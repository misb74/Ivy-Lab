import type { MemoryRow } from '../db/schema.js';

export function computeRelevance(memory: MemoryRow, similarityScore: number = 1): number {
  const now = Date.now();
  const createdAt = new Date(memory.created_at).getTime();
  const ageDays = (now - createdAt) / (1000 * 60 * 60 * 24);

  const decay = Math.exp(-0.01 * ageDays);
  const importanceBoost = 1 + memory.importance / 10;
  const accessBoost = Math.log2(memory.access_count + 1) * 0.1;

  return similarityScore * decay * (importanceBoost + accessBoost);
}
