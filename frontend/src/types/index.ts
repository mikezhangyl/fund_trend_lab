/**
 * 类型定义 - 基金趋势实验室
 */

// 基金/指数类型
export type InstrumentType = 'fund' | 'etf' | 'index';

// 基金/指数信息
export interface Instrument {
  code: string;
  name: string;
  type: InstrumentType;
}

// 时间序列数据点
export interface TimeseriesPoint {
  date: string;
  value: number;
}

// 时间区间配置
export interface TimeRange {
  days: number;
  label: string;
}

// 默认时间区间
export const DEFAULT_TIME_RANGES: TimeRange[] = [
  { days: 365, label: '1年' },
  { days: 180, label: '6个月' },
  { days: 30, label: '1个月' },
];

// 图表数据（基金+对比指数）
export interface ChartData {
  fundData: TimeseriesPoint[];
  indexData?: TimeseriesPoint[];
  fundInfo: Instrument;
  indexInfo?: Instrument;
}

// 极值信息
export interface Extremes {
  max: {
    value: number;
    date: string;
    percentChange?: number; // 相对于锁定日的百分比变化
  };
  min: {
    value: number;
    date: string;
    percentChange?: number;
  };
}

// UI状态
export interface UIState {
  instruments: Instrument[];  // 基金列表
  timeRanges: TimeRange[];     // 时间区间配置
  selectedIndexCode: string;  // 当前选择的对比指数
  lockedDate?: string;         // 锁定的日期
  customRanges: TimeRange[];   // 自定义区间
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

// 同步状态
export interface SyncStatus {
  code: string;
  synced: boolean;
  last_success_date?: string;
  last_sync_at?: string;
  status?: 'success' | 'failed' | 'pending';
  message?: string;
}
