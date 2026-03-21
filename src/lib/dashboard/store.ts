/**
 * Dashboard Store
 *
 * CRUD operations for dashboards and widgets using SQLite.
 * Uses the working database at data/working.db.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type {
  Dashboard,
  DashboardWidget,
  GlobalFilter,
  VisualizationConfig,
  WidgetPosition,
  WidgetType,
} from './types';

/** Path to the working database */
const WORKING_DB_DIR = path.join(process.cwd(), 'data');
const WORKING_DB_PATH = path.join(WORKING_DB_DIR, 'working.db');

/** Whether tables have been initialized in this process */
let tablesInitialized = false;

/**
 * Get the working SQLite database and ensure dashboard tables exist.
 */
function getDb(): Database.Database {
  if (!fs.existsSync(WORKING_DB_DIR)) {
    fs.mkdirSync(WORKING_DB_DIR, { recursive: true });
  }

  const db = new Database(WORKING_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  if (!tablesInitialized) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS dashboards (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        filters TEXT DEFAULT '[]',
        refresh_interval INTEGER DEFAULT 0,
        is_public INTEGER DEFAULT 0,
        public_slug TEXT UNIQUE,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS dashboard_widgets (
        id TEXT PRIMARY KEY,
        dashboard_id TEXT NOT NULL,
        title TEXT NOT NULL,
        widget_type TEXT NOT NULL,
        query_natural TEXT NOT NULL,
        query_sql TEXT NOT NULL,
        connector_id TEXT NOT NULL DEFAULT 'default',
        visualization TEXT NOT NULL DEFAULT '{}',
        position TEXT NOT NULL DEFAULT '{"x":0,"y":0,"w":6,"h":4}',
        refresh_override INTEGER,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS saved_queries (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        natural_language TEXT NOT NULL,
        sql TEXT NOT NULL,
        connector_id TEXT NOT NULL DEFAULT 'default',
        parameters TEXT DEFAULT '[]',
        visualization TEXT,
        usage_count INTEGER DEFAULT 0,
        last_run_at TEXT,
        tags TEXT DEFAULT '[]',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_dashboards_team ON dashboards(team_id);
      CREATE INDEX IF NOT EXISTS idx_widgets_dashboard ON dashboard_widgets(dashboard_id);
      CREATE INDEX IF NOT EXISTS idx_saved_queries_team ON saved_queries(team_id);
    `);
    tablesInitialized = true;
  }

  return db;
}

/** Row shape returned from the dashboards table */
interface DashboardRow {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  filters: string;
  refresh_interval: number;
  is_public: number;
  public_slug: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Row shape returned from the dashboard_widgets table */
interface WidgetRow {
  id: string;
  dashboard_id: string;
  title: string;
  widget_type: string;
  query_natural: string;
  query_sql: string;
  connector_id: string;
  visualization: string;
  position: string;
  refresh_override: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Map a raw dashboard row + widgets into the Dashboard interface.
 */
function toDashboard(row: DashboardRow, widgets: DashboardWidget[]): Dashboard {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    description: row.description ?? undefined,
    widgets,
    filters: JSON.parse(row.filters) as GlobalFilter[],
    refreshInterval: row.refresh_interval,
    isPublic: row.is_public === 1,
    publicSlug: row.public_slug ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map a raw widget row into the DashboardWidget interface.
 */
function toWidget(row: WidgetRow): DashboardWidget {
  return {
    id: row.id,
    dashboardId: row.dashboard_id,
    title: row.title,
    widgetType: row.widget_type as WidgetType,
    queryNatural: row.query_natural,
    querySQL: row.query_sql,
    connectorId: row.connector_id,
    visualization: JSON.parse(row.visualization) as VisualizationConfig,
    position: JSON.parse(row.position) as WidgetPosition,
    refreshOverride: row.refresh_override ?? undefined,
    sortOrder: row.sort_order,
  };
}

/**
 * Fetch widgets for a given dashboard.
 */
function fetchWidgets(db: Database.Database, dashboardId: string): DashboardWidget[] {
  const rows = db
    .prepare('SELECT * FROM dashboard_widgets WHERE dashboard_id = ? ORDER BY sort_order ASC')
    .all(dashboardId) as WidgetRow[];
  return rows.map(toWidget);
}

/**
 * Create a new dashboard.
 */
export function createDashboard(
  teamId: string,
  name: string,
  description: string | undefined,
  createdBy: string
): Dashboard {
  const db = getDb();
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO dashboards (id, team_id, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, teamId, name, description ?? null, createdBy, now, now);

    const row = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(id) as DashboardRow;
    return toDashboard(row, []);
  } finally {
    db.close();
  }
}

/**
 * Get a dashboard by ID, including its widgets.
 */
export function getDashboard(id: string): Dashboard | null {
  const db = getDb();
  try {
    const row = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(id) as DashboardRow | undefined;
    if (!row) return null;

    const widgets = fetchWidgets(db, id);
    return toDashboard(row, widgets);
  } finally {
    db.close();
  }
}

/**
 * List all dashboards for a team.
 */
export function listDashboards(teamId: string): Dashboard[] {
  const db = getDb();
  try {
    const rows = db
      .prepare('SELECT * FROM dashboards WHERE team_id = ? ORDER BY updated_at DESC')
      .all(teamId) as DashboardRow[];

    return rows.map((row) => {
      const widgets = fetchWidgets(db, row.id);
      return toDashboard(row, widgets);
    });
  } finally {
    db.close();
  }
}

/**
 * Update a dashboard's metadata.
 */
export function updateDashboard(
  id: string,
  updates: Partial<Pick<Dashboard, 'name' | 'description' | 'filters' | 'refreshInterval' | 'isPublic' | 'publicSlug'>>
): Dashboard {
  const db = getDb();
  try {
    const existing = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(id) as DashboardRow | undefined;
    if (!existing) throw new Error(`Dashboard not found: ${id}`);

    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = ?'];
    const values: unknown[] = [now];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.filters !== undefined) {
      fields.push('filters = ?');
      values.push(JSON.stringify(updates.filters));
    }
    if (updates.refreshInterval !== undefined) {
      fields.push('refresh_interval = ?');
      values.push(updates.refreshInterval);
    }
    if (updates.isPublic !== undefined) {
      fields.push('is_public = ?');
      values.push(updates.isPublic ? 1 : 0);
    }
    if (updates.publicSlug !== undefined) {
      fields.push('public_slug = ?');
      values.push(updates.publicSlug);
    }

    values.push(id);
    db.prepare(`UPDATE dashboards SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const row = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(id) as DashboardRow;
    const widgets = fetchWidgets(db, id);
    return toDashboard(row, widgets);
  } finally {
    db.close();
  }
}

/**
 * Delete a dashboard and all its widgets.
 */
export function deleteDashboard(id: string): void {
  const db = getDb();
  try {
    db.prepare('DELETE FROM dashboard_widgets WHERE dashboard_id = ?').run(id);
    db.prepare('DELETE FROM dashboards WHERE id = ?').run(id);
  } finally {
    db.close();
  }
}

/**
 * Add a widget to a dashboard.
 */
export function addWidget(
  dashboardId: string,
  widget: Omit<DashboardWidget, 'id' | 'dashboardId'>
): DashboardWidget {
  const db = getDb();
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO dashboard_widgets
        (id, dashboard_id, title, widget_type, query_natural, query_sql, connector_id, visualization, position, refresh_override, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      dashboardId,
      widget.title,
      widget.widgetType,
      widget.queryNatural,
      widget.querySQL,
      widget.connectorId,
      JSON.stringify(widget.visualization),
      JSON.stringify(widget.position),
      widget.refreshOverride ?? null,
      widget.sortOrder,
      now,
      now
    );

    // Touch dashboard updated_at
    db.prepare('UPDATE dashboards SET updated_at = ? WHERE id = ?').run(now, dashboardId);

    const row = db.prepare('SELECT * FROM dashboard_widgets WHERE id = ?').get(id) as WidgetRow;
    return toWidget(row);
  } finally {
    db.close();
  }
}

/**
 * Update an existing widget.
 */
export function updateWidget(
  widgetId: string,
  updates: Partial<Omit<DashboardWidget, 'id' | 'dashboardId'>>
): DashboardWidget {
  const db = getDb();
  try {
    const existing = db.prepare('SELECT * FROM dashboard_widgets WHERE id = ?').get(widgetId) as WidgetRow | undefined;
    if (!existing) throw new Error(`Widget not found: ${widgetId}`);

    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = ?'];
    const values: unknown[] = [now];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.widgetType !== undefined) {
      fields.push('widget_type = ?');
      values.push(updates.widgetType);
    }
    if (updates.queryNatural !== undefined) {
      fields.push('query_natural = ?');
      values.push(updates.queryNatural);
    }
    if (updates.querySQL !== undefined) {
      fields.push('query_sql = ?');
      values.push(updates.querySQL);
    }
    if (updates.connectorId !== undefined) {
      fields.push('connector_id = ?');
      values.push(updates.connectorId);
    }
    if (updates.visualization !== undefined) {
      fields.push('visualization = ?');
      values.push(JSON.stringify(updates.visualization));
    }
    if (updates.position !== undefined) {
      fields.push('position = ?');
      values.push(JSON.stringify(updates.position));
    }
    if (updates.refreshOverride !== undefined) {
      fields.push('refresh_override = ?');
      values.push(updates.refreshOverride);
    }
    if (updates.sortOrder !== undefined) {
      fields.push('sort_order = ?');
      values.push(updates.sortOrder);
    }

    values.push(widgetId);
    db.prepare(`UPDATE dashboard_widgets SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    // Touch dashboard updated_at
    db.prepare('UPDATE dashboards SET updated_at = ? WHERE id = ?').run(now, existing.dashboard_id);

    const row = db.prepare('SELECT * FROM dashboard_widgets WHERE id = ?').get(widgetId) as WidgetRow;
    return toWidget(row);
  } finally {
    db.close();
  }
}

/**
 * Remove a widget from its dashboard.
 */
export function removeWidget(widgetId: string): void {
  const db = getDb();
  try {
    const existing = db.prepare('SELECT dashboard_id FROM dashboard_widgets WHERE id = ?').get(widgetId) as { dashboard_id: string } | undefined;

    db.prepare('DELETE FROM dashboard_widgets WHERE id = ?').run(widgetId);

    if (existing) {
      const now = new Date().toISOString();
      db.prepare('UPDATE dashboards SET updated_at = ? WHERE id = ?').run(now, existing.dashboard_id);
    }
  } finally {
    db.close();
  }
}

/**
 * Batch-update widget positions for a dashboard (drag-and-drop layout).
 */
export function updateLayout(
  dashboardId: string,
  widgets: Array<{ id: string; position: WidgetPosition }>
): void {
  const db = getDb();
  try {
    const now = new Date().toISOString();
    const updateStmt = db.prepare(
      'UPDATE dashboard_widgets SET position = ?, updated_at = ? WHERE id = ? AND dashboard_id = ?'
    );

    const batchUpdate = db.transaction((items: Array<{ id: string; position: WidgetPosition }>) => {
      for (const item of items) {
        updateStmt.run(JSON.stringify(item.position), now, item.id, dashboardId);
      }
    });

    batchUpdate(widgets);

    db.prepare('UPDATE dashboards SET updated_at = ? WHERE id = ?').run(now, dashboardId);
  } finally {
    db.close();
  }
}
