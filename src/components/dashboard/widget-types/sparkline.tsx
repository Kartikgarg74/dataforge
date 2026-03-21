'use client';

import React from 'react';

interface SparklineWidgetProps {
  data: number[];
  label?: string;
  color?: string;
  height?: number;
  width?: number;
  className?: string;
}

export function SparklineWidget({
  data,
  label,
  color = '#3b82f6',
  height = 48,
  width,
  className = '',
}: SparklineWidgetProps) {
  if (!data || data.length < 2) {
    return (
      <div className={`flex items-center justify-center text-xs text-gray-400 ${className}`} style={{ height }}>
        Not enough data
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const current = data[data.length - 1];
  const range = max - min || 1;
  const svgWidth = width || 200;
  const padding = 2;
  const effectiveHeight = height - padding * 2;
  const effectiveWidth = svgWidth - padding * 2;
  const stepX = effectiveWidth / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = padding + i * stepX;
      const y = padding + effectiveHeight - ((v - min) / range) * effectiveHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const formatNum = (n: number): string => {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </div>
      )}
      <div className="w-full" style={{ maxWidth: width }}>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${svgWidth} ${height}`}
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Current value dot */}
          <circle
            cx={padding + (data.length - 1) * stepX}
            cy={padding + effectiveHeight - ((current - min) / range) * effectiveHeight}
            r="3"
            fill={color}
          />
        </svg>
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
        <span>Min: {formatNum(min)}</span>
        <span>Current: {formatNum(current)}</span>
        <span>Max: {formatNum(max)}</span>
      </div>
    </div>
  );
}
