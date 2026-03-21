/**
 * Chat Threads API
 *
 * POST /api/threads
 * Load and list persisted chat threads.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import Database from 'better-sqlite3';
import path from 'path';

const WORKING_DB_PATH = path.join(process.cwd(), 'data', 'working.db');

function getDb(): Database.Database {
  const db = new Database(WORKING_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS _chat_threads (
      id TEXT PRIMARY KEY,
      team_id TEXT DEFAULT '',
      user_id TEXT DEFAULT '',
      connector_id TEXT,
      title TEXT,
      messages TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  return db;
}

const RequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('get'), threadId: z.string().min(1) }),
  z.object({ action: z.literal('list'), teamId: z.string().optional(), limit: z.number().int().positive().optional() }),
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const db = getDb();
    try {
      const data = parsed.data;

      if (data.action === 'get') {
        const row = db.prepare('SELECT * FROM _chat_threads WHERE id = ?').get(data.threadId) as Record<string, unknown> | undefined;
        if (!row) {
          return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
        }
        return NextResponse.json({
          success: true,
          thread: {
            id: row.id,
            title: row.title,
            messages: JSON.parse((row.messages as string) || '[]'),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
        });
      }

      if (data.action === 'list') {
        const limit = data.limit || 50;
        const teamId = data.teamId || '';
        const rows = db.prepare(
          'SELECT id, title, created_at, updated_at FROM _chat_threads WHERE team_id = ? ORDER BY updated_at DESC LIMIT ?'
        ).all(teamId, limit) as Array<Record<string, unknown>>;

        return NextResponse.json({
          success: true,
          threads: rows.map((r) => ({
            id: r.id,
            title: r.title,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })),
        });
      }
    } finally {
      db.close();
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Thread operation failed' },
      { status: 500 }
    );
  }
}
