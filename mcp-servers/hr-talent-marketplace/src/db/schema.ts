import { getDatabase } from "./database.js";

export function initializeSchema(): void {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS talent_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      current_role TEXT,
      department TEXT,
      skills TEXT DEFAULT '[]',
      aspirations TEXT DEFAULT '[]',
      performance_rating REAL,
      tenure_years REAL,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS open_roles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      department TEXT,
      required_skills TEXT DEFAULT '[]',
      preferred_skills TEXT DEFAULT '[]',
      level TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS development_plans (
      id TEXT PRIMARY KEY,
      profile_id TEXT REFERENCES talent_profiles(id),
      target_role TEXT,
      phases TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      created_at TEXT,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_talent_profiles_department
      ON talent_profiles(department);

    CREATE INDEX IF NOT EXISTS idx_open_roles_status
      ON open_roles(status);
  `);
}
