'use client';

import React from 'react';
import {
  BarChart3, TrendingUp, PieChart, Table2,
  ArrowDownWideNarrow, Layers, CircleDot, Target, Hash,
} from 'lucide-react';

type WidgetType = 'kpi' | 'line' | 'bar' | 'horizontal_bar' | 'stacked_bar' | 'area' | 'pie' | 'donut' | 'scatter' | 'table' | 'funnel' | 'heatmap' | 'gauge';

interface ChartTypeSelectorProps {
  selected: string;
  onChange: (type: WidgetType) => void;
  className?: string;
}

const CHART_TYPES: Array<{ value: WidgetType; label: string; icon: React.ReactNode }> = [
  { value: 'kpi', label: 'KPI', icon: <Hash className="w-4 h-4" /> },
  { value: 'bar', label: 'Bar', icon: <BarChart3 className="w-4 h-4" /> },
  { value: 'line', label: 'Line', icon: <TrendingUp className="w-4 h-4" /> },
  { value: 'area', label: 'Area', icon: <TrendingUp className="w-4 h-4" /> },
  { value: 'horizontal_bar', label: 'H-Bar', icon: <ArrowDownWideNarrow className="w-4 h-4 rotate-90" /> },
  { value: 'stacked_bar', label: 'Stacked', icon: <Layers className="w-4 h-4" /> },
  { value: 'pie', label: 'Pie', icon: <PieChart className="w-4 h-4" /> },
  { value: 'donut', label: 'Donut', icon: <CircleDot className="w-4 h-4" /> },
  { value: 'scatter', label: 'Scatter', icon: <CircleDot className="w-4 h-4" /> },
  { value: 'table', label: 'Table', icon: <Table2 className="w-4 h-4" /> },
  { value: 'funnel', label: 'Funnel', icon: <Target className="w-4 h-4" /> },
  { value: 'gauge', label: 'Gauge', icon: <Target className="w-4 h-4" /> },
];

export function ChartTypeSelector({ selected, onChange, className = '' }: ChartTypeSelectorProps) {
  return (
    <div className={`grid grid-cols-4 gap-1.5 ${className}`}>
      {CHART_TYPES.map((ct) => (
        <button
          key={ct.value}
          onClick={() => onChange(ct.value)}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
            selected === ct.value
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
              : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }`}
        >
          {ct.icon}
          <span>{ct.label}</span>
        </button>
      ))}
    </div>
  );
}
