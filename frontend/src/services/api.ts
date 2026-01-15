/**
 * API服务层 - 与后端FastAPI通信
 */
import axios from 'axios';
import type {
  Instrument,
  TimeseriesPoint,
  UIState,
  SyncStatus
} from '../types';

const API_BASE = '/api';

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// ==================== 基金/指数管理 ====================

/**
 * 批量添加基金请求参数
 */
export interface BatchAddFundsRequest {
  codes: string[];
  set_favorite?: boolean;
  sync_data?: boolean;
}

/**
 * 批量添加基金响应
 */
export interface BatchAddFundsResponse {
  success: boolean;
  added: number;
  synced: number;
  favorites_updated: number;
  results: Array<{
    code: string;
    name: string;
    status: string;
  }>;
  errors: Array<{
    code: string;
    error: string;
  }>;
}

/**
 * 批量添加基金
 *
 * @param codes 基金代码数组
 * @param setFavorite 是否设为收藏（默认false）
 * @param syncData 是否同步数据（默认true）
 */
export async function batchAddFunds(
  codes: string[],
  setFavorite: boolean = false,
  syncData: boolean = true
): Promise<BatchAddFundsResponse> {
  const response = await api.post<BatchAddFundsResponse>('/funds/batch', {
    codes,
    set_favorite: setFavorite,
    sync_data: syncData
  });
  return response.data;
}

/**
 * 获取所有基金/指数列表
 */
export async function getInstruments(
  type?: 'fund' | 'etf' | 'index'
): Promise<Instrument[]> {
  const response = await api.get<Instrument[]>('/instruments', {
    params: { type }
  });
  return response.data;
}

/**
 * 获取单个基金/指数详情
 */
export async function getInstrument(code: string): Promise<Instrument> {
  const response = await api.get<Instrument>(`/instruments/${code}`);
  return response.data;
}

/**
 * 添加基金/指数
 */
export async function addInstrument(
  code: string,
  name: string,
  type: 'fund' | 'etf' | 'index'
): Promise<{ success: boolean; message: string }> {
  const response = await api.post('/instruments', { code, name, type });
  return response.data;
}

/**
 * 删除基金/指数及其所有数据
 */
export interface DeleteInstrumentResponse {
  success: boolean;
  message: string;
  details: {
    code: string;
    instrument_deleted: number;
    message: string;
  };
}

export async function deleteInstrument(
  code: string
): Promise<DeleteInstrumentResponse> {
  const response = await api.delete<DeleteInstrumentResponse>(`/instruments/${code}`);
  return response.data;
}

// ==================== 技术指标 ====================

export interface IndicatorData {
  fund_code: string;
  period_days: number;
  momentum: number;
  relative_strength: number;
  index_return: number;
  volatility: number;
  vol_ratio: number;
  analysis: string[];
  warning_level: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  score: number;
}

/**
 * 获取基金技术指标
 */
export async function getIndicators(
  code: string,
  days: number = 20
): Promise<IndicatorData> {
  const response = await api.get<IndicatorData>(`/indicators/${code}`, {
    params: { days }
  });
  return response.data;
}

// ==================== 急涨事件 ====================

export interface SurgeEvent {
  id: number;
  code: string;
  start_date: string;
  end_date: string;
  window: number;
  total_gain: number;
  slope_first: number;
  slope_second: number;
  is_accelerating: number;
}

/**
 * 获取基金的急涨事件
 */
export async function getSurgeEvents(code: string): Promise<SurgeEvent[]> {
  const response = await api.get<SurgeEvent[]>(`/surge_events/${code}`);
  return response.data;
}

// ==================== 连续上涨阶段 ====================

export interface UptrendPhase {
  start_date: string;
  end_date: string;
  duration_days: number;
  total_gain: number;
  max_drawdown: number;
  avg_daily_gain: number;
  slope_first: number;
  slope_second: number;
  is_accelerating: boolean;
}

/**
 * 获取基金的连续上涨阶段
 * 新算法：期间回撤超过阈值则认为是新阶段
 */
