
# 验证脚本：检查数据长度问题

import akshare as ak
from datetime import datetime, timedelta

def check_data_length():
    code = "000001" # 华夏成长
    months = 3
    days_fetch = months * 30 + 10

    print(f"Fetching {days_fetch} days of data...")

    try:
        df = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
        data = []
        for _, row in df.iterrows():
            date_str = str(row['净值日期'])
            if '-' not in date_str:
                date_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
            data.append({
                'date': date_str,
                'value': float(row['单位净值'])
            })

        # 模拟 _get_fund_data 的筛选
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_fetch)
        start_str = start_date.strftime('%Y-%m-%d')
        filtered_data = [d for d in data if d['date'] >= start_str]

        print(f"Time range: {start_str} to {end_date.strftime('%Y-%m-%d')}")
        print(f"Actual data points (trading days): {len(filtered_data)}")

        # 模拟新的 _calculate_monthly_growth 逻辑
        if not filtered_data or len(filtered_data) < 2:
            print("❌ FAIL: Data too short")
            return

        sorted_data = sorted(filtered_data, key=lambda x: x['date'])
        end_point = sorted_data[-1]
        target_start_date = datetime.strptime(end_point['date'], '%Y-%m-%d') - timedelta(days=months * 30)
        target_start_str = target_start_date.strftime('%Y-%m-%d')

        start_point = None
        for item in sorted_data:
            if item['date'] >= target_start_str:
                start_point = item
                break

        if not start_point:
             print("❌ FAIL: Cannot find start point")
             return

        actual_start_date = datetime.strptime(start_point['date'], '%Y-%m-%d')
        diff_days = (actual_start_date - target_start_date).days
        print(f"Target start: {target_start_str}, Actual start: {start_point['date']} (Diff: {diff_days} days)")

        if diff_days > 20:
            print(f"❌ FAIL: Start point too far ({diff_days} > 20 days)")
        else:
            print(f"✅ PASS: Valid start point found. Growth: {((end_point['value'] - start_point['value'])/start_point['value']*100):.2f}%")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_data_length()
