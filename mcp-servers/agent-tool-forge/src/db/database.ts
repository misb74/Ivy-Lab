import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CREATE_FORGED_SERVERS_TABLE, CREATE_STATUS_INDEX } from './schema.js';

const DB_DIR = path.resolve(process.cwd(), 'data', 'tool-forge');
const DB_PATH = path.join(DB_DIR, 'tool-forge.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(CREATE_FORGED_SERVERS_TABLE);
    db.exec(CREATE_STATUS_INDEX);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
