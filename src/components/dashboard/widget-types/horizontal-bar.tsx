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
} from 'recharts';

interface HorizontalBarProps {
  data: Record<string, unknown>[];
  categoryField: string;
  valueField: string;
  title?: string;
  color?: string;
  height?: number;
  className?: string;
}

export function HorizontalBarWidget({
  data,
  categoryField,
  valueField,
  title,
  color = '#3b82f6',
  height = 300,
  className = '',
}: HorizontalBarProps) {
  const barHeight = Math.max(height, data.length * 32 + 40);

  return (
    <div className={className}>
      {title && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</div>
      )}
      <ResponsiveContainer width="100%" height={barHeight}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis
            type="category"
            dataKey={categoryField}
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            width={75}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255,255,255,0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Bar dataKey={valueField} fill={color} radius={[0, 4, 4, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
