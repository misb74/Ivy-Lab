import { getDatabase } from './database.js';

export function initializeSchema(): void {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS connectors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      base_url TEXT NOT NULL,
      auth_type TEXT DEFAULT 'none',
      auth_config TEXT DEFAULT '{}',
      field_mapping TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active',
      last_sync_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_data (
      id TEXT PRIMARY KEY,
      connector_id TEXT NOT NULL REFERENCES connectors(id),
      entity_type TEXT NOT NULL,
      data TEXT DEFAULT '{}',
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id TEXT PRIMARY KEY,
      connector_id TEXT NOT NULL REFERENCES connectors(id),
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      records_synced INTEGER DEFAULT 0,
      error TEXT,
      started_at TEXT,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sync_data_connector_id ON sync_data(connector_id);
    CREATE INDEX IF NOT EXISTS idx_sync_log_connector_id ON sync_log(connector_id);
  `);
}
