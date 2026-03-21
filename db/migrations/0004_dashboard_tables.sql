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
