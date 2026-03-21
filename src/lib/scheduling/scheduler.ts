/**
 * Schedule Manager
 *
 * CRUD operations for scheduled reports and alerts.
 * Actual cron execution requires BullMQ + Redis (Phase 2C infrastructure).
 * This module handles persistence and configuration.
 */

import Database from 'better-sqlite3';
import path from 'path';
import type { Schedule, ScheduleChannels, AlertConfig } from './types';

const WORKING_DB_PATH = path.join(process.cwd(), 'data', 'working.db');

function getDb(): Database.Database {
  const db = new Database(WORKING_DB_PATH);
  db.pragma('journal_mode = WAL');
  ensureTables(db);
  return db;
}

function ensureTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      channels TEXT NOT NULL DEFAULT '{}',
      alert_config TEXT,
      enabled INTEGER DEFAULT 1,
      last_run_at TEXT,
      last_status TEXT,
      next_run_at TEXT,
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedule_runs (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      error_message TEXT,
      delivery_results TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_schedules_team ON schedules(team_id);
    CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled) WHERE enabled = 1;
    CREATE INDEX IF NOT EXISTS idx_schedule_runs_schedule ON schedule_runs(schedule_id);
  `);
}

export function createSchedule(input: {
  name: string;
  type: 'report' | 'alert' | 'digest';
  sourceType: 'dashboard' | 'query';
  sourceId: string;
  cron: string;
  timezone: string;
  channels: ScheduleChannels;
  alertConfig?: AlertConfig;
  teamId?: string;
  createdBy?: string;
}): Schedule {
  const db = getDb();
  try {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO schedules (id, team_id, name, type, source_type, source_id, cron_expression, timezone, channels, alert_config, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, input.teamId || '', input.name, input.type,
      input.sourceType, input.sourceId, input.cron, input.timezone,
      JSON.stringify(input.channels),
      input.alertConfig ? JSON.stringify(input.alertConfig) : null,
      input.createdBy || ''
    );

    return getSchedule(id)!;
  } finally {
    db.close();
  }
}

export function getSchedule(id: string): Schedule | null {
  const db = getDb();
  try {
    const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return mapRow(row);
  } finally {
    db.close();
  }
}

export function listSchedules(teamId: string = ''): Schedule[] {
  const db = getDb();
  try {
    const rows = db.prepare('SELECT * FROM schedules WHERE team_id = ? ORDER BY created_at DESC').all(teamId) as Array<Record<string, unknown>>;
    return rows.map(mapRow);
  } finally {
    db.close();
  }
}

export function updateSchedule(id: string, updates: Partial<Pick<Schedule, 'name' | 'cronExpression' | 'timezone' | 'channels' | 'alertConfig' | 'enabled'>>): Schedule | null {
  const db = getDb();
  try {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.cronExpression !== undefined) { sets.push('cron_expression = ?'); values.push(updates.cronExpression); }
    if (updates.timezone !== undefined) { sets.push('timezone = ?'); values.push(updates.timezone); }
    if (updates.channels !== undefined) { sets.push('channels = ?'); values.push(JSON.stringify(updates.channels)); }
    if (updates.alertConfig !== undefined) { sets.push('alert_config = ?'); values.push(JSON.stringify(updates.alertConfig)); }
    if (updates.enabled !== undefined) { sets.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }

    if (sets.length === 0) return getSchedule(id);

    values.push(id);
    db.prepare(`UPDATE schedules SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return getSchedule(id);
  } finally {
    db.close();
  }
}

export function deleteSchedule(id: string): void {
  const db = getDb();
  try {
    db.prepare('DELETE FROM schedule_runs WHERE schedule_id = ?').run(id);
    db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
  } finally {
    db.close();
  }
}

export function toggleSchedule(id: string, enabled: boolean): void {
  const db = getDb();
  try {
    db.prepare('UPDATE schedules SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  } finally {
    db.close();
  }
}

function mapRow(row: Record<string, unknown>): Schedule {
  return {
    id: row.id as string,
    teamId: row.team_id as string,
    name: row.name as string,
    type: row.type as 'report' | 'alert' | 'digest',
    sourceType: row.source_type as 'dashboard' | 'query',
    sourceId: row.source_id as string,
    cronExpression: row.cron_expression as string,
    timezone: row.timezone as string,
    channels: JSON.parse((row.channels as string) || '{}'),
    alertConfig: row.alert_config ? JSON.parse(row.alert_config as string) : undefined,
    enabled: row.enabled === 1,
    lastRunAt: row.last_run_at as string | undefined,
    lastStatus: row.last_status as 'success' | 'failed' | 'partial' | undefined,
    nextRunAt: row.next_run_at as string | undefined,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  };
}
