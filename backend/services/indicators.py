"""
技术指标计算服务
用于计算基金的相对强度、动量、波动率等指标，帮助识别潜在急涨信号
"""
import pandas as pd
import numpy as np
from typing import Dict, Optional, List
from database import get_timeseries


class IndicatorService:
    """技术指标计算服务"""

    def __init__(self):
        self.index_code = '000300'  # 使用沪深300作为基准指数

    def calculate_indicators(self, fund_code: str, days: int = 20) -> Dict:
        """
        计算基金的技术指标

        Args:
            fund_code: 基金代码
            days: 计算周期 (默认20天，约1个月交易日)

        Returns:
            包含 RS、动量、波动率等指标的字典
        """
        # 1. 获取数据
        fund_data = get_timeseries(fund_code)
        index_data = get_timeseries(self.index_code)

        if not fund_data or len(fund_data) < days + 1:
            return self._empty_result("数据不足")

        # 转换为 DataFrame 并取最近 N+1 天
        fund_df = pd.DataFrame(fund_data)
        fund_df['value'] = pd.to_numeric(fund_df['value'])
        fund_df = fund_df.tail(days + 1).reset_index(drop=True)

        # 2. 计算动量 (Momentum)
        current_price = fund_df.iloc[-1]['value']
        start_price = fund_df.iloc[0]['value']
        momentum = ((current_price - start_price) / start_price) * 100

        # 3. 计算相对强度 (Relative Strength)
        index_return = 0
        if index_data and len(index_data) >= days + 1:
            idx_df = pd.DataFrame(index_data)
            idx_df['value'] = pd.to_numeric(idx_df['value'])
            idx_df = idx_df.tail(days + 1).reset_index(drop=True)

            idx_current = idx_df.iloc[-1]['value']
            idx_start = idx_df.iloc[0]['value']
            index_return = ((idx_current - idx_start) / idx_start) * 100

        rs_value = momentum - index_return

        # 4. 计算波动率 (Volatility)
        fund_df['daily_return'] = fund_df['value'].pct_change()
        volatility = fund_df['daily_return'].std() * 100

        # 5. 计算波动率压缩比 (与前一个周期对比)
        if len(fund_data) >= (days + 1) * 2:
            prev_df = pd.DataFrame(fund_data)
            prev_df['value'] = pd.to_numeric(prev_df['value'])
            prev_df = prev_df.tail((days + 1) * 2).head(days + 1).reset_index(drop=True)
            prev_df['daily_return'] = prev_df['value'].pct_change()
            prev_volatility = prev_df['daily_return'].std() * 100

            if prev_volatility > 0:
                vol_ratio = volatility / prev_volatility
            else:
                vol_ratio = 1.0
        else:
            vol_ratio = 1.0

        # 6. 生成分析和评分
        analysis = []
        score = 0

        # RS 信号
        if rs_value > 5:
            analysis.append("强势跑赢")
            score += 2
        elif rs_value > 0:
            analysis.append("略微跑赢")
            score += 1
        else:
            analysis.append("跑输大盘")

        # 动量信号
        if momentum > 10:
            analysis.append("上涨动能强")
            score += 2
        elif momentum > 0:
            analysis.append("趋势向上")
            score += 1
        elif momentum < -5:
            analysis.append("下跌趋势")

        # 波动率压缩信号
        if vol_ratio < 0.6:
            analysis.append("波动压缩(蓄势)")
            score += 2
        elif vol_ratio < 0.8:
            analysis.append("波动收窄")
            score += 1

        # 综合判断
        if score >= 4:
            warning_level = "HIGH"
        elif score >= 2:
            warning_level = "MEDIUM"
        else:
            warning_level = "LOW"

        return {
            "fund_code": fund_code,
            "period_days": days,
            "momentum": round(momentum, 2),
            "relative_strength": round(rs_value, 2),
            "index_return": round(index_return, 2),
            "volatility": round(volatility, 3),
            "vol_ratio": round(vol_ratio, 2),
            "analysis": analysis,
            "warning_level": warning_level,
            "score": score
        }

    def calculate_rolling_volatility_ratio(
        self,
        fund_code: str,
        window: int = 5,
        max_days: Optional[int] = None
    ) -> List[Dict]:
        """
        计算滚动波动率压缩比

        使用滑动窗口计算每个时间点的波动率压缩比：
        - 近期窗口: 最近N天的波动率
        - 前期窗口: 再往前N天的波动率
        - vol_ratio = 近期波动率 / 前期波动率

        Args:
            fund_code: 基金代码
            window: 滚动窗口大小（默认5天）
            max_days: 最多返回多少天的数据（None表示全部）

        Returns:
            包含日期和vol_ratio的列表 [{"date": "2024-01-15", "vol_ratio": 0.75, ...}, ...]
        """
        # 1. 获取完整时间序列数据
        fund_data = get_timeseries(fund_code)

        if not fund_data or len(fund_data) < window * 2:
            return []

        # 2. 转换为 DataFrame
        df = pd.DataFrame(fund_data)
        df['value'] = pd.to_numeric(df['value'])

        # 按日期排序（确保时间顺序正确）
        df = df.sort_values('date').reset_index(drop=True)

        # 3. 计算每日收益率
        df['daily_return'] = df['value'].pct_change()

        # 4. 滚动计算波动率比率
        results = []

        # 从第2*window天开始（需要足够的历史数据）
        for i in range(window * 2, len(df)):
            # 近期窗口: [i-window+1, i]
            recent_returns = df['daily_return'].iloc[i-window+1:i+1]
            recent_vol = recent_returns.std()

            # 前期窗口: [i-2*window+1, i-window]
            prev_returns = df['daily_return'].iloc[i-2*window+1:i-window+1]
            prev_vol = prev_returns.std()

            # 计算比率
            if prev_vol > 0 and not np.isnan(recent_vol) and not np.isnan(prev_vol):
                vol_ratio = recent_vol / prev_vol
            else:
                vol_ratio = 1.0

            results.append({
                'date': df.iloc[i]['date'],
                'vol_ratio': round(vol_ratio, 3),
                'recent_vol': round(recent_vol * 100, 3) if not np.isnan(recent_vol) else 0,
                'prev_vol': round(prev_vol * 100, 3) if not np.isnan(prev_vol) else 0
            })

        # 5. 如果指定了max_days，只返回最近的数据
        if max_days and len(results) > max_days:
            results = results[-max_days:]

        return results

    def calculate_monthly_growth_rate(
        self,
        fund_code: str,
        months: int = 3
    ) -> Optional[Dict]:
        """
        计算基金的平均月增长率

        Args:
            fund_code: 基金代码
            months: 时间窗口（月数）

        Returns:
            包含总增长率和平均月增长率的字典，失败返回None
        """
        # 1. 计算需要的天数（每月约30天）
        days_needed = months * 30

        # 2. 获取时间序列数据
        fund_data = get_timeseries(fund_code)

        if not fund_data or len(fund_data) < days_needed:
            return None

        # 3. 转换为 DataFrame 并取最近的数据
        df = pd.DataFrame(fund_data)
        df['value'] = pd.to_numeric(df['value'])
        df = df.sort_values('date').tail(days_needed + 1).reset_index(drop=True)

        # 4. 计算增长率
        start_value = df.iloc[0]['value']
        end_value = df.iloc[-1]['value']

        if start_value <= 0:
            return None

        total_growth = ((end_value - start_value) / start_value) * 100
        avg_monthly_growth = total_growth / months

        return {
            'total_growth': round(total_growth, 2),
            'avg_monthly_growth': round(avg_monthly_growth, 2),
            'current_value': round(end_value, 4),
            'start_value': round(start_value, 4),
            'months': months
        }

    def _empty_result(self, reason: str) -> Dict:
        return {
            "fund_code": "",
            "period_days": 0,
            "momentum": 0,
            "relative_strength": 0,
            "index_return": 0,
            "volatility": 0,
            "vol_ratio": 1,
            "analysis": [reason],
            "warning_level": "NONE",
            "score": 0
        }


# 单例
indicator_service = IndicatorService()
