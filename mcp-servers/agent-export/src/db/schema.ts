import { getDatabase } from './database.js';

export function initializeSchema(): void {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS exports (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT,
      source_data TEXT DEFAULT '{}',
      output_path TEXT,
      format TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      file_size INTEGER,
      created_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS embed_tokens (
      id TEXT PRIMARY KEY,
      export_id TEXT REFERENCES exports(id),
      token TEXT NOT NULL UNIQUE,
      html_content TEXT,
      expires_at TEXT,
      created_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_exports_status ON exports(status);
    CREATE INDEX IF NOT EXISTS idx_embed_tokens_token ON embed_tokens(token);
  `);
}
