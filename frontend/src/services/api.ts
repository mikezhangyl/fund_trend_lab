/**
 * API服务层 - 与后端FastAPI通信
 */
import axios from 'axios';
import type {
  Instrument,
  TimeseriesPoint,
  TimeRange,
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
export async function deleteInstrument(
  code: string
): Promise<{ success: boolean; message: string; details: any }> {
  const response = await api.delete(`/instruments/${code}`);
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
