#!/usr/bin/env python3
"""
筛选特定条件的基金并添加到数据库
条件: 持续5-10天，斜率1-2%/天
"""
import sys
sys.path.insert(0, '.')

import akshare as ak
import numpy as np
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import json

# 筛选条件
MIN_DURATION = 5
MAX_DURATION = 10
MIN_SLOPE = 1.0
MAX_SLOPE = 2.0
MAX_DRAWDOWN = 5.0
MIN_GAIN = 5.0
RECENT_DAYS = 60
WORKERS = 15

def get_fund_data(code: str, days: int = 365) -> list:
    """获取基金净值数据"""
    try:
        df = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
        if df is None or len(df) == 0:
            return []
        
        data = []
        for _, row in df.iterrows():
            date_str = str(row['净值日期'])
            if '-' not in date_str:
                date_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
            data.append({
                'date': date_str,
                'value': float(row['单位净值'])
            })
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        start_str = start_date.strftime('%Y-%m-%d')
        
        return [d for d in data if d['date'] >= start_str]
    except:
        return []

def detect_uptrend(prices: list, dates: list):
    """检测上涨阶段"""
    if len(prices) < MIN_DURATION:
        return []
    
    prices = np.array(prices)
    phases = []
    i = 0
    
    while i < len(prices) - 1:
        if prices[i+1] <= prices[i]:
            i += 1
            continue
        
        phase_start = i
        phase_start_price = prices[i]
        running_peak = prices[i]
        running_peak_idx = i
        
        j = i + 1
        while j < len(prices):
            current_price = prices[j]
            if current_price > running_peak:
                running_peak = current_price
                running_peak_idx = j
            
            drawdown = (running_peak - current_price) / running_peak * 100
            if drawdown > MAX_DRAWDOWN:
                break
            j += 1
        
        phase_end = running_peak_idx
        
        if phase_end > phase_start:
            total_gain = (prices[phase_end] - phase_start_price) / phase_start_price * 100
            duration = phase_end - phase_start
            
            if total_gain >= MIN_GAIN and duration >= MIN_DURATION:
                mid = (phase_end - phase_start) // 2
                prices_second = prices[phase_start+mid:phase_end+1]
                
                slope_second = 0.0
                if len(prices_second) > 1:
                    x2 = np.arange(len(prices_second))
                    y2 = (prices_second - prices_second[0]) / prices_second[0] * 100
                    slope_second = float(np.polyfit(x2, y2, 1)[0])
                
                phases.append({
                    'start_date': dates[phase_start],
                    'end_date': dates[phase_end],
                    'duration': int(duration),
                    'total_gain': float(round(total_gain, 2)),
                    'slope_second': float(round(slope_second, 3))
                })
        
        i = max(j, phase_end + 1)
    
    return phases

def scan_fund(code: str, name: str) -> dict | None:
    """扫描单个基金"""
    try:
        data = get_fund_data(code, RECENT_DAYS)
        if len(data) < MIN_DURATION:
            return None
        
        prices = [d['value'] for d in data]
        dates = [d['date'] for d in data]
        
        phases = detect_uptrend(prices, dates)
        if not phases:
            return None
        
        latest = max(phases, key=lambda p: p['end_date'])
        
        # 筛选: 结束在2025-12-01后, 持续5-10天, 斜率1-2%
        if (latest['end_date'] >= '2025-12-01' and 
            MIN_DURATION <= latest['duration'] <= MAX_DURATION and
            MIN_SLOPE <= latest['slope_second'] <= MAX_SLOPE):
            return {
                'code': code,
                'name': name,
                **latest
            }
        return None
    except:
        return None

def main():
    print("=" * 70)
    print("筛选特定条件基金: 持续5-10天, 斜率1-2%/天")
    print("=" * 70)
    
    print("\n正在获取基金列表...")
    df = ak.fund_name_em()
    stock_types = ['股票型', '混合型', '股票指数', '联接基金']
    df_filtered = df[df['基金类型'].str.contains('|'.join(stock_types), na=False)]
    funds = [(row['基金代码'], row['基金简称']) for _, row in df_filtered.iterrows()]
    print(f"共 {len(funds)} 只基金待扫描")
    
    print("\n开始扫描...")
    selected = []
    scanned = 0
    
    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = {executor.submit(scan_fund, code, name): (code, name) for code, name in funds}
        
        for future in as_completed(futures):
            scanned += 1
            if scanned % 500 == 0:
                print(f"进度: {scanned}/{len(funds)} ({scanned*100//len(funds)}%), 已发现 {len(selected)} 只")
            
            try:
                result = future.result()
                if result:
                    selected.append(result)
            except:
                pass
    
    selected.sort(key=lambda x: x['slope_second'], reverse=True)
    
    print(f"\n发现 {len(selected)} 只符合条件的基金")
    print("-" * 70)
    for i, f in enumerate(selected, 1):
        print(f"{i:2}. {f['code']} {f['name'][:25]:<25} | {f['duration']}天 | +{f['total_gain']:>5.1f}% | {f['slope_second']:.2f}%/天")
    
    # 保存结果
    output = {
        'scan_time': datetime.now().isoformat(),
        'criteria': {
            'duration': f'{MIN_DURATION}-{MAX_DURATION}天',
            'slope': f'{MIN_SLOPE}-{MAX_SLOPE}%/天'
        },
        'funds': selected
    }
    
    with open('../docs/selected_funds.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n结果已保存到: docs/selected_funds.json")
    
    # 输出基金代码列表用于添加到数据库
    codes = [f['code'] for f in selected]
    print(f"\n基金代码列表 (共{len(codes)}只):")
    print(codes)
    
    return selected

if __name__ == '__main__':
    main()
