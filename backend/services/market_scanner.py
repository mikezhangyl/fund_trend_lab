import akshare as ak
import numpy as np
from datetime import datetime, timedelta
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import List, Dict, Optional
import asyncio


# ---- Top-level functions for ProcessPoolExecutor pickling ----

def _get_fund_data(code: str, days: int = 90) -> List[Dict]:
    """获取基金净值数据 (独立函数)"""
    try:
        # 获取足够长的时间范围，确保能覆盖所需的月份
        # 加上30天缓冲，确保能找到起始点
        fetch_days = days + 30

        # 为了提高效率和减少 akshare 错误，我们可以限制获取的最大数据量
        # 但是 akshare 的接口通常返回所有数据或者最近一年，具体取决于接口实现
        # 这里indicator="单位净值走势"通常返回所有历史数据，我们只截取需要的

        df = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
        if df is None or len(df) == 0:
            return []

        # 转换为列表格式
        data = []
        for _, row in df.iterrows():
            date_str = str(row['净值日期'])
            if '-' not in date_str:
                date_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
            data.append({
                'date': date_str,
                'value': float(row['单位净值'])
            })

        # 只取需要的最近N天数据
        end_date = datetime.now()
        start_date = end_date - timedelta(days=fetch_days)
        start_str = start_date.strftime('%Y-%m-%d')

        return [d for d in data if d['date'] >= start_str]
    except Exception as e:
        return []

def _calculate_monthly_growth(data: List[Dict], months: int) -> Optional[Dict]:
    """计算平均月增长率 (独立函数)"""
    if not data or len(data) < 2:
        return None

    # 按日期排序
    sorted_data = sorted(data, key=lambda x: x['date'])
    end_point = sorted_data[-1]

    # 目标起始日期 = 结束日期 - 月数*30天
    end_date = datetime.strptime(end_point['date'], '%Y-%m-%d')
    target_start_date = end_date - timedelta(days=months * 30)
    target_start_str = target_start_date.strftime('%Y-%m-%d')

    # 寻找最接近目标起始日期的点（且必须在目标日期之后或当天）
    start_point = None
    for item in sorted_data:
        if item['date'] >= target_start_str:
            start_point = item
            break

    if not start_point:
        return None

    # 检查找到的起始点是否偏离太远（例如，如果数据缺失，可能找到的起始点是最近几天的）
    # 如果找到的起始点比目标日期晚了超过15天，说明这段时间缺数据或者基金成立时间不足
    actual_start_date = datetime.strptime(start_point['date'], '%Y-%m-%d')
    if (actual_start_date - target_start_date).days > 20:
        return None

    start_value = start_point['value']
    end_value = end_point['value']

    if start_value <= 0:
        return None

    total_growth = ((end_value - start_value) / start_value) * 100
    avg_monthly_growth = total_growth / months

    return {
        'total_growth': round(total_growth, 2),
        'avg_monthly_growth': round(avg_monthly_growth, 2),
        'current_value': round(end_value, 4),
        'start_value': round(start_value, 4),
        'start_date': start_point['date'],
        'end_date': end_point['date']
    }

def _scan_single_fund(code: str, name: str, months: int, min_growth: float) -> Optional[Dict]:
    """扫描单个基金 (独立函数)"""
    try:
        # 获取数据
        days = months * 30 + 10  # 多取一些数据
        data = _get_fund_data(code, days)

        if not data:
            return None

        # 计算增长率
        growth_data = _calculate_monthly_growth(data, months)

        if not growth_data:
            return None

        # 筛选符合条件的
        if growth_data['avg_monthly_growth'] >= min_growth:
            return {
                'code': code,
                'name': name,
                'months': months,
                **growth_data
            }

        return None
    except Exception as e:
        return None


class MarketScanner:
    """全市场基金扫描器"""

    def __init__(self):
        self.is_scanning = False
        self.progress = 0
        self.total = 0
        self.results = []
        self.scan_params = {}
        self.workers = 5  # 并发数
        self.logs = []    # 实时日志

    def _log(self, message: str):
        """添加日志"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        log_entry = f"[{timestamp}] {message}"
        print(log_entry)
        self.logs.append(log_entry)
        if len(self.logs) > 100:
            self.logs = self.logs[-100:]

    def scan_market(
        self,
        months: int = 3,
        min_growth: float = 20.0,
        fund_types: List[str] = None
    ):
        """
        扫描全市场基金
        """
        if self.is_scanning:
            return

        try:
            self.is_scanning = True
            self.progress = 0
            self.results = []
            self.logs = []  # 清空日志
            self.scan_params = {
                'months': months,
                'min_growth': min_growth,
                'started_at': datetime.now().isoformat()
            }

            # 获取所有基金列表
            self._log(f"正在获取基金列表...")
            df = ak.fund_name_em()

            # 筛选基金类型
            if fund_types is None:
                fund_types = ['股票型', '混合型', '股票指数', '联接基金']

            self._log(f"正在根据类型筛选基金: {','.join(fund_types)}")
            df_filtered = df[df['基金类型'].str.contains('|'.join(fund_types), na=False)]
            funds = [(row['基金代码'], row['基金简称']) for _, row in df_filtered.iterrows()]

            self.total = len(funds)
            self._log(f"共 {self.total} 只基金待扫描，并发数: {self.workers} (进程模式)")

            # 并发扫描
            matching_funds = []

            # 使用 ProcessPoolExecutor 进行多进程扫描，避免 akshare/mini_racer 线程冲突 crash
            with ProcessPoolExecutor(max_workers=self.workers) as executor:
                futures = {
                    executor.submit(_scan_single_fund, code, name, months, min_growth): (code, name)
                    for code, name in funds
                }

                check_interval = 50

                for i, future in enumerate(as_completed(futures)):
                    try:
                        self.progress += 1
                        result = future.result()
                        if result:
                            matching_funds.append(result)
                            self._log(f"✅ 发现: {result['code']} {result['name']} (+{result['avg_monthly_growth']:.1f}%/月)")

                        # 进度日志
                        if (i + 1) % check_interval == 0:
                            pct = (i + 1) * 100 // self.total
                            self._log(f"扫描进度: {i + 1}/{self.total} ({pct}%)")

                    except Exception as e:
                        pass

            # 按平均月增长率排序
            matching_funds.sort(key=lambda x: x['avg_monthly_growth'], reverse=True)

            self.results = matching_funds
            self.scan_params['completed_at'] = datetime.now().isoformat()
            self.scan_params['count'] = len(matching_funds)

            self._log(f"扫描完成! 发现 {len(matching_funds)} 只符合条件的基金")

        except Exception as e:
            self._log(f"❌ 扫描失败: {e}")
            self.scan_params['error'] = str(e)
        finally:
            self.is_scanning = False

    def get_status(self) -> Dict:
        """获取扫描状态"""
        percentage = 0
        if self.total > 0:
            percentage = round(self.progress / self.total * 100, 1)

        return {
            'is_scanning': self.is_scanning,
            'progress': self.progress,
            'total': self.total,
            'percentage': percentage,
            'params': self.scan_params,
            'logs': self.logs[-50:]
        }

    def get_results(self) -> Dict:
        """获取扫描结果"""
        return {
            'results': self.results,
            'count': len(self.results),
            'params': self.scan_params
        }

    def clear_results(self):
        """清除扫描结果"""
        if not self.is_scanning:
            self.results = []
            self.progress = 0
            self.total = 0
            self.logs = []
            self.scan_params = {}


# 全局扫描器实例
market_scanner = MarketScanner()
