/**
 * 基金卡片组件 - 单个基金的图表展示
 * 新布局：一行显示3个基金，统一时间区间，包含技术指标
 */
import { useMemo, useEffect, useState } from 'react';
import { TrendChartEcharts } from './TrendChartEcharts';
import { ChartModal } from './ChartModal';
import { VolRatioMiniChart } from './VolRatioMiniChart';
import { useVolatilityRatio } from '../hooks/useVolatilityRatio';
import type { Instrument, TimeseriesPoint } from '../types';
import { getIndicators, getSurgeEvents, getUptrendPhases, setFavorites, getFavorites, type IndicatorData, type SurgeEvent, type UptrendPhase } from '../services/api';

export interface FundCardProps {
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
    // 急涨事件状态
    const [surgeEvents, setSurgeEvents] = useState<SurgeEvent[]>([]);
    // 连续上涨阶段状态
    const [uptrendPhases, setUptrendPhases] = useState<UptrendPhase[]>([]);
    // 全屏模态框状态
    const [isModalOpen, setIsModalOpen] = useState(false);
    // 收藏状态 - 从后端API读取
    const [isFavorite, setIsFavorite] = useState<boolean>(false);
    const [favoritesLoading, setFavoritesLoading] = useState<boolean>(true);
    const [allFavorites, setAllFavorites] = useState<string[]>([]);
    // 获取波动率压缩比数据
    const { data: volRatioData } = useVolatilityRatio(instrument.code, 365); // 最近1年数据

    // 加载收藏列表
    useEffect(() => {
        getFavorites()
            .then(data => {
                setAllFavorites(data.codes);
                setIsFavorite(data.codes.includes(instrument.code));
            })
            .catch(err => console.error('Failed to load favorites:', err))
            .finally(() => setFavoritesLoading(false));
    }, [instrument.code]);

    // 切换收藏状态
    const toggleFavorite = async (e: React.MouseEvent) => {
        e.stopPropagation(); // 防止触发图表放大
        setFavoritesLoading(true);

        try {
            const newFavorites = isFavorite
                ? allFavorites.filter(code => code !== instrument.code)
                : [...allFavorites, instrument.code];

            await setFavorites(newFavorites, 'replace');

            setAllFavorites(newFavorites);
            setIsFavorite(!isFavorite);
        } catch (err) {
            console.error('Failed to update favorites:', err);
        } finally {
            setFavoritesLoading(false);
        }
    };

    // 获取技术指标、急涨事件和上涨阶段
    useEffect(() => {
        getIndicators(instrument.code, 20)
            .then(data => setIndicators(data))
            .catch(err => console.error('Failed to load indicators:', err));

        getSurgeEvents(instrument.code)
            .then(events => setSurgeEvents(events))
            .catch(err => console.error('Failed to load surge events:', err));

        // 获取连续上涨阶段（5%回撤容忍，5%最小涨幅）
        getUptrendPhases(instrument.code, 5.0, 5.0, 5)
            .then(phases => setUptrendPhases(phases))
            .catch(err => console.error('Failed to load uptrend phases:', err));
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

    // 过滤只保留当前显示范围内的上涨阶段
    const filteredUptrendPhases = useMemo(() => {
        if (fundData.length === 0 || uptrendPhases.length === 0) return [];

        const chartStartDate = fundData[0].date;
        const chartEndDate = fundData[fundData.length - 1].date;

        return uptrendPhases.filter(phase =>
            phase.end_date >= chartStartDate && phase.start_date <= chartEndDate
        );
    }, [fundData, uptrendPhases]);

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
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}>
                        {instrument.name}
                        {/* 收藏星标 */}
                        <button
                            onClick={toggleFavorite}
                            disabled={favoritesLoading}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: favoritesLoading ? 'not-allowed' : 'pointer',
                                padding: '2px',
                                fontSize: '16px',
                                lineHeight: 1,
                                color: isFavorite ? '#f59e0b' : '#d1d5db',
                                opacity: favoritesLoading ? 0.5 : 1,
                                transition: 'color 0.2s, transform 0.2s',
                            }}
                            title={favoritesLoading ? '加载中...' : (isFavorite ? '取消收藏' : '添加收藏')}
                        >
                            ★
                        </button>
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

            {/* 图表 - 点击放大 */}
            <div
                style={{ position: 'relative', cursor: loading ? 'default' : 'zoom-in' }}
                onClick={() => !loading && setIsModalOpen(true)}
                title={loading ? '' : '点击放大查看'}
            >
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
                    <>
                        <TrendChartEcharts
                            id={`${instrument.code}-card`}
                            fundData={fundData}
                            indexData={indexData}
                            fundName={instrument.name}
                            indexName={indexInstrument.name}
                            onDateHover={onDateHover}
                            onDateClick={onDateClick}
                            height={160}
                            surgeEvents={surgeEvents}
                            uptrendPhases={filteredUptrendPhases}
                            volRatioData={volRatioData}
                        />
                        {/* 放大图标 */}
                        <div style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            fontSize: '10px',
                            color: '#6b7280',
                            pointerEvents: 'none',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        }}>
                            🔍
                        </div>
                    </>
                )}
            </div>

            {/* 波动率压缩比迷你图 */}
            {volRatioData && volRatioData.length > 0 && (
                <VolRatioMiniChart
                    data={volRatioData}
                    fundData={fundData}
                />
            )}

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
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {indicators && (
                        <>
                            <span title={`近${indicators.period_days}天相对强度(vs沪深300)`}>
                                {indicators.period_days}天RS: <span style={{
                                    color: indicators.relative_strength > 0 ? '#10b981' : '#ef4444',
                                    fontWeight: 'bold'
                                }}>
                                    {indicators.relative_strength > 0 ? '+' : ''}{indicators.relative_strength}%
                                </span>
                            </span>
                            <span title={`近${indicators.period_days}天动量`}>
                                {indicators.period_days}天动量: <span style={{
                                    color: indicators.momentum > 0 ? '#10b981' : '#ef4444',
                                    fontWeight: 'bold'
                                }}>
                                    {indicators.momentum > 0 ? '+' : ''}{indicators.momentum}%
                                </span>
                            </span>
                            {indicators.vol_ratio < 0.8 && (
                                <span title="波动率压缩(近期波动收窄)" style={{ color: '#8b5cf6' }}>
                                    蓄势
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* 全屏模态框 */}
            <ChartModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                fundData={fundData}
                indexData={indexData}
                fundName={instrument.name}
                indexName={indexInstrument.name}
                rangeLabel="当前时间区间"
                surgeEvents={surgeEvents}
                uptrendPhases={filteredUptrendPhases}
            />
        </div>
    );
}
