import { NextResponse } from 'next/server';
import { Client } from '@neondatabase/serverless';
import { beginRequest, completeRequest, failRequest } from '@/lib/observability/request-monitor';
import { enforceApiProtection } from '@/lib/security/api-guard';

interface TableRow {
  table_name: string;
}

interface QueryField {
  name: string;
}

function isSafeReadOnlyQuery(query: string): boolean {
  const normalized = query.trim();
  if (!normalized || normalized.length > 10000) {
    return false;
  }

  if (normalized.includes(';')) {
    return false;
  }

  if (!/^\s*(select|with)\b/i.test(normalized)) {
    return false;
  }

  if (/\b(insert|update|delete|drop|alter|create|replace|truncate|grant|revoke|copy)\b/i.test(normalized)) {
    return false;
  }

  return true;
}

export async function POST(request: Request) {
  const monitor = beginRequest('neon', request);

  const blocked = enforceApiProtection(request, {
    route: 'neon',
    rateLimit: { windowMs: 60_000, max: 20 },
    requireApiKey: process.env.NEON_API_KEY_REQUIRED === 'true',
  });
  if (blocked) {
    completeRequest(monitor, blocked.status, { blocked: true });
    return blocked;
  }

  let client: Client | null = null;

  try {
    const body = await request.json();
    const { connectionString, query, action = 'query' } = body;

    console.log('Neon API called:', { action, hasQuery: !!query });

    // Security check
    if (!connectionString || typeof connectionString !== 'string') {
      completeRequest(monitor, 400, { reason: 'missing_connection_string' });
      return NextResponse.json(
        { error: 'Connection string is required' },
        { status: 400 }
      );
    }

    if (!connectionString.includes('neon.tech')) {
      completeRequest(monitor, 400, { reason: 'invalid_connection_string' });
      return NextResponse.json(
        { error: 'Only Neon (neon.tech) databases supported' },
        { status: 400 }
      );
    }

    // Create client with timeout
    client = new Client(connectionString);

    // Set connection timeout
    const connectPromise = client.connect();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout after 10s')), 10000);
    });

    await Promise.race([connectPromise, timeoutPromise]);
    console.log('Connected to Neon successfully');

    let result;

    if (action === 'tables') {
      // List tables
      result = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      `);

      await client.end();
      completeRequest(monitor, 200, { action, rowCount: result.rowCount ?? 0 });

      return NextResponse.json({
        success: true,
        connected: true,
        database: 'neon',
        tables: result.rows.map((r: TableRow) => r.table_name),
        rowCount: result.rowCount,
      });

    } else {
      // Execute query
      if (!query) {
        completeRequest(monitor, 400, { reason: 'missing_query' });
        return NextResponse.json(
          { error: 'Query is required for query action' },
          { status: 400 }
        );
      }

      if (typeof query !== 'string' || !isSafeReadOnlyQuery(query)) {
        completeRequest(monitor, 400, { reason: 'unsafe_query' });
        return NextResponse.json(
          { error: 'Only safe read-only SELECT/CTE queries are allowed' },
          { status: 400 }
        );
      }

      result = await client.query(query);
      await client.end();
      completeRequest(monitor, 200, { action, rowCount: result.rowCount ?? 0 });

      return NextResponse.json({
        success: true,
        connected: true,
        database: 'neon',
        results: result.rows,
        columns: result.fields.map((f: QueryField) => f.name),
        rowCount: result.rowCount,
      });
    }

  } catch (error: unknown) {
    console.error('Neon error:', error);

    // Clean up connection
    if (client) {
      try { await client.end(); } catch {
        // Ignore errors on cleanup
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Database connection failed';
    failRequest(monitor, error, 500);

    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}
