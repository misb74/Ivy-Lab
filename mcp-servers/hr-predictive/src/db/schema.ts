import { getDatabase } from './database.js';

export function initializeSchema(): void {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS predictions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      subject TEXT NOT NULL,
      input_data TEXT DEFAULT '{}',
      result TEXT DEFAULT '{}',
      confidence REAL,
      created_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_predictions_type ON predictions(type);
    CREATE INDEX IF NOT EXISTS idx_predictions_subject ON predictions(subject);

    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      variables TEXT DEFAULT '{}',
      results TEXT DEFAULT '{}',
      created_at TEXT
    );
  `);
}
