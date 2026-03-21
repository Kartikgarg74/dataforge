/**
 * Dataset Split API Endpoint
 *
 * POST /api/split
 * Split datasets into train/val/test sets.
 */

import { NextResponse } from 'next/server';
import { apiMiddleware } from '@/lib/security/api-middleware';
import { enforceApiProtection } from '@/lib/security/api-guard';
import { z } from 'zod';
import { splitDataset } from '@/lib/splitting';

const SplitRequestSchema = z.object({
  table: z.string().min(1),
  strategy: z.enum(['random', 'stratified', 'temporal', 'group', 'kfold']),
  ratios: z.object({
    train: z.number().min(0).max(1),
    val: z.number().min(0).max(1),
    test: z.number().min(0).max(1),
  }),
  stratifyColumn: z.string().optional(),
  groupColumn: z.string().optional(),
  timeColumn: z.string().optional(),
  seed: z.number().int().optional(),
  kFolds: z.number().int().min(2).max(20).optional(),
});

export async function POST(request: Request) {
  try {
    const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'split.execute' });
    if (middlewareError) return middlewareError;

    const rateLimitResult = enforceApiProtection(request, {
      route: 'split',
      rateLimit: { windowMs: 60000, max: 20 },
    });
    if (rateLimitResult) return rateLimitResult;

    const body = await request.json();
    const parsed = SplitRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { table, strategy, ratios, stratifyColumn, groupColumn, timeColumn, seed } = parsed.data;

    const result = splitDataset(table, {
      strategy,
      ratios,
      stratifyColumn,
      groupColumn,
      timeColumn,
      seed,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Split API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Split failed',
      },
      { status: 500 }
    );
  }
}
