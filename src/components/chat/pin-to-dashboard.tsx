'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Pin, Plus, Loader2, Check, ChevronDown } from 'lucide-react';
import type { Dashboard, WidgetType } from '@/lib/dashboard/types';

interface PinToDashboardProps {
  queryNatural: string;
  querySQL: string;
  chartType: string;
  connectorId?: string;
}

export function PinToDashboard({
  queryNatural,
  querySQL,
  chartType,
  connectorId = 'default',
}: PinToDashboardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | ''>('');
  const [newDashboardName, setNewDashboardName] = useState('');
  const [widgetTitle, setWidgetTitle] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const fetchDashboards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', teamId: '' }),
      });
      const data = await res.json();
      if (data.success) {
        setDashboards(data.dashboards || []);
      }
    } catch {
      // Silently fail - user can still create a new dashboard
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDashboards();
      // Default the widget title to the natural language query (truncated)
      if (!widgetTitle) {
        setWidgetTitle(
          queryNatural.length > 60
            ? queryNatural.slice(0, 57) + '...'
            : queryNatural
        );
      }
    }
  }, [isOpen, fetchDashboards, queryNatural, widgetTitle]);

  const handleSubmit = async () => {
    setError(null);

    if (!widgetTitle.trim()) {
      setError('Widget title is required');
      return;
    }

    let dashboardId = selectedDashboardId;

    setSubmitting(true);
    try {
      // Create new dashboard if needed
      if (isCreatingNew) {
        if (!newDashboardName.trim()) {
          setError('Dashboard name is required');
          setSubmitting(false);
          return;
        }

        const createRes = await fetch('/api/dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            teamId: '',
            name: newDashboardName.trim(),
            createdBy: '',
          }),
        });
        const createData = await createRes.json();
        if (!createData.success) {
          setError(createData.error || 'Failed to create dashboard');
          setSubmitting(false);
          return;
        }
        dashboardId = createData.dashboard.id;
      }

      if (!dashboardId) {
        setError('Please select a dashboard or create a new one');
        setSubmitting(false);
        return;
      }

      // Calculate position: append to the end
      // Fetch existing widgets to determine next position
      const getRes = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', id: dashboardId }),
      });
      const getData = await getRes.json();
      const existingWidgets = getData.dashboard?.widgets || [];
      const maxY = existingWidgets.reduce(
        (max: number, w: { position: { y: number; h: number } }) =>
          Math.max(max, w.position.y + w.position.h),
        0
      );

      // Add the widget
      const widgetRes = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_widget',
          dashboardId,
          title: widgetTitle.trim(),
          widgetType: chartType as WidgetType,
          queryNatural,
          querySQL,
          connectorId,
          visualization: { chartType: chartType as WidgetType },
          position: { x: 0, y: maxY, w: 6, h: 4 },
          sortOrder: existingWidgets.length,
        }),
      });
      const widgetData = await widgetRes.json();

      if (widgetData.success) {
        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
          setSelectedDashboardId('');
          setNewDashboardName('');
          setIsCreatingNew(false);
        }, 1500);
      } else {
        setError(widgetData.error || 'Failed to add widget');
      }
    } catch {
      setError('An error occurred while pinning to dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
        <Check className="w-3.5 h-3.5" />
        Pinned!
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        <Pin className="w-3.5 h-3.5" />
        Pin to Dashboard
        <ChevronDown
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {/* Widget Title */}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Widget Title
            </label>
            <input
              type="text"
              value={widgetTitle}
              onChange={(e) => setWidgetTitle(e.target.value)}
              placeholder="Enter widget title"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {/* Dashboard Selection */}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Dashboard
            </label>

            {loading ? (
              <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading dashboards...
              </div>
            ) : (
              <>
                {!isCreatingNew && (
                  <select
                    value={selectedDashboardId}
                    onChange={(e) => setSelectedDashboardId(e.target.value)}
                    className="mb-2 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="">Select a dashboard...</option>
                    {dashboards.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => {
                    setIsCreatingNew(!isCreatingNew);
                    if (!isCreatingNew) setSelectedDashboardId('');
                  }}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <Plus className="w-3 h-3" />
                  {isCreatingNew ? 'Select existing' : 'Create New Dashboard'}
                </button>

                {isCreatingNew && (
                  <input
                    type="text"
                    value={newDashboardName}
                    onChange={(e) => setNewDashboardName(e.target.value)}
                    placeholder="New dashboard name"
                    className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                )}
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="mb-3 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Pinning...
                </>
              ) : (
                <>
                  <Pin className="w-3 h-3" />
                  Pin Widget
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
