/**
 * 应用状态管理Hook
 * 管理基金列表、时间区间、锁定日期等UI状态
 */
import { useState, useEffect, useCallback } from 'react';
import type { Instrument, TimeRange, UIState } from '../types';
import * as api from '../services/api';

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
  const [state, setState] = useState<UIState>(DEFAULT_UI_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初始化：加载保存的状态
  useEffect(() => {
    async function loadState() {
      try {
        const savedState = await api.loadUIState();
        if (savedState) {
          setState(savedState);
        }
      } catch (err) {
        console.error('Failed to load saved state:', err);
      } finally {
        setLoading(false);
      }
    }

    loadState();
  }, []);

  // 保存状态到后端
  const saveState = useCallback(async (newState: UIState) => {
    try {
      await api.saveUIState(newState);
    } catch (err) {
      console.error('Failed to save state:', err);
    }
  }, []);

  // 添加基金
  const addInstrument = useCallback(async (code: string, name: string, type: 'fund' | 'etf' | 'index') => {
    try {
      await api.addInstrument(code, name, type);

      const newState = {
        ...state,
        instruments: [...state.instruments, { code, name, type }],
      };
      setState(newState);
      await saveState(newState);

      // 触发后台同步
      await api.syncInstruments([code]);
    } catch (err) {
      console.error('Failed to add instrument:', err);
      throw err;
    }
  }, [state, saveState]);

  // 移除基金（同时从数据库删除所有数据）
  const removeInstrument = useCallback(async (code: string) => {
    try {
      // 调用后端API删除数据库中的所有数据
      const result = await api.deleteInstrument(code);
      console.log(`删除基金 ${code} 成功:`, result.details);

      // 更新本地状态
      const newState = {
        ...state,
        instruments: state.instruments.filter(inst => inst.code !== code),
      };
      setState(newState);
      await saveState(newState);
    } catch (err) {
      console.error(`删除基金 ${code} 失败:`, err);
      throw err;
    }
  }, [state, saveState]);

  // 更新时间区间
  const updateTimeRanges = useCallback(async (timeRanges: TimeRange[]) => {
    const newState = {
      ...state,
      timeRanges,
    };
    setState(newState);
    await saveState(newState);
  }, [state, saveState]);

  // 更新对比指数
  const updateSelectedIndex = useCallback(async (indexCode: string) => {
    const newState = {
      ...state,
      selectedIndexCode: indexCode,
    };
    setState(newState);
    await saveState(newState);
  }, [state, saveState]);

  // 添加自定义区间
  const addCustomRange = useCallback(async (days: number, label: string) => {
    const newRange: TimeRange = { days, label };
    const newState = {
      ...state,
      customRanges: [...state.customRanges, newRange],
    };
    setState(newState);
    await saveState(newState);
  }, [state, saveState]);

  return {
    state,
    loading,
    error,
    addInstrument,
    removeInstrument,
    updateTimeRanges,
    updateSelectedIndex,
    addCustomRange,
  };
}
