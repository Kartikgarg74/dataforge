import { getDatabaseProvider, getDatabaseSchema, getRowCounts } from '@/db/connection';
import { enforceApiProtection } from '@/lib/security/api-guard';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const blocked = enforceApiProtection(request, {
    route: 'schema',
    rateLimit: { windowMs: 60_000, max: 60 },
  });
  if (blocked) return blocked;

  try {
    const schemaText = await getDatabaseSchema();
    const tables = await parseSchema(schemaText);

    return NextResponse.json({
      provider: getDatabaseProvider(),
      schema: schemaText,
      tables: tables // Return directly as 'tables' for easier access
    });
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      tables: [] // Return empty array on error
    }, { status: 500 });
  }
}

interface Column {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

interface Table {
  name: string;
  columns: Column[];
  rowCount: number;
}

async function parseSchema(schemaText: string): Promise<Table[]> {
  const tables: Table[] = [];
  let currentTable: Table | null = null;
  const lines = schemaText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('Table:')) {
      if (currentTable) {
        tables.push(currentTable);
      }
      currentTable = {
        name: trimmed.replace('Table:', '').trim(),
        columns: [],
        rowCount: 0
      };
    }
    else if (trimmed.startsWith('-') && currentTable) {
      const match = trimmed.match(/- (\w+) \((\w+)\)/);
      if (match) {
        const [, name, type] = match;
        currentTable.columns.push({
          name,
          type,
          isPrimaryKey: name === 'id',
          isForeignKey: false
        });
      }
    }
  }

  if (currentTable) {
    tables.push(currentTable);
  }

  // Get row counts
  for (const table of tables) {
    try {
      table.rowCount = await getRowCounts(table.name);
    } catch {
      // Could not get row counts, default to 0
      table.rowCount = 0;
    }
  }

  return tables;
}
