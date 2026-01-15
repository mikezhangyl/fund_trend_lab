"""
急涨检测回测引擎
使用分段斜率 + 加速度检测急涨事件
"""
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from scipy import stats
from database import get_timeseries, list_instruments, save_surge_event, clear_surge_events, init_database


@dataclass
class SurgeEvent:
    """急涨事件"""
    code: str
    name: str
    start_date: str
    end_date: str
    window: int
    total_gain: float      # 总涨幅%
    slope_first: float     # 前半段斜率
    slope_second: float    # 后半段斜率
    acceleration: float    # 加速度 (slope_second / slope_first)
    is_accelerating: bool  # 是否加速上涨


@dataclass
class UptrendPhase:
    """连续上涨阶段"""
    code: str
    name: str
    start_date: str
    end_date: str
    start_idx: int
    end_idx: int
    duration_days: int      # 持续天数
    total_gain: float       # 总涨幅%
    max_drawdown: float     # 期间最大回撤%
    avg_daily_gain: float   # 日均涨幅%
    peak_date: str          # 峰值日期
    peak_gain: float        # 峰值涨幅%
    slope_first: float      # 前半段斜率
    slope_second: float     # 后半段斜率
    is_accelerating: bool   # 是否加速上涨


class UptrendPhaseDetector:
    """
    连续上涨阶段检测器
    
    检测逻辑：
    - 捕捉连续上涨的阶段
    - 允许期间有小幅回撤（默认5%以内）
    - 如果回撤超过阈值，则认为是新的上涨阶段
    """
    
    def __init__(self,
                 max_drawdown_tolerance: float = 5.0,   # 最大允许回撤%
                 min_gain: float = 10.0,                 # 最小涨幅%
                 min_duration: int = 5):                 # 最小持续天数
        self.max_drawdown_tolerance = max_drawdown_tolerance
        self.min_gain = min_gain
        self.min_duration = min_duration
    
    def detect_phases(self, code: str, name: str = "") -> List[UptrendPhase]:
        """检测基金的所有上涨阶段"""
        data = get_timeseries(code)
        
        if not data or len(data) < self.min_duration:
            return []
        
        prices = np.array([float(d['value']) for d in data])
        dates = [d['date'] for d in data]
        
        phases = []
        i = 0
        
        while i < len(prices) - 1:
            # 寻找上涨起点（当前价格低于下一个价格）
            if prices[i+1] <= prices[i]:
                i += 1
                continue
            
            # 开始一个新的上涨阶段
            phase_start = i
            phase_start_price = prices[i]
            running_peak = prices[i]
            running_peak_idx = i
            
            j = i + 1
            while j < len(prices):
                current_price = prices[j]
                
                # 更新峰值
                if current_price > running_peak:
                    running_peak = current_price
                    running_peak_idx = j
                
                # 计算从峰值的回撤
                drawdown_from_peak = (running_peak - current_price) / running_peak * 100
                
                # 如果回撤超过阈值，结束当前阶段
                if drawdown_from_peak > self.max_drawdown_tolerance:
                    break
                
                j += 1
            
            # 阶段结束于峰值位置（不包含回撤部分）
            phase_end = running_peak_idx
            
            # 验证：确保这个阶段内的最大回撤确实不超过阈值
            # 通过滑动窗口检查每个点相对于前面峰值的回撤
            if phase_end > phase_start:
                phase_prices = prices[phase_start:phase_end+1]
                
                # 重新检查内部是否有超过5%的回撤
                # 找到真正的无回撤子区间
                valid_end = self._find_valid_phase_end(phase_prices)
                actual_end = phase_start + valid_end
                
                if actual_end > phase_start:
                    actual_prices = prices[phase_start:actual_end+1]
                    total_gain = (prices[actual_end] - phase_start_price) / phase_start_price * 100
                    duration = actual_end - phase_start
                    
                    if total_gain >= self.min_gain and duration >= self.min_duration:
                        # 计算期间最大回撤
                        max_dd = self._calculate_max_drawdown(actual_prices)
                        
                        # 计算分段斜率
                        slope_first, slope_second, acceleration = self._calculate_segment_slopes(actual_prices)
                        
                        phases.append(UptrendPhase(
                            code=code,
                            name=name,
                            start_date=dates[phase_start],
                            end_date=dates[actual_end],
                            start_idx=phase_start,
                            end_idx=actual_end,
                            duration_days=duration,
                            total_gain=round(total_gain, 2),
                            max_drawdown=round(max_dd, 2),
                            avg_daily_gain=round(total_gain / duration, 3),
                            peak_date=dates[actual_end],
                            peak_gain=round(total_gain, 2),
                            slope_first=round(slope_first, 3),
                            slope_second=round(slope_second, 3),
                            is_accelerating=bool(acceleration > 1.3)
                        ))
            
            # 移动到下一个可能的起点
            i = max(j, phase_end + 1)
        
        return phases
    
    def _find_valid_phase_end(self, prices: np.ndarray) -> int:
        """找到不超过回撤阈值的有效阶段结束点"""
        if len(prices) < 2:
            return 0
        
        peak = prices[0]
        peak_idx = 0
        valid_end = 0
        
        for i in range(1, len(prices)):
            if prices[i] > peak:
                peak = prices[i]
                peak_idx = i
                valid_end = i  # 更新有效结束点
            else:
                # 检查回撤
                drawdown = (peak - prices[i]) / peak * 100
                if drawdown > self.max_drawdown_tolerance:
                    # 回撤超过阈值，返回峰值位置
                    return peak_idx
        
        return len(prices) - 1
    
    def _calculate_max_drawdown(self, prices: np.ndarray) -> float:
        """计算最大回撤"""
        if len(prices) < 2:
            return 0.0
        
        peak = prices[0]
        max_dd = 0.0
        
        for price in prices:
            if price > peak:
                peak = price
            dd = (peak - price) / peak * 100
            if dd > max_dd:
                max_dd = dd
        
        return max_dd
    
    def _calculate_segment_slopes(self, prices: np.ndarray) -> Tuple[float, float, float]:
        """计算分段斜率"""
        n = len(prices)
        if n < 4:
            return 0.0, 0.0, 1.0
        
        mid = n // 2
        
        # 归一化为涨幅%
        y = (prices / prices[0] - 1) * 100
        
        # 前半段
        x1 = np.arange(mid)
        y1 = y[:mid]
        slope1, _, _, _, _ = stats.linregress(x1, y1)
        
        # 后半段
        x2 = np.arange(n - mid)
        y2 = y[mid:] - y[mid]
        slope2, _, _, _, _ = stats.linregress(x2, y2)
        
        # 加速度
        if slope1 > 0.01:
            acceleration = slope2 / slope1
        else:
            acceleration = float('inf') if slope2 > 0 else 0
        
        return slope1, slope2, acceleration


