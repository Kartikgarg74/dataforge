'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Lock, AlertTriangle, LayoutDashboard } from 'lucide-react';
import { WidgetRenderer } from '@/components/dashboard/widget-renderer';

interface ShareInfo {
  id: string;
  resourceType: 'dashboard' | 'query';
  resourceId: string;
  slug: string;
  accessType: string;
  viewCount: number;
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
  refreshInterval?: number;
}

interface WidgetData {
  data: Record<string, unknown>[];
  columns: string[];
  loading: boolean;
  error?: string;
}

type PageState = 'loading' | 'not-found' | 'password' | 'ready';

export default function EmbedDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [state, setState] = useState<PageState>('loading');
  const [, setShare] = useState<ShareInfo | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResource | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [widgetDataMap, setWidgetDataMap] = useState<Record<string, WidgetData>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  // Auto-resize: post content height to parent via postMessage
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      const height = containerRef.current?.scrollHeight;
      if (height) {
        window.parent.postMessage(
          { type: 'dataforge-embed-resize', height },
          '*'
        );
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [state]);

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
        fetchAllWidgetData(dashResource.widgets);
        if (dashResource.refreshInterval && dashResource.refreshInterval > 0) {
          setRefreshInterval(dashResource.refreshInterval);
        }
      } else {
        setState('not-found');
      }
    } catch {
      setState('not-found');
    }
  };

  const fetchAllWidgetData = (widgets: WidgetInfo[]) => {
    const initial: Record<string, WidgetData> = {};
    widgets.forEach((w) => {
      initial[w.id] = { data: [], columns: [], loading: true };
    });
    setWidgetDataMap(initial);

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
        setPasswordError('Incorrect password.');
      }
    } catch {
      setPasswordError('Something went wrong.');
    }
  };

  useEffect(() => {
    if (slug) {
      fetchShare(slug);
    }
  }, [slug, fetchShare]);

  // Auto-refresh widget data at the configured interval
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0 || !dashboard) return;

    const intervalMs = refreshInterval * 1000;
    const handle = setInterval(() => {
      setIsRefreshing(true);
      fetchAllWidgetData(dashboard.widgets);
      // Clear the refreshing indicator after a short delay
      setTimeout(() => setIsRefreshing(false), 1500);
    }, intervalMs);

    return () => clearInterval(handle);
  }, [refreshInterval, dashboard]);

  // --- Loading ---
  if (state === 'loading') {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-screen bg-white dark:bg-gray-950">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  // --- Not Found ---
  if (state === 'not-found') {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-screen bg-white dark:bg-gray-950 p-4">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Dashboard not found or expired.</p>
        </div>
      </div>
    );
  }

  // --- Password ---
  if (state === 'password') {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-screen bg-white dark:bg-gray-950 p-4">
        <div className="max-w-xs w-full">
          <div className="flex items-center justify-center mb-3">
            <Lock className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-center text-xs text-gray-500 mb-3">
            This embed is password protected.
          </p>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              autoFocus
            />
            {passwordError && (
              <p className="text-xs text-red-500 mb-2">{passwordError}</p>
            )}
            <button
              type="submit"
              className="w-full px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Ready: Embedded Dashboard with real widgets ---
  return (
    <div ref={containerRef} className="bg-white dark:bg-gray-950 p-3 relative">
      {isRefreshing && (
        <div className="absolute top-1 right-3 flex items-center gap-1.5 text-xs text-gray-400 animate-pulse z-10">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Refreshing...</span>
        </div>
      )}
      {dashboard && dashboard.widgets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <LayoutDashboard className="w-8 h-8 text-gray-300 mb-2" />
          <p className="text-xs text-gray-400">No widgets to display.</p>
        </div>
      )}
    </div>
  );
}
