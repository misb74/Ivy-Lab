import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CREATE_MEMORIES_TABLE, CREATE_MEMORIES_INDEX, CREATE_MEMORIES_DATE_INDEX, ADD_EMBEDDING_COLUMN } from './schema.js';

const DB_DIR = path.resolve(process.cwd(), 'data', 'memory');
const DB_PATH = path.join(DB_DIR, 'auxia-memory.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(CREATE_MEMORIES_TABLE);
    db.exec(CREATE_MEMORIES_INDEX);
    db.exec(CREATE_MEMORIES_DATE_INDEX);

    // Migration: add embedding column if not present
    try {
      db.exec(ADD_EMBEDDING_COLUMN);
    } catch {
      // Column already exists — ignore
    }

    // Safe migration — add tenant_id column
    try {
      db.exec("ALTER TABLE memories ADD COLUMN tenant_id TEXT DEFAULT 'default'");
      db.exec("CREATE INDEX IF NOT EXISTS idx_memories_tenant ON memories(tenant_id)");
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
