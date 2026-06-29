/**
 * 波动率压缩比迷你图表
 * 显示滚动vol_ratio曲线
 */
import { useState, useMemo } from 'react';
import type { VolatilityRatioPoint } from '../services/api';
import type { TimeseriesPoint } from '../types';

interface VolRatioMiniChartProps {
    data: VolatilityRatioPoint[];
    fundData: TimeseriesPoint[];
}

export function VolRatioMiniChart({ data, fundData }: VolRatioMiniChartProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

    if (!data || data.length === 0) {
        return null;
    }

    // 创建日期到归一化净值的映射
    const fundValueByDate = useMemo(() => {
        if (!fundData || fundData.length === 0) return new Map();

        const map = new Map<string, number>();
        // 找到基准值（第一个非空值）
        let baseValue: number | null = null;
        for (const point of fundData) {
            if (point.value != null) {
                baseValue = point.value;
                break;
            }
        }

        if (baseValue === null) return map;

        // 计算每个日期的百分比变化
        fundData.forEach(point => {
            if (point.value != null) {
                const percentChange = ((point.value - baseValue) / baseValue) * 100;
                map.set(point.date, percentChange);
            }
        });

        return map;
    }, [fundData]);

    // 计算图表尺寸
    const width = 100;
    const height = 40;
    const padding = 2;

    // 找到数据范围
    const values = data.map(d => d.vol_ratio);
    const minVal = Math.min(...values, 0.5);
    const maxVal = Math.max(...values, 1.5);

    // 数据点到SVG坐标的转换
    const xScale = (index: number) => padding + (index / (data.length - 1)) * (width - 2 * padding);
    const yScale = (value: number) => height - padding - ((value - minVal) / (maxVal - minVal)) * (height - 2 * padding);

    // 参考线的Y坐标
    const y0_6 = yScale(0.6);
    const y0_8 = yScale(0.8);
    const y1_0 = yScale(1.0);

    // 生成路径
    const pathData = data.map((d, i) => {
        const x = xScale(i);
        const y = yScale(d.vol_ratio);
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(' ');

    // 根据最新值选择颜色
    const latestRatio = data[data.length - 1]?.vol_ratio || 1.0;
    const lineColor = latestRatio < 0.6 ? '#9333ea' : latestRatio < 0.8 ? '#c084fc' : '#9ca3af';

    // 处理鼠标移动
    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        // 将屏幕坐标转换为SVG坐标
        const svgX = (x / rect.width) * width;

        // 找到最近的数据点
        let closestIndex = 0;
        let minDistance = Infinity;
        data.forEach((_, i) => {
            const pointX = xScale(i);
            const distance = Math.abs(svgX - pointX);
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
        });

        setHoveredIndex(closestIndex);
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleMouseLeave = () => {
        setHoveredIndex(null);
        setTooltipPos(null);
    };

    // 悬停数据
    const hoveredData = hoveredIndex !== null ? data[hoveredIndex] : null;
    const hoveredColor = hoveredData
        ? (hoveredData.vol_ratio < 0.6 ? '#9333ea' : hoveredData.vol_ratio < 0.8 ? '#c084fc' : '#9ca3af')
        : lineColor;

    return (
        <div style={{
            marginTop: '8px',
            padding: '6px 8px',
            backgroundColor: '#f9fafb',
            borderRadius: '4px',
            border: '1px solid #e5e7eb',
            position: 'relative',
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
            }}>
                <span style={{
                    fontSize: '11px',
                    color: '#6b7280',
                    fontWeight: 'bold',
                }}>
                    波动率压缩比
                </span>
                <span style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: hoveredColor,
                }}>
                    {hoveredData ? hoveredData.vol_ratio.toFixed(2) : latestRatio.toFixed(2)}
                </span>
            </div>

            <svg
                width={width}
                height={height}
                style={{
                    display: 'block',
                    width: '100%',
                    cursor: 'crosshair',
                }}
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                {/* 参考线 */}
                <line x1={0} y1={y0_6} x2={width} y2={y0_6} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2,2" />
                <line x1={0} y1={y0_8} x2={width} y2={y0_8} stroke="#d1d5db" strokeWidth="0.5" strokeDasharray="2,2" />
                <line x1={0} y1={y1_0} x2={width} y2={y1_0} stroke="#9ca3af" strokeWidth="0.5" />

                {/* Vol Ratio曲线 */}
                <path
                    d={pathData}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth="0.19"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* 悬停时显示垂直线和数据点 */}
                {hoveredIndex !== null && (
                    <>
                        <line
                            x1={xScale(hoveredIndex)}
                            y1={0}
                            x2={xScale(hoveredIndex)}
                            y2={height}
                            stroke={hoveredColor}
                            strokeWidth="0.5"
                            strokeDasharray="2,2"
                            opacity="0.5"
                        />
                        <circle
                            cx={xScale(hoveredIndex)}
                            cy={yScale(data[hoveredIndex].vol_ratio)}
                            r="1.5"
                            fill={hoveredColor}
                            stroke="white"
                            strokeWidth="0.5"
                        />
                    </>
                )}

                {/* 最新数据点 */}
                {hoveredIndex === null && (
                    <circle
                        cx={xScale(data.length - 1)}
                        cy={yScale(latestRatio)}
                        r="2"
                        fill={lineColor}
                    />
                )}
            </svg>

            {/* Tooltip */}
            {hoveredData && tooltipPos && (
                <div style={{
                    position: 'absolute',
                    left: tooltipPos.x + 10,
                    top: tooltipPos.y - 40,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 10,
                }}>
                    <div style={{ marginBottom: '2px' }}>{hoveredData.date}</div>
                    {(() => {
                        const fundValue = fundValueByDate.get(hoveredData.date);
                        if (fundValue != null) {
                            const color = fundValue >= 0 ? '#10b981' : '#ef4444';
                            return (
                                <div style={{ color, fontWeight: 'bold' }}>
                                    净值: {fundValue >= 0 ? '+' : ''}{fundValue.toFixed(2)}%
                                </div>
                            );
                        }
                        return null;
                    })()}
                    <div style={{ color: hoveredColor, fontWeight: 'bold' }}>
                        波动率: {hoveredData.vol_ratio.toFixed(3)}
                    </div>
                </div>
            )}

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '2px',
                fontSize: '9px',
                color: '#9ca3af',
            }}>
                <span>0.6</span>
                <span>0.8</span>
                <span>1.0</span>
            </div>
        </div>
    );
}
