'use client';

import React from 'react';

interface FunnelWidgetProps {
  data: Array<{ name: string; value: number }>;
  title?: string;
  height?: number;
  className?: string;
}

export function FunnelWidget({
  data,
  title,
  height = 300,
  className = '',
}: FunnelWidgetProps) {
  if (data.length === 0) {
    return <div className="text-center py-8 text-sm text-gray-400">No data</div>;
  }

  const maxValue = Math.max(...data.map((d) => d.value));
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className={className}>
      {title && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</div>
      )}
      <div className="flex flex-col items-center gap-1" style={{ minHeight: height }}>
        {sortedData.map((item, index) => {
          const widthPct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          const conversionRate =
            index > 0 && sortedData[index - 1].value > 0
              ? ((item.value / sortedData[index - 1].value) * 100).toFixed(1)
              : null;

          // Color gradient from blue to lighter blue
          const hue = 220;
          const saturation = 70;
          const lightness = 45 + index * (35 / Math.max(sortedData.length - 1, 1));

          return (
            <React.Fragment key={item.name}>
              {conversionRate !== null && (
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    className="text-gray-300"
                  >
                    <path d="M5 0 L5 7 L2 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  <span>{conversionRate}% conversion</span>
                </div>
              )}
              <div
                className="relative rounded-md transition-all duration-300 hover:opacity-90 cursor-default"
                style={{
                  width: `${Math.max(widthPct, 15)}%`,
                  backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
                  minHeight: 36,
                }}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs font-medium text-white truncate">
                    {item.name}
                  </span>
                  <span className="text-xs font-bold text-white/90 ml-2 flex-shrink-0">
                    {item.value.toLocaleString()}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
