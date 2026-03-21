import { executeQuery } from '@/db/connection';
import { beginRequest, completeRequest, failRequest } from '@/lib/observability/request-monitor';
import { enforceApiProtection } from '@/lib/security/api-guard';
import { apiMiddleware } from '@/lib/security/api-middleware';
import { getCachedQuery, cacheQuery, makeCacheKey, CacheTTL } from '@/lib/cache';
import { checkTableAccess } from '@/lib/auth/table-permissions';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { UserRole } from '@/lib/auth/types';

const queryRequestSchema = z.object({
  query: z.string().min(1).max(10000),
  params: z.array(z.union([z.string(), z.number(), z.null()])).optional().default([]),
});

export async function POST(request: Request) {
  const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'query.execute' });
  if (middlewareError) return middlewareError;

  const monitor = beginRequest('query', request);

  const blocked = enforceApiProtection(request, {
    route: 'query',
    rateLimit: { windowMs: 60_000, max: 40 },
  });
  if (blocked) {
    completeRequest(monitor, blocked.status, { blocked: true });
    return blocked;
  }

  try {
    const body = await request.json();
    const parsed = queryRequestSchema.safeParse(body);

    if (!parsed.success) {
      completeRequest(monitor, 400, { reason: 'invalid_payload' });
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }

    const { query, params } = parsed.data;

    // Extract table names from SQL (FROM and JOIN clauses)
    const tableNameRegex = /\b(?:FROM|JOIN)\s+["`]?(\w+)["`]?/gi;
    const referencedTables: string[] = [];
    let tableMatch: RegExpExecArray | null;
    while ((tableMatch = tableNameRegex.exec(query)) !== null) {
      referencedTables.push(tableMatch[1]);
    }

    // Check table permissions (use 'viewer' as default role when no auth context)
    const userRole: UserRole = (request.headers.get('x-user-role') as UserRole) || 'viewer';
    const connectorId = request.headers.get('x-connector-id') || 'default';
    const allHiddenColumns: string[] = [];

    for (const tableName of referencedTables) {
      try {
        const access = checkTableAccess(connectorId, tableName, userRole);
        if (!access.allowed) {
          completeRequest(monitor, 403, { reason: 'table_access_denied', table: tableName });
          return NextResponse.json(
            { error: `Access denied: you do not have permission to query table '${tableName}'` },
            { status: 403 }
          );
        }
        if (access.hiddenColumns.length > 0) {
          allHiddenColumns.push(...access.hiddenColumns);
        }
      } catch {
        // If permission check fails (e.g., db not initialized), allow access
      }
    }

    // Check cache before executing
    const cacheKey = makeCacheKey(query, params);
    const cached = getCachedQuery<{ results: unknown[]; columns: string[] }>(cacheKey);

    if (cached) {
      completeRequest(monitor, 200, { rowCount: cached.results.length, cache: 'HIT' });
      return NextResponse.json(
        { results: cached.results, columns: cached.columns, rowCount: cached.results.length },
        { headers: { 'X-Cache': 'HIT' } }
      );
    }

    const { results: rawResults, columns: rawColumns } = await executeQuery(query, params);

    // Remove hidden columns from results
    let results = rawResults;
    let columns = rawColumns;
    if (allHiddenColumns.length > 0) {
      const hiddenSet = new Set(allHiddenColumns);
      columns = rawColumns.filter((c: string) => !hiddenSet.has(c));
      results = rawResults.map((row: Record<string, unknown>) => {
        const filtered: Record<string, unknown> = {};
        for (const key of Object.keys(row)) {
          if (!hiddenSet.has(key)) {
            filtered[key] = row[key];
          }
        }
        return filtered;
      });
    }

    // Cache the result with DETAIL TTL (1 minute)
    cacheQuery(cacheKey, { results, columns }, CacheTTL.DETAIL);

    completeRequest(monitor, 200, { rowCount: results.length, cache: 'MISS' });
    return NextResponse.json(
      { results, columns, rowCount: results.length },
      { headers: { 'X-Cache': 'MISS' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Query execution failed';
    failRequest(monitor, error, 500);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
