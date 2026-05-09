// ============================================================
// SQLite schema for talent research batches and roles
// ============================================================

export const CREATE_BATCHES_TABLE = `
  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    csv_path TEXT NOT NULL,
    output_dir TEXT NOT NULL,
    total_roles INTEGER NOT NULL DEFAULT 0,
    completed_roles INTEGER NOT NULL DEFAULT 0,
    failed_roles INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    email_to TEXT,
    recipient_name TEXT
  )
`;

export const CREATE_ROLES_TABLE = `
  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    role_index INTEGER NOT NULL,
    title TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT 'US',
    spec_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'queued',
    progress INTEGER NOT NULL DEFAULT 0,
    candidates_found INTEGER NOT NULL DEFAULT 0,
    results_json TEXT,
    output_path TEXT,
    error TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_ROLES_BATCH_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_roles_batch_id ON roles(batch_id)
`;

export const CREATE_ROLES_STATUS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_roles_status ON roles(status)
`;
