#!/usr/bin/env python3
"""
全市场公募基金扫描器
扫描所有公募基金，找出快速上涨的基金（斜率 > 1%/天）
"""
import sys
sys.path.insert(0, '.')

import akshare as ak
import numpy as np
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import json

# 配置参数
MAX_DRAWDOWN = 5.0    # 最大回撤容忍度
MIN_GAIN = 5.0        # 最小涨幅
MIN_DURATION = 5      # 最小持续天数
MIN_SLOPE = 1.0       # 最小斜率 %/天
RECENT_DAYS = 60      # 只看最近60天的数据
WORKERS = 10          # 并发数

def get_fund_data(code: str, days: int = 365) -> list:
    """获取基金净值数据"""
    try:
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
        
        # 只取最近N天
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        start_str = start_date.strftime('%Y-%m-%d')
        
        return [d for d in data if d['date'] >= start_str]
    except Exception as e:
        return []

def detect_uptrend(prices: list, dates: list, max_dd: float = 5.0, min_gain: float = 5.0, min_dur: int = 5):
    """检测上涨阶段"""
    if len(prices) < min_dur:
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
            if drawdown > max_dd:
                break
            j += 1
        
        phase_end = running_peak_idx
        
        if phase_end > phase_start:
            total_gain = (prices[phase_end] - phase_start_price) / phase_start_price * 100
            duration = phase_end - phase_start
            
            if total_gain >= min_gain and duration >= min_dur:
                # 计算斜率
                mid = (phase_end - phase_start) // 2
                prices_first = prices[phase_start:phase_start+mid+1]
                prices_second = prices[phase_start+mid:phase_end+1]
                
                slope_first = 0.0
                slope_second = 0.0
                
                if len(prices_first) > 1:
                    x1 = np.arange(len(prices_first))
                    y1 = (prices_first - prices_first[0]) / prices_first[0] * 100
                    slope_first = np.polyfit(x1, y1, 1)[0]
                
                if len(prices_second) > 1:
                    x2 = np.arange(len(prices_second))
                    y2 = (prices_second - prices_second[0]) / prices_second[0] * 100
                    slope_second = np.polyfit(x2, y2, 1)[0]
                
                phases.append({
                    'start_date': dates[phase_start],
                    'end_date': dates[phase_end],
                    'duration': duration,
                    'total_gain': round(total_gain, 2),
                    'slope_first': round(slope_first, 3),
                    'slope_second': round(slope_second, 3),
                    'is_accelerating': bool(slope_second > slope_first * 1.3)
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
        
        phases = detect_uptrend(prices, dates, MAX_DRAWDOWN, MIN_GAIN, MIN_DURATION)
        
        if not phases:
            return None
        
        # 找最近的阶段
        latest = max(phases, key=lambda p: p['end_date'])
        
        # 检查是否是最近的且斜率>1%
        if latest['end_date'] >= '2025-12-01' and latest['slope_second'] > MIN_SLOPE:
            return {
                'code': code,
                'name': name,
                **latest
            }
        return None
    except Exception as e:
        return None

def main():
    print("=" * 80)
    print("全市场公募基金扫描器")
    print(f"参数: 回撤容忍={MAX_DRAWDOWN}%, 最小涨幅={MIN_GAIN}%, 最小持续={MIN_DURATION}天, 最小斜率={MIN_SLOPE}%/天")
    print("=" * 80)
    
    # 获取所有基金列表
    print("\n正在获取基金列表...")
    df = ak.fund_name_em()
    
    # 只看股票型、混合型、指数型基金
    stock_types = ['股票型', '混合型', '股票指数', '联接基金']
    df_filtered = df[df['基金类型'].str.contains('|'.join(stock_types), na=False)]
    
    funds = [(row['基金代码'], row['基金简称']) for _, row in df_filtered.iterrows()]
    print(f"共 {len(funds)} 只权益类基金待扫描")
    
    # 并发扫描
    print("\n开始扫描...")
    fast_rising = []
    scanned = 0
    errors = 0
    
    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = {executor.submit(scan_fund, code, name): (code, name) for code, name in funds}
        
        for future in as_completed(futures):
            scanned += 1
            if scanned % 100 == 0:
                print(f"进度: {scanned}/{len(funds)} ({scanned*100//len(funds)}%), 已发现 {len(fast_rising)} 只")
            
            try:
                result = future.result()
                if result:
                    fast_rising.append(result)
                    print(f"  ✓ {result['code']} {result['name'][:20]} | +{result['total_gain']:.1f}% | {result['slope_second']:.2f}%/天")
            except Exception as e:
                errors += 1
    
    # 按斜率排序
    fast_rising.sort(key=lambda x: x['slope_second'], reverse=True)
    
    # 输出结果
    print("\n" + "=" * 80)
    print(f"扫描完成! 共扫描 {scanned} 只基金, 错误 {errors} 个")
    print(f"发现 {len(fast_rising)} 只快速上涨基金 (斜率 > {MIN_SLOPE}%/天)")
    print("=" * 80)
    
    # 输出Top 50
    print("\nTop 50 快速上涨基金:")
    print("-" * 80)
    for i, f in enumerate(fast_rising[:50], 1):
        acc = '🚀' if f['is_accelerating'] else ''
        print(f"{i:2}. {f['code']} {f['name'][:25]:<25} | {f['start_date']} -> {f['end_date']} | +{f['total_gain']:>5.1f}% | {f['slope_second']:.2f}%/天 {acc}")
    
    # 保存结果
    output_file = '../docs/full_market_scan_results.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(fast_rising, f, ensure_ascii=False, indent=2)
    print(f"\n完整结果已保存到: {output_file}")
    
    return fast_rising

if __name__ == '__main__':
    main()
