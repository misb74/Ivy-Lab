import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  CREATE_INSTITUTIONS, CREATE_PUBLICATIONS, CREATE_PUBLICATIONS_IDX, CREATE_PUBLICATIONS_DATE_IDX,
  CREATE_FINDINGS, CREATE_FINDINGS_PUB_IDX, CREATE_FINDINGS_TYPE_IDX, CREATE_FINDINGS_GEO_IDX, CREATE_FINDINGS_SECTOR_IDX,
  CREATE_FINDINGS_FTS, CREATE_FTS_INSERT_TRIGGER, CREATE_FTS_DELETE_TRIGGER, CREATE_FTS_UPDATE_TRIGGER,
  CREATE_FINDING_SOURCES, CREATE_FINDING_SOURCES_IDX,
} from './schema.js';

const DB_DIR = path.resolve(process.cwd(), 'data', 'research-index');
const DB_PATH = path.join(DB_DIR, 'research-index.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const ddl = [
      CREATE_INSTITUTIONS,
      CREATE_PUBLICATIONS, CREATE_PUBLICATIONS_IDX, CREATE_PUBLICATIONS_DATE_IDX,
      CREATE_FINDINGS, CREATE_FINDINGS_PUB_IDX, CREATE_FINDINGS_TYPE_IDX, CREATE_FINDINGS_GEO_IDX, CREATE_FINDINGS_SECTOR_IDX,
      CREATE_FINDINGS_FTS, CREATE_FTS_INSERT_TRIGGER, CREATE_FTS_DELETE_TRIGGER, CREATE_FTS_UPDATE_TRIGGER,
      CREATE_FINDING_SOURCES, CREATE_FINDING_SOURCES_IDX,
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
