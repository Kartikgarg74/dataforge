'use client';

import React from 'react';
import { Loader2, AlertCircle, MoreHorizontal } from 'lucide-react';
import { KPICard } from './widget-types/kpi-card';
import { AreaChartWidget } from './widget-types/area-chart';
import { HorizontalBarWidget } from './widget-types/horizontal-bar';
import { StackedBarWidget } from './widget-types/stacked-bar';
import { DonutChartWidget } from './widget-types/donut-chart';
import { ScatterPlotWidget } from './widget-types/scatter-plot';
import { DataTableWidget } from './widget-types/data-table-widget';

type WidgetType = 'kpi' | 'line' | 'bar' | 'horizontal_bar' | 'stacked_bar' | 'area' | 'pie' | 'donut' | 'scatter' | 'table' | 'text';

interface WidgetRendererProps {
  widgetType: WidgetType;
  title: string;
  data: Record<string, unknown>[];
  columns: string[];
  visualization?: Record<string, unknown>;
  loading?: boolean;
  error?: string;
  cached?: boolean;
  onRefresh?: () => void;
  onEdit?: () => void;
  className?: string;
}

export function WidgetRenderer({
  widgetType,
  title,
  data,
  columns,
  visualization = {},
  loading,
  error,
  cached,
  onEdit,
  className = '',
}: WidgetRendererProps) {
  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 text-center ${className}`}>
        <AlertCircle className="w-6 h-6 text-red-400 mb-2" />
        <p className="text-xs text-red-500">{error}</p>
      </div>
    );
  }

  const xAxis = (visualization.xAxis as string) || columns[0];
  const yAxis = (visualization.yAxis as string) || columns[1];

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{title}</h3>
          {cached && (
            <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded">
              CACHED
            </span>
          )}
        </div>
        {onEdit && (
          <button onClick={onEdit} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <MoreHorizontal className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-2">
        {renderWidget(widgetType, data, columns, xAxis, yAxis, visualization)}
      </div>
    </div>
  );
}

function renderWidget(
  type: WidgetType,
  data: Record<string, unknown>[],
  columns: string[],
  xAxis: string,
  yAxis: string,
  viz: Record<string, unknown>
): React.ReactNode {
  if (data.length === 0) {
    return <div className="text-center py-8 text-sm text-gray-400">No data</div>;
  }

  switch (type) {
    case 'kpi': {
      const row = data[0];
      const value = row[columns[0]];
      return (
        <KPICard
          label={columns[0]}
          value={typeof value === 'number' ? value : String(value ?? 0)}
          format={viz.format as 'number' | 'currency' | 'percent' | undefined}
          prefix={viz.prefix as string | undefined}
          suffix={viz.suffix as string | undefined}
        />
      );
    }

    case 'area':
      return <AreaChartWidget data={data} xAxis={xAxis} yAxis={yAxis} height={250} />;

    case 'horizontal_bar':
      return <HorizontalBarWidget data={data} categoryField={xAxis} valueField={yAxis} height={250} />;

    case 'stacked_bar':
      return (
        <StackedBarWidget
          data={data}
          xAxis={xAxis}
          series={columns.filter((c) => c !== xAxis)}
          height={250}
        />
      );

    case 'donut':
    case 'pie':
      return (
        <DonutChartWidget
          data={data.map((row) => ({
            name: String(row[xAxis] ?? ''),
            value: Number(row[yAxis]) || 0,
          }))}
          height={250}
        />
      );

    case 'scatter':
      return <ScatterPlotWidget data={data} xAxis={xAxis} yAxis={yAxis} height={250} />;

    case 'table':
      return <DataTableWidget data={data} columns={columns} pageSize={10} />;

    case 'text':
      return (
        <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
          {String(data[0]?.[columns[0]] ?? '')}
        </div>
      );

    case 'line':
    case 'bar':
    default:
      // Use recharts BarChart/LineChart from the existing graph component
      // For now, fall back to area chart for line and table for bar
      if (type === 'line') {
        return <AreaChartWidget data={data} xAxis={xAxis} yAxis={yAxis} height={250} />;
      }
      return <DataTableWidget data={data} columns={columns} pageSize={10} />;
  }
}
