"""
数据摄取模块 - 使用AKShare获取外部数据
遵循PRD v1.1第3章节：仅用于数据摄取，不允许UI或业务层直接访问
"""
import akshare as ak
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Tuple
from database import (
    upsert_instrument,
    upsert_timeseries,
    update_sync_state,
    get_sync_state
)


class DataFetcher:
    """AKShare数据抓取器"""

    def __init__(self):
        self.source = "akshare"
        self.source_version = "v1"

    def fetch_fund_info(self, code: str) -> Optional[Dict]:
        """
        获取基金基本信息
        
        Args:
            code: 基金代码
            
        Returns:
            基金信息字典，失败返回None
        """
        try:
            # 使用 akshare 获取基金基本信息
            df = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
            if df is None or len(df) == 0:
                # 尝试用另一个接口获取名称（如果之前那个不行）
                try:
                    all_funds = ak.fund_name_em()
                    fund_row = all_funds[all_funds['基金代码'] == code]
                    if not fund_row.empty:
                        return {
                            "code": code,
                            "name": fund_row.iloc[0]['基金简称'],
                            "type": fund_row.iloc[0]['基金类型']
                        }
                except:
                    pass
                return None
            
            # 这里API其实只返回净值，不返回名称，需要用 fund_name_em 获取名称
            # 为了效率，我们先尝试直接从全量列表中查
            try:
                all_funds = ak.fund_name_em()
                fund_row = all_funds[all_funds['基金代码'] == code]
                if not fund_row.empty:
                    return {
                        "code": code,
                        "name": fund_row.iloc[0]['基金简称'],
                        "type": fund_row.iloc[0]['基金类型']
                    }
            except:
                pass
                
            return {
                "code": code,
                "name": f"基金{code}",
                "type": "fund"
            }
            
        except Exception as e:
            print(f"Error fetching fund info for {code}: {e}")
            return None

    def get_fund_info(self, code: str) -> Optional[Dict]:
        """get_fund_info 是 fetch_fund_info 的别名，用于兼容性"""
        return self.fetch_fund_info(code)

    def fetch_fund_history(
        self,
        code: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> pd.DataFrame:
        """
        获取基金历史复权净值数据
        复权净值 = 考虑分红再投资后的真实净值

        Args:
            code: 基金代码
            start_date: 开始日期 (YYYY-MM-DD)
            end_date: 结束日期 (YYYY-MM-DD)

        Returns:
            DataFrame with columns: date, value (复权净值)
        """
        try:
            # 1. 获取单位净值走势
            nav_df = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")

            if nav_df is None or nav_df.empty:
                print(f"No history data for fund {code}")
                return pd.DataFrame(columns=["date", "value"])

            # 转换日期格式
            nav_df['净值日期'] = pd.to_datetime(nav_df['净值日期'])
            nav_df = nav_df.sort_values('净值日期').reset_index(drop=True)

            # 2. 获取分红送配详情
            try:
                div_df = ak.fund_open_fund_info_em(symbol=code, indicator="分红送配详情")
                has_dividends = div_df is not None and not div_df.empty
            except Exception:
                has_dividends = False
                div_df = None

            # 3. 计算复权净值 (前复权)
            if has_dividends:
                # 解析分红金额
                import re
                def parse_dividend(text):
                    match = re.search(r'([0-9.]+)元', str(text))
                    return float(match.group(1)) if match else 0

                # 解析分红日期和金额
                dividends = []
                for _, row in div_df.iterrows():
                    try:
                        div_date = pd.to_datetime(row['权益登记日'])
                        div_amount = parse_dividend(row['每份分红'])
                        if div_amount > 0:
                            dividends.append({'date': div_date, 'amount': div_amount})
                    except Exception:
                        continue

                # 按日期排序
                dividends = sorted(dividends, key=lambda x: x['date'])

                # 计算复权因子 (从最早到最新累积)
                nav_df['adj_factor'] = 1.0

                for div in dividends:
                    div_date = div['date']
                    div_amount = div['amount']

                    # 找到分红日当天或之前的净值
                    mask = nav_df['净值日期'] <= div_date
                    if mask.any():
                        # 获取分红日的净值
                        div_nav = nav_df.loc[mask, '单位净值'].iloc[-1]
                        if div_nav > 0:
                            # 分红再投资获得的额外份额比例
                            extra_ratio = div_amount / div_nav
                            # 分红日之后的数据需要乘以 (1 + extra_ratio)
                            after_mask = nav_df['净值日期'] > div_date
                            nav_df.loc[after_mask, 'adj_factor'] *= (1 + extra_ratio)

                # 复权净值 = 单位净值 * 复权因子
                nav_df['value'] = nav_df['单位净值'] * nav_df['adj_factor']
            else:
                # 没有分红，直接使用单位净值
                nav_df['value'] = nav_df['单位净值']

            # 4. 格式化输出
            nav_df['date'] = nav_df['净值日期'].dt.strftime('%Y-%m-%d')

            # 过滤日期范围
            if start_date:
                nav_df = nav_df[nav_df['date'] >= start_date]
            if end_date:
                nav_df = nav_df[nav_df['date'] <= end_date]

            # 只保留需要的列
            result = nav_df[['date', 'value']].copy()
            result = result.dropna(subset=['value'])

            return result

        except Exception as e:
            print(f"Error fetching fund history for {code}: {e}")
            import traceback
            traceback.print_exc()
            return pd.DataFrame(columns=["date", "value"])

    def fetch_index_info(self, code: str) -> Optional[Dict]:
        """
        获取指数基本信息

        Args:
            code: 指数代码 (如 '000300' 代表沪深300)

        Returns:
            指数信息字典，失败返回None
        """
        # 常见指数映射
        index_names = {
            "000300": "沪深300",
            "000905": "中证500",
            "000016": "上证50",
            "399006": "创业板指",
            "000852": "中证1000"
        }

        name = index_names.get(code, f"指数{code}")

        try:
            upsert_instrument(
                code=code,
                name=name,
                instrument_type="index",
                source=self.source
            )

            return {
                "code": code,
                "name": name,
                "type": "index"
            }
        except Exception as e:
            print(f"Error setting up index {code}: {e}")
            return None

    def fetch_index_history(
        self,
        code: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> pd.DataFrame:
        """
        获取指数历史行情数据

        Args:
            code: 指数代码
            start_date: 开始日期
            end_date: 结束日期

        Returns:
            DataFrame with columns: date, value
        """
        try:
            # 使用akshare获取指数历史数据
            index_history = ak.stock_zh_index_daily(
                symbol=f"sh{code}" if code.startswith("0") else f"sz{code}"
            )

            if index_history is None or index_history.empty:
                # 尝试另一种方式
                index_history = ak.index_zh_a_hist(
                    symbol=code,
                    period="daily"
                )

            if index_history is None or index_history.empty:
                print(f"No history data for index {code}")
                return pd.DataFrame(columns=["date", "value"])

            # 处理列名
            if '收盘' in index_history.columns:
                index_history = index_history.rename(columns={
                    '日期': 'date',
                    '收盘': 'value'
                })
            elif 'close' in index_history.columns:
                index_history = index_history.rename(columns={
                    'date': 'date',
                    'close': 'value'
                })
            else:
                print(f"Unexpected columns for index {code}: {index_history.columns.tolist()}")
                return pd.DataFrame(columns=["date", "value"])

            # 转换日期格式
            index_history['date'] = pd.to_datetime(index_history['date']).dt.strftime('%Y-%m-%d')

            # 过滤日期范围
            if start_date:
                index_history = index_history[index_history['date'] >= start_date]
            if end_date:
                index_history = index_history[index_history['date'] <= end_date]

            # 只保留需要的列
            result = index_history[['date', 'value']].copy()
            result = result.dropna(subset=['value'])

            return result

        except Exception as e:
            print(f"Error fetching index history for {code}: {e}")
            return pd.DataFrame(columns=["date", "value"])

    def sync_to_database(
        self,
        code: str,
        instrument_type: str = "fund",
        days_back: int = 365 * 3  # 默认拉取3年数据
    ) -> Tuple[bool, str]:
        """
        同步数据到本地数据库

        Args:
            code: 基金/指数代码
            instrument_type: 类型 ('fund', 'index')
            days_back: 向前拉取天数

        Returns:
            (成功状态, 消息)
        """
        try:
            # 1. 获取基本信息
            if instrument_type == "fund":
                info = self.fetch_fund_info(code)
                history_df = self.fetch_fund_history(code)
            elif instrument_type == "index":
                info = self.fetch_index_info(code)
                history_df = self.fetch_index_history(code)
            else:
                return False, f"Unsupported type: {instrument_type}"

            if not info:
                return False, f"Failed to fetch info for {code}"

            if history_df.empty:
                return False, f"No history data for {code}"

            # 2. 批量写入时间序列数据
            success_count = 0
            last_date = None

            for _, row in history_df.iterrows():
                try:
                    upsert_timeseries(
                        code=code,
                        date=row['date'],
                        value=float(row['value']),
                        source_version=self.source_version
                    )
                    success_count += 1
                    last_date = row['date']
                except Exception as e:
                    print(f"Error inserting {code} on {row['date']}: {e}")
                    continue

            # 3. 更新同步状态
            update_sync_state(
                code=code,
                last_success_date=last_date,
                status="success",
                message=f"Synced {success_count} records"
            )

            return True, f"Successfully synced {success_count} records for {code}"

        except Exception as e:
            error_msg = f"Sync failed for {code}: {str(e)}"
            update_sync_state(code=code, status="failed", message=error_msg)
            return False, error_msg

    def incremental_sync(
        self,
        code: str,
        instrument_type: str = "fund"
    ) -> Tuple[bool, str]:
        """
        增量同步：只拉取自上次同步后的新数据

        Args:
            code: 基金/指数代码
            instrument_type: 类型

        Returns:
            (成功状态, 消息)
        """
        # 获取上次同步状态
        sync_state = get_sync_state(code)

        if sync_state and sync_state.get("last_success_date"):
            # 从上次同步的下一天开始
            last_date = datetime.strptime(sync_state["last_success_date"], "%Y-%m-%d")
            start_date = (last_date + timedelta(days=1)).strftime("%Y-%m-%d")
        else:
            # 首次同步，拉取3年数据
            start_date = (datetime.now() - timedelta(days=365 * 3)).strftime("%Y-%m-%d")

        end_date = datetime.now().strftime("%Y-%m-%d")

        # 重新实现增量同步逻辑
        try:
            if instrument_type == "fund":
                history_df = self.fetch_fund_history(code, start_date, end_date)
            elif instrument_type == "index":
                history_df = self.fetch_index_history(code, start_date, end_date)
            else:
                return False, f"Unsupported type: {instrument_type}"

            if history_df.empty:
                return True, "No new data to sync"

            # 批量写入
            success_count = 0
            last_date = None

            for _, row in history_df.iterrows():
                try:
                    upsert_timeseries(
                        code=code,
                        date=row['date'],
                        value=float(row['value']),
                        source_version=self.source_version
                    )
                    success_count += 1
                    last_date = row['date']
                except Exception as e:
                    print(f"Error inserting {code} on {row['date']}: {e}")
                    continue

            # 更新同步状态
            update_sync_state(
                code=code,
                last_success_date=last_date,
                status="success",
                message=f"Incremental sync: {success_count} new records"
            )

            return True, f"Incremental sync: {success_count} new records"

        except Exception as e:
            error_msg = f"Incremental sync failed for {code}: {str(e)}"
            update_sync_state(code=code, status="failed", message=error_msg)
            return False, error_msg


if __name__ == "__main__":
    # 测试代码
    from backend.database import init_database

    init_database()

    fetcher = DataFetcher()

    # 测试获取基金数据
    print("Testing fund data fetch...")
    success, msg = fetcher.sync_to_database("000001", "fund")
    print(f"Fund sync result: {success}, {msg}")

    # 测试获取指数数据
    print("\nTesting index data fetch...")
    success, msg = fetcher.sync_to_database("000300", "index")
    print(f"Index sync result: {success}, {msg}")
