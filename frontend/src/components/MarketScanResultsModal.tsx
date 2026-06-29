import React, { useState, useMemo } from 'react';
import * as api from '../services/api';

interface MarketScanResultsModalProps {
    results: api.MarketScanFund[];
    isOpen: boolean;
    onClose: () => void;
    onAddFunds: (funds: any[]) => void;
}

export const MarketScanResultsModal: React.FC<MarketScanResultsModalProps> = ({
    results,
    isOpen,
    onClose,
    onAddFunds,
}) => {
    const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
    const [sortField, setSortField] = useState<keyof api.MarketScanFund>('avg_monthly_growth');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // 初始化全选
    React.useEffect(() => {
        if (isOpen && results.length > 0) {
            // 默认全选前20个
            const initialSelected = new Set(results.slice(0, 20).map(f => f.code));
            setSelectedCodes(initialSelected);
        }
    }, [isOpen, results]);

    const sortedResults = useMemo(() => {
        return [...results].sort((a, b) => {
            const aValue = a[sortField];
            const bValue = b[sortField];

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }
            return 0;
        });
    }, [results, sortField, sortDirection]);

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
            setSelectedCodes(new Set(results.map(f => f.code)));
        } else {
            setSelectedCodes(new Set());
        }
    };

    const handleSort = (field: keyof api.MarketScanFund) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                width: '900px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                            扫描结果
                        </h2>
                        <p style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280' }}>
                            发现 {results.length} 只符合条件的基金，请选择要添加到监控列表的基金
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            color: '#6b7280',
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* List */}
                <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9fafb', zIndex: 1 }}>
                            <tr>
                                <th style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                                    <input
                                        type="checkbox"
                                        checked={results.length > 0 && selectedCodes.size === results.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                </th>
                                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                                    基金代码
                                </th>
                                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                                    基金名称
                                </th>
                                <th
                                    style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280', borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                                    onClick={() => handleSort('avg_monthly_growth')}
                                >
                                    月均增长 {sortField === 'avg_monthly_growth' && (sortDirection === 'desc' ? '↓' : '↑')}
                                </th>
                                <th
                                    style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280', borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                                    onClick={() => handleSort('total_growth')}
                                >
                                    总增长 {sortField === 'total_growth' && (sortDirection === 'desc' ? '↓' : '↑')}
                                </th>
                                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                                    区间
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedResults.map((fund) => (
                                <tr
                                    key={fund.code}
                                    style={{
                                        borderBottom: '1px solid #f3f4f6',
                                        backgroundColor: selectedCodes.has(fund.code) ? '#f0fdf4' : 'white',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onClick={() => handleToggleSelect(fund.code)}
                                >
                                    <td style={{ padding: '12px 16px' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedCodes.has(fund.code)}
                                            onChange={() => { }} // handled by row click
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', fontFamily: 'monospace' }}>
                                        {fund.code}
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '500' }}>
                                        {fund.name}
                                    </td>
                                    <td style={{ padding: '12px 16px', color: '#ef4444', fontWeight: 'bold' }}>
                                        +{fund.avg_monthly_growth.toFixed(1)}%
                                    </td>
                                    <td style={{ padding: '12px 16px', color: '#ef4444' }}>
                                        +{fund.total_growth.toFixed(1)}%
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>
                                        {fund.start_date} → {fund.end_date}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '20px',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '0 0 12px 12px',
                }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: '14px', color: '#6b7280' }}>
                        已选择: <strong style={{ margin: '0 4px', color: '#111827' }}>{selectedCodes.size}</strong> 只基金
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            backgroundColor: 'white',
                            color: '#374151',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                        }}
                    >
                        取消
                    </button>
                    <button
                        onClick={() => {
                            const selectedFunds = results
                                .filter(f => selectedCodes.has(f.code))
                                .map(f => ({ code: f.code, name: f.name }));
                            onAddFunds(selectedFunds);
                        }}
                        disabled={selectedCodes.size === 0}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: selectedCodes.size === 0 ? '#9ca3af' : '#10b981',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: selectedCodes.size === 0 ? 'not-allowed' : 'pointer',
                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                        }}
                    >
                        添加选中基金 ({selectedCodes.size})
                    </button>
                </div>
            </div>
        </div>
    );
};
