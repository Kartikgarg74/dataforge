CREATE TABLE IF NOT EXISTS query_favorites (
    user_id TEXT NOT NULL,
    query_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, query_id)
);