export async function getUptrendPhases(
  code: string,
  maxDrawdown: number = 5.0,
  minGain: number = 10.0,
  minDuration: number = 5
): Promise<UptrendPhase[]> {
  const response = await api.get<UptrendPhase[]>(`/uptrend_phases/${code}`, {
    params: {
      max_drawdown: maxDrawdown,
      min_gain: minGain,
      min_duration: minDuration,
    }
  });
  return response.data;
}

// ==================== 时间序列数据 ====================

/**
 * 获取时间序列数据
 */
export async function getTimeseries(
  code: string,
  startDate?: string,
  endDate?: string
): Promise<TimeseriesPoint[]> {
  const response = await api.post<TimeseriesPoint[]>('/timeseries', {
    code,
    start_date: startDate,
    end_date: endDate
  });
  return response.data;
}

/**
 * 按天数范围获取时间序列数据
 */
export async function getTimeseriesByRange(
  code: string,
  days: number,
  endDate?: string
): Promise<TimeseriesPoint[]> {
  const response = await api.get<TimeseriesPoint[]>(
    `/timeseries/${code}/range/${days}`,
    { params: { end_date: endDate } }
  );
  return response.data;
}

/**
 * 获取图表数据（基金+对比指数）
 */
export async function getChartData(
  fundCode: string,
  indexCode: string,
  days: number
): Promise<{
  fundData: TimeseriesPoint[];
  indexData: TimeseriesPoint[];
}> {
  const [fundData, indexData] = await Promise.all([
    getTimeseriesByRange(fundCode, days),
    getTimeseriesByRange(indexCode, days)
  ]);

  return { fundData, indexData };
}

// ==================== 数据同步 ====================

/**
 * 同步基金数据（后台异步）
 */
export async function syncInstruments(
  codes: string[]
): Promise<{ success: boolean; message: string }> {
  const response = await api.post('/sync', { codes });
  return response.data;
}

/**
 * 获取同步状态
 */
export async function getSyncStatus(code: string): Promise<SyncStatus> {
  const response = await api.get<SyncStatus>(`/sync/status/${code}`);
  return response.data;
}

/**
 * 获取正在同步的代码列表
 */
export async function getSyncingList(): Promise<string[]> {
  const response = await api.get<string[]>('/sync/syncing');
  return response.data;
}

// ==================== 收藏管理 ====================

export interface FavoritesResponse {
  count: number;
  codes: string[];
}

export interface FavoritesSetResponse {
  success: boolean;
  count: number;
  codes: string[];
  mode: string;
}

/**
 * 获取收藏的基金列表
 */
export async function getFavorites(): Promise<FavoritesResponse> {
  const response = await api.get<FavoritesResponse>('/favorites');
  return response.data;
}

/**
 * 设置/更新收藏列表
 */
export async function setFavorites(
  codes: string[],
  mode: 'replace' | 'add' | 'remove' = 'replace'
): Promise<FavoritesSetResponse> {
  const response = await api.post<FavoritesSetResponse>('/favorites', { codes, mode });
  return response.data;
}

// ==================== 用户状态管理 ====================

/**
 * 保存用户状态
 */
export async function saveUserState(
  key: string,
  value: string
): Promise<{ success: boolean }> {
  const response = await api.post('/state', { key, value });
  return response.data;
}

/**
 * 加载用户状态
 */
export async function loadUserState(
  key: string
): Promise<{ key: string; value: string } | null> {
  try {
    const response = await api.get<{ key: string; value: string }>(`/state/${key}`);
    return response.data;
  } catch (error) {
    return null;
  }
}

/**
 * 保存完整UI状态
 */
export async function saveUIState(state: UIState): Promise<void> {
  await saveUserState('ui_state', JSON.stringify(state));
}

/**
 * 加载完整UI状态
 */
export async function loadUIState(): Promise<UIState | null> {
  const result = await loadUserState('ui_state');
  if (!result) return null;

  try {
    return JSON.parse(result.value) as UIState;
  } catch {
    return null;
  }
}

// ==================== 健康检查 ====================

/**
 * 健康检查
 */
export async function healthCheck(): Promise<{
  status: string;
  timestamp: string;
}> {
  const response = await api.get('/health');
  return response.data;
}
