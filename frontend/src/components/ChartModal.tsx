/**
 * 全屏图表模态框组件
 * 点击图表时显示大尺寸全屏视图
 */
import { useEffect, useCallback } from 'react';
import { TrendChartEcharts } from './TrendChartEcharts';
import type { TimeseriesPoint } from '../types';
import type { SurgeEvent, UptrendPhase } from '../services/api';

interface ChartModalProps {
    isOpen: boolean;
    onClose: () => void;
    fundData: TimeseriesPoint[];
    indexData: TimeseriesPoint[];
    fundName: string;
    indexName: string;
    rangeLabel: string;
    surgeEvents?: SurgeEvent[];
    uptrendPhases?: UptrendPhase[];
}

export function ChartModal({
    isOpen,
    onClose,
    fundData,
    indexData,
    fundName,
    indexName,
    rangeLabel,
    surgeEvents = [],
    uptrendPhases = [],
}: ChartModalProps) {
    // ESC 键关闭
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'auto';
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
            }}
        >
            {/* 点击内容区不关闭 */}
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '1400px',
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    padding: '24px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                }}
            >
                {/* 标题栏 */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '20px', color: '#1f2937' }}>
                            {fundName}
                        </h2>
                        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280' }}>
                            {rangeLabel}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#f3f4f6',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            cursor: 'pointer',
                            color: '#374151',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <span>ESC</span>
                        <span>关闭</span>
                    </button>
                </div>

                {/* 大尺寸图表 */}
                <div style={{ height: '500px', paddingTop: '30px' }}>
                    <TrendChartEcharts
                        id="fullscreen-chart"
                        fundData={fundData}
                        indexData={indexData}
                        fundName={fundName}
                        indexName={indexName}
                        height={470}
                        surgeEvents={surgeEvents}
                        uptrendPhases={uptrendPhases}
                    />
                </div>

                {/* 图例说明 */}
                <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#6b7280',
                }}>
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '20px', height: '3px', backgroundColor: '#3b82f6' }} />
                            <span>基金走势</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '20px', height: '3px', backgroundColor: '#9ca3af', borderStyle: 'dashed' }} />
                            <span>沪深300</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '20px', height: '12px', backgroundColor: 'rgba(239, 68, 68, 0.15)' }} />
                            <span>急涨区域</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#ef4444' }}>🚀 X.XX%/天</span>
                            <span>加速上涨斜率</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#f97316' }}>X.XX%/天</span>
                            <span>普通上涨斜率</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
