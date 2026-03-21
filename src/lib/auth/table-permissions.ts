/**
 * Table Permissions
 *
 * Fine-grained, per-table access control stored in the working SQLite DB.
 * Allows admins to set visibility, role-based access, and hidden columns
 * for each table in a connected data source.
 */

import Database from 'better-sqlite3';
import path from 'path';
import type { UserRole } from './types';

const DB_PATH = path.resolve(process.cwd(), 'db', 'app.db');

export type TableVisibility = 'visible' | 'hidden' | 'restricted';

export interface TablePermission {
  connectorId: string;
  tableName: string;
  visibility: TableVisibility;
  allowedRoles: UserRole[];
  hiddenColumns: string[];
  updatedAt: string;
}

export interface TableAccessResult {
  allowed: boolean;
  hiddenColumns: string[];
}

function getDb(): Database.Database {
  const db = new Database(DB_PATH);

  // Ensure the table_permissions table exists (idempotent)
  db.exec(`
    CREATE TABLE IF NOT EXISTS table_permissions (
      connector_id TEXT NOT NULL,
      table_name TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'visible',
      allowed_roles TEXT DEFAULT '[]',
      hidden_columns TEXT DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (connector_id, table_name)
    )
  `);

  return db;
}

/**
 * Set the permission configuration for a specific table within a connector.
 */
export function setTablePermission(
  connectorId: string,
  tableName: string,
  visibility: TableVisibility,
  allowedRoles?: UserRole[],
  hiddenColumns?: string[],
): void {
  const db = getDb();
  try {
    const now = new Date().toISOString();
    const rolesJson = JSON.stringify(allowedRoles ?? []);
    const columnsJson = JSON.stringify(hiddenColumns ?? []);

    db.prepare(`
      INSERT INTO table_permissions (connector_id, table_name, visibility, allowed_roles, hidden_columns, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(connector_id, table_name) DO UPDATE SET
        visibility = excluded.visibility,
        allowed_roles = excluded.allowed_roles,
        hidden_columns = excluded.hidden_columns,
        updated_at = excluded.updated_at
    `).run(connectorId, tableName, visibility, rolesJson, columnsJson, now);
  } finally {
    db.close();
  }
}

/**
 * Retrieve all table permissions for a given connector.
 */
export function getTablePermissions(connectorId: string): TablePermission[] {
  const db = getDb();
  try {
    const rows = db
      .prepare('SELECT * FROM table_permissions WHERE connector_id = ?')
      .all(connectorId) as Array<{
        connector_id: string;
        table_name: string;
        visibility: string;
        allowed_roles: string;
        hidden_columns: string;
        updated_at: string;
      }>;

    return rows.map((row) => ({
      connectorId: row.connector_id,
      tableName: row.table_name,
      visibility: row.visibility as TableVisibility,
      allowedRoles: JSON.parse(row.allowed_roles) as UserRole[],
      hiddenColumns: JSON.parse(row.hidden_columns) as string[],
      updatedAt: row.updated_at,
    }));
  } finally {
    db.close();
  }
}

/**
 * Check whether a user with a given role can access a specific table,
 * and which columns should be hidden from them.
 */
export function checkTableAccess(
  connectorId: string,
  tableName: string,
  userRole: UserRole,
): TableAccessResult {
  const db = getDb();
  try {
    const row = db
      .prepare(
        'SELECT visibility, allowed_roles, hidden_columns FROM table_permissions WHERE connector_id = ? AND table_name = ?',
      )
      .get(connectorId, tableName) as
      | { visibility: string; allowed_roles: string; hidden_columns: string }
      | undefined;

    // No explicit permission record means the table is visible to everyone
    if (!row) {
      return { allowed: true, hiddenColumns: [] };
    }

    const visibility = row.visibility as TableVisibility;
    const allowedRoles = JSON.parse(row.allowed_roles) as UserRole[];
    const hiddenColumns = JSON.parse(row.hidden_columns) as string[];

    if (visibility === 'hidden') {
      return { allowed: false, hiddenColumns };
    }

    if (visibility === 'restricted') {
      // Owner and admin always have access to restricted tables
      if (userRole === 'owner' || userRole === 'admin') {
        return { allowed: true, hiddenColumns };
      }

      // Check if the user's role is in the allowed list
      const allowed = allowedRoles.length === 0 || allowedRoles.includes(userRole);
      return { allowed, hiddenColumns };
    }

    // visibility === 'visible'
    return { allowed: true, hiddenColumns };
  } finally {
    db.close();
  }
}
