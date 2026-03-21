'use client';

import React, { useRef } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPIMetric {
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
}

interface KPICarouselProps {
  metrics: KPIMetric[];
  className?: string;
}

function formatVal(value: string | number, format?: string, prefix?: string, suffix?: string): string {
  let s = typeof value === 'number'
    ? (format === 'currency' ? value.toLocaleString() : format === 'percent' ? value.toFixed(1) : value.toLocaleString())
    : value;
  return `${prefix || ''}${s}${suffix || ''}`;
}

export function KPICarousel({ metrics, className = '' }: KPICarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (metrics.length === 0) return null;

  return (
    <div className={className}>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {metrics.map((metric, i) => {
          const TrendIcon = metric.trend?.direction === 'up' ? TrendingUp
            : metric.trend?.direction === 'down' ? TrendingDown
            : Minus;

          const trendColor = metric.trend
            ? metric.trend.isGood ? 'text-green-500' : 'text-red-500'
            : 'text-gray-400';

          return (
            <div
              key={i}
              className="snap-start flex-shrink-0 w-[160px] p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
            >
              <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">
                {metric.label}
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                {formatVal(metric.value, metric.format, metric.prefix, metric.suffix)}
              </div>
              {metric.trend && (
                <div className={`flex items-center gap-1 mt-1 text-xs ${trendColor}`}>
                  <TrendIcon className="w-3 h-3" />
                  <span>{metric.trend.direction === 'down' ? '-' : '+'}{Math.abs(metric.trend.value)}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scroll indicators */}
      {metrics.length > 2 && (
        <div className="flex justify-center gap-1 mt-2">
          {metrics.map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
          ))}
        </div>
      )}
    </div>
  );
}
