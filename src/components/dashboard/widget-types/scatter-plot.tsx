'use client';

import React from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ZAxis,
} from 'recharts';

interface ScatterPlotProps {
  data: Record<string, unknown>[];
  xAxis: string;
  yAxis: string;
  sizeField?: string;
  title?: string;
  color?: string;
  height?: number;
  className?: string;
}

export function ScatterPlotWidget({
  data,
  xAxis,
  yAxis,
  sizeField,
  title,
  color = '#3b82f6',
  height = 300,
  className = '',
}: ScatterPlotProps) {
  return (
    <div className={className}>
      {title && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey={xAxis} name={xAxis} tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis dataKey={yAxis} name={yAxis} tick={{ fontSize: 11 }} stroke="#9ca3af" />
          {sizeField && <ZAxis dataKey={sizeField} range={[20, 400]} />}
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255,255,255,0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Scatter data={data} fill={color} fillOpacity={0.6} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
