import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.resolve(__dirname, "../../data/talent-marketplace");
const DB_PATH = path.join(DB_DIR, "marketplace.db");

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  fs.mkdirSync(DB_DIR, { recursive: true });

  db = new Database(DB_PATH);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
