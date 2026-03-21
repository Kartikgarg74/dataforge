/**
 * Transform Pipeline API Endpoint
 *
 * POST /api/transform
 * Execute data transformation pipelines on working database tables.
 */

import { NextResponse } from 'next/server';
import { apiMiddleware } from '@/lib/security/api-middleware';
import { enforceApiProtection } from '@/lib/security/api-guard';
import { z } from 'zod';
import { executePipeline, previewStep } from '@/lib/transforms';
import { createVersion } from '@/lib/ingestion/versioning';

const TransformStepSchema = z.object({
  id: z.string().optional(),
  type: z.enum([
    'filter', 'dedup', 'sample', 'sort', 'limit',
    'fill_nulls', 'drop_nulls', 'rename', 'drop_columns',
    'reorder', 'cast_type', 'computed_column',
    'trim', 'lowercase', 'uppercase', 'regex_replace',
    'round', 'normalize', 'bin', 'clip_outliers',
    'one_hot_encode', 'label_encode',
    'extract', 'group_aggregate', 'join', 'pivot', 'unpivot',
    'custom_sql', 'custom_python',
  ]),
  params: z.record(z.unknown()),
  description: z.string(),
  createdBy: z.enum(['user', 'ai']).optional(),
});

const RequestSchema = z.object({
  sourceTable: z.string().min(1),
  steps: z.array(TransformStepSchema).min(1),
  pipelineId: z.string().optional(),
  pipelineName: z.string().optional(),
  preview: z.boolean().optional(),
  previewRows: z.number().int().positive().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'transform.execute' });
    if (middlewareError) return middlewareError;

    const rateLimitResult = enforceApiProtection(request, {
      route: 'transform',
      rateLimit: { windowMs: 60000, max: 20 },
    });
    if (rateLimitResult) return rateLimitResult;

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { sourceTable, steps, pipelineId, pipelineName, preview, previewRows } = parsed.data;

    // Preview mode: only show the first step's result without persisting
    if (preview) {
      const firstStep = steps[0];
      const previewResult = previewStep(
        sourceTable,
        {
          type: firstStep.type,
          params: firstStep.params,
          description: firstStep.description,
        },
        previewRows || 100
      );

      return NextResponse.json({
        success: true,
        preview: previewResult,
      });
    }

    // Full execution
    const stepsWithIds = steps.map((s) => ({
      ...s,
      id: s.id || crypto.randomUUID(),
    }));

    const pipeline = executePipeline(sourceTable, stepsWithIds, {
      pipelineId,
      pipelineName,
    });

    if (pipeline.status === 'failed') {
      return NextResponse.json(
        {
          error: 'Pipeline execution failed',
          pipeline,
        },
        { status: 500 }
      );
    }

    // Create a version snapshot after successful pipeline execution
    try {
      createVersion(sourceTable, pipeline.resultTable, {
        pipelineId: pipeline.id,
        description: `Transform pipeline: ${pipeline.name}`,
      });
    } catch (versionError) {
      console.warn('Versioning failed (transform still succeeded):', versionError);
    }

    return NextResponse.json({
      success: true,
      pipeline,
    });
  } catch (error) {
    console.error('Transform API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Transform failed',
      },
      { status: 500 }
    );
  }
}
