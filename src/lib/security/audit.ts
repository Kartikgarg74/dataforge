import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AUDIT_ACTIONS = {
  QUERY_EXECUTE: 'query.execute',
  SCHEMA_VIEW: 'schema.view',
  FILE_UPLOAD: 'file.upload',
  FILE_EXPORT: 'file.export',
  CONNECTION_ADD: 'connection.add',
  CONNECTION_REMOVE: 'connection.remove',
  CONNECTION_TEST: 'connection.test',
  CHAT_MESSAGE: 'chat.message',
  TRANSFORM_EXECUTE: 'transform.execute',
  PROFILE_RUN: 'profile.run',
  CSRF_FAILURE: 'security.csrf_failure',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEntry {
  action: string;
  resourceType?: string;
  resourceId?: string;
  userId?: string;
  teamId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

interface AuditRow {
  id: string;
  timestamp: string;
  user_id: string | null;
  team_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string | null;
  created_at: string;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  since?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Database access
// ---------------------------------------------------------------------------

const AUDIT_DB_PATH = path.join(process.cwd(), 'src/db', 'data.db');
const MIGRATION_PATH = path.join(process.cwd(), 'db/migrations', '0002_audit_log.sql');

let auditDb: Database.Database | null = null;

/**
 * Returns a writable database handle used exclusively for audit logging.
 * The audit_log table is created lazily on first access so the module works
 * without requiring a separate migration step during development.
 */
function getAuditDb(): Database.Database {
  if (auditDb) {
    return auditDb;
  }

  auditDb = new Database(AUDIT_DB_PATH);
  auditDb.pragma('journal_mode = WAL');

  // Apply the migration to ensure the table exists.
  if (fs.existsSync(MIGRATION_PATH)) {
    const migration = fs.readFileSync(MIGRATION_PATH, 'utf8');
    auditDb.exec(migration);
  } else {
    // Fallback: create the table inline so the module is self-contained.
    auditDb.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          user_id TEXT,
          team_id TEXT,
          action TEXT NOT NULL,
          resource_type TEXT,
          resource_id TEXT,
          ip_address TEXT,
          user_agent TEXT,
          metadata TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
    `);
  }

  return auditDb;
}

// Exposed for testing so unit tests can inject an in-memory database.
export function _setAuditDb(db: Database.Database | null): void {
  auditDb = db;
  insertStmt = null;
}

// ---------------------------------------------------------------------------
// Prepared statement cache
// ---------------------------------------------------------------------------

let insertStmt: Database.Statement | null = null;

function getInsertStmt(): Database.Statement {
  if (!insertStmt) {
    const db = getAuditDb();
    insertStmt = db.prepare(`
      INSERT INTO audit_log (id, timestamp, user_id, team_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
      VALUES (@id, @timestamp, @userId, @teamId, @action, @resourceType, @resourceId, @ipAddress, @userAgent, @metadata)
    `);
  }
  return insertStmt;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persist an audit entry. This is fire-and-forget: it will never throw.
 * Errors are logged to the console so they surface in observability tooling
 * without disrupting the caller.
 */
export function logAudit(entry: AuditEntry): void {
  try {
    const stmt = getInsertStmt();

    stmt.run({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      userId: entry.userId ?? null,
      teamId: entry.teamId ?? null,
      action: entry.action,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Failed to write audit log',
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
        action: entry.action,
      }),
    );
  }
}

/**
 * Extract the client IP address from a standard `Request` object.
 * Checks `X-Forwarded-For` (first entry), then `X-Real-IP`, falling back to
 * `'unknown'` when neither header is present.
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}

/**
 * Query the audit log with optional filters.
 * Returns entries in reverse-chronological order.
 */
export function queryAuditLog(filters: AuditLogFilters = {}): AuditEntry[] {
  try {
    const db = getAuditDb();
    const conditions: string[] = [];
    const params: Record<string, string | number> = {};

    if (filters.userId) {
      conditions.push('user_id = @userId');
      params.userId = filters.userId;
    }

    if (filters.action) {
      conditions.push('action = @action');
      params.action = filters.action;
    }

    if (filters.since) {
      conditions.push('timestamp >= @since');
      params.since = filters.since;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 10_000) : 100;
    params.limit = limit;

    const rows = db
      .prepare(`SELECT * FROM audit_log ${where} ORDER BY timestamp DESC LIMIT @limit`)
      .all(params) as AuditRow[];

    return rows.map(rowToEntry);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Failed to query audit log',
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToEntry(row: AuditRow): AuditEntry {
  return {
    action: row.action,
    resourceType: row.resource_type ?? undefined,
    resourceId: row.resource_id ?? undefined,
    userId: row.user_id ?? undefined,
    teamId: row.team_id ?? undefined,
    ipAddress: row.ip_address ?? undefined,
    userAgent: row.user_agent ?? undefined,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
  };
}
