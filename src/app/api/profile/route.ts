/**
 * Data Profiling API Endpoint
 *
 * POST /api/profile
 * Generates comprehensive data profiles for tables in the working database.
 */

import { NextResponse } from 'next/server';
import { apiMiddleware } from '@/lib/security/api-middleware';
import { enforceApiProtection } from '@/lib/security/api-guard';
import { z } from 'zod';
import { profileDataset } from '@/lib/profiling';

const ProfileRequestSchema = z.object({
  table: z.string().min(1),
  columns: z.array(z.string()).optional(),
  sampleSize: z.number().int().positive().max(1_000_000).optional(),
});

export async function POST(request: Request) {
  try {
    const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'profile.run' });
    if (middlewareError) return middlewareError;

    const rateLimitResult = enforceApiProtection(request, {
      route: 'profile',
      rateLimit: { windowMs: 60000, max: 30 },
    });
    if (rateLimitResult) return rateLimitResult;

    const body = await request.json();
    const parsed = ProfileRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { table, columns, sampleSize } = parsed.data;

    const profile = profileDataset(table, { columns, sampleSize });

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Profiling failed',
      },
      { status: 500 }
    );
  }
}
