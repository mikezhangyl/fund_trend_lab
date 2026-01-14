/**
 * 基金卡片组件 - 单个基金的图表展示
 * 新布局：一行显示3个基金，统一时间区间
 */
import { useMemo } from 'react';
import { TrendChartEcharts } from './TrendChartEcharts';
import type { Instrument, TimeseriesPoint } from '../types';

interface FundCardProps {
    instrument: Instrument;
    indexInstrument: Instrument;
    fundData: TimeseriesPoint[];
    indexData: TimeseriesPoint[];
    loading: boolean;
    onDateHover: (date: string | null) => void;
    onDateClick: (date: string) => void;
    onDelete: (code: string) => void;
}

export function FundCard({
    instrument,
    indexInstrument,
    fundData,
    indexData,
    loading,
    onDateHover,
    onDateClick,
    onDelete,
}: FundCardProps) {
    // 计算极值（归一化后的百分比）
    const extremes = useMemo(() => {
        if (fundData.length === 0) return null;

        const baseValue = fundData[0].value;
        let maxVal = -Infinity;
        let minVal = Infinity;
        let maxDate = '';
        let minDate = '';

        fundData.forEach(d => {
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

        return {
            max: { value: maxVal, date: maxDate },
            min: { value: minVal, date: minDate },
        };
    }, [fundData]);

    return (
        <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
        }}>
            {/* 基金信息头部 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
            }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#1f2937',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>
                        {instrument.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        {instrument.code}
                    </div>
                </div>
                {/* 删除按钮 */}
                <button
                    onClick={() => {
                        if (window.confirm(`确定要删除 ${instrument.name}(${instrument.code}) 吗？`)) {
                            onDelete(instrument.code);
                        }
                    }}
                    style={{
                        padding: '4px 8px',
                        backgroundColor: 'transparent',
                        color: '#9ca3af',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#ef4444';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#9ca3af';
                    }}
                >
                    ✕
                </button>
            </div>

            {/* 图表 */}
            <div style={{ position: 'relative' }}>
                {loading ? (
                    <div style={{
                        height: '180px',
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
                            width: '20px',
                            height: '20px',
                            border: '2px solid #e5e7eb',
                            borderTopColor: '#3b82f6',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                        }} />
                        <div style={{ fontSize: '11px' }}>加载中...</div>
                        <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
                    </div>
                ) : (
                    <TrendChartEcharts
                        id={`${instrument.code}-card`}
                        fundData={fundData}
                        indexData={indexData}
                        fundName={instrument.name}
                        indexName={indexInstrument.name}
                        onDateHover={onDateHover}
                        onDateClick={onDateClick}
                        height={180}
                    />
                )}
            </div>

            {/* 极值标注 */}
            {extremes && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: '#6b7280',
                    borderTop: '1px solid #f3f4f6',
                    paddingTop: '8px',
                }}>
                    <div>
                        最大: <span style={{
                            color: extremes.max.value >= 0 ? '#10b981' : '#ef4444',
                            fontWeight: 'bold',
                        }}>
                            {extremes.max.value >= 0 ? '+' : ''}{extremes.max.value.toFixed(2)}%
                        </span>
                    </div>
                    <div>
                        最小: <span style={{
                            color: extremes.min.value >= 0 ? '#10b981' : '#ef4444',
                            fontWeight: 'bold',
                        }}>
                            {extremes.min.value >= 0 ? '+' : ''}{extremes.min.value.toFixed(2)}%
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
