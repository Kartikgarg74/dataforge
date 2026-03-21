/**
 * Semantic Layer API
 *
 * POST /api/semantic
 * Actions: save, get
 *
 * Stores semantic layer JSON in a _semantic_layers table in the working DB.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'db', 'app.db');

function getDb(): Database.Database {
  const db = new Database(DB_PATH);

  // Ensure the _semantic_layers table exists (idempotent)
  db.exec(`
    CREATE TABLE IF NOT EXISTS _semantic_layers (
      connector_id TEXT PRIMARY KEY,
      layer_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}

const RequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save'),
    connectorId: z.string().min(1),
    semanticLayer: z.record(z.unknown()),
  }),
  z.object({
    action: z.literal('get'),
    connectorId: z.string().min(1),
  }),
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;

    switch (data.action) {
      case 'save': {
        const db = getDb();
        try {
          const now = new Date().toISOString();
          const json = JSON.stringify(data.semanticLayer);

          db.prepare(`
            INSERT INTO _semantic_layers (connector_id, layer_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(connector_id) DO UPDATE SET
              layer_json = excluded.layer_json,
              updated_at = excluded.updated_at
          `).run(data.connectorId, json, now);

          return NextResponse.json({ success: true });
        } finally {
          db.close();
        }
      }

      case 'get': {
        const db = getDb();
        try {
          const row = db
            .prepare(
              'SELECT layer_json, updated_at FROM _semantic_layers WHERE connector_id = ?',
            )
            .get(data.connectorId) as
            | { layer_json: string; updated_at: string }
            | undefined;

          if (!row) {
            return NextResponse.json({
              success: true,
              semanticLayer: null,
            });
          }

          return NextResponse.json({
            success: true,
            semanticLayer: JSON.parse(row.layer_json),
            updatedAt: row.updated_at,
          });
        } finally {
          db.close();
        }
      }
    }
  } catch (error) {
    console.error('Semantic API error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
