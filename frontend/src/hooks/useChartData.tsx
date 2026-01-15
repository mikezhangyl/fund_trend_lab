/**
 * 图表数据管理Hook（使用 React Query）
 * 获取单个基金的单个时间区间数据
 *
 * 缓存策略：基金净值每天 22:00 更新，缓存到下一个 22:00
 */
import { useQuery } from '@tanstack/react-query';
import type { TimeseriesPoint } from '../types';
import * as api from '../services/api';
import { queryKeys } from '../lib/queryClient';

export interface ChartDataResult {
  fundData: TimeseriesPoint[];
  indexData: TimeseriesPoint[];
  loading: boolean;
  error: string | null;
  isFetching: boolean;  // 后台重新获取中
}

/**
 * 获取单个基金的单个时间区间数据（React Query 版本）
 */
export function useChartData(
  fundCode: string,
  indexCode: string,
  days: number,
  autoLoad: boolean = true
): ChartDataResult {
  // 使用 React Query 的 useQuery
  const query = useQuery({
    // 查询键
    queryKey: queryKeys.chartData(fundCode, indexCode, days),

    // 查询函数
    queryFn: async () => {
      console.log('[useChartData] 从 API 获取:', fundCode, days, 'days');
      const data = await api.getChartData(fundCode, indexCode, days);
      console.log('[useChartData] 数据获取成功:', {
        fundCode,
        days,
        fundDataLength: data.fundData.length,
        indexDataLength: data.indexData.length,
      });
      return data;
    },

    // 只有在 autoLoad 为 true 且参数完整时才启用
    enabled: autoLoad && !!fundCode && !!indexCode,

    // 使用配置的缓存时间（在 queryClient.ts 中设置）
    // staleTime 和 gcTime 会自动从 queryClient 继承
  });

  return {
    fundData: query.data?.fundData ?? [],
    indexData: query.data?.indexData ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    isFetching: query.isFetching,  // 后台重新获取时为 true
  };
}

/**
 * 计算极值
 */
export function calculateExtremes(
  data: TimeseriesPoint[],
  lockedDate?: string
): {
  max: { value: number; date: string; percentChange?: number };
  min: { value: number; date: string; percentChange?: number };
} {
  if (!data || data.length === 0) {
    return {
      max: { value: 0, date: '' },
      min: { value: 0, date: '' }
    };
  }

  let maxPoint = data[0];
  let minPoint = data[0];

  data.forEach(point => {
    if (point.value > maxPoint.value) {
      maxPoint = point;
    }
    if (point.value < minPoint.value) {
      minPoint = point;
    }
  });

  // 如果有锁定日期，计算百分比变化
  let lockedValue: number | undefined;
  if (lockedDate) {
    const lockedPoint = data.find(p => p.date === lockedDate);
    if (lockedPoint) {
      lockedValue = lockedPoint.value;
    }
  }

  return {
    max: {
      value: maxPoint.value,
      date: maxPoint.date,
      percentChange: lockedValue
        ? ((maxPoint.value - lockedValue) / lockedValue) * 100
        : undefined
    },
    min: {
      value: minPoint.value,
      date: minPoint.date,
      percentChange: lockedValue
        ? ((minPoint.value - lockedValue) / lockedValue) * 100
        : undefined
    }
  };
}
