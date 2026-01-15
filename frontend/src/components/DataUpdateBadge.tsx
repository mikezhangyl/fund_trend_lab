/**
 * 数据更新状态徽章
 * 显示基金净值数据最后更新时间和下次更新倒计时
 */
import { useMemo } from 'react';
import { getNextUpdateCountdown, getLastUpdateExplanation } from '../lib/cacheStrategy';

export function DataUpdateBadge() {
  const countdown = useMemo(() => getNextUpdateCountdown(), []);
  const explanation = useMemo(() => getLastUpdateExplanation(), []);

  return (
    <div
      style={{
        padding: '4px 10px',
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        fontSize: '11px',
        color: '#6b7280',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}
    >
      <div style={{ fontWeight: '500' }}>
        {explanation}
      </div>
      <div style={{ fontSize: '10px', opacity: 0.8 }}>
        {countdown}
      </div>
    </div>
  );
}

/**
 * 简化版本：只显示更新时间
 */
export function SimpleDataUpdateBadge() {
  const explanation = useMemo(() => getLastUpdateExplanation(), []);

  return (
    <div
      style={{
        padding: '4px 10px',
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        fontSize: '11px',
        color: '#6b7280',
      }}
    >
      {explanation}
    </div>
  );
}
