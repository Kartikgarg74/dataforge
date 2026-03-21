'use client';

import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

interface DonutChartProps {
  data: Array<{ name: string; value: number }>;
  title?: string;
  centerLabel?: string;
  centerValue?: string | number;
  colors?: string[];
  showLegend?: boolean;
  height?: number;
  className?: string;
}

const DEFAULT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

export function DonutChartWidget({
  data,
  title,
  centerLabel,
  centerValue,
  colors = DEFAULT_COLORS,
  showLegend = true,
  height = 300,
  className = '',
}: DonutChartProps) {
  return (
    <div className={className}>
      {title && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255,255,255,0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value) => typeof value === 'number' ? value.toLocaleString() : String(value)}
          />
          {showLegend && <Legend wrapperStyle={{ fontSize: '11px' }} />}
          {/* Center label */}
          {(centerLabel || centerValue) && (
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
              {centerValue && (
                <tspan x="50%" dy="-6" className="fill-gray-900 dark:fill-gray-100 text-lg font-bold">
                  {centerValue}
                </tspan>
              )}
              {centerLabel && (
                <tspan x="50%" dy={centerValue ? '18' : '0'} className="fill-gray-500 text-[10px]">
                  {centerLabel}
                </tspan>
              )}
            </text>
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
