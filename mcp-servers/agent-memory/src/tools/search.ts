import { getDb } from '../db/database.js';
import type { MemoryRow } from '../db/schema.js';

export interface SearchParams {
  keyword?: string;
  tags?: string[];
  type?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export async function memorySearch(params: SearchParams): Promise<{
  results: Array<{
    id: number;
    content: string;
    type: string;
    tags: string[];
    importance: number;
    access_count: number;
    created_at: string;
  }>;
  total: number;
}> {
  const { keyword, tags, type, date_from, date_to, limit = 20 } = params;
  const db = getDb();

  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (keyword) {
    conditions.push('content LIKE ?');
    values.push(`%${keyword}%`);
  }

  if (type) {
    conditions.push('type = ?');
    values.push(type);
  }

  if (date_from) {
    conditions.push('created_at >= ?');
    values.push(date_from);
  }

  if (date_to) {
    conditions.push('created_at <= ?');
    values.push(date_to);
  }

  if (tags && tags.length > 0) {
    // Match any of the provided tags
    const tagConditions = tags.map(() => 'tags LIKE ?');
    conditions.push(`(${tagConditions.join(' OR ')})`);
    for (const tag of tags) {
      values.push(`%"${tag}"%`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = db.prepare(
    `SELECT COUNT(*) as total FROM memories ${whereClause}`
  ).get(...values) as { total: number };

  const rows = db.prepare(
    `SELECT * FROM memories ${whereClause} ORDER BY created_at DESC LIMIT ?`
  ).all(...values, limit) as MemoryRow[];

  return {
    results: rows.map(row => ({
      id: row.id,
      content: row.content,
      type: row.type,
      tags: JSON.parse(row.tags),
      importance: row.importance,
      access_count: row.access_count,
      created_at: row.created_at,
    })),
    total: countRow.total,
  };
}
