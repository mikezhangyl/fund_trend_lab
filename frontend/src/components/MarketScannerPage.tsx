/**
 * Market Scanner Page - 全屏市场扫描页面
 * 独立的扫描功能页面，覆盖主界面
 */
import React, { useState, useEffect, useRef } from 'react';
import * as api from '../services/api';

interface MarketScannerPageProps {
    onClose: () => void;
    onAddFunds: (funds: Array<{ code: string; name: string }>) => void;
}

export const MarketScannerPage: React.FC<MarketScannerPageProps> = ({
    onClose,
    onAddFunds,
}) => {
    // Scan parameters
    const [scanMonths, setScanMonths] = useState('3');
    const [minGrowth, setMinGrowth] = useState('20');

    // Scan state
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState({ progress: 0, total: 0, percentage: 0 });
    const [scanLogs, setScanLogs] = useState<string[]>([]);
    const [scanResults, setScanResults] = useState<api.MarketScanFund[]>([]);

    // Selection state
    const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
    const [sortField, setSortField] = useState<keyof api.MarketScanFund>('avg_monthly_growth');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Refs
    const logEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [scanLogs]);

    // Auto-select top 20 when results come in
    useEffect(() => {
        if (scanResults.length > 0) {
            const initialSelected = new Set(scanResults.slice(0, 20).map(f => f.code));
            setSelectedCodes(initialSelected);
        }
    }, [scanResults]);

    // Start scanning
    const handleStartScan = async () => {
        const months = parseInt(scanMonths) || 3;
        const growth = parseFloat(minGrowth) || 20;

        if (months < 1 || growth < 0) {
            alert('请输入有效参数');
            return;
        }

        try {
            await api.startMarketScan(months, growth);
            setIsScanning(true);
            setScanResults([]);
            setScanLogs([]);
            setSelectedCodes(new Set());

            // Poll for status
            const poll = setInterval(async () => {
                try {
                    const status = await api.getMarketScanStatus();
                    setScanProgress(status);

                    if (status.logs && status.logs.length > 0) {
                        setScanLogs(status.logs);
                    }

                    if (!status.is_scanning && status.progress > 0) {
                        setIsScanning(false);
                        clearInterval(poll);

                        const results = await api.getMarketScanResults();
                        setScanResults(results.results);
                    }
                } catch (e) {
                    console.error('Polling error:', e);
                }
            }, 1000);
        } catch (err) {
            setIsScanning(false);
            alert('扫描失败：' + (err instanceof Error ? err.message : ''));
        }
    };

    // Sorting
    const sortedResults = React.useMemo(() => {
        return [...scanResults].sort((a, b) => {
            const aValue = a[sortField];
            const bValue = b[sortField];

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }
            return 0;
        });
    }, [scanResults, sortField, sortDirection]);

    const handleSort = (field: keyof api.MarketScanFund) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Selection
    const handleToggleSelect = (code: string) => {
        const newSelected = new Set(selectedCodes);
        if (newSelected.has(code)) {
            newSelected.delete(code);
        } else {
            newSelected.add(code);
        }
        setSelectedCodes(newSelected);
    };

    const handleSelectAll = (select: boolean) => {
        if (select) {
            setSelectedCodes(new Set(scanResults.map(f => f.code)));
        } else {
            setSelectedCodes(new Set());
        }
    };

    // Add selected funds
    const handleAddSelected = () => {
        const selectedFunds = scanResults
            .filter(f => selectedCodes.has(f.code))
            .map(f => ({ code: f.code, name: f.name }));
        onAddFunds(selectedFunds);
        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#0f172a',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            color: '#e2e8f0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(to right, #1e293b, #0f172a)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>🔍</span>
                    <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                        全市场基金扫描
                    </h1>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid #475569',
                        backgroundColor: 'transparent',
                        color: '#94a3b8',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#1e293b';
                        e.currentTarget.style.borderColor = '#64748b';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = '#475569';
                    }}
                >
                    ✕ 关闭
                </button>
            </div>

            {/* Main Content */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                maxWidth: '1200px',
                margin: '0 auto',
                width: '100%',
            }}>
                {/* Scan Parameters */}
                <div style={{
                    padding: '20px',
                    backgroundColor: '#1e293b',
                    borderRadius: '12px',
                    border: '1px solid #334155',
                }}>
                    <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', color: '#f1f5f9' }}>
                        扫描参数
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', color: '#94a3b8' }}>近</span>
                            <input
                                type="number"
                                value={scanMonths}
                                onChange={(e) => setScanMonths(e.target.value)}
                                disabled={isScanning}
                                style={{
                                    width: '60px',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid #475569',
                                    backgroundColor: '#0f172a',
                                    color: '#f1f5f9',
                                    fontSize: '14px',
                                    textAlign: 'center',
                                }}
                            />
                            <span style={{ fontSize: '14px', color: '#94a3b8' }}>个月</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', color: '#94a3b8' }}>月均增长 ≥</span>
                            <input
                                type="number"
                                value={minGrowth}
                                onChange={(e) => setMinGrowth(e.target.value)}
                                disabled={isScanning}
                                style={{
                                    width: '60px',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid #475569',
                                    backgroundColor: '#0f172a',
                                    color: '#f1f5f9',
                                    fontSize: '14px',
                                    textAlign: 'center',
                                }}
                            />
                            <span style={{ fontSize: '14px', color: '#94a3b8' }}>%</span>
                        </div>
                        <button
                            onClick={handleStartScan}
                            disabled={isScanning}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '8px',
                                border: 'none',
                                background: isScanning
                                    ? 'linear-gradient(135deg, #475569, #334155)'
                                    : 'linear-gradient(135deg, #f97316, #ea580c)',
                                color: 'white',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                cursor: isScanning ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: isScanning ? 'none' : '0 4px 12px rgba(249, 115, 22, 0.3)',
                                transition: 'all 0.2s',
                            }}
                        >
                            {isScanning ? (
                                <>
                                    <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                                    扫描中 {scanProgress.percentage}%
                                </>
                            ) : (
                                <>🚀 开始扫描</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Log Console */}
                <div style={{
                    padding: '16px',
                    backgroundColor: '#020617',
                    borderRadius: '12px',
                    border: '1px solid #1e293b',
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    fontSize: '12px',
                    height: '160px',
                    overflow: 'auto',
                }}>
                    <div style={{ color: '#64748b', marginBottom: '8px' }}>
                        {'>'} 控制台日志
                    </div>
                    {scanLogs.length === 0 ? (
                        <div style={{ color: '#475569' }}>等待扫描开始...</div>
                    ) : (
                        scanLogs.map((log, i) => (
                            <div key={i} style={{
                                color: log.includes('发现') ? '#22c55e' :
                                    log.includes('错误') ? '#ef4444' : '#94a3b8',
                                padding: '2px 0',
                            }}>
                                {log}
                            </div>
                        ))
                    )}
                    <div ref={logEndRef} />
                </div>

                {/* Results Section */}
                {scanResults.length > 0 && (
                    <div style={{
                        flex: 1,
                        backgroundColor: '#1e293b',
                        borderRadius: '12px',
                        border: '1px solid #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: '300px',
                    }}>
                        {/* Results Header */}
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid #334155',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <div>
                                <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#f1f5f9' }}>
                                    扫描结果
                                </h2>
                                <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                                    发现 {scanResults.length} 只符合条件的基金，已选择 {selectedCodes.size} 只
                                </p>
                            </div>
                            <button
                                onClick={handleAddSelected}
                                disabled={selectedCodes.size === 0}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: selectedCodes.size === 0
                                        ? '#475569'
                                        : 'linear-gradient(135deg, #10b981, #059669)',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    cursor: selectedCodes.size === 0 ? 'not-allowed' : 'pointer',
                                    boxShadow: selectedCodes.size === 0 ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
                                }}
                            >
                                ✓ 添加选中 ({selectedCodes.size})
                            </button>
                        </div>

                        {/* Results Table */}
                        <div style={{ flex: 1, overflow: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{
                                    position: 'sticky',
                                    top: 0,
                                    backgroundColor: '#1e293b',
                                    zIndex: 1,
                                }}>
                                    <tr>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #334155' }}>
                                            <input
                                                type="checkbox"
                                                checked={scanResults.length > 0 && selectedCodes.size === scanResults.length}
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                            />
                                        </th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                                            基金代码
                                        </th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                                            基金名称
                                        </th>
                                        <th
                                            style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: '#94a3b8', borderBottom: '1px solid #334155', cursor: 'pointer' }}
                                            onClick={() => handleSort('avg_monthly_growth')}
                                        >
                                            月均增长 {sortField === 'avg_monthly_growth' && (sortDirection === 'desc' ? '↓' : '↑')}
                                        </th>
                                        <th
                                            style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: '#94a3b8', borderBottom: '1px solid #334155', cursor: 'pointer' }}
                                            onClick={() => handleSort('total_growth')}
                                        >
                                            总增长 {sortField === 'total_growth' && (sortDirection === 'desc' ? '↓' : '↑')}
                                        </th>
                                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                                            区间
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedResults.map((fund) => (
                                        <tr
                                            key={fund.code}
                                            onClick={() => handleToggleSelect(fund.code)}
                                            style={{
                                                cursor: 'pointer',
                                                backgroundColor: selectedCodes.has(fund.code) ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                                transition: 'background-color 0.2s',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!selectedCodes.has(fund.code)) {
                                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = selectedCodes.has(fund.code)
                                                    ? 'rgba(16, 185, 129, 0.1)'
                                                    : 'transparent';
                                            }}
                                        >
                                            <td style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCodes.has(fund.code)}
                                                    onChange={() => { }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                />
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: '13px', fontFamily: 'monospace', color: '#e2e8f0', borderBottom: '1px solid #1e293b' }}>
                                                {fund.code}
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500', color: '#f1f5f9', borderBottom: '1px solid #1e293b' }}>
                                                {fund.name}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 'bold', color: '#22c55e', borderBottom: '1px solid #1e293b' }}>
                                                +{fund.avg_monthly_growth.toFixed(1)}%
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', color: '#22c55e', borderBottom: '1px solid #1e293b' }}>
                                                +{fund.total_growth.toFixed(1)}%
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: '#64748b', borderBottom: '1px solid #1e293b' }}>
                                                {fund.start_date} → {fund.end_date}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Spin Animation */}
            <style>
                {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
            </style>
        </div>
    );
};
