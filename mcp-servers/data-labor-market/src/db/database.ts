import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  CREATE_JOB_POSTINGS, CREATE_JOB_POSTINGS_IDX, CREATE_JOB_POSTINGS_SECTOR_IDX, CREATE_JOB_POSTINGS_METRO_IDX,
  CREATE_WAGE_GROWTH, CREATE_WAGE_GROWTH_IDX,
  CREATE_AI_POSTINGS, CREATE_AI_POSTINGS_IDX,
  CREATE_REMOTE_POSTINGS, CREATE_REMOTE_POSTINGS_IDX, CREATE_REMOTE_SEARCHES,
  CREATE_PAY_TRANSPARENCY, CREATE_PAY_TRANSPARENCY_IDX,
  CREATE_GEOGRAPHIC_RISK, CREATE_EMPLOYMENT_INDICES,
  CREATE_DATA_SOURCES,
} from './schema.js';

const DB_DIR = path.resolve(process.cwd(), 'data', 'labor-market');
const DB_PATH = path.join(DB_DIR, 'labor-market.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const ddl = [
      CREATE_JOB_POSTINGS, CREATE_JOB_POSTINGS_IDX, CREATE_JOB_POSTINGS_SECTOR_IDX, CREATE_JOB_POSTINGS_METRO_IDX,
      CREATE_WAGE_GROWTH, CREATE_WAGE_GROWTH_IDX,
      CREATE_AI_POSTINGS, CREATE_AI_POSTINGS_IDX,
      CREATE_REMOTE_POSTINGS, CREATE_REMOTE_POSTINGS_IDX, CREATE_REMOTE_SEARCHES,
      CREATE_PAY_TRANSPARENCY, CREATE_PAY_TRANSPARENCY_IDX,
      CREATE_GEOGRAPHIC_RISK, CREATE_EMPLOYMENT_INDICES,
      CREATE_DATA_SOURCES,
    ];
    for (const stmt of ddl) {
      db.exec(stmt);
    }
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
