/**
 * 应用状态管理Hook（使用 React Query）
 * 管理基金列表、时间区间、锁定日期等UI状态
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TimeRange, UIState } from '../types';
import * as api from '../services/api';
import { queryKeys } from '../lib/queryClient';

// 默认UI状态
const DEFAULT_UI_STATE: UIState = {
  instruments: [],
  timeRanges: [
    { days: 365, label: '1年' },
    { days: 180, label: '6个月' },
    { days: 30, label: '1个月' },
  ],
  selectedIndexCode: '000300', // 默认沪深300
  customRanges: [],
};

export function useAppState() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<UIState>(DEFAULT_UI_STATE);

  // 获取 UI 状态（React Query）
  const { data: savedState, isLoading } = useQuery({
    queryKey: queryKeys.uiState(),
    queryFn: () => api.loadUIState(),
    staleTime: 5 * 60 * 1000,  // UI 状态缓存 5 分钟
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  // 监听数据变化更新本地状态
  useEffect(() => {
    if (savedState) {
      setState(savedState);
    }
  }, [savedState]);

  // 添加基金（Mutation）
  const addInstrument = useMutation({
    mutationFn: async ({ code, name, type }: { code: string; name: string; type: 'fund' | 'etf' | 'index' }) => {
      await api.addInstrument(code, name, type);
      // 触发后台同步
      await api.syncInstruments([code]);
      return { code, name, type };
    },
    onSuccess: async (result) => {
      // 更新本地状态
      const newState = {
        ...state,
        instruments: [...state.instruments, { code: result.code, name: result.name, type: result.type }],
      };
      setState(newState);

      // 使 UI 状态缓存失效（触发重新获取）
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState() });

      // 清除该基金的图表缓存（强制重新获取最新数据）
      queryClient.invalidateQueries({ queryKey: ['chartData', result.code] });
    },
  });

  // 移除基金（Mutation）
  const removeInstrument = useMutation({
    mutationFn: async (code: string) => {
      const result = await api.deleteInstrument(code);
      console.log(`删除基金 ${code} 成功:`, result.details);
      return code;
    },
    onSuccess: (code) => {
      // 更新本地状态
      const newState = {
        ...state,
        instruments: state.instruments.filter(inst => inst.code !== code),
      };
      setState(newState);

      // 使 UI 状态缓存失效
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState() });

      // 清除该基金的所有相关缓存
      queryClient.invalidateQueries({ queryKey: ['chartData', code] });
      queryClient.invalidateQueries({ queryKey: ['indicators', code] });
      queryClient.invalidateQueries({ queryKey: ['surgeEvents', code] });
      queryClient.invalidateQueries({ queryKey: ['uptrendPhases', code] });
    },
  });

  // 更新时间区间
  const updateTimeRanges = async (timeRanges: TimeRange[]) => {
    const newState = {
      ...state,
      timeRanges,
    };
    setState(newState);
    await api.saveUIState(newState);
  };

  // 更新对比指数
  const updateSelectedIndex = async (indexCode: string) => {
    const newState = {
      ...state,
      selectedIndexCode: indexCode,
    };
    setState(newState);
    await api.saveUIState(newState);
  };

  // 添加自定义区间
  const addCustomRange = async (days: number, label: string) => {
    const newRange: TimeRange = { days, label };
    const newState = {
      ...state,
      customRanges: [...state.customRanges, newRange],
    };
    setState(newState);
    await api.saveUIState(newState);
  };

  return {
    state,
    loading: isLoading,
    addInstrument: (code: string, name: string, type: 'fund' | 'etf' | 'index') =>
      addInstrument.mutateAsync({ code, name, type }),
    removeInstrument: (code: string) => removeInstrument.mutateAsync(code),
    updateTimeRanges,
    updateSelectedIndex,
    addCustomRange,
  };
}
