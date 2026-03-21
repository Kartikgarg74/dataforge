/**
 * Schedule API Endpoint
 *
 * POST /api/schedule
 * Create, list, update, toggle, and delete scheduled reports/alerts.
 */

import { NextResponse } from 'next/server';
import { apiMiddleware } from '@/lib/security/api-middleware';
import { z } from 'zod';
import { createSchedule, listSchedules, updateSchedule, deleteSchedule, toggleSchedule } from '@/lib/scheduling';

const ChannelsSchema = z.object({
  email: z.object({ recipients: z.array(z.string()) }).optional(),
  slack: z.object({ webhookUrl: z.string() }).optional(),
  webhook: z.object({ url: z.string(), headers: z.record(z.string()).optional() }).optional(),
});

const AlertConfigSchema = z.object({
  condition: z.enum(['gt', 'lt', 'eq', 'change_pct']),
  threshold: z.number(),
  column: z.string(),
});

const RequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name: z.string().min(1),
    type: z.enum(['report', 'alert', 'digest']),
    source: z.object({
      type: z.enum(['dashboard', 'query']),
      id: z.string().min(1),
    }),
    cron: z.string().min(1),
    timezone: z.string().default('UTC'),
    channels: ChannelsSchema,
    alert: AlertConfigSchema.optional(),
  }),
  z.object({
    action: z.literal('list'),
    teamId: z.string().optional(),
  }),
  z.object({
    action: z.literal('update'),
    scheduleId: z.string().min(1),
    updates: z.object({
      name: z.string().optional(),
      cron: z.string().optional(),
      timezone: z.string().optional(),
      channels: ChannelsSchema.optional(),
      alert: AlertConfigSchema.optional(),
    }),
  }),
  z.object({
    action: z.literal('toggle'),
    scheduleId: z.string().min(1),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal('delete'),
    scheduleId: z.string().min(1),
  }),
]);

export async function POST(request: Request) {
  try {
    const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'schedule.manage' });
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
        const schedule = createSchedule({
          name: data.name,
          type: data.type,
          sourceType: data.source.type,
          sourceId: data.source.id,
          cron: data.cron,
          timezone: data.timezone,
          channels: data.channels,
          alertConfig: data.alert,
        });
        return NextResponse.json({ success: true, schedule });
      }

      case 'list': {
        const schedules = listSchedules(data.teamId);
        return NextResponse.json({ success: true, schedules });
      }

      case 'update': {
        const schedule = updateSchedule(data.scheduleId, {
          name: data.updates.name,
          cronExpression: data.updates.cron,
          timezone: data.updates.timezone,
          channels: data.updates.channels,
          alertConfig: data.updates.alert,
        });
        return NextResponse.json({ success: true, schedule });
      }

      case 'toggle': {
        toggleSchedule(data.scheduleId, data.enabled);
        return NextResponse.json({ success: true });
      }

      case 'delete': {
        deleteSchedule(data.scheduleId);
        return NextResponse.json({ success: true });
      }
    }
  } catch (error) {
    console.error('Schedule API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Schedule operation failed' },
      { status: 500 }
    );
  }
}
