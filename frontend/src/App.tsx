/**
 * 主应用组件 - 基金趋势实验室
 * 新布局：一行3个基金，统一时间区间选择器，固定顶部Header
 */
import { useState, useCallback, useMemo } from 'react';
import { useAppState } from './hooks/useAppState';
import { useChartData } from './hooks/useChartData';
import { FundCard } from './components/FundCard';
import type { Instrument } from './types';
import * as api from './services/api';

// 时间区间选项
const TIME_RANGE_OPTIONS = [
  { days: 365, label: '1年' },
  { days: 365 * 3, label: '3年' },
  { days: 365 * 5, label: '5年' },
];

// 排序选项
type SortOption = 'newest' | 'name' | 'code';
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: '最新' },
  { value: 'name', label: '名称' },
  { value: 'code', label: '代码' },
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
  const { state, addInstrument, removeInstrument } = useAppState();
  const [inputCode, setInputCode] = useState('');
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(365); // 默认1年
  const [sortBy, setSortBy] = useState<SortOption>('newest'); // 排序方式

  // 指数信息（用于对比）
  const indexInstrument: Instrument = useMemo(() => ({
    code: state.selectedIndexCode,
    name: '沪深300',
    type: 'index',
  }), [state.selectedIndexCode]);

  // 处理日期悬停
  const handleDateHover = useCallback((date: string | null) => {
    setHoveredDate(date);
  }, []);

  // 处理日期点击
  const handleDateClick = useCallback((date: string) => {
    console.log('点击日期:', date);
  }, []);

  // 处理添加基金
  const handleAddFund = async () => {
    if (!inputCode.trim()) return;

    try {
      const instrumentInfo = await api.getInstrument(inputCode);
      await addInstrument(inputCode, instrumentInfo.name, instrumentInfo.type);

      try {
        await api.syncInstruments([inputCode]);
        console.log(`已启动基金 ${inputCode} 的数据同步`);
      } catch (syncErr) {
        console.error('启动数据同步失败:', syncErr);
      }

      setInputCode(''); // 清空输入框
    } catch (err) {
      alert('添加基金失败：' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  // 基金列表排序
  const displayedInstruments = useMemo(() => {
    const instruments = [...state.instruments];

    switch (sortBy) {
      case 'name':
        // 按名称排序（使用 localeCompare 支持中文）
        return instruments.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      case 'code':
        // 按代码排序
        return instruments.sort((a, b) => a.code.localeCompare(b.code));
      case 'newest':
      default:
        // 新添加的在前面
        return instruments.reverse();
    }
  }, [state.instruments, sortBy]);

  return (
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
              placeholder="基金代码"
              style={{
                padding: '6px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
                width: '100px',
              }}
            />
            <button
              onClick={handleAddFund}
              style={{
                padding: '6px 12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              添加
            </button>
          </div>

          {/* 悬停日期显示 */}
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

          {/* 右侧：时间区间选择器 */}
          <div style={{
            marginLeft: 'auto',
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
            {displayedInstruments.map(instrument => (
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
    </div>
  );
}

export default App;
