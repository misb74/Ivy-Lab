import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  CREATE_BATCHES_TABLE,
  CREATE_ROLES_TABLE,
  CREATE_ROLES_BATCH_INDEX,
  CREATE_ROLES_STATUS_INDEX,
} from './schema.js';

const DB_DIR = path.resolve(process.cwd(), 'data', 'talent-researcher');
const DB_PATH = path.join(DB_DIR, 'talent-researcher.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(CREATE_BATCHES_TABLE);
    db.exec(CREATE_ROLES_TABLE);
    db.exec(CREATE_ROLES_BATCH_INDEX);
    db.exec(CREATE_ROLES_STATUS_INDEX);

    // Idempotent migration: add email delivery columns to batches
    try { db.exec('ALTER TABLE batches ADD COLUMN email_to TEXT'); } catch {}
    try { db.exec('ALTER TABLE batches ADD COLUMN recipient_name TEXT'); } catch {}

    // Safe migration — add tenant_id column
    try {
      db.exec("ALTER TABLE batches ADD COLUMN tenant_id TEXT DEFAULT 'default'");
      db.exec("CREATE INDEX IF NOT EXISTS idx_batches_tenant ON batches(tenant_id)");
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
