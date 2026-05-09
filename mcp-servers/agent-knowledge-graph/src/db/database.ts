import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  CREATE_ENTITIES_TABLE,
  CREATE_RELATIONS_TABLE,
  CREATE_ENTITIES_TYPE_INDEX,
  CREATE_ENTITIES_NAME_INDEX,
  CREATE_RELATIONS_SOURCE_INDEX,
  CREATE_RELATIONS_TARGET_INDEX,
} from './schema.js';

const DB_DIR = path.resolve(process.cwd(), 'data', 'knowledge-graph');
const DB_PATH = path.join(DB_DIR, 'kg.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(CREATE_ENTITIES_TABLE);
    db.exec(CREATE_RELATIONS_TABLE);
    db.exec(CREATE_ENTITIES_TYPE_INDEX);
    db.exec(CREATE_ENTITIES_NAME_INDEX);
    db.exec(CREATE_RELATIONS_SOURCE_INDEX);
    db.exec(CREATE_RELATIONS_TARGET_INDEX);

    // Safe migration — add tenant_id column
    try {
      db.exec("ALTER TABLE entities ADD COLUMN tenant_id TEXT DEFAULT 'default'");
      db.exec("CREATE INDEX IF NOT EXISTS idx_entities_tenant ON entities(tenant_id)");
    } catch {} // Column already exists — ignore
    try {
      db.exec("ALTER TABLE relations ADD COLUMN tenant_id TEXT DEFAULT 'default'");
      db.exec("CREATE INDEX IF NOT EXISTS idx_relations_tenant ON relations(tenant_id)");
    } catch {} // Column already exists — ignore

    console.error(`Knowledge graph database initialized at ${DB_PATH}`);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    console.error('Knowledge graph database connection closed');
  }
}
