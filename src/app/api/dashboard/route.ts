/**
 * Dashboard API Endpoint
 *
 * Manages dashboards and widgets: create, get, list, update, delete,
 * add_widget, update_widget, remove_widget, update_layout.
 * POST /api/dashboard
 */

import { NextResponse } from 'next/server';
import { apiMiddleware } from '@/lib/security/api-middleware';
import { z } from 'zod';
import {
  createDashboard,
  getDashboard,
  listDashboards,
  updateDashboard,
  deleteDashboard,
  addWidget,
  updateWidget,
  removeWidget,
  updateLayout,
} from '@/lib/dashboard';
import { getCachedQuery, cacheQuery, makeCacheKey, CacheTTL } from '@/lib/cache';

const WidgetTypeEnum = z.enum([
  'kpi', 'line', 'bar', 'horizontal_bar', 'stacked_bar',
  'area', 'pie', 'donut', 'scatter', 'table', 'text',
]);

const WidgetPositionSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
});

const VisualizationConfigSchema = z.object({
  chartType: WidgetTypeEnum,
  xAxis: z.string().optional(),
  yAxis: z.string().optional(),
  colorField: z.string().optional(),
  showLegend: z.boolean().optional(),
  colors: z.array(z.string()).optional(),
  format: z.string().optional(),
  comparison: z.enum(['previous_period', 'same_period_last_year']).optional(),
  goal: z.number().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});

const GlobalFilterSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['date_range', 'select', 'multi_select', 'text']),
  column: z.string(),
  table: z.string(),
  defaultValue: z.unknown().optional(),
  linkedWidgets: z.array(z.string()),
});

const RequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    teamId: z.string().min(1),
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    createdBy: z.string().min(1),
  }),
  z.object({
    action: z.literal('get'),
    id: z.string().min(1),
  }),
  z.object({
    action: z.literal('list'),
    teamId: z.string().min(1),
  }),
  z.object({
    action: z.literal('update'),
    id: z.string().min(1),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    filters: z.array(GlobalFilterSchema).optional(),
    refreshInterval: z.number().int().min(0).optional(),
    isPublic: z.boolean().optional(),
    publicSlug: z.string().optional(),
  }),
  z.object({
    action: z.literal('delete'),
    id: z.string().min(1),
  }),
  z.object({
    action: z.literal('add_widget'),
    dashboardId: z.string().min(1),
    title: z.string().min(1).max(200),
    widgetType: WidgetTypeEnum,
    queryNatural: z.string().min(1),
    querySQL: z.string().min(1),
    connectorId: z.string().default('default'),
    visualization: VisualizationConfigSchema,
    position: WidgetPositionSchema,
    refreshOverride: z.number().int().min(0).optional(),
    sortOrder: z.number().int().default(0),
  }),
  z.object({
    action: z.literal('update_widget'),
    widgetId: z.string().min(1),
    title: z.string().min(1).max(200).optional(),
    widgetType: WidgetTypeEnum.optional(),
    queryNatural: z.string().min(1).optional(),
    querySQL: z.string().min(1).optional(),
    connectorId: z.string().optional(),
    visualization: VisualizationConfigSchema.optional(),
    position: WidgetPositionSchema.optional(),
    refreshOverride: z.number().int().min(0).optional(),
    sortOrder: z.number().int().optional(),
  }),
  z.object({
    action: z.literal('remove_widget'),
    widgetId: z.string().min(1),
  }),
  z.object({
    action: z.literal('update_layout'),
    dashboardId: z.string().min(1),
    widgets: z.array(
      z.object({
        id: z.string().min(1),
        position: WidgetPositionSchema,
      })
    ),
  }),
]);

export async function POST(request: Request) {
  try {
    const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'dashboard.manage' });
    if (middlewareError) return middlewareError;

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    switch (data.action) {
      case 'create': {
        const dashboard = createDashboard(
          data.teamId,
          data.name,
          data.description,
          data.createdBy
        );
        return NextResponse.json({ success: true, dashboard });
      }

      case 'get': {
        // Check cache for dashboard data
        const dashCacheKey = makeCacheKey(`dashboard:${data.id}`, [], 'dashboard');
        const cachedDashboard = getCachedQuery<{ success: boolean; dashboard: unknown }>(dashCacheKey);

        if (cachedDashboard) {
          return NextResponse.json(cachedDashboard, {
            headers: { 'X-Cache': 'HIT' },
          });
        }

        const dashboard = getDashboard(data.id);
        if (!dashboard) {
          return NextResponse.json(
            { error: 'Dashboard not found' },
            { status: 404 }
          );
        }

        const responsePayload = { success: true, dashboard };
        // Cache with DASHBOARD_DEFAULT TTL (configurable, defaults to 5 min)
        cacheQuery(dashCacheKey, responsePayload, CacheTTL.DASHBOARD_DEFAULT);

        return NextResponse.json(responsePayload, {
          headers: { 'X-Cache': 'MISS' },
        });
      }

      case 'list': {
        const dashboards = listDashboards(data.teamId);
        return NextResponse.json({ success: true, dashboards });
      }

      case 'update': {
        const { action: _, id, ...updates } = data;
        const dashboard = updateDashboard(id, updates);
        return NextResponse.json({ success: true, dashboard });
      }

      case 'delete': {
        deleteDashboard(data.id);
        return NextResponse.json({ success: true });
      }

      case 'add_widget': {
        const { action: _, dashboardId, ...widgetData } = data;
        const widget = addWidget(dashboardId, widgetData);
        return NextResponse.json({ success: true, widget });
      }

      case 'update_widget': {
        const { action: _, widgetId, ...updates } = data;
        const widget = updateWidget(widgetId, updates);
        return NextResponse.json({ success: true, widget });
      }

      case 'remove_widget': {
        removeWidget(data.widgetId);
        return NextResponse.json({ success: true });
      }

      case 'update_layout': {
        updateLayout(data.dashboardId, data.widgets);
        return NextResponse.json({ success: true });
      }
    }
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
