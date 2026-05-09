import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  CREATE_PROJECTS_TABLE,
  CREATE_THREADS_TABLE,
  CREATE_FINDINGS_TABLE,
  CREATE_SOURCES_TABLE,
  CREATE_THREADS_PROJECT_INDEX,
  CREATE_THREADS_STATUS_INDEX,
  CREATE_FINDINGS_THREAD_INDEX,
  CREATE_FINDINGS_PROJECT_INDEX,
  CREATE_SOURCES_FINDING_INDEX,
} from './schema.js';

const DB_DIR = path.resolve(process.cwd(), 'data', 'deep-research');
const DB_PATH = path.join(DB_DIR, 'deep-research.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(CREATE_PROJECTS_TABLE);
    db.exec(CREATE_THREADS_TABLE);
    db.exec(CREATE_FINDINGS_TABLE);
    db.exec(CREATE_SOURCES_TABLE);
    db.exec(CREATE_THREADS_PROJECT_INDEX);
    db.exec(CREATE_THREADS_STATUS_INDEX);
    db.exec(CREATE_FINDINGS_THREAD_INDEX);
    db.exec(CREATE_FINDINGS_PROJECT_INDEX);
    db.exec(CREATE_SOURCES_FINDING_INDEX);

    // Safe migration — add tenant_id column
    try {
      db.exec("ALTER TABLE projects ADD COLUMN tenant_id TEXT DEFAULT 'default'");
      db.exec("CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id)");
    } catch {} // Column already exists — ignore
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
