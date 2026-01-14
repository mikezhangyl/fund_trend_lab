/**
 * ECharts趋势图表组件
 * 高性能时间序列图表，支持跨图同步时间线
 */
import { useRef, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import type { TimeseriesPoint } from '../types';

/**
 * 填充缺失日期（周末、节假日）
 * 使用前值填充法：非交易日用前一个交易日的值
 */
function fillMissingDates(
  data: TimeseriesPoint[],
  startDate: string,
  endDate: string
): TimeseriesPoint[] {
  if (data.length === 0) return [];

  const result = new Map<string, number>(); // 使用Map便于查找
  const dataMap = new Map(data.map(d => [d.date, d.value]));

  // 生成完整日期序列
  let currentDate = new Date(startDate);
  const end = new Date(endDate);
  let lastValue: number | null = null;

  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay();

    // 跳过周末（0=周日, 6=周六）
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (!isWeekend) {
      // 工作日：使用实际数据
      if (dataMap.has(dateStr)) {
        lastValue = dataMap.get(dateStr)!;
        result.set(dateStr, lastValue);
      } else if (lastValue !== null) {
        // 没有数据但有前值，说明是节假日，用前值填充
        result.set(dateStr, lastValue);
      }
    } else if (lastValue !== null) {
      // 周末：用前值填充
      result.set(dateStr, lastValue);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 转换回数组
  return Array.from(result.entries()).map(([date, value]) => ({ date, value }));
}

interface TrendChartEchartsProps {
  id: string;
  fundData: TimeseriesPoint[];
  indexData?: TimeseriesPoint[];
  fundName: string;
  indexName?: string;
  onDateHover?: (date: string | null) => void;
  onDateClick?: (date: string) => void;
  height?: number;
}

export function TrendChartEcharts({
  id,
  fundData,
  indexData = [],
  fundName,
  indexName = '沪深300',
  onDateHover,
  onDateClick,
  height = 200,
}: TrendChartEchartsProps) {
  const chartRef = useRef<ReactECharts>(null);

  // 获取日期范围
  const allDates = useMemo(() => {
    const dates = [
      ...fundData.map(d => d.date),
      ...indexData.map(d => d.date),
    ];
    if (dates.length === 0) return [];

    const sorted = dates.sort();
    return { start: sorted[0], end: sorted[sorted.length - 1] };
  }, [fundData, indexData]);

  // 填充缺失日期
  const filledFundData = useMemo(() => {
    if (!allDates.start || !allDates.end) return [];
    return fillMissingDates(fundData, allDates.start, allDates.end);
  }, [fundData, allDates]);

  const filledIndexData = useMemo(() => {
    if (!allDates.start || !allDates.end) return [];
    return fillMissingDates(indexData, allDates.start, allDates.end);
  }, [indexData, allDates]);

  // 准备数据
  const dates = useMemo(() => {
    const dateSet = new Set([
      ...filledFundData.map(d => d.date),
      ...filledIndexData.map(d => d.date),
    ]);
    return Array.from(dateSet).sort();
  }, [filledFundData, filledIndexData]);

  const fundValues = dates.map(date => {
    const point = filledFundData.find(d => d.date === date);
    return point?.value ?? null;
  });

  const indexValues = dates.map(date => {
    const point = filledIndexData.find(d => d.date === date);
    return point?.value ?? null;
  });

  // 归一化数据：计算相对于起始点的百分比变化
  // 这是最重要的金融可视化方法
  const getNormalizedData = (values: (number | null)[]) => {
    // 找到第一个非空值作为基准
    let baseValue: number | null = null;
    for (const v of values) {
      if (v !== null) {
        baseValue = v;
        break;
      }
    }

    if (baseValue === null) return values;

    // 计算每个点相对于基准的百分比变化
    return values.map(v => {
      if (v === null) return null;
      return ((v - baseValue) / baseValue) * 100;
    });
  };

  const normalizedFundValues = getNormalizedData(fundValues);
  const normalizedIndexValues = getNormalizedData(indexValues);

  // Y轴配置：显示百分比，只基于目标基金数据计算范围
  const getYAxisConfig = (): echarts.EChartOption.YAxisComponent => {
    // 只使用基金数据计算Y轴范围（不包含参考指数）
    const fundOnlyValues = normalizedFundValues.filter((v): v is number => v !== null);

    let min: number;
    let max: number;

    if (fundOnlyValues.length === 0) {
      min = -10;
      max = 10;
    } else {
      const dataMin = Math.min(...fundOnlyValues);
      const dataMax = Math.max(...fundOnlyValues);

      // 确保0在视野内
      min = Math.min(dataMin, 0);
      max = Math.max(dataMax, 0);

      // 添加5%的边距
      const range = max - min;
      const padding = range * 0.05 || 1; // 至少1%的边距
      min -= padding;
      max += padding;
    }

    return {
      type: 'value',
      min,
      max,
      axisLabel: {
        formatter: (value: number) => `${value.toFixed(2)}%`,
        textStyle: { color: '#6b7280', fontSize: 10 },
      },
      splitLine: {
        show: true,
        lineStyle: { color: '#e5e7eb', width: 1 },
      },
      axisLine: { show: false },
      axisTick: { show: false },
    };
  };

  // ECharts配置
  const option: echarts.EChartOption = {
    animation: false,
    grid: {
      left: 40, // 给Y轴标签留空间
      right: 10,
      top: 10,
      bottom: 20,
    },
    tooltip: {
      trigger: 'axis',
      confine: true, // 将 tooltip 限制在图表容器内
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#3b82f6', width: 1 },
      },
      // 智能定位：左边空间不足时显示在右边
      position: (
        point: [number, number],
        _params: any,
        _dom: HTMLElement,
        _rect: any,
        size: { contentSize: [number, number]; viewSize: [number, number] }
      ) => {
        const [mouseX, mouseY] = point;
        const [tooltipWidth, tooltipHeight] = size.contentSize;
        const [viewWidth, viewHeight] = size.viewSize;

        // 计算 tooltip 位置
        let x: number;
        let y: number;

        // 水平方向：默认显示在鼠标左边，空间不足时显示在右边
        const leftSpace = mouseX;
        const rightSpace = viewWidth - mouseX;

        if (leftSpace >= tooltipWidth + 10) {
          // 左边有足够空间，显示在左边
          x = mouseX - tooltipWidth - 10;
        } else if (rightSpace >= tooltipWidth + 10) {
          // 右边有足够空间，显示在右边
          x = mouseX + 10;
        } else {
          // 两边都不够，居中显示
          x = Math.max(5, Math.min(viewWidth - tooltipWidth - 5, mouseX - tooltipWidth / 2));
        }

        // 垂直方向：默认显示在鼠标上方，空间不足时显示在下方
        const topSpace = mouseY;
        const bottomSpace = viewHeight - mouseY;

        if (topSpace >= tooltipHeight + 10) {
          y = mouseY - tooltipHeight - 10;
        } else if (bottomSpace >= tooltipHeight + 10) {
          y = mouseY + 10;
        } else {
          y = Math.max(5, Math.min(viewHeight - tooltipHeight - 5, mouseY - tooltipHeight / 2));
        }

        return [x, y];
      },
      formatter: (params: any) => {
        if (!params || params.length === 0) return '';
        const date = params[0].axisValue;
        let tooltip = `<div style="font-weight:bold;margin-bottom:4px;">${date}</div>`;
        params.forEach((param: any) => {
          const value = param.value;
          if (value !== null) {
            const color = value >= 0 ? '#10b981' : '#ef4444'; // 涨绿跌红
            tooltip += `<div>${param.marker} ${param.seriesName}: <span style="color:${color}">${value >= 0 ? '+' : ''}${value.toFixed(2)}%</span></div>`;
          }
        });
        return tooltip;
      },
    },
    xAxis: {
      type: 'category',
      data: dates,
      show: false,
    },
    yAxis: getYAxisConfig(),
    series: [
      {
        name: fundName,
        type: 'line',
        data: normalizedFundValues,
        smooth: false,
        symbol: 'none',
        lineStyle: {
          color: '#3b82f6',
          width: 1.5,
        },
        emphasis: {
          focus: 'series',
        },
      },
      {
        name: indexName,
        type: 'line',
        data: normalizedIndexValues,
        smooth: false,
        symbol: 'none',
        lineStyle: {
          color: '#9ca3af',
          width: 1,
          type: 'dashed',
        },
        emphasis: {
          focus: 'series',
        },
      },
    ],
  };

  // 事件处理
  const onEvents = {
    mousemove: (params: any) => {
      if (params && params.componentType === 'series') {
        const date = dates[params.dataIndex];
        onDateHover?.(date);
      }
    },
    mouseout: () => {
      onDateHover?.(null);
    },
    click: (params: any) => {
      if (params && params.componentType === 'series') {
        const date = dates[params.dataIndex];
        onDateClick?.(date);
      }
    },
  };

  // 注意：锁定日期功能在归一化模式下暂时禁用
  // 因为归一化始终以区间起点为基准
  // 如果需要锁定日期功能，可以在getNormalizedData中支持自定义基准点

  return (
    <ReactECharts
      ref={chartRef}
      echarts={echarts}
      option={option}
      onEvents={onEvents}
      style={{ height: `${height}px`, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
