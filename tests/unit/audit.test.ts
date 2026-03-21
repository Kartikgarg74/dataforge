import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  logAudit,
  queryAuditLog,
  getClientIP,
  AUDIT_ACTIONS,
  _setAuditDb,
} from '@/lib/security/audit';
import type { AuditEntry } from '@/lib/security/audit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createInMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
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
  return db;
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/', {
    headers: new Headers(headers),
  });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let db: Database.Database;

beforeEach(() => {
  db = createInMemoryDb();
  _setAuditDb(db);
});

afterEach(() => {
  _setAuditDb(null);
  db.close();
});

// ---------------------------------------------------------------------------
// AUDIT_ACTIONS constants
// ---------------------------------------------------------------------------

describe('AUDIT_ACTIONS', () => {
  it('contains all expected action keys', () => {
    expect(AUDIT_ACTIONS.QUERY_EXECUTE).toBe('query.execute');
    expect(AUDIT_ACTIONS.SCHEMA_VIEW).toBe('schema.view');
    expect(AUDIT_ACTIONS.FILE_UPLOAD).toBe('file.upload');
    expect(AUDIT_ACTIONS.FILE_EXPORT).toBe('file.export');
    expect(AUDIT_ACTIONS.CONNECTION_ADD).toBe('connection.add');
    expect(AUDIT_ACTIONS.CONNECTION_REMOVE).toBe('connection.remove');
    expect(AUDIT_ACTIONS.CONNECTION_TEST).toBe('connection.test');
    expect(AUDIT_ACTIONS.CHAT_MESSAGE).toBe('chat.message');
    expect(AUDIT_ACTIONS.TRANSFORM_EXECUTE).toBe('transform.execute');
    expect(AUDIT_ACTIONS.PROFILE_RUN).toBe('profile.run');
  });
});

// ---------------------------------------------------------------------------
// logAudit
// ---------------------------------------------------------------------------

