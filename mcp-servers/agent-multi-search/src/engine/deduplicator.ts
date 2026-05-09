import { NormalizedResult } from './types.js';

/** Levenshtein distance for fuzzy matching */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[b.length][a.length];
}

/** Normalized similarity (0 to 1, where 1 = identical) */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export interface DedupGroup {
  canonical_key: string;
  results: NormalizedResult[];
}

const FUZZY_THRESHOLD = 0.85;

/**
 * Deduplicate normalized results using:
 * 1. Exact canonical_key match
 * 2. Fuzzy Levenshtein on canonical_key for near-duplicates
 */
export function deduplicateResults(results: NormalizedResult[]): DedupGroup[] {
  const groups: DedupGroup[] = [];
  const assigned = new Set<string>();

  // Phase 1: Exact match grouping
  const exactMap = new Map<string, NormalizedResult[]>();
  for (const r of results) {
    const key = r.canonical_key;
    if (!exactMap.has(key)) exactMap.set(key, []);
    exactMap.get(key)!.push(r);
  }

  for (const [key, members] of exactMap) {
    if (members.length > 0) {
      groups.push({ canonical_key: key, results: members });
      for (const m of members) assigned.add(m.id);
    }
  }

  // Phase 2: Fuzzy merge of groups with similar keys
  const mergedGroups: DedupGroup[] = [];
  const groupAssigned = new Set<number>();

  for (let i = 0; i < groups.length; i++) {
    if (groupAssigned.has(i)) continue;

    const merged: DedupGroup = {
      canonical_key: groups[i].canonical_key,
      results: [...groups[i].results],
    };

    for (let j = i + 1; j < groups.length; j++) {
      if (groupAssigned.has(j)) continue;

      // Only fuzzy-match within same type prefix
      const typeA = groups[i].canonical_key.split(':')[0];
      const typeB = groups[j].canonical_key.split(':')[0];
      if (typeA !== typeB) continue;

      const sim = similarity(groups[i].canonical_key, groups[j].canonical_key);
      if (sim >= FUZZY_THRESHOLD) {
        merged.results.push(...groups[j].results);
        groupAssigned.add(j);
      }
    }

    groupAssigned.add(i);
    mergedGroups.push(merged);
  }

  return mergedGroups;
}
