/**
 * Saved Queries Store
 *
 * CRUD operations for saved queries.
 */

import Database from 'better-sqlite3';
import path from 'path';
import type { SavedQuery, QueryParameter, VisualizationConfig } from './types';

const WORKING_DB_PATH = path.join(process.cwd(), 'data', 'working.db');

function getDb(): Database.Database {
  const db = new Database(WORKING_DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

export function createSavedQuery(input: {
  teamId: string;
  name: string;
  description?: string;
  category?: string;
  naturalLanguage: string;
  sql: string;
  connectorId?: string;
  parameters?: QueryParameter[];
  visualization?: VisualizationConfig;
  tags?: string[];
  createdBy: string;
}): SavedQuery {
  const db = getDb();
  try {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO saved_queries (id, team_id, name, description, category, natural_language, sql, connector_id, parameters, visualization, tags, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, input.teamId, input.name, input.description || null,
      input.category || null, input.naturalLanguage, input.sql,
      input.connectorId || 'default',
      JSON.stringify(input.parameters || []),
      input.visualization ? JSON.stringify(input.visualization) : null,
      JSON.stringify(input.tags || []),
      input.createdBy
    );
    return getSavedQuery(id)!;
  } finally {
    db.close();
  }
}

export function getSavedQuery(id: string): SavedQuery | null {
  const db = getDb();
  try {
    const row = db.prepare('SELECT * FROM saved_queries WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  } finally {
    db.close();
  }
}

export function listSavedQueries(teamId: string, options?: {
  category?: string;
  search?: string;
  limit?: number;
  sortBy?: 'usage' | 'recent' | 'name';
}): SavedQuery[] {
  const db = getDb();
  try {
    let sql = 'SELECT * FROM saved_queries WHERE team_id = ?';
    const params: unknown[] = [teamId];

    if (options?.category) {
      sql += ' AND category = ?';
      params.push(options.category);
    }
    if (options?.search) {
      sql += ' AND (name LIKE ? OR description LIKE ? OR natural_language LIKE ?)';
      const pattern = `%${options.search}%`;
      params.push(pattern, pattern, pattern);
    }

    switch (options?.sortBy) {
      case 'usage': sql += ' ORDER BY usage_count DESC'; break;
      case 'name': sql += ' ORDER BY name ASC'; break;
      default: sql += ' ORDER BY updated_at DESC';
    }

    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    return rows.map(mapRow);
  } finally {
    db.close();
  }
}

export function updateSavedQuery(id: string, updates: Partial<Pick<SavedQuery, 'name' | 'description' | 'category' | 'sql' | 'naturalLanguage' | 'visualization' | 'tags'>>): SavedQuery | null {
  const db = getDb();
  try {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.description !== undefined) { sets.push('description = ?'); values.push(updates.description); }
    if (updates.category !== undefined) { sets.push('category = ?'); values.push(updates.category); }
    if (updates.sql !== undefined) { sets.push('sql = ?'); values.push(updates.sql); }
    if (updates.naturalLanguage !== undefined) { sets.push('natural_language = ?'); values.push(updates.naturalLanguage); }
    if (updates.visualization !== undefined) { sets.push('visualization = ?'); values.push(JSON.stringify(updates.visualization)); }
    if (updates.tags !== undefined) { sets.push('tags = ?'); values.push(JSON.stringify(updates.tags)); }

    sets.push("updated_at = datetime('now')");
    values.push(id);

    if (sets.length > 1) {
      db.prepare(`UPDATE saved_queries SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }
    return getSavedQuery(id);
  } finally {
    db.close();
  }
}

export function deleteSavedQuery(id: string): void {
  const db = getDb();
  try {
    db.prepare('DELETE FROM saved_queries WHERE id = ?').run(id);
  } finally {
    db.close();
  }
}

export function incrementQueryUsage(id: string): void {
  const db = getDb();
  try {
    db.prepare("UPDATE saved_queries SET usage_count = usage_count + 1, last_run_at = datetime('now') WHERE id = ?").run(id);
  } finally {
    db.close();
  }
}

export function getTopQueries(teamId: string, limit: number = 10): SavedQuery[] {
  return listSavedQueries(teamId, { sortBy: 'usage', limit });
}

/**
 * Toggle a query as favorite for a user.
 * If already favorited, removes it. If not, adds it.
 */
export function toggleFavorite(userId: string, queryId: string): void {
  const db = getDb();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS query_favorites (
        user_id TEXT NOT NULL,
        query_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, query_id)
      )
    `);
    const existing = db.prepare(
      'SELECT 1 FROM query_favorites WHERE user_id = ? AND query_id = ?'
    ).get(userId, queryId);
    if (existing) {
      db.prepare('DELETE FROM query_favorites WHERE user_id = ? AND query_id = ?').run(userId, queryId);
    } else {
      db.prepare('INSERT INTO query_favorites (user_id, query_id) VALUES (?, ?)').run(userId, queryId);
    }
  } finally {
    db.close();
  }
}

/**
 * Check if a query is favorited by a user.
 */
export function isFavorite(userId: string, queryId: string): boolean {
  const db = getDb();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS query_favorites (
        user_id TEXT NOT NULL,
        query_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, query_id)
      )
    `);
    const row = db.prepare(
      'SELECT 1 FROM query_favorites WHERE user_id = ? AND query_id = ?'
    ).get(userId, queryId);
    return !!row;
  } finally {
    db.close();
  }
}

/**
 * List all favorite queries for a user.
 */
export function listFavorites(userId: string): SavedQuery[] {
  const db = getDb();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS query_favorites (
        user_id TEXT NOT NULL,
        query_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, query_id)
      )
    `);
    const rows = db.prepare(`
      SELECT sq.* FROM saved_queries sq
      INNER JOIN query_favorites qf ON sq.id = qf.query_id
      WHERE qf.user_id = ?
      ORDER BY qf.created_at DESC
    `).all(userId) as Array<Record<string, unknown>>;
    return rows.map(mapRow);
  } finally {
    db.close();
  }
}

function mapRow(row: Record<string, unknown>): SavedQuery {
  return {
    id: row.id as string,
    teamId: row.team_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    category: row.category as string | undefined,
    naturalLanguage: row.natural_language as string,
    sql: row.sql as string,
    connectorId: row.connector_id as string,
    parameters: row.parameters ? JSON.parse(row.parameters as string) : [],
    visualization: row.visualization ? JSON.parse(row.visualization as string) : undefined,
    usageCount: row.usage_count as number,
    lastRunAt: row.last_run_at as string | undefined,
    tags: row.tags ? JSON.parse(row.tags as string) : [],
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
