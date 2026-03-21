'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Lock, LayoutDashboard, Eye, AlertTriangle } from 'lucide-react';
import { WidgetRenderer } from '@/components/dashboard/widget-renderer';

interface ShareInfo {
  id: string;
  resourceType: 'dashboard' | 'query';
  resourceId: string;
  slug: string;
  accessType: string;
  viewCount: number;
  createdAt: string;
  needsPassword: boolean;
}

interface WidgetInfo {
  id: string;
  title: string;
  widgetType: string;
  querySQL: string;
  position: { x: number; y: number; w: number; h: number };
  visualization: Record<string, unknown>;
  sortOrder: number;
}

interface DashboardResource {
  type: 'dashboard';
  id: string;
  name: string;
  description?: string;
  widgets: WidgetInfo[];
}

interface WidgetData {
  data: Record<string, unknown>[];
  columns: string[];
  loading: boolean;
  error?: string;
}

type PageState = 'loading' | 'not-found' | 'password' | 'ready';

export default function PublicDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [state, setState] = useState<PageState>('loading');
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResource | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [widgetDataMap, setWidgetDataMap] = useState<Record<string, WidgetData>>({});

  // Unwrap params
  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  const fetchShare = useCallback(async (shareSlug: string) => {
    try {
      const res = await fetch('/api/public-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', slug: shareSlug }),
      });

      if (!res.ok) {
        setState('not-found');
        return;
      }

      const data = await res.json();
      if (!data.success) {
        setState('not-found');
        return;
      }

      setShare(data.share);

      if (data.share.needsPassword) {
        setState('password');
      } else {
        await loadDashboard(shareSlug);
      }
    } catch {
      setState('not-found');
    }
  }, []);

  const loadDashboard = async (shareSlug: string) => {
    try {
      const res = await fetch('/api/public-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'view', slug: shareSlug }),
      });

      if (!res.ok) {
        setState('not-found');
        return;
      }

      const data = await res.json();
      if (data.success && data.resource) {
        const dashResource = data.resource as DashboardResource;
        setDashboard(dashResource);
        setState('ready');

        // Fetch data for each widget
        fetchAllWidgetData(dashResource.widgets);
      } else {
        setState('not-found');
      }
    } catch {
      setState('not-found');
    }
  };

  const fetchAllWidgetData = (widgets: WidgetInfo[]) => {
    // Initialize all widgets as loading
    const initial: Record<string, WidgetData> = {};
    widgets.forEach((w) => {
      initial[w.id] = { data: [], columns: [], loading: true };
    });
    setWidgetDataMap(initial);

    // Fetch each widget's data
    widgets.forEach((widget) => {
      if (!widget.querySQL) {
        setWidgetDataMap((prev) => ({
          ...prev,
          [widget.id]: { data: [], columns: [], loading: false, error: 'No query configured' },
        }));
        return;
      }

      fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: widget.querySQL }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`Query failed (${res.status})`);
          return res.json();
        })
        .then((result) => {
          setWidgetDataMap((prev) => ({
            ...prev,
            [widget.id]: {
              data: result.results || [],
              columns: result.columns || [],
              loading: false,
            },
          }));
        })
        .catch((err) => {
          setWidgetDataMap((prev) => ({
            ...prev,
            [widget.id]: {
              data: [],
              columns: [],
              loading: false,
              error: err instanceof Error ? err.message : 'Query failed',
            },
          }));
        });
    });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;

    setPasswordError('');

    try {
      const res = await fetch('/api/public-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', slug, password }),
      });

      const data = await res.json();

      if (data.success && data.verified) {
        await loadDashboard(slug);
      } else {
        setPasswordError('Incorrect password. Please try again.');
      }
    } catch {
      setPasswordError('Something went wrong. Please try again.');
    }
  };

  useEffect(() => {
    if (slug) {
      fetchShare(slug);
    }
  }, [slug, fetchShare]);

  // --- Loading ---
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // --- Not Found / Expired ---
  if (state === 'not-found') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Dashboard Not Found
          </h1>
          <p className="text-sm text-gray-500">
            This dashboard link may have expired, been revoked, or reached its maximum view count.
          </p>
        </div>
      </div>
    );
  }

  // --- Password Required ---
  if (state === 'password') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="max-w-sm w-full mx-auto px-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <h2 className="text-center text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
              Password Protected
            </h2>
            <p className="text-center text-xs text-gray-500 mb-5">
              Enter the password to view this dashboard.
            </p>
            <form onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                autoFocus
              />
              {passwordError && (
                <p className="text-xs text-red-500 mb-3">{passwordError}</p>
              )}
              <button
                type="submit"
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Unlock Dashboard
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- Ready: Show Dashboard with Real Widget Rendering ---
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <LayoutDashboard className="w-5 h-5 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                {dashboard?.name || 'Dashboard'}
              </h1>
              {dashboard?.description && (
                <p className="text-xs text-gray-500 truncate">{dashboard.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
            {share && (
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {share.viewCount + 1}
              </span>
            )}
            <span className="text-[10px] text-gray-400">
              Powered by <span className="font-semibold text-gray-600 dark:text-gray-300">DataForge</span>
            </span>
          </div>
        </div>
      </header>

      {/* Dashboard Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {dashboard && dashboard.widgets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...dashboard.widgets]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((widget) => {
                const wd = widgetDataMap[widget.id] || {
                  data: [],
                  columns: [],
                  loading: true,
                };

                return (
                  <div
                    key={widget.id}
                    className={
                      widget.position.w >= 3
                        ? 'sm:col-span-2 lg:col-span-3'
                        : widget.position.w >= 2
                        ? 'sm:col-span-2'
                        : ''
                    }
                  >
                    <WidgetRenderer
                      widgetType={widget.widgetType as 'kpi' | 'line' | 'bar' | 'horizontal_bar' | 'stacked_bar' | 'area' | 'pie' | 'donut' | 'scatter' | 'table' | 'text'}
                      title={widget.title}
                      data={wd.data}
                      columns={wd.columns}
                      visualization={widget.visualization}
                      loading={wd.loading}
                      error={wd.error}
                    />
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
            <LayoutDashboard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              No widgets in this dashboard
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              This dashboard doesn&apos;t have any widgets to display.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
