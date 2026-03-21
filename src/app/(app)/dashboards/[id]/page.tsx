'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  LayoutDashboard,
  RefreshCw,
  Share2,
  Pencil,
  Loader2,
  AlertTriangle,
  BarChart3,
  PieChart,
  Table,
  Type,
  TrendingUp,
  ScatterChart,
} from 'lucide-react';

interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Widget {
  id: string;
  title: string;
  widgetType: string;
  queryNatural: string;
  position: WidgetPosition;
}

interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  isPublic: boolean;
  updatedAt: string;
}

const WIDGET_ICONS: Record<string, React.ElementType> = {
  kpi: TrendingUp,
  line: TrendingUp,
  bar: BarChart3,
  horizontal_bar: BarChart3,
  stacked_bar: BarChart3,
  area: TrendingUp,
  pie: PieChart,
  donut: PieChart,
  scatter: ScatterChart,
  table: Table,
  text: Type,
};

export default function DashboardDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load dashboard');
      setDashboard(data.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDashboard();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-500">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={fetchDashboard}
          className="mt-3 text-sm text-blue-500 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!dashboard) return null;

  const widgets = dashboard.widgets || [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {dashboard.name}
            </h1>
            {dashboard.description && (
              <p className="text-sm text-gray-500">{dashboard.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboard}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          <button
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Share"
          >
            <Share2 className="w-4 h-4 text-gray-500" />
          </button>
          <button
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Widgets Grid */}
      {widgets.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <LayoutDashboard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            No widgets yet
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Add widgets to start building this dashboard
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {widgets.map((widget) => {
            const Icon = WIDGET_ICONS[widget.widgetType] || BarChart3;
            return (
              <div
                key={widget.id}
                className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-shadow"
                style={{
                  gridColumn: widget.position.w > 1 ? `span ${Math.min(widget.position.w, 3)}` : undefined,
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {widget.title}
                  </h3>
                </div>
                <div className="flex items-center justify-center h-32 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="text-center">
                    <Icon className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                      {widget.widgetType} chart
                    </span>
                  </div>
                </div>
                {widget.queryNatural && (
                  <p className="text-[10px] text-gray-400 mt-2 truncate">
                    {widget.queryNatural}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
