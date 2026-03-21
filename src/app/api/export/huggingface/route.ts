/**
 * HuggingFace Export API Endpoint
 *
 * POST /api/export/huggingface
 * Pushes a table from the working database to a HuggingFace dataset repo.
 */

import { NextResponse } from 'next/server';
import { apiMiddleware } from '@/lib/security/api-middleware';
import { enforceApiProtection } from '@/lib/security/api-guard';
import { z } from 'zod';
import { pushToHuggingFace } from '@/lib/export/huggingface';

const HuggingFaceExportSchema = z.object({
  table: z.string().min(1),
  repoId: z.string().min(1).regex(/^[^/]+\/[^/]+$/, 'Must be in format "username/dataset-name"'),
  token: z.string().min(1),
  private: z.boolean().optional().default(false),
  split: z.enum(['train', 'test', 'val']).optional().default('train'),
  description: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'file.export' });
    if (middlewareError) return middlewareError;

    const rateLimitResult = enforceApiProtection(request, {
      route: 'export/huggingface',
      rateLimit: { windowMs: 60000, max: 5 },
    });
    if (rateLimitResult) return rateLimitResult;

    const body = await request.json();
    const parsed = HuggingFaceExportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { table, repoId, token, private: isPrivate, split, description } = parsed.data;

    const result = await pushToHuggingFace({
      table,
      repoId,
      token,
      private: isPrivate,
      split,
      description,
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      datasetId: result.datasetId,
    });
  } catch (error) {
    console.error('HuggingFace export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'HuggingFace export failed',
      },
      { status: 500 }
    );
  }
}
