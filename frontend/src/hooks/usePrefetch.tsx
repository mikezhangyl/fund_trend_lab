/**
 * 数据预加载Hook
 * 在用户查看基金时，后台预加载其他基金数据
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '../lib/queryClient';
import * as api from '../services/api';
import type { Instrument } from '../types';

/**
 * 预加载策略：预加载当前基金前后的其他基金
 *
 * @param currentFundCode 当前查看的基金代码
 * @param allInstruments 所有基金列表
 * @param indexCode 对比指数代码
 * @param days 时间区间
 * @param prefetchCount 预加载数量（前后各多少只）
 */
export function usePrefetchRelatedFunds(
  currentFundCode: string | null,
  allInstruments: Instrument[],
  indexCode: string,
  days: number,
  prefetchCount: number = 2
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!currentFundCode || allInstruments.length === 0) {
      return;
    }

    // 找到当前基金的索引
    const currentIndex = allInstruments.findIndex(inst => inst.code === currentFundCode);
    if (currentIndex === -1) {
      return;
    }

    // 确定预加载范围（前后各 prefetchCount 只）
    const startIndex = Math.max(0, currentIndex - prefetchCount);
    const endIndex = Math.min(allInstruments.length - 1, currentIndex + prefetchCount);

    // 预加载函数
    const prefetchFund = async (fundCode: string) => {
      try {
        console.log('[Prefetch] 预加载基金数据:', fundCode);
        await queryClient.prefetchQuery({
          queryKey: queryKeys.chartData(fundCode, indexCode, days),
          queryFn: () => api.getChartData(fundCode, indexCode, days),
          staleTime: undefined,  // 使用默认配置
        });
      } catch (err) {
        console.warn('[Prefetch] 预加载失败:', fundCode, err);
      }
    };

    // 后台预加载（不阻塞UI）
    const prefetchTimer = setTimeout(async () => {
      // 优先预加载前面的基金（用户可能会往回看）
      for (let i = currentIndex - 1; i >= startIndex && i >= 0; i--) {
        const fund = allInstruments[i];
        if (fund.code !== currentFundCode) {
          await prefetchFund(fund.code);
          // 预加载间隔，避免同时发起太多请求
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // 然后预加载后面的基金（用户可能会继续往下看）
      for (let i = currentIndex + 1; i <= endIndex; i++) {
        const fund = allInstruments[i];
        if (fund.code !== currentFundCode) {
          await prefetchFund(fund.code);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log('[Prefetch] 预加载完成');
    }, 1000); // 延迟1秒开始预加载，确保当前基金数据优先加载

    return () => clearTimeout(prefetchTimer);
  }, [currentFundCode, allInstruments, indexCode, days, prefetchCount, queryClient]);
}

/**
 * 预加载所有技术指标
 *
 * @param instruments 基金列表
 * @param days 天数
 */
export function usePrefetchAllIndicators(
  instruments: Instrument[],
  days: number
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (instruments.length === 0) {
      return;
    }

    // 延迟预加载，优先加载图表数据
    const prefetchTimer = setTimeout(async () => {
      console.log('[Prefetch] 开始预加载技术指标...');

      for (const inst of instruments) {
        try {
          await queryClient.prefetchQuery({
            queryKey: queryKeys.indicators(inst.code, days),
            queryFn: () => api.getIndicators(inst.code, days),
          });
          console.log('[Prefetch] 预加载指标:', inst.code);
        } catch (err) {
          console.warn('[Prefetch] 预加载指标失败:', inst.code);
        }

        // 间隔，避免过载
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('[Prefetch] 技术指标预加载完成');
    }, 3000); // 延迟3秒

    return () => clearTimeout(prefetchTimer);
  }, [instruments, days, queryClient]);
}

/**
 * 智能预加载：根据用户行为预测可能查看的基金
 */
export function useSmartPrefetch(
  currentFundCode: string | null,
  allInstruments: Instrument[],
  indexCode: string,
  days: number
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!currentFundCode || allInstruments.length === 0) {
      return;
    }

    // 延迟预加载
    const prefetchTimer = setTimeout(async () => {
      const currentIndex = allInstruments.findIndex(inst => inst.code === currentFundCode);

      if (currentIndex === -1) {
        return;
      }

      // 预测：用户可能查看
      // 1. 相似名称的基金
      // 2. 前后相邻的基金
      // 3. 收藏列表中的基金

      const prefetchTargets: string[] = [];

      // 策略1: 前后相邻的基金
      const neighbors = [
        allInstruments[currentIndex - 1]?.code,
        allInstruments[currentIndex + 1]?.code,
      ].filter(Boolean);

      prefetchTargets.push(...neighbors);

      // 策略2: 基金名称相似（同系列）
      const currentFund = allInstruments[currentIndex];
      const similar = allInstruments
        .filter(inst => inst.name.substring(0, 4) === currentFund.name.substring(0, 4))
        .slice(0, 2)
        .map(inst => inst.code);

      prefetchTargets.push(...similar);

      // 去重并限制数量
      const uniqueTargets = [...new Set(prefetchTargets)].slice(0, 5);

      console.log('[SmartPrefetch] 预测用户可能查看:', uniqueTargets);

      // 预加载
      for (const code of uniqueTargets) {
        try {
          await queryClient.prefetchQuery({
            queryKey: queryKeys.chartData(code, indexCode, days),
            queryFn: () => api.getChartData(code, indexCode, days),
          });
        } catch (err) {
          // 静默失败
        }
      }
    }, 2000);

    return () => clearTimeout(prefetchTimer);
  }, [currentFundCode, allInstruments, indexCode, days, queryClient]);
}
