import { getDatabase } from './database.js';

export function initializeSchema(): void {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS monitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      target TEXT NOT NULL,
      config TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active',
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      monitor_id TEXT NOT NULL REFERENCES monitors(id),
      data TEXT DEFAULT '{}',
      delta TEXT DEFAULT '{}',
      alerts TEXT DEFAULT '[]',
      captured_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_monitor_id ON snapshots(monitor_id);
    CREATE INDEX IF NOT EXISTS idx_monitors_status ON monitors(status);
  `);
}
