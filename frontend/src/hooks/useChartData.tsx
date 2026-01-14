/**
 * 图表数据管理Hook
 * 获取单个基金的单个时间区间数据
 */
import { useState, useEffect } from 'react';
import type { TimeseriesPoint } from '../types';
import * as api from '../services/api';

export interface ChartDataResult {
  fundData: TimeseriesPoint[];
  indexData: TimeseriesPoint[];
  loading: boolean;
  error: string | null;
}

/**
 * 获取单个基金的单个时间区间数据
 */
export function useChartData(
  fundCode: string,
  indexCode: string,
  days: number,
  autoLoad: boolean = true
): ChartDataResult {
  const [fundData, setFundData] = useState<TimeseriesPoint[]>([]);
  const [indexData, setIndexData] = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoLoad || !fundCode || !indexCode) return;

    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await api.getChartData(fundCode, indexCode, days);
        if (isMounted) {
          console.log('[useChartData]', fundCode, days, 'days, fetched:', {
            fundDataLength: data.fundData.length,
            indexDataLength: data.indexData.length,
          });
          setFundData(data.fundData);
          setIndexData(data.indexData);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMessage);
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [fundCode, indexCode, days, autoLoad]);

  return { fundData, indexData, loading, error };
}

/**
 * 计算极值
 */
export function calculateExtremes(
  data: TimeseriesPoint[],
  lockedDate?: string
): { max: { value: number; date: string }; min: { value: number; date: string } } {
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
