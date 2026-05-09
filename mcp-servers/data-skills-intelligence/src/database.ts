import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.resolve(process.cwd(), 'data', 'skills-intelligence');
const DB_PATH = path.join(DB_DIR, 'skills-intelligence.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id        INTEGER PRIMARY KEY,
        name      TEXT NOT NULL,
        repo      TEXT NOT NULL,
        url       TEXT NOT NULL,
        category  TEXT NOT NULL,
        content   TEXT NOT NULL,
        chars     INTEGER NOT NULL
      )
    `);

    // FTS5 virtual table for full-text search over name + content
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
        name,
        category,
        content,
        content=skills,
        content_rowid=id,
        tokenize='porter unicode61'
      )
    `);

    // Triggers to keep FTS in sync with the skills table
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS skills_ai AFTER INSERT ON skills BEGIN
        INSERT INTO skills_fts(rowid, name, category, content)
        VALUES (new.id, new.name, new.category, new.content);
      END
    `);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS skills_ad AFTER DELETE ON skills BEGIN
        INSERT INTO skills_fts(skills_fts, rowid, name, category, content)
        VALUES ('delete', old.id, old.name, old.category, old.content);
      END
    `);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS skills_au AFTER UPDATE ON skills BEGIN
        INSERT INTO skills_fts(skills_fts, rowid, name, category, content)
        VALUES ('delete', old.id, old.name, old.category, old.content);
        INSERT INTO skills_fts(rowid, name, category, content)
        VALUES (new.id, new.name, new.category, new.content);
      END
    `);
  }
  return db;
}

export interface SkillRow {
  id: number;
  name: string;
  repo: string;
  url: string;
  category: string;
  content: string;
  chars: number;
}

export function isSeeded(): boolean {
  const row = getDb().prepare('SELECT COUNT(*) as count FROM skills').get() as { count: number };
  return row.count > 0;
}

export function seed(skills: SkillRow[]): void {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO skills (id, name, repo, url, category, content, chars)
    VALUES (@id, @name, @repo, @url, @category, @content, @chars)
  `);
  const tx = db.transaction((rows: SkillRow[]) => {
    for (const row of rows) insert.run(row);
  });
  tx(skills);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