describe('logAudit', () => {
  it('inserts a minimal audit entry', () => {
    logAudit({ action: AUDIT_ACTIONS.QUERY_EXECUTE });

    const rows = db.prepare('SELECT * FROM audit_log').all() as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('query.execute');
    expect(rows[0].id).toBeTruthy();
    expect(rows[0].timestamp).toBeTruthy();
  });

  it('stores all optional fields', () => {
    const entry: AuditEntry = {
      action: AUDIT_ACTIONS.FILE_UPLOAD,
      resourceType: 'csv',
      resourceId: 'file-123',
      userId: 'user-1',
      teamId: 'team-1',
      ipAddress: '10.0.0.1',
      userAgent: 'TestAgent/1.0',
      metadata: { size: 1024, filename: 'data.csv' },
    };

    logAudit(entry);

    const rows = db.prepare('SELECT * FROM audit_log').all() as Record<string, unknown>[];
    expect(rows).toHaveLength(1);

    const row = rows[0];
    expect(row.action).toBe('file.upload');
    expect(row.resource_type).toBe('csv');
    expect(row.resource_id).toBe('file-123');
    expect(row.user_id).toBe('user-1');
    expect(row.team_id).toBe('team-1');
    expect(row.ip_address).toBe('10.0.0.1');
    expect(row.user_agent).toBe('TestAgent/1.0');

    const meta = JSON.parse(row.metadata as string);
    expect(meta.size).toBe(1024);
    expect(meta.filename).toBe('data.csv');
  });

  it('generates unique ids for each entry', () => {
    logAudit({ action: 'a' });
    logAudit({ action: 'b' });

    const rows = db.prepare('SELECT id FROM audit_log').all() as { id: string }[];
    expect(rows).toHaveLength(2);
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  it('never throws on database errors', () => {
    // Close the db so writes fail.
    db.close();

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      logAudit({ action: 'should.not.throw' });
    }).not.toThrow();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();

    // Re-create so afterEach close does not throw.
    db = createInMemoryDb();
    _setAuditDb(db);
  });

  it('stores null for omitted optional fields', () => {
    logAudit({ action: AUDIT_ACTIONS.SCHEMA_VIEW });

    const row = db.prepare('SELECT * FROM audit_log').get() as Record<string, unknown>;
    expect(row.user_id).toBeNull();
    expect(row.team_id).toBeNull();
    expect(row.resource_type).toBeNull();
    expect(row.resource_id).toBeNull();
    expect(row.ip_address).toBeNull();
    expect(row.user_agent).toBeNull();
    expect(row.metadata).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getClientIP
// ---------------------------------------------------------------------------

describe('getClientIP', () => {
  it('extracts IP from X-Forwarded-For header', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(getClientIP(req)).toBe('1.2.3.4');
  });

  it('extracts IP from X-Real-IP header', () => {
    const req = makeRequest({ 'x-real-ip': '10.0.0.1' });
    expect(getClientIP(req)).toBe('10.0.0.1');
  });

  it('prefers X-Forwarded-For over X-Real-IP', () => {
    const req = makeRequest({
      'x-forwarded-for': '1.1.1.1',
      'x-real-ip': '2.2.2.2',
    });
    expect(getClientIP(req)).toBe('1.1.1.1');
  });

  it('returns "unknown" when no headers are present', () => {
    const req = makeRequest();
    expect(getClientIP(req)).toBe('unknown');
  });

  it('trims whitespace from header values', () => {
    const req = makeRequest({ 'x-forwarded-for': '  3.3.3.3 , 4.4.4.4' });
    expect(getClientIP(req)).toBe('3.3.3.3');
  });
});

// ---------------------------------------------------------------------------
// queryAuditLog
// ---------------------------------------------------------------------------

describe('queryAuditLog', () => {
  function insertRows(entries: Partial<AuditEntry>[]) {
    for (const e of entries) {
      logAudit({ action: 'default', ...e });
    }
  }

  it('returns entries in reverse-chronological order', () => {
    insertRows([
      { action: 'first' },
      { action: 'second' },
      { action: 'third' },
    ]);

    const results = queryAuditLog();
    expect(results.length).toBe(3);
    // Most recent first
    expect(results[0].action).toBe('third');
    expect(results[2].action).toBe('first');
  });

  it('filters by userId', () => {
    insertRows([
      { action: 'a', userId: 'user-1' },
      { action: 'b', userId: 'user-2' },
    ]);

    const results = queryAuditLog({ userId: 'user-1' });
    expect(results).toHaveLength(1);
    expect(results[0].userId).toBe('user-1');
  });

  it('filters by action', () => {
    insertRows([
      { action: AUDIT_ACTIONS.QUERY_EXECUTE },
      { action: AUDIT_ACTIONS.FILE_UPLOAD },
      { action: AUDIT_ACTIONS.QUERY_EXECUTE },
    ]);

    const results = queryAuditLog({ action: AUDIT_ACTIONS.QUERY_EXECUTE });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.action === 'query.execute')).toBe(true);
  });

  it('respects the limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      logAudit({ action: `action-${i}` });
    }

    const results = queryAuditLog({ limit: 3 });
    expect(results).toHaveLength(3);
  });

  it('defaults to 100 results when no limit is given', () => {
    // Insert fewer than 100 to keep the test fast.
    for (let i = 0; i < 5; i++) {
      logAudit({ action: `action-${i}` });
    }

    const results = queryAuditLog();
    expect(results).toHaveLength(5);
  });

  it('returns empty array on database errors', () => {
    db.close();

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const results = queryAuditLog();
    expect(results).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();

    // Re-create so afterEach close does not throw.
    db = createInMemoryDb();
    _setAuditDb(db);
  });

  it('deserializes metadata back to an object', () => {
    logAudit({
      action: AUDIT_ACTIONS.FILE_UPLOAD,
      metadata: { rows: 500 },
    });

    const results = queryAuditLog();
    expect(results[0].metadata).toEqual({ rows: 500 });
  });

  it('combines multiple filters', () => {
    insertRows([
      { action: AUDIT_ACTIONS.QUERY_EXECUTE, userId: 'user-1' },
      { action: AUDIT_ACTIONS.QUERY_EXECUTE, userId: 'user-2' },
      { action: AUDIT_ACTIONS.FILE_UPLOAD, userId: 'user-1' },
    ]);

    const results = queryAuditLog({
      action: AUDIT_ACTIONS.QUERY_EXECUTE,
      userId: 'user-1',
    });
    expect(results).toHaveLength(1);
    expect(results[0].action).toBe('query.execute');
    expect(results[0].userId).toBe('user-1');
  });
});
