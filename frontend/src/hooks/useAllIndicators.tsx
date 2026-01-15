/**
 * 批量获取所有基金的技术指标
 */
import { useQuery } from '@tanstack/react-query';
import * as api from '../services/api';
import { queryKeys } from '../lib/queryClient';

export interface IndicatorMap {
  [code: string]: {
    momentum: number;
    relative_strength: number;
    warning_level: string;
    score: number;
    vol_ratio: number;
  };
}

/**
 * 批量获取所有基金的技术指标
 */
export function useAllIndicators(codes: string[], days: number) {
  return useQuery({
    queryKey: queryKeys.indicators('all', days),
    queryFn: async () => {
      // 并行获取所有基金的指标
      const indicators = await Promise.allSettled(
        codes.map(code => api.getIndicators(code, days))
      );

      // 构建映射表
      const map: IndicatorMap = {};
      indicators.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          map[codes[index]] = {
            momentum: result.value.momentum,
            relative_strength: result.value.relative_strength,
            warning_level: result.value.warning_level,
            score: result.value.score,
            vol_ratio: result.value.vol_ratio,
          };
        }
      });

      return map;
    },
    enabled: codes.length > 0,
    staleTime: 5 * 60 * 1000, // 缓存5分钟
    gcTime: 10 * 60 * 1000,
  });
}
