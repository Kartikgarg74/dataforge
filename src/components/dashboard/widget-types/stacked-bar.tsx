'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface StackedBarProps {
  data: Record<string, unknown>[];
  xAxis: string;
  series: string[];
  title?: string;
  colors?: string[];
  showLegend?: boolean;
  height?: number;
  className?: string;
}

const DEFAULT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];

export function StackedBarWidget({
  data,
  xAxis,
  series,
  title,
  colors = DEFAULT_COLORS,
  showLegend = true,
  height = 300,
  className = '',
}: StackedBarProps) {
  return (
    <div className={className}>
      {title && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey={xAxis} tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255,255,255,0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          {showLegend && <Legend wrapperStyle={{ fontSize: '12px' }} />}
          {series.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="stack"
              fill={colors[i % colors.length]}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
