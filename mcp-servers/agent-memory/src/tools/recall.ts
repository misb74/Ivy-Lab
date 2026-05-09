import { getDb } from '../db/database.js';
import { getIndex } from '../index-manager.js';
import { computeRelevance } from '../decay/relevance.js';
import type { MemoryRow } from '../db/schema.js';

export interface RecallParams {
  query: string;
  limit?: number;
}

export async function memoryRecall(params: RecallParams): Promise<{
  results: Array<{
    id: number;
    content: string;
    type: string;
    tags: string[];
    importance: number;
    relevance_score: number;
    created_at: string;
  }>;
  total_searched: number;
}> {
  const { query, limit = 10 } = params;
  const db = getDb();
  const index = getIndex();

  // Get vector similarity scores
  const vectorResults = await index.search(query, limit * 3);

  if (vectorResults.length === 0) {
    return { results: [], total_searched: index.size };
  }

  // Fetch memory rows
  const ids = vectorResults.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT * FROM memories WHERE id IN (${placeholders})`
  ).all(...ids) as MemoryRow[];

  const rowMap = new Map(rows.map(r => [r.id, r]));

  // Compute relevance with decay
  const scored = vectorResults
    .map(({ id, score }) => {
      const row = rowMap.get(id);
      if (!row) return null;
      return {
        row,
        relevance: computeRelevance(row, score),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  scored.sort((a, b) => b.relevance - a.relevance);
  const topResults = scored.slice(0, limit);

  // Update access counts
  const updateStmt = db.prepare(
    `UPDATE memories SET access_count = access_count + 1, last_accessed = datetime('now') WHERE id = ?`
  );
  const updateMany = db.transaction((ids: number[]) => {
    for (const id of ids) updateStmt.run(id);
  });
  updateMany(topResults.map(r => r.row.id));

  return {
    results: topResults.map(({ row, relevance }) => ({
      id: row.id,
      content: row.content,
      type: row.type,
      tags: JSON.parse(row.tags),
      importance: row.importance,
      relevance_score: Math.round(relevance * 1000) / 1000,
      created_at: row.created_at,
    })),
    total_searched: index.size,
  };
}
