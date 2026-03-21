'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart as RechartsArea,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface AreaChartProps {
  data: Record<string, unknown>[];
  xAxis: string;
  yAxis: string | string[];
  title?: string;
  showLegend?: boolean;
  colors?: string[];
  height?: number;
  className?: string;
}

const DEFAULT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export function AreaChartWidget({
  data,
  xAxis,
  yAxis,
  title,
  showLegend = true,
  colors = DEFAULT_COLORS,
  height = 300,
  className = '',
}: AreaChartProps) {
  const yAxes = Array.isArray(yAxis) ? yAxis : [yAxis];

  return (
    <div className={className}>
      {title && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsArea data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
          {yAxes.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[i % colors.length]}
              fill={colors[i % colors.length]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </RechartsArea>
      </ResponsiveContainer>
    </div>
  );
}
