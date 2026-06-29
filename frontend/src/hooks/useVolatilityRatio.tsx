/**
 * 波动率压缩比数据Hook
 * 获取基金的滚动波动率比率数据
 */
import { useQuery } from '@tanstack/react-query';
import * as api from '../services/api';

export function useVolatilityRatio(code: string, days?: number) {
    return useQuery({
        queryKey: ['volatilityRatio', code, days],
        queryFn: () => api.getVolatilityRatio(code, 10, days),
        staleTime: 5 * 60 * 1000, // 5分钟
        enabled: Boolean(code),
    });
}