class SurgeDetector:
    """急涨检测器"""
    
    def __init__(self, 
                 windows: List[int] = [10, 20, 30],
                 min_gain: float = 15.0,          # 最小涨幅%
                 min_slope: float = 0.3,          # 最小日均斜率%
                 acceleration_threshold: float = 1.3):  # 加速阈值
        self.windows = windows
        self.min_gain = min_gain
        self.min_slope = min_slope
        self.acceleration_threshold = acceleration_threshold
    
    def calculate_segment_slopes(self, prices: np.ndarray) -> Tuple[float, float, float]:
        """
        计算分段斜率
        
        Returns:
            (前半段斜率, 后半段斜率, 加速度)
        """
        n = len(prices)
        mid = n // 2
        
        # 归一化为涨幅%
        y = (prices / prices[0] - 1) * 100
        
        # 前半段
        x1 = np.arange(mid)
        y1 = y[:mid]
        slope1, _, _, _, _ = stats.linregress(x1, y1)
        
        # 后半段
        x2 = np.arange(n - mid)
        y2 = y[mid:] - y[mid]  # 以中点为新起点
        slope2, _, _, _, _ = stats.linregress(x2, y2)
        
        # 加速度
        if slope1 > 0.01:  # 避免除零
            acceleration = slope2 / slope1
        else:
            acceleration = float('inf') if slope2 > 0 else 0
            
        return slope1, slope2, acceleration
    
    def is_surge(self, prices: np.ndarray) -> Tuple[bool, Dict]:
        """
        判断是否为急涨
        
        Returns:
            (是否急涨, 详情字典)
        """
        total_gain = (prices[-1] / prices[0] - 1) * 100
        slope1, slope2, acceleration = self.calculate_segment_slopes(prices)
        avg_slope = total_gain / len(prices)
        
        details = {
            'total_gain': round(total_gain, 2),
            'slope_first': round(slope1, 3),
            'slope_second': round(slope2, 3),
            'acceleration': round(acceleration, 2),
            'avg_slope': round(avg_slope, 3),
        }
        
        # 急涨条件
        is_surge = (
            total_gain >= self.min_gain and
            avg_slope >= self.min_slope and
            slope2 > 0  # 后半段仍在上涨
        )
        
        details['is_accelerating'] = acceleration > self.acceleration_threshold
        
        return is_surge, details
    
    def scan_fund(self, code: str, name: str = "") -> List[SurgeEvent]:
        """扫描单个基金的急涨事件"""
        events = []
        data = get_timeseries(code)
        
        if not data or len(data) < max(self.windows) + 1:
            return events
        
        prices = np.array([float(d['value']) for d in data])
        dates = [d['date'] for d in data]
        
        # 记录已检测的区间，避免重复
        detected_ranges = set()
        
        for window in self.windows:
            for i in range(window, len(prices)):
                window_prices = prices[i-window:i+1]
                is_surge_event, details = self.is_surge(window_prices)
                
                if is_surge_event:
                    start_date = dates[i-window]
                    end_date = dates[i]
                    
                    # 检查是否与已检测区间重叠
                    range_key = f"{start_date}_{end_date}"
                    if range_key in detected_ranges:
                        continue
                    detected_ranges.add(range_key)
                    
                    events.append(SurgeEvent(
                        code=code,
                        name=name,
                        start_date=start_date,
                        end_date=end_date,
                        window=window,
                        total_gain=details['total_gain'],
                        slope_first=details['slope_first'],
                        slope_second=details['slope_second'],
                        acceleration=details['acceleration'],
                        is_accelerating=details['is_accelerating']
                    ))
        
        # 按日期排序并去重
        events.sort(key=lambda e: e.end_date)
        return events


