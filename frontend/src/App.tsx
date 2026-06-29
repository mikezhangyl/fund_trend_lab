/**
 * 主应用组件 - 基金趋势实验室
 * 新布局：一行3个基金，统一时间区间选择器，固定顶部Header
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAppState } from './hooks/useAppState';
import { useChartData } from './hooks/useChartData';
import { useAllIndicators } from './hooks/useAllIndicators';
import { FundCard } from './components/FundCard';
import { MarketScannerPage } from './components/MarketScannerPage';
import type { Instrument } from './types';
import * as api from './services/api';

// 时间区间选项
const TIME_RANGE_OPTIONS = [
  { days: 365, label: '1年' },
  { days: 365 * 3, label: '3年' },
  { days: 365 * 5, label: '5年' },
];

// 排序选项
type SortOption = 'newest' | 'name' | 'code' | 'momentum' | 'rs';
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: '最新添加' },
  { value: 'momentum', label: '动量（高→低）' },
  { value: 'rs', label: '相对强度（高→低）' },
  { value: 'name', label: '名称（A→Z）' },
  { value: 'code', label: '代码（A→Z）' },
];

// 单个基金卡片包装组件
interface FundCardWithDataProps {
  instrument: Instrument;
  indexInstrument: Instrument;
  days: number;
  onDateHover: (date: string | null) => void;
  onDateClick: (date: string) => void;
  onDelete: (code: string) => void;
}

function FundCardWithData({
  instrument,
  indexInstrument,
  days,
  onDateHover,
  onDateClick,
  onDelete,
}: FundCardWithDataProps) {
  const chartData = useChartData(instrument.code, indexInstrument.code, days, true);

  return (
    <FundCard
      instrument={instrument}
      indexInstrument={indexInstrument}
      fundData={chartData.fundData}
      indexData={chartData.indexData}
      loading={chartData.loading}
      onDateHover={onDateHover}
      onDateClick={onDateClick}
      onDelete={onDelete}
    />
  );
}

function App() {
  const { state, addInstrument, removeInstrument, refreshAll, isRefreshing } = useAppState();
  const [inputCode, setInputCode] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(365); // 默认1年
  const [sortBy, setSortBy] = useState<SortOption>('newest'); // 排序方式

  // 市场扫描页面状态
  const [showScannerPage, setShowScannerPage] = useState(false);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12; // 每页显示12个（3x4布局）

  // 指数信息（用于对比）
  const indexInstrument: Instrument = useMemo(() => ({
    code: state.selectedIndexCode,
    name: '沪深300',
    type: 'index',
  }), [state.selectedIndexCode]);

  // 获取所有基金的指标数据（用于排序）
  const fundCodes = useMemo(() => state.instruments.map(inst => inst.code), [state.instruments]);
  const { data: indicatorsMap } = useAllIndicators(fundCodes, 20); // 使用20天指标排序

  // 处理日期悬停
  const handleDateHover = useCallback((date: string | null) => {
    setHoveredDate(date);
  }, []);

  // 处理日期点击
  const handleDateClick = useCallback((date: string) => {
    console.log('点击日期:', date);
  }, []);

  // 解析输入的基金代码（支持逗号、空格、换行分隔）
  const parseInputCodes = (input: string): string[] => {
    return input
      .split(/[\s,，\n]+/) // 按空格、逗号、换行分隔
      .map(code => code.trim())
      .filter(code => code.length > 0); // 过滤空字符串
  };

  // 处理添加基金（使用批量API）
  const handleAddFund = async () => {
    if (!inputCode.trim() || isAdding) return;

    const codes = parseInputCodes(inputCode);

    if (codes.length === 0) {
      alert('请输入有效的基金代码');
      return;
    }

    setIsAdding(true);

    try {
      // 使用批量添加API
      const result = await api.batchAddFunds(codes, false, true);

      // 将成功添加的基金加入到本地状态
      for (const item of result.results) {
        if (item.status === 'added') {
          await addInstrument(item.code, item.name, 'fund');
        }
      }

      // 显示结果
      const successMsg = `✅ 成功添加 ${result.added} 只基金，正在后台同步数据...`;
      const errorMsg = result.errors.length > 0
        ? `\n\n❌ 失败 ${result.errors.length} 只：\n${result.errors.map(e => `${e.code}: ${e.error}`).join('\n')}`
        : '';

      alert(successMsg + errorMsg);

      if (result.added > 0) {
        setInputCode(''); // 只在成功时清空
      }
    } catch (err) {
      alert('添加基金失败：' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsAdding(false);
    }
  };

  // 处理刷新所有基金数据
  const handleRefreshAll = async () => {
    if (isRefreshing || state.instruments.length === 0) return;

    try {
      await refreshAll();
      alert(`✅ 已触发 ${state.instruments.length} 只基金的数据刷新，正在后台同步...`);
    } catch (err) {
      alert('刷新失败：' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  // 批量添加基金（供 MarketScannerPage 使用）
  const handleBatchAdd = async (items: Array<{ code: string; name: string }>) => {
    if (items.length === 0) return;

    try {
      const result = await api.batchAddFunds(items, false, true);

      let addedCount = 0;
      for (const item of result.results) {
        if (item.status === 'added') {
          await addInstrument(item.code, item.name, 'fund');
          addedCount++;
        }
      }

      if (addedCount > 0) {
        alert(`✅ 成功添加 ${addedCount} 只基金`);
      } else {
        alert('没有新基金被添加（可能已存在）');
      }
    } catch (err) {
      alert('批量添加失败：' + (err instanceof Error ? err.message : ''));
    }
  };



  // 基金列表排序
  const displayedInstruments = useMemo(() => {
    let instruments = [...state.instruments];

    // 不再筛选现有基金，市场扫描结果独立显示

    switch (sortBy) {
      case 'name':
        // 按名称排序（使用 localeCompare 支持中文）
        return instruments.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      case 'code':
        // 按代码排序
        return instruments.sort((a, b) => a.code.localeCompare(b.code));
      case 'momentum':
        // 按动量排序（高到低）
        if (!indicatorsMap) return instruments;
        return instruments.sort((a, b) => {
          const aMomentum = indicatorsMap[a.code]?.momentum || 0;
          const bMomentum = indicatorsMap[b.code]?.momentum || 0;
          return bMomentum - aMomentum; // 降序
        });
      case 'rs':
        // 按相对强度排序（高到低）
        if (!indicatorsMap) return instruments;
        return instruments.sort((a, b) => {
          const aRS = indicatorsMap[a.code]?.relative_strength || 0;
          const bRS = indicatorsMap[b.code]?.relative_strength || 0;
          return bRS - aRS; // 降序
        });
      case 'newest':
      default:
        // 新添加的在前面
        return instruments.reverse();
    }
  }, [state.instruments, sortBy, indicatorsMap]);

  // 当列表变化时重置页码
  // 注意：这里我们监听列表长度变化，而不是整个列表，以避免频繁重置
  const instrumentCount = state.instruments.length;
  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, instrumentCount]);

  return (
    <>
      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
      <div style={{

        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
      }}>
        {/* 固定顶部 Header */}
        <div style={{
          position: 'sticky',
          top: 0,
          backgroundColor: '#ffffff',
          zIndex: 100,
          borderBottom: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
          }}>
            {/* 左侧：标题 */}
            <h1 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#1f2937',
              margin: 0,
              whiteSpace: 'nowrap',
            }}>
              基金趋势实验室
            </h1>

            {/* 市场扫描入口图标 */}
            <button
              onClick={() => setShowScannerPage(true)}
              title="全市场扫描"
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#fff7ed',
                color: '#ea580c',
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s',
              }}
            >
              🔍 <span style={{ fontSize: '12px', fontWeight: 'bold' }}>扫描</span>
            </button>

            {/* 添加基金输入框 */}
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFund()}
                placeholder="基金代码（支持多个，逗号分隔）"
                disabled={isAdding}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  width: '240px',
                  opacity: isAdding ? 0.6 : 1,
                  cursor: isAdding ? 'not-allowed' : 'text',
                }}
              />
              <button
                onClick={handleAddFund}
                disabled={isAdding}
                style={{
                  padding: '6px 12px',
                  backgroundColor: isAdding ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: isAdding ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {isAdding ? '添加中...' : '添加'}
              </button>
            </div>
            {hoveredDate && (
              <div style={{
                padding: '4px 10px',
                backgroundColor: '#f3f4f6',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#6b7280',
              }}>
                {hoveredDate}
              </div>
            )}

            {/* 排序选择器 */}
            <div style={{
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>排序:</span>
              {SORT_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: sortBy === option.value ? '#e0e7ff' : 'transparent',
                    color: sortBy === option.value ? '#4f46e5' : '#6b7280',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: sortBy === option.value ? 'bold' : 'normal',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* 刷新按钮 */}
            <button
              onClick={handleRefreshAll}
              disabled={isRefreshing || state.instruments.length === 0}
              style={{
                marginLeft: 'auto',
                padding: '6px 12px',
                backgroundColor: isRefreshing ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: isRefreshing || state.instruments.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: state.instruments.length === 0 ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
              title={state.instruments.length === 0 ? '请先添加基金' : '刷新所有基金数据'}
            >
              <span style={{
                display: 'inline-block',
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              }}>
                🔄
              </span>
              {isRefreshing ? '刷新中...' : '刷新数据'}
            </button>

            {/* 右侧：时间区间选择器 */}
            <div style={{
              display: 'flex',
              gap: '6px',
            }}>
              {TIME_RANGE_OPTIONS.map(option => (
                <button
                  key={option.days}
                  onClick={() => setSelectedDays(option.days)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: selectedDays === option.days ? '#3b82f6' : '#f3f4f6',
                    color: selectedDays === option.days ? 'white' : '#4b5563',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: selectedDays === option.days ? 'bold' : 'normal',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '20px',
        }}>
          {/* 基金网格 - 一行3个 */}
          {displayedInstruments.length === 0 ? (
            <div style={{
              padding: '60px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '14px',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
            }}>
              还没有添加任何基金，请在上方输入基金代码开始使用
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
            }}>
              {displayedInstruments.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(instrument => (
                <FundCardWithData
                  key={instrument.code}
                  instrument={instrument}
                  indexInstrument={indexInstrument}
                  days={selectedDays}
                  onDateHover={handleDateHover}
                  onDateClick={handleDateClick}
                  onDelete={removeInstrument}
                />
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {displayedInstruments.length > ITEMS_PER_PAGE && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              marginTop: '24px',
              alignItems: 'center'
            }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 16px',
                  backgroundColor: currentPage === 1 ? '#e5e7eb' : 'white',
                  color: currentPage === 1 ? '#9ca3af' : '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                上一页
              </button>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>
                第 {currentPage} / {Math.ceil(displayedInstruments.length / ITEMS_PER_PAGE)} 页
                (共 {displayedInstruments.length} 只)
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(displayedInstruments.length / ITEMS_PER_PAGE), p + 1))}
                disabled={currentPage >= Math.ceil(displayedInstruments.length / ITEMS_PER_PAGE)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: currentPage >= Math.ceil(displayedInstruments.length / ITEMS_PER_PAGE) ? '#e5e7eb' : 'white',
                  color: currentPage >= Math.ceil(displayedInstruments.length / ITEMS_PER_PAGE) ? '#9ca3af' : '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: currentPage >= Math.ceil(displayedInstruments.length / ITEMS_PER_PAGE) ? 'not-allowed' : 'pointer',
                }}
              >
                下一页
              </button>
            </div>
          )}

          {/* 底部提示 */}
          <div style={{
            marginTop: '20px',
            padding: '10px 12px',
            backgroundColor: '#ffffff',
            borderRadius: '4px',
            border: '1px solid #e5e7eb',
            fontSize: '12px',
            color: '#6b7280',
          }}>
            <strong>💡 图表说明：</strong>
            归一化显示，起点为0%。蓝色实线为基金，灰色虚线为沪深300指数。
            如果基金历史不足所选区间，将从成立日开始显示。
          </div>
        </div>
      </div >

      {/* 全屏市场扫描页面 */}
      {showScannerPage && (
        <MarketScannerPage
          onClose={() => setShowScannerPage(false)}
          onAddFunds={handleBatchAdd}
        />
      )}
    </>
  );
}

export default App;
