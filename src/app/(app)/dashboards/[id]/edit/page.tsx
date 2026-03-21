'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Plus,
  X,
} from 'lucide-react';
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar';
import { DashboardGrid } from '@/components/dashboard/dashboard-grid';
import { WidgetConfigPanel } from '@/components/dashboard/widget-config-panel';
import type {
  Dashboard,
  DashboardWidget,
  WidgetType,
} from '@/lib/dashboard/types';

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

export default function DashboardEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);

  // Add widget form state
  const [newTitle, setNewTitle] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [newType, setNewType] = useState<WidgetType>('bar');

  const fetchDashboard = useCallback(async () => {
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
  }, [id]);

  useEffect(() => {
    if (id) fetchDashboard();
  }, [id, fetchDashboard]);

  const handleLayoutChange = async (widgets: DashboardWidget[]) => {
    if (!dashboard) return;

    // Update local state optimistically
    setDashboard({ ...dashboard, widgets });

    try {
      await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_layout',
          dashboardId: dashboard.id,
          widgets: widgets.map((w) => ({
            id: w.id,
            position: w.position,
          })),
        }),
      });
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  };

  const handleAddWidget = async () => {
    if (!dashboard || !newTitle.trim() || !newQuery.trim()) return;

    setSaving(true);
    try {
      const existingWidgets = dashboard.widgets || [];
      const maxSortOrder = existingWidgets.length > 0
        ? Math.max(...existingWidgets.map((w) => w.sortOrder))
        : -1;

      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_widget',
          dashboardId: dashboard.id,
          title: newTitle.trim(),
          widgetType: newType,
          queryNatural: newQuery.trim(),
          querySQL: `-- Generated from: ${newQuery.trim()}`,
          connectorId: 'default',
          visualization: {
            chartType: newType,
          },
          position: {
            x: 0,
            y: 0,
            w: newType === 'kpi' ? 3 : 6,
            h: newType === 'kpi' ? 2 : 4,
          },
          sortOrder: maxSortOrder + 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add widget');

      // Refresh dashboard to get the latest widgets
      await fetchDashboard();

      // Reset form
      setNewTitle('');
      setNewQuery('');
      setNewType('bar');
      setShowAddWidget(false);
    } catch (err) {
      console.error('Failed to add widget:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveWidget = async (widgetId: string) => {
    if (!dashboard) return;

    // Optimistic update
    setDashboard({
      ...dashboard,
      widgets: dashboard.widgets.filter((w) => w.id !== widgetId),
    });

    try {
      await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_widget',
          widgetId,
        }),
      });
    } catch (err) {
      console.error('Failed to remove widget:', err);
      // Revert on failure
      await fetchDashboard();
    }
  };

  const handleEditWidget = (widgetId: string) => {
    setEditingWidgetId(widgetId);
  };

  const handleSaveWidgetConfig = async (updates: Partial<DashboardWidget>) => {
    if (!editingWidgetId) return;

    setSaving(true);
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_widget',
          widgetId: editingWidgetId,
          ...updates,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update widget');

      await fetchDashboard();
      setEditingWidgetId(null);
    } catch (err) {
      console.error('Failed to update widget:', err);
    } finally {
      setSaving(false);
    }
  };

  const editingWidget = editingWidgetId
    ? dashboard?.widgets.find((w) => w.id === editingWidgetId) ?? null
    : null;

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

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      {/* Back button */}
      <button
        onClick={() => router.push(`/dashboards/${id}`)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </button>

      {/* Toolbar */}
      <DashboardToolbar
        dashboardName={dashboard.name}
        isEditMode={true}
        refreshInterval={dashboard.refreshInterval}
        onRefresh={fetchDashboard}
        onToggleEdit={() => router.push(`/dashboards/${id}`)}
        onAddWidget={() => setShowAddWidget(true)}
      />

      {/* Add Widget Panel */}
      {showAddWidget && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Add New Widget
            </h3>
            <button
              onClick={() => setShowAddWidget(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                placeholder="Widget title"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Query (natural language)
              </label>
              <input
                type="text"
                value={newQuery}
                onChange={(e) => setNewQuery(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                placeholder="e.g. Total revenue by month"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Chart Type
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as WidgetType)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              >
                {WIDGET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end mt-3">
            <button
              onClick={handleAddWidget}
              disabled={saving || !newTitle.trim() || !newQuery.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Add Widget
            </button>
          </div>
        </div>
      )}

      {/* Widget Config Panel (overlay) */}
      {editingWidget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <WidgetConfigPanel
            widget={editingWidget}
            onSave={handleSaveWidgetConfig}
            onCancel={() => setEditingWidgetId(null)}
          />
        </div>
      )}

      {/* Grid */}
      <div className="mt-4">
        <DashboardGrid
          widgets={dashboard.widgets}
          editMode={true}
          onLayoutChange={handleLayoutChange}
          onRemoveWidget={handleRemoveWidget}
          onEditWidget={handleEditWidget}
        />
      </div>
    </div>
  );
}
