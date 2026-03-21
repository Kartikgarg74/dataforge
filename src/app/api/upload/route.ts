/**
 * File Upload API Endpoint
 *
 * POST /api/upload
 * Accepts multipart form data with a file, parses it, and ingests into the working database.
 */

import { NextResponse } from 'next/server';
import { apiMiddleware } from '@/lib/security/api-middleware';
import { enforceApiProtection } from '@/lib/security/api-guard';
import { parseFile, generateTableName, ingestIntoSQLite } from '@/lib/ingestion';
import { getExistingTables } from '@/lib/ingestion/ingest-sqlite';
import { profileDataset } from '@/lib/profiling';
import { createVersion } from '@/lib/ingestion/versioning';

/** Maximum file size: 500MB for local */
const MAX_FILE_SIZE = 500 * 1024 * 1024;

/** Allowed MIME types and extensions */
const ALLOWED_EXTENSIONS = new Set([
  'csv', 'tsv', 'tab', 'json', 'jsonl', 'ndjson',
  'parquet', 'xlsx', 'xls', 'db', 'sqlite', 'sqlite3',
]);

export async function POST(request: Request) {
  try {
    const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'file.upload' });
    if (middlewareError) return middlewareError;

    const rateLimitResult = enforceApiProtection(request, {
      route: 'upload',
      rateLimit: { windowMs: 60000, max: 20 },
    });
    if (rateLimitResult) return rateLimitResult;

    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Send a file in the "file" field.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
        },
        { status: 413 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 }
      );
    }

    // Validate extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: .${ext}. Supported: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Sanitize filename to prevent path traversal
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());

    // Get custom table name or generate one
    const customTableName = formData.get('tableName') as string | null;
    const existingTables = getExistingTables();
    const tableName = customTableName
      ? customTableName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
      : generateTableName(safeFilename, existingTables);

    // Parse options from form data
    const options = {
      tableName,
      delimiter: (formData.get('delimiter') as string) || undefined,
      hasHeader: formData.get('hasHeader') !== 'false',
      encoding: (formData.get('encoding') as BufferEncoding) || 'utf-8',
      sheetName: (formData.get('sheetName') as string) || undefined,
    };

    // Parse the file
    const parseResult = parseFile(buffer, safeFilename, options);

    if (parseResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'File contains no data rows', warnings: parseResult.warnings },
        { status: 400 }
      );
    }

    // Ingest into working database
    const ingestResult = ingestIntoSQLite(parseResult, tableName, file.size);

    // Auto-profile the dataset after successful ingestion
    let profile = null;
    try {
      profile = profileDataset(tableName);
    } catch (profileError) {
      console.warn('Auto-profiling failed (upload still succeeded):', profileError);
    }

    // Create a version snapshot after successful ingestion + profiling
    try {
      createVersion(tableName, tableName, {
        description: `Initial upload of ${safeFilename}`,
      });
    } catch (versionError) {
      console.warn('Versioning failed (upload still succeeded):', versionError);
    }

    // Return success with preview
    const previewRows = parseResult.rows.slice(0, 100);

    return NextResponse.json({
      success: true,
      table: {
        name: ingestResult.tableName,
        rowCount: ingestResult.rowCount,
        columnCount: ingestResult.columnCount,
        columns: ingestResult.columns.map((col) => ({
          name: col.name,
          type: col.type,
          nullCount: col.nullCount,
          sampleValues: col.sampleValues,
        })),
      },
      preview: {
        rows: previewRows,
        totalRows: ingestResult.rowCount,
        showing: previewRows.length,
      },
      metadata: {
        originalFilename: safeFilename,
        fileSize: file.size,
        format: parseResult.format,
        delimiter: parseResult.delimiter,
        ingestTimeMs: ingestResult.ingestTimeMs,
      },
      profile,
      warnings: ingestResult.warnings,
    });
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process file',
      },
      { status: 500 }
    );
  }
}
