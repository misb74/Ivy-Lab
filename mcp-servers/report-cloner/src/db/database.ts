import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { CREATE_CLONE_JOBS_TABLE } from './schema.js';

const DB_DIR = path.resolve(process.cwd(), 'data', 'report-cloner');
const DB_PATH = path.join(DB_DIR, 'report-cloner.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(CREATE_CLONE_JOBS_TABLE);

    // Safe migration — add tenant_id column
    try {
      db.exec("ALTER TABLE clone_jobs ADD COLUMN tenant_id TEXT DEFAULT 'default'");
      db.exec("CREATE INDEX IF NOT EXISTS idx_clone_jobs_tenant ON clone_jobs(tenant_id)");
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
