/**
 * Share Manager
 *
 * Manages public/private share links for dashboards and queries.
 */

import Database from 'better-sqlite3';
import path from 'path';
import type { Share, ShareCreateInput, ShareAccessType } from './types';

const WORKING_DB_PATH = path.join(process.cwd(), 'data', 'working.db');

function getDb(): Database.Database {
  const db = new Database(WORKING_DB_PATH);
  db.pragma('journal_mode = WAL');
  ensureTables(db);
  return db;
}

function ensureTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL DEFAULT '',
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      access_type TEXT NOT NULL DEFAULT 'public',
      password_hash TEXT,
      allowed_emails TEXT,
      expires_at TEXT,
      max_views INTEGER,
      view_count INTEGER DEFAULT 0,
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_shares_slug ON shares(slug);
  `);
}

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join('');
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createShare(
  input: ShareCreateInput,
  teamId: string = '',
  createdBy: string = ''
): Promise<{ share: Share; url: string; embedUrl: string; embedCode: string }> {
  const db = getDb();
  try {
    const id = crypto.randomUUID();
    const slug = generateSlug();
    const passwordHash = input.password ? await hashPassword(input.password) : null;

    db.prepare(`
      INSERT INTO shares (id, team_id, resource_type, resource_id, slug, access_type, password_hash, allowed_emails, expires_at, max_views, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, teamId, input.resourceType, input.resourceId, slug,
      input.access, passwordHash,
      input.allowedEmails ? JSON.stringify(input.allowedEmails) : null,
      input.expiresAt || null, input.maxViews || null, createdBy
    );

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const prefix = input.resourceType === 'dashboard' ? 'd' : 'q';
    const url = `${baseUrl}/public/${prefix}/${slug}`;
    const embedUrl = `${baseUrl}/embed/${prefix}/${slug}`;
    const embedCode = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0"></iframe>`;

    const share: Share = {
      id, teamId, resourceType: input.resourceType, resourceId: input.resourceId,
      slug, accessType: input.access as ShareAccessType,
      passwordHash: passwordHash || undefined,
      allowedEmails: input.allowedEmails,
      expiresAt: input.expiresAt,
      maxViews: input.maxViews,
      viewCount: 0, createdBy, createdAt: new Date().toISOString(),
    };

    return { share, url, embedUrl, embedCode };
  } finally {
    db.close();
  }
}

export function getShareBySlug(slug: string): Share | null {
  const db = getDb();
  try {
    const row = db.prepare('SELECT * FROM shares WHERE slug = ?').get(slug) as Record<string, unknown> | undefined;
    if (!row) return null;

    // Check expiration
    if (row.expires_at && new Date(row.expires_at as string) < new Date()) return null;
    // Check max views
    if (row.max_views && (row.view_count as number) >= (row.max_views as number)) return null;

    return {
      id: row.id as string,
      teamId: row.team_id as string,
      resourceType: row.resource_type as 'dashboard' | 'query',
      resourceId: row.resource_id as string,
      slug: row.slug as string,
      accessType: row.access_type as ShareAccessType,
      allowedEmails: row.allowed_emails ? JSON.parse(row.allowed_emails as string) : undefined,
      expiresAt: row.expires_at as string | undefined,
      maxViews: row.max_views as number | undefined,
      viewCount: row.view_count as number,
      createdBy: row.created_by as string,
      createdAt: row.created_at as string,
    };
  } finally {
    db.close();
  }
}

export function incrementViewCount(slug: string): void {
  const db = getDb();
  try {
    db.prepare('UPDATE shares SET view_count = view_count + 1 WHERE slug = ?').run(slug);
  } finally {
    db.close();
  }
}

export function revokeShare(id: string): void {
  const db = getDb();
  try {
    db.prepare('DELETE FROM shares WHERE id = ?').run(id);
  } finally {
    db.close();
  }
}

export function listShares(teamId: string): Share[] {
  const db = getDb();
  try {
    const rows = db.prepare('SELECT * FROM shares WHERE team_id = ? ORDER BY created_at DESC').all(teamId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: row.id as string,
      teamId: row.team_id as string,
      resourceType: row.resource_type as 'dashboard' | 'query',
      resourceId: row.resource_id as string,
      slug: row.slug as string,
      accessType: row.access_type as ShareAccessType,
      viewCount: row.view_count as number,
      createdBy: row.created_by as string,
      createdAt: row.created_at as string,
    }));
  } finally {
    db.close();
  }
}