class SurgeBacktester:
    """回测引擎"""
    
    def __init__(self):
        self.detector = SurgeDetector()
        self.all_events: List[SurgeEvent] = []
    
    def scan_all_funds(self) -> List[SurgeEvent]:
        """扫描数据库中所有基金"""
        instruments = list_instruments(instrument_type='fund')
        
        print(f"开始扫描 {len(instruments)} 只基金...")
        
        for i, inst in enumerate(instruments):
            code = inst['code']
            name = inst['name']
            
            events = self.detector.scan_fund(code, name)
            self.all_events.extend(events)
            
            if events:
                print(f"  [{i+1}/{len(instruments)}] {name}({code}): 发现 {len(events)} 个急涨事件")
        
        print(f"\n总共发现 {len(self.all_events)} 个急涨事件")
        return self.all_events
    
    def generate_report(self) -> str:
        """生成报告"""
        if not self.all_events:
            return "未发现急涨事件"
        
        lines = ["=" * 60]
        lines.append("急涨事件扫描报告")
        lines.append("=" * 60)
        lines.append(f"总事件数: {len(self.all_events)}")
        lines.append(f"加速上涨事件数: {sum(1 for e in self.all_events if e.is_accelerating)}")
        lines.append("")
        
        # 按涨幅排序显示Top10
        top_events = sorted(self.all_events, key=lambda e: e.total_gain, reverse=True)[:10]
        
        lines.append("Top 10 涨幅最大事件:")
        lines.append("-" * 60)
        
        for i, e in enumerate(top_events, 1):
            accel_mark = "🚀加速" if e.is_accelerating else ""
            lines.append(f"{i}. {e.name}({e.code})")
            lines.append(f"   时间: {e.start_date} ~ {e.end_date} ({e.window}天)")
            lines.append(f"   涨幅: +{e.total_gain:.1f}% {accel_mark}")
            lines.append(f"   斜率: 前段{e.slope_first:.2f}%/天 → 后段{e.slope_second:.2f}%/天")
            lines.append("")
        
        return "\n".join(lines)
    
    def save_to_database(self) -> int:
        """保存急涨事件到数据库"""
        clear_surge_events()  # 清空旧数据
        
        for e in self.all_events:
            save_surge_event(
                code=e.code,
                start_date=e.start_date,
                end_date=e.end_date,
                window=e.window,
                total_gain=e.total_gain,
                slope_first=e.slope_first,
                slope_second=e.slope_second,
                is_accelerating=e.is_accelerating
            )
        
        print(f"已保存 {len(self.all_events)} 个急涨事件到数据库")
        return len(self.all_events)


# 测试入口
if __name__ == "__main__":
    init_database()
    
    # 测试新的连续上涨阶段检测器
    print("=" * 60)
    print("测试连续上涨阶段检测器 (5% 回撤容忍)")
    print("=" * 60)
    
    phase_detector = UptrendPhaseDetector(
        max_drawdown_tolerance=5.0,  # 5% 回撤阈值
        min_gain=10.0,                # 最小10%涨幅
        min_duration=5                # 最少5天
    )
    
    instruments = list_instruments(instrument_type='fund')[:5]  # 测试前5个
    
    for inst in instruments:
        phases = phase_detector.detect_phases(inst['code'], inst['name'])
        if phases:
            print(f"\n{inst['name']} ({inst['code']}):")
            for p in phases[:3]:  # 只显示前3个
                accel = "🚀加速" if p.is_accelerating else ""
                print(f"  {p.start_date} → {p.end_date} ({p.duration_days}天)")
                print(f"    涨幅: +{p.total_gain}%  期间最大回撤: {p.max_drawdown}%  {accel}")
                print(f"    斜率: {p.slope_first}%/天 → {p.slope_second}%/天")
    
    print("\n")
    
    # 原有的固定窗口检测
    print("=" * 60)
    print("原有固定窗口急涨检测")
    print("=" * 60)
    
    backtester = SurgeBacktester()
    events = backtester.scan_all_funds()
    backtester.save_to_database()
    print(backtester.generate_report())

