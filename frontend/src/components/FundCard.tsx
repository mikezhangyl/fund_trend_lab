/**
 * 基金卡片组件 - 单个基金的图表展示
 * 新布局：一行显示3个基金，统一时间区间，包含技术指标
 */
import { useMemo, useEffect, useState } from 'react';
import { TrendChartEcharts } from './TrendChartEcharts';
import type { Instrument, TimeseriesPoint } from '../types';
import { getIndicators, type IndicatorData } from '../services/api';

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
    // 技术指标状态
    const [indicators, setIndicators] = useState<IndicatorData | null>(null);

    // 获取技术指标
    useEffect(() => {
        getIndicators(instrument.code, 20)
            .then(data => setIndicators(data))
            .catch(err => console.error('Failed to load indicators:', err));
    }, [instrument.code]);

    // 计算极值（归一化后的百分比）
    const extremes = useMemo(() => {
        if (fundData.length === 0) return null;

        const baseValue = fundData[0].value;
        let maxVal = -Infinity;
        let minVal = Infinity;

        fundData.forEach(d => {
            const percentChange = ((d.value - baseValue) / baseValue) * 100;
            if (percentChange > maxVal) maxVal = percentChange;
            if (percentChange < minVal) minVal = percentChange;
        });

        return { max: maxVal, min: minVal };
    }, [fundData]);

    // 预警等级颜色
    const warningColor = indicators ? {
        HIGH: '#ef4444',
        MEDIUM: '#f59e0b',
        LOW: '#10b981',
        NONE: '#9ca3af'
    }[indicators.warning_level] : '#9ca3af';

    return (
        <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: `1px solid ${indicators?.warning_level === 'HIGH' ? '#fecaca' : '#e5e7eb'}`,
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            boxShadow: indicators?.warning_level === 'HIGH' ? '0 0 8px rgba(239,68,68,0.2)' : 'none',
        }}>
            {/* 基金信息头部 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
                {/* 预警标签 */}
                {indicators && indicators.warning_level !== 'NONE' && (
                    <span style={{
                        padding: '2px 6px',
                        backgroundColor: warningColor,
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        marginRight: '8px',
                    }}>
                        {indicators.warning_level === 'HIGH' ? '🔥 热门' : '📈 关注'}
                    </span>
                )}
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
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
                >
                    ✕
                </button>
            </div>

            {/* 图表 */}
            <div style={{ position: 'relative' }}>
                {loading ? (
                    <div style={{
                        height: '160px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f9fafb',
                        borderRadius: '4px',
                        color: '#6b7280',
                        fontSize: '11px',
                    }}>
                        加载中...
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
                        height={160}
                    />
                )}
            </div>

            {/* 极值和技术指标 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: '#6b7280',
                borderTop: '1px solid #f3f4f6',
                paddingTop: '8px',
            }}>
                {/* 左侧：极值 */}
                <div>
                    {extremes && (
                        <>
                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                                ↑{extremes.max.toFixed(1)}%
                            </span>
                            {' / '}
                            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                                ↓{extremes.min.toFixed(1)}%
                            </span>
                        </>
                    )}
                </div>
                {/* 右侧：技术指标 */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    {indicators && (
                        <>
                            <span title="相对强度(vs沪深300)">
                                RS: <span style={{
                                    color: indicators.relative_strength > 0 ? '#10b981' : '#ef4444',
                                    fontWeight: 'bold'
                                }}>
                                    {indicators.relative_strength > 0 ? '+' : ''}{indicators.relative_strength}%
                                </span>
                            </span>
                            <span title="动量">
                                动量: <span style={{
                                    color: indicators.momentum > 0 ? '#10b981' : '#ef4444',
                                    fontWeight: 'bold'
                                }}>
                                    {indicators.momentum > 0 ? '+' : ''}{indicators.momentum}%
                                </span>
                            </span>
                            {indicators.vol_ratio < 0.8 && (
                                <span title="波动率压缩" style={{ color: '#8b5cf6' }}>
                                    蓄势
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
