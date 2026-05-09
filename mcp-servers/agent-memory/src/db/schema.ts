export const CREATE_MEMORIES_TABLE = `
  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    tags TEXT NOT NULL DEFAULT '[]',
    importance REAL NOT NULL DEFAULT 5,
    context TEXT DEFAULT '',
    source TEXT DEFAULT '',
    tokens TEXT NOT NULL DEFAULT '[]',
    embedding BLOB,
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_MEMORIES_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type)
`;

export const CREATE_MEMORIES_DATE_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at)
`;

export const ADD_EMBEDDING_COLUMN = `
  ALTER TABLE memories ADD COLUMN embedding BLOB
`;

export interface MemoryRow {
  id: number;
  content: string;
  type: string;
  tags: string;
  importance: number;
  context: string;
  source: string;
  tokens: string;
  embedding: Buffer | null;
  access_count: number;
  last_accessed: string | null;
  created_at: string;
}
