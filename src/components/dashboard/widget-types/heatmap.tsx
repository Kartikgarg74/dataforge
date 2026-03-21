'use client';

import React, { useMemo } from 'react';

interface HeatmapWidgetProps {
  data: Record<string, unknown>[];
  xField: string;
  yField: string;
  valueField: string;
  title?: string;
  height?: number;
  className?: string;
}

function getColor(value: number, min: number, max: number): string {
  const range = max - min || 1;
  const normalized = (value - min) / range;
  // Blue color scale: light (#dbeafe) to dark (#1e40af)
  const r = Math.round(219 - normalized * 189);
  const g = Math.round(234 - normalized * 170);
  const b = Math.round(254 - normalized * 79);
  return `rgb(${r}, ${g}, ${b})`;
}

function getTextColor(value: number, min: number, max: number): string {
  const range = max - min || 1;
  const normalized = (value - min) / range;
  return normalized > 0.5 ? '#ffffff' : '#1e3a5f';
}

export function HeatmapWidget({
  data,
  xField,
  yField,
  valueField,
  title,
  height,
  className = '',
}: HeatmapWidgetProps) {
  const { xLabels, yLabels, grid, min, max } = useMemo(() => {
    const xSet = new Set<string>();
    const ySet = new Set<string>();
    const valueMap = new Map<string, number>();

    for (const row of data) {
      const x = String(row[xField] ?? '');
      const y = String(row[yField] ?? '');
      const v = Number(row[valueField]) || 0;
      xSet.add(x);
      ySet.add(y);
      valueMap.set(`${y}__${x}`, v);
    }

    const xLabels = Array.from(xSet);
    const yLabels = Array.from(ySet);
    const allValues = Array.from(valueMap.values());
    const min = allValues.length > 0 ? Math.min(...allValues) : 0;
    const max = allValues.length > 0 ? Math.max(...allValues) : 1;

    const grid = yLabels.map((y) =>
      xLabels.map((x) => valueMap.get(`${y}__${x}`) ?? 0)
    );

    return { xLabels, yLabels, grid, min, max };
  }, [data, xField, yField, valueField]);

  if (data.length === 0) {
    return <div className="text-center py-8 text-sm text-gray-400">No data</div>;
  }

  return (
    <div className={className} style={height ? { minHeight: height } : undefined}>
      {title && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</div>
      )}
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-[10px] text-gray-500 font-medium p-1 text-left sticky left-0 bg-white dark:bg-gray-900 z-10">
                {yField} / {xField}
              </th>
              {xLabels.map((x) => (
                <th
                  key={x}
                  className="text-[10px] text-gray-500 font-medium p-1 text-center min-w-[40px]"
                >
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yLabels.map((y, yi) => (
              <tr key={y}>
                <td className="text-[10px] text-gray-600 dark:text-gray-400 font-medium p-1 truncate max-w-[100px] sticky left-0 bg-white dark:bg-gray-900 z-10">
                  {y}
                </td>
                {grid[yi].map((value, xi) => (
                  <td
                    key={xi}
                    className="p-0.5"
                  >
                    <div
                      className="flex items-center justify-center rounded text-[10px] font-medium min-h-[28px] min-w-[36px] transition-opacity hover:opacity-80 cursor-default"
                      style={{
                        backgroundColor: getColor(value, min, max),
                        color: getTextColor(value, min, max),
                      }}
                      title={`${y}, ${xLabels[xi]}: ${value.toLocaleString()}`}
                    >
                      {value.toLocaleString()}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-2">
        <span className="text-[10px] text-gray-400">{min.toLocaleString()}</span>
        <div
          className="h-2 w-24 rounded"
          style={{
            background: `linear-gradient(to right, ${getColor(min, min, max)}, ${getColor(max, min, max)})`,
          }}
        />
        <span className="text-[10px] text-gray-400">{max.toLocaleString()}</span>
      </div>
    </div>
  );
}
