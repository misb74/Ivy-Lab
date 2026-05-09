import { getDb } from '../db/database.js';
import type { MemoryRow } from '../db/schema.js';

export interface SummarizeParams {
  topic: string;
  limit?: number;
}

export async function memorySummarize(params: SummarizeParams): Promise<{
  topic: string;
  memory_count: number;
  types: Record<string, number>;
  key_memories: Array<{
    id: number;
    content: string;
    type: string;
    importance: number;
    created_at: string;
  }>;
  tags_frequency: Record<string, number>;
  date_range: { earliest: string; latest: string } | null;
}> {
  const { topic, limit = 20 } = params;
  const db = getDb();

  const rows = db.prepare(
    `SELECT * FROM memories WHERE content LIKE ? ORDER BY importance DESC, created_at DESC LIMIT ?`
  ).all(`%${topic}%`, limit) as MemoryRow[];

  if (rows.length === 0) {
    return {
      topic,
      memory_count: 0,
      types: {},
      key_memories: [],
      tags_frequency: {},
      date_range: null,
    };
  }

  // Aggregate types
  const types: Record<string, number> = {};
  const tagsFreq: Record<string, number> = {};

  for (const row of rows) {
    types[row.type] = (types[row.type] || 0) + 1;
    const tags: string[] = JSON.parse(row.tags);
    for (const tag of tags) {
      tagsFreq[tag] = (tagsFreq[tag] || 0) + 1;
    }
  }

  const dates = rows.map(r => r.created_at).sort();

  return {
    topic,
    memory_count: rows.length,
    types,
    key_memories: rows.slice(0, 5).map(row => ({
      id: row.id,
      content: row.content,
      type: row.type,
      importance: row.importance,
      created_at: row.created_at,
    })),
    tags_frequency: tagsFreq,
    date_range: {
      earliest: dates[0],
      latest: dates[dates.length - 1],
    },
  };
}
