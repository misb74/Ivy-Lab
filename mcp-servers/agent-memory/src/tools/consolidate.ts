/**
 * Memory consolidation — background maintenance for the memory store.
 *
 * Inspired by Claude Code's autoDream service: periodically reviews
 * stored memories for redundancy, staleness, and pattern extraction.
 * Can be triggered manually or scheduled via the scheduler engine.
 */

import { getDb } from '../db/database.js';

interface ConsolidationResult {
  total_memories: number;
  stale_pruned: number;
  duplicates_merged: number;
  low_importance_pruned: number;
  patterns_extracted: string[];
  duration_ms: number;
}

/**
 * Run memory consolidation:
 * 1. Prune memories older than retention_days with low importance and low access
 * 2. Merge near-duplicate memories (same type + similar content)
 * 3. Extract cross-memory patterns for knowledge synthesis
 */
export async function consolidateMemories(params: {
  retention_days?: number;
  min_importance?: number;
  dry_run?: boolean;
}): Promise<ConsolidationResult> {
  const startTime = Date.now();
  const retentionDays = params.retention_days ?? 90;
  const minImportance = params.min_importance ?? 3;
  const dryRun = params.dry_run ?? false;
  const db = getDb();

  // Count total
  const total = (db.prepare('SELECT COUNT(*) as count FROM memories').get() as any).count;

  // Phase 1: Prune stale low-importance memories
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffISO = cutoffDate.toISOString();

  const staleRows = db.prepare(`
    SELECT id FROM memories
    WHERE created_at < ? AND importance <= ? AND access_count <= 1
  `).all(cutoffISO, minImportance) as Array<{ id: number }>;

  let stalePruned = 0;
  if (!dryRun && staleRows.length > 0) {
    const deleteStmt = db.prepare('DELETE FROM memories WHERE id = ?');
    const deleteMany = db.transaction((ids: number[]) => {
      for (const id of ids) deleteStmt.run(id);
    });
    deleteMany(staleRows.map(r => r.id));
    stalePruned = staleRows.length;
  } else {
    stalePruned = staleRows.length; // Report count even in dry run
  }

  // Phase 2: Find and merge near-duplicates (same type, similar content start)
  const allMemories = db.prepare(`
    SELECT id, content, type, importance, tags, created_at
    FROM memories ORDER BY importance DESC, created_at DESC
  `).all() as Array<{
    id: number; content: string; type: string;
    importance: number; tags: string; created_at: string;
  }>;

  const duplicateIds = new Set<number>();
  const contentMap = new Map<string, number>();

  for (const mem of allMemories) {
    // Use first 100 chars + type as dedup key
    const key = `${mem.type}:${mem.content.slice(0, 100).toLowerCase().trim()}`;
    if (contentMap.has(key)) {
      // Keep the one with higher importance (already sorted DESC)
      duplicateIds.add(mem.id);
    } else {
      contentMap.set(key, mem.id);
    }
  }

  let duplicatesMerged = 0;
  if (!dryRun && duplicateIds.size > 0) {
    const deleteStmt = db.prepare('DELETE FROM memories WHERE id = ?');
    const deleteMany = db.transaction((ids: number[]) => {
      for (const id of ids) deleteStmt.run(id);
    });
    deleteMany(Array.from(duplicateIds));
    duplicatesMerged = duplicateIds.size;
  } else {
    duplicatesMerged = duplicateIds.size;
  }

  // Phase 3: Extract patterns from remaining memories
  const patterns: string[] = [];
  const remainingMemories = dryRun ? allMemories : db.prepare(`
    SELECT type, content, tags FROM memories ORDER BY importance DESC LIMIT 100
  `).all() as Array<{ type: string; content: string; tags: string }>;

  // Type frequency analysis
  const typeCount = new Map<string, number>();
  for (const mem of remainingMemories) {
    typeCount.set(mem.type, (typeCount.get(mem.type) || 0) + 1);
  }
  const topTypes = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (topTypes.length > 0) {
    patterns.push(`Most common memory types: ${topTypes.map(([t, c]) => `${t} (${c})`).join(', ')}`);
  }

  // Tag frequency analysis
  const tagCount = new Map<string, number>();
  for (const mem of remainingMemories) {
    if (!mem.tags) continue;
    try {
      const tags = JSON.parse(mem.tags);
      if (Array.isArray(tags)) {
        for (const tag of tags) tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      }
    } catch { /* ignore */ }
  }
  const topTags = Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topTags.length > 0) {
    patterns.push(`Recurring themes: ${topTags.map(([t, c]) => `${t} (${c})`).join(', ')}`);
  }

  return {
    total_memories: total,
    stale_pruned: stalePruned,
    duplicates_merged: duplicatesMerged,
    low_importance_pruned: 0, // Included in stale_pruned
    patterns_extracted: patterns,
    duration_ms: Date.now() - startTime,
  };
}
