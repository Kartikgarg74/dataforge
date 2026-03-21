'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { WidgetRenderer } from '@/components/dashboard/widget-renderer';

interface WidgetInfo {
  id: string;
  title: string;
  widgetType: string;
  querySQL: string;
  position: { x: number; y: number; w: number; h: number };
  visualization: Record<string, unknown>;
  sortOrder: number;
}

interface WidgetData {
  data: Record<string, unknown>[];
  columns: string[];
  loading: boolean;
  error?: string;
}

type PageState = 'loading' | 'not-found' | 'ready';

export default function EmbedWidgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [widgetId, setWidgetId] = useState<string | null>(null);
  const [state, setState] = useState<PageState>('loading');
  const [widget, setWidget] = useState<WidgetInfo | null>(null);
  const [widgetData, setWidgetData] = useState<WidgetData>({
    data: [],
    columns: [],
    loading: true,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then((p) => setWidgetId(p.id));
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

  useEffect(() => {
    if (!widgetId) return;

    const fetchWidget = async () => {
      try {
        // The widget ID is expected in format: slug--widgetId
        // where slug is the share slug and widgetId is the widget's id within the dashboard
        const parts = widgetId.split('--');
        if (parts.length !== 2) {
          setState('not-found');
          return;
        }

        const [shareSlug, targetWidgetId] = parts;

        // Fetch the dashboard via the share
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
        if (!data.success || !data.resource || data.resource.type !== 'dashboard') {
          setState('not-found');
          return;
        }

        const found = data.resource.widgets.find(
          (w: WidgetInfo) => w.id === targetWidgetId
        );

        if (!found) {
          setState('not-found');
          return;
        }

        setWidget(found);
        setState('ready');

        // Fetch widget data
        if (found.querySQL) {
          fetchWidgetData(found.querySQL);
        } else {
          setWidgetData({
            data: [],
            columns: [],
            loading: false,
            error: 'No query configured',
          });
        }
      } catch {
        setState('not-found');
      }
    };

    fetchWidget();
  }, [widgetId]);

  const fetchWidgetData = async (querySQL: string) => {
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: querySQL }),
      });

      if (!res.ok) {
        throw new Error(`Query failed (${res.status})`);
      }

      const result = await res.json();
      setWidgetData({
        data: result.results || [],
        columns: result.columns || [],
        loading: false,
      });
    } catch (err) {
      setWidgetData({
        data: [],
        columns: [],
        loading: false,
        error: err instanceof Error ? err.message : 'Query failed',
      });
    }
  };

  // --- Loading ---
  if (state === 'loading') {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-screen bg-white dark:bg-gray-950">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      </div>
    );
  }

  // --- Not Found ---
  if (state === 'not-found') {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-screen bg-white dark:bg-gray-950 p-4">
        <div className="text-center">
          <AlertTriangle className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-500">Widget not found.</p>
        </div>
      </div>
    );
  }

  // --- Ready: Single Widget Embed with real data ---
  return (
    <div ref={containerRef} className="bg-white dark:bg-gray-950 min-h-screen">
      <div className="m-2">
        <WidgetRenderer
          widgetType={
            (widget?.widgetType as 'kpi' | 'line' | 'bar' | 'horizontal_bar' | 'stacked_bar' | 'area' | 'pie' | 'donut' | 'scatter' | 'table' | 'text') ||
            'table'
          }
          title={widget?.title || 'Widget'}
          data={widgetData.data}
          columns={widgetData.columns}
          visualization={widget?.visualization || {}}
          loading={widgetData.loading}
          error={widgetData.error}
        />
      </div>
    </div>
  );
}
