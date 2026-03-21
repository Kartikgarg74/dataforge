'use client';

import React, { useState, useRef, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, X } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string | number;
  format?: 'number' | 'currency' | 'percent';
  prefix?: string;
  suffix?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'flat';
    isGood: boolean;
  };
  comparison?: string;
  sparkline?: number[];
  goal?: number;
  variant?: 'standard' | 'compact' | 'detailed';
  className?: string;
}

function formatValue(value: string | number, format?: string, prefix?: string, suffix?: string): string {
  let formatted = String(value);
  if (typeof value === 'number') {
    if (format === 'currency') {
      formatted = value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    } else if (format === 'percent') {
      formatted = value.toFixed(1);
    } else {
      formatted = value.toLocaleString();
    }
  }
  return `${prefix || ''}${formatted}${suffix || ''}`;
}

function MiniSparkline({ data, className = '' }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const height = 24;
  const width = 60;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className={className}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GoalProgress({ current, goal }: { current: number; goal: number }) {
  const pct = Math.min(100, Math.max(0, (current / goal) * 100));
  const color = pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
        <span>Goal: {goal.toLocaleString()}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function KPICard({
  label,
  value,
  format,
  prefix,
  suffix,
  trend,
  comparison,
  sparkline,
  goal,
  variant = 'standard',
  className = '',
}: KPICardProps) {
  const formattedValue = formatValue(value, format, prefix, suffix);
  const [isExpanded, setIsExpanded] = useState(false);
  const lastTapRef = useRef<number>(0);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setIsExpanded(true);
    }
    lastTapRef.current = now;
  }, []);

  const trendColor = trend
    ? trend.isGood
      ? 'text-green-500'
      : 'text-red-500'
    : 'text-gray-400';

  const TrendIcon = trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus;

  // Expanded detail modal/sheet
  const expandedOverlay = isExpanded ? (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-end sm:items-center justify-center"
      onClick={() => setIsExpanded(false)}
    >
      <div
        className="bg-white dark:bg-gray-900 w-full sm:max-w-sm sm:rounded-xl rounded-t-xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
            {label}
          </h3>
          <button
            onClick={() => setIsExpanded(false)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close detail view"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {formattedValue}
        </div>

        {trend && (
          <div className={`flex items-center gap-2 mb-4 ${trendColor}`}>
            <TrendIcon className="w-5 h-5" />
            <span className="text-lg font-semibold">
              {trend.direction === 'down' ? '-' : '+'}{Math.abs(trend.value)}%
            </span>
            {comparison && <span className="text-sm text-gray-400">{comparison}</span>}
          </div>
        )}

        {sparkline && sparkline.length >= 2 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">Trend</p>
            <MiniSparkline data={sparkline} className="text-blue-500 w-full" />
          </div>
        )}

        {goal !== undefined && typeof value === 'number' && (
          <GoalProgress current={value} goal={goal} />
        )}
      </div>
    </div>
  ) : null;

  if (variant === 'compact') {
    return (
      <>
        <div className={`flex items-center justify-between p-3 ${className}`} onClick={handleTap}>
          <div className="min-w-0">
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{formattedValue}</div>
            {trend && (
              <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
                <TrendIcon className="w-3 h-3" />
                <span>{Math.abs(trend.value)}%</span>
              </div>
            )}
          </div>
          {sparkline && <MiniSparkline data={sparkline} className="text-gray-300 dark:text-gray-600" />}
        </div>
        {expandedOverlay}
      </>
    );
  }

  return (
    <>
      <div className={`p-4 ${className}`} onClick={handleTap}>
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          {label}
        </div>
        <div className="flex items-end justify-between">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formattedValue}
          </div>
          {sparkline && <MiniSparkline data={sparkline} className="text-gray-300 dark:text-gray-600 mb-1" />}
        </div>

        {trend && (
          <div className={`flex items-center gap-1.5 mt-1 text-xs ${trendColor}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            <span className="font-medium">{trend.direction === 'down' ? '-' : '+'}{Math.abs(trend.value)}%</span>
            {comparison && <span className="text-gray-400">{comparison}</span>}
          </div>
        )}

        {variant === 'detailed' && goal !== undefined && typeof value === 'number' && (
          <GoalProgress current={value} goal={goal} />
        )}
      </div>
      {expandedOverlay}
    </>
  );
}
