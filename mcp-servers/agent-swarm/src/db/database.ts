import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  CREATE_SWARMS_TABLE,
  CREATE_SWARM_TASKS_TABLE,
  CREATE_SWARM_TASKS_SWARM_ID_INDEX,
  CREATE_SWARM_TASKS_STATUS_INDEX,
} from './schema.js';

const DB_DIR = path.resolve(process.cwd(), 'data', 'swarm');
const DB_PATH = path.join(DB_DIR, 'swarm.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(CREATE_SWARMS_TABLE);
    db.exec(CREATE_SWARM_TASKS_TABLE);
    db.exec(CREATE_SWARM_TASKS_SWARM_ID_INDEX);
    db.exec(CREATE_SWARM_TASKS_STATUS_INDEX);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
