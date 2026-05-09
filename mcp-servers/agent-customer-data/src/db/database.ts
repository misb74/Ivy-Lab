import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CREATE_TABLES, CREATE_INDEXES } from './schema.js';

const DB_BASE = path.resolve(process.cwd(), 'data', 'customer-data');
const pool = new Map<string, Database.Database>();

export function getDbForTenant(tenantId: string): Database.Database {
  const safe = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (pool.has(safe)) return pool.get(safe)!;

  const dir = path.join(DB_BASE, safe);
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, 'customer.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(CREATE_TABLES);
  db.exec(CREATE_INDEXES);
  pool.set(safe, db);
  return db;
}

export function closeAll(): void {
  for (const [, db] of pool) db.close();
  pool.clear();
}
