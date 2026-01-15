/**
 * 基金行组件 - 横向展示3个时间区间的图表
 */
import { useMemo, useState } from 'react';
import { TrendChartEcharts } from './TrendChartEcharts';
import { ChartModal } from './ChartModal';
import type { Instrument, TimeRange, TimeseriesPoint } from '../types';

export interface FundRowProps {
  instrument: Instrument;
  indexInstrument: Instrument;
  timeRanges: TimeRange[];
  chartDataMap: Record<number, {
    fundData: TimeseriesPoint[];
    indexData: TimeseriesPoint[];
    loading: boolean;
  }>;
  onDateHover: (date: string | null) => void;
  onDateClick: (date: string) => void;
  onDelete: (code: string) => void;
}

export function FundRow({
  instrument,
  indexInstrument,
  timeRanges,
  chartDataMap,
  onDateHover,
  onDateClick,
  onDelete,
}: FundRowProps) {
  // 全屏模态框状态
  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    fundData: TimeseriesPoint[];
    indexData: TimeseriesPoint[];
    rangeLabel: string;
  }>({
    isOpen: false,
    fundData: [],
    indexData: [],
    rangeLabel: '',
  });

  // 为每个时间区间计算极值（归一化后的百分比）
  const extremesMap = useMemo(() => {
    const map: Record<number, {
      max: { value: number; date: string; percentChange?: number };
      min: { value: number; date: string; percentChange?: number };
    }> = {};

    timeRanges.forEach(range => {
      const chartData = chartDataMap[range.days];
      if (chartData && chartData.fundData.length > 0) {
        // 计算归一化极值
        const values = chartData.fundData.map(d => d.value);
        const baseValue = values[0];

        let maxVal = -Infinity;
        let minVal = Infinity;
        let maxDate = '';
        let minDate = '';

        chartData.fundData.forEach(d => {
          const percentChange = ((d.value - baseValue) / baseValue) * 100;
          if (percentChange > maxVal) {
            maxVal = percentChange;
            maxDate = d.date;
          }
          if (percentChange < minVal) {
            minVal = percentChange;
            minDate = d.date;
          }
        });

        map[range.days] = {
          max: {
            value: maxVal,
            date: maxDate,
            percentChange: maxVal,
          },
          min: {
            value: minVal,
            date: minDate,
            percentChange: minVal,
          },
        };
      }
    });

    return map;
  }, [timeRanges, chartDataMap]);

  return (
    <div className="fund-row" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '16px',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: '#ffffff',
    }}>
      {/* 基金信息头部 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
            {instrument.name}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {instrument.code} · {instrument.type === 'fund' ? '基金' : instrument.type === 'etf' ? 'ETF' : '指数'}
          </div>
        </div>
        {/* 删除按钮 */}
        <button
          onClick={() => {
            if (window.confirm(`确定要删除 ${instrument.name}(${instrument.code}) 吗？\n这将删除该基金的所有历史数据。`)) {
              onDelete(instrument.code);
            }
          }}
          style={{
            padding: '6px 12px',
            backgroundColor: 'transparent',
            color: '#ef4444',
            border: '1px solid #ef4444',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#ef4444';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#ef4444';
          }}
        >
          删除
        </button>
      </div>

      {/* 图表行：3个时间区间 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${timeRanges.length}, 1fr)`,
        gap: '16px',
        marginTop: '24px',
      }}>
        {timeRanges.map((range) => {
          const chartData = chartDataMap[range.days];
          const extremes = extremesMap[range.days];

          if (!chartData) {
            return (
              <div key={range.days} style={{
                height: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f9fafb',
                borderRadius: '4px',
                color: '#9ca3af',
              }}>
                加载中...
              </div>
            );
          }

          // 显示 loading 状态
          if (chartData.loading) {
            return (
              <div key={range.days} style={{ position: 'relative', paddingTop: '24px' }}>
                {/* 时间区间标签 */}
                <div style={{
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#6b7280',
                  zIndex: 1,
                }}>
                  {range.label}
                </div>

                {/* Loading UI */}
                <div style={{
                  height: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f9fafb',
                  borderRadius: '4px',
                  color: '#6b7280',
                  gap: '8px',
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    border: '2px solid #e5e7eb',
                    borderTopColor: '#3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  <div style={{ fontSize: '12px' }}>下载数据中...</div>
                </div>

                {/* 添加旋转动画 */}
                <style>{`
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            );
          }

          return (
            <div key={range.days} style={{ position: 'relative', paddingTop: '24px' }}>
              {/* 时间区间标签 */}
              <div style={{
                position: 'absolute',
                top: '0',
                left: '0',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#6b7280',
                zIndex: 1,
              }}>
                {range.label}
              </div>

              {/* ECharts图表 - 点击放大 */}
              <div
                onClick={() => setModalData({
                  isOpen: true,
                  fundData: chartData.fundData,
                  indexData: chartData.indexData,
                  rangeLabel: range.label,
                })}
                style={{
                  cursor: 'zoom-in',
                  position: 'relative',
                }}
                title="点击放大查看"
              >
                <TrendChartEcharts
                  id={`${instrument.code}-${range.days}`}
                  fundData={chartData.fundData}
                  indexData={chartData.indexData}
                  fundName={instrument.name}
                  indexName={indexInstrument.name}
                  onDateHover={onDateHover}
                  onDateClick={onDateClick}
                  height={200}
                />
                {/* 放大图标 */}
                <div style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  color: '#6b7280',
                  pointerEvents: 'none',
                }}>
                  🔍 点击放大
                </div>
              </div>

              {/* 极值标注 */}
              {extremes && (
                <div style={{
                  position: 'absolute',
                  bottom: '0',
                  left: '0',
                  right: '0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  color: '#6b7280',
                  padding: '4px 0',
                  borderTop: '1px solid #e5e7eb',
                }}>
                  <div>
                    最大: <span style={{
                      color: extremes.max.value >= 0 ? '#10b981' : '#ef4444'
                    }}>
                      {extremes.max.value >= 0 ? '+' : ''}{extremes.max.value.toFixed(2)}%
                    </span>
                  </div>
                  <div>
                    最小: <span style={{
                      color: extremes.min.value >= 0 ? '#10b981' : '#ef4444'
                    }}>
                      {extremes.min.value >= 0 ? '+' : ''}{extremes.min.value.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 全屏模态框 */}
      <ChartModal
        isOpen={modalData.isOpen}
        onClose={() => setModalData(prev => ({ ...prev, isOpen: false }))}
        fundData={modalData.fundData}
        indexData={modalData.indexData}
        fundName={instrument.name}
        indexName={indexInstrument.name}
        rangeLabel={modalData.rangeLabel}
      />
    </div>
  );
}
