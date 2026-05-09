import { getDb } from '../db/database.js';
import type { MemoryRow } from '../db/schema.js';

export interface ListRecentParams {
  limit?: number;
  type?: string;
}

export async function memoryListRecent(params: ListRecentParams): Promise<{
  results: Array<{
    id: number;
    content: string;
    type: string;
    tags: string[];
    importance: number;
    created_at: string;
  }>;
}> {
  const { limit = 10, type } = params;
  const db = getDb();

  let query = 'SELECT * FROM memories';
  const values: (string | number)[] = [];

  if (type) {
    query += ' WHERE type = ?';
    values.push(type);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  values.push(limit);

  const rows = db.prepare(query).all(...values) as MemoryRow[];

  return {
    results: rows.map(row => ({
      id: row.id,
      content: row.content,
      type: row.type,
      tags: JSON.parse(row.tags),
      importance: row.importance,
      created_at: row.created_at,
    })),
  };
}
