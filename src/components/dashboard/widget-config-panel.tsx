'use client';

import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import type { DashboardWidget, WidgetType, VisualizationConfig } from '@/lib/dashboard/types';

interface WidgetConfigPanelProps {
  widget: DashboardWidget;
  onSave: (updates: Partial<DashboardWidget>) => void;
  onCancel: () => void;
}

const WIDGET_TYPES: { value: WidgetType; label: string }[] = [
  { value: 'kpi', label: 'KPI Card' },
  { value: 'line', label: 'Line Chart' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'horizontal_bar', label: 'Horizontal Bar' },
  { value: 'stacked_bar', label: 'Stacked Bar' },
  { value: 'area', label: 'Area Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'donut', label: 'Donut Chart' },
  { value: 'scatter', label: 'Scatter Plot' },
  { value: 'table', label: 'Data Table' },
  { value: 'text', label: 'Text' },
];

const PRESET_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

const FORMAT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
];

export function WidgetConfigPanel({
  widget,
  onSave,
  onCancel,
}: WidgetConfigPanelProps) {
  const [title, setTitle] = useState(widget.title);
  const [widgetType, setWidgetType] = useState<WidgetType>(widget.widgetType);
  const [xAxis, setXAxis] = useState(widget.visualization.xAxis || '');
  const [yAxis, setYAxis] = useState(widget.visualization.yAxis || '');
  const [showLegend, setShowLegend] = useState(widget.visualization.showLegend ?? true);
  const [selectedColor, setSelectedColor] = useState(
    widget.visualization.colors?.[0] || PRESET_COLORS[0]
  );
  const [format, setFormat] = useState(widget.visualization.format || '');
  const [prefix, setPrefix] = useState(widget.visualization.prefix || '');
  const [suffix, setSuffix] = useState(widget.visualization.suffix || '');

  const handleSave = () => {
    const visualization: VisualizationConfig = {
      ...widget.visualization,
      chartType: widgetType,
      xAxis: xAxis || undefined,
      yAxis: yAxis || undefined,
      showLegend,
      colors: [selectedColor],
      format: format || undefined,
      prefix: prefix || undefined,
      suffix: suffix || undefined,
    };

    onSave({
      title,
      widgetType,
      visualization,
    });
  };

  const isKPI = widgetType === 'kpi';

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg w-full max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Configure Widget
        </h3>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Form */}
      <div className="p-4 space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            placeholder="Widget title"
          />
        </div>

        {/* Chart Type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Chart Type
          </label>
          <select
            value={widgetType}
            onChange={(e) => setWidgetType(e.target.value as WidgetType)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          >
            {WIDGET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* X-Axis / Y-Axis */}
        {!isKPI && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                X-Axis Column
              </label>
              <input
                type="text"
                value={xAxis}
                onChange={(e) => setXAxis(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                placeholder="Column name for x-axis"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Y-Axis Column
              </label>
              <input
                type="text"
                value={yAxis}
                onChange={(e) => setYAxis(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                placeholder="Column name for y-axis"
              />
            </div>
          </>
        )}

        {/* Show Legend Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Show Legend
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={showLegend}
            onClick={() => setShowLegend(!showLegend)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              showLegend ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                showLegend ? 'translate-x-[18px]' : 'translate-x-[3px]'
              }`}
            />
          </button>
        </div>

        {/* Color Picker */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-6 h-6 rounded-full transition-all ${
                  selectedColor === color
                    ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-900'
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
        </div>

        {/* KPI-specific fields */}
        {isKPI && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              >
                {FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Prefix
                </label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  placeholder="e.g. $"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Suffix
                </label>
                <input
                  type="text"
                  value={suffix}
                  onChange={(e) => setSuffix(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  placeholder="e.g. %"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          Save
        </button>
      </div>
    </div>
  );
}
