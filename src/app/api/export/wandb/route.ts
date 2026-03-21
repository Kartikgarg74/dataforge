/**
 * W&B Export API Endpoint
 *
 * POST /api/export/wandb
 * Upload a dataset to Weights & Biases as an artifact.
 */

import { NextResponse } from 'next/server';
import { apiMiddleware } from '@/lib/security/api-middleware';
import { enforceApiProtection } from '@/lib/security/api-guard';
import { z } from 'zod';
import { uploadToWandB } from '@/lib/export/wandb';
import { exportCSV } from '@/lib/export/csv';
import Database from 'better-sqlite3';
import path from 'path';

const WORKING_DB_PATH = path.join(process.cwd(), 'data', 'working.db');

const RequestSchema = z.object({
  table: z.string().min(1),
  project: z.string().min(1),
  entity: z.string().min(1),
  apiKey: z.string().min(1),
  artifactName: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'file.export' });
    if (middlewareError) return middlewareError;

    const rateLimitResult = enforceApiProtection(request, {
      route: 'export/wandb',
      rateLimit: { windowMs: 60000, max: 5 },
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

    const { table, project, entity, apiKey, artifactName, description } = parsed.data;

    // Get data from working DB
    const db = new Database(WORKING_DB_PATH, { readonly: true });
    let rows: Record<string, unknown>[];
    let columns: string[];
    try {
      rows = db.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
      columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    } finally {
      db.close();
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Table is empty' }, { status: 400 });
    }

    // Convert to CSV
    const csvBuffer = exportCSV(rows, columns);

    // Upload to W&B
    const result = await uploadToWandB(
      { table, project, entity, apiKey, artifactName, description, metadata: { rowCount: rows.length, columns } },
      csvBuffer
    );

    return NextResponse.json({
      success: true,
      url: result.url,
      artifactId: result.artifactId,
      version: result.version,
    });
  } catch (error) {
    console.error('W&B export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'W&B upload failed' },
      { status: 500 }
    );
  }
}
