/**
 * Export API Endpoint
 *
 * POST /api/export
 * Exports data from the working database in various formats.
 */

import { NextResponse } from 'next/server';
import { apiMiddleware } from '@/lib/security/api-middleware';
import { enforceApiProtection } from '@/lib/security/api-guard';
import { z } from 'zod';
import { exportData } from '@/lib/export';

const ExportRequestSchema = z.object({
  table: z.string().min(1),
  format: z.enum(['csv', 'json', 'jsonl', 'parquet', 'arrow', 'sqlite']),
  columns: z.array(z.string()).optional(),
  compression: z.enum(['none', 'gzip', 'snappy', 'zstd']).optional(),
  includeMetadata: z.boolean().optional(),
  maxRows: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  try {
    const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'file.export' });
    if (middlewareError) return middlewareError;

    const rateLimitResult = enforceApiProtection(request, {
      route: 'export',
      rateLimit: { windowMs: 60000, max: 20 },
    });
    if (rateLimitResult) return rateLimitResult;

    const body = await request.json();
    const parsed = ExportRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const options = parsed.data;

    const result = await exportData({
      format: options.format,
      table: options.table,
      columns: options.columns,
      compression: options.compression,
      maxRows: options.maxRows,
      includeMetadata: options.includeMetadata,
    });

    // Return file as download
    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Row-Count': String(result.rowCount),
        'X-Export-Format': options.format,
        'X-File-Size': String(result.fileSizeBytes),
      },
    });
  } catch (error) {
    console.error('Export API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Export failed',
      },
      { status: 500 }
    );
  }
}
