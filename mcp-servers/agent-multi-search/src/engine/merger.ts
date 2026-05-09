import { ActionResult, MergeResult, NormalizedResult } from './types.js';
import { normalizeResults } from './normalizer.js';
import { deduplicateResults } from './deduplicator.js';
import { rankResults } from './ranker.js';
import { SOURCE_GROUPS } from './source-groups.js';

/** In-memory store for pending search sessions */
const searchSessions = new Map<string, { query: string; sourceGroup: string }>();

export function registerSearch(searchId: string, query: string, sourceGroup: string): void {
  searchSessions.set(searchId, { query, sourceGroup });
}

export function getSearchSession(searchId: string) {
  return searchSessions.get(searchId);
}

/**
 * Full merge pipeline: normalize → deduplicate → rank
 */
export function mergeResults(searchId: string, actionResults: ActionResult[]): MergeResult {
  const session = searchSessions.get(searchId);
  const query = session?.query || '';
  const sourceGroup = session?.sourceGroup || 'unknown';
  const warnings: string[] = [];

  // Step 1: Normalize all results
  const allNormalized: NormalizedResult[] = [];
  const sourceBreakdown: Record<string, number> = {};

  for (const ar of actionResults) {
    if (!ar.success) {
      warnings.push(`${ar.source_tool}: ${ar.error || 'failed'}`);
      continue;
    }

    // Find the tool def to get reliability weight
    let reliabilityWeight = 0.5;
    let serverName = 'unknown';
    for (const group of Object.values(SOURCE_GROUPS)) {
      const toolDef = group.tools.find((t) => t.tool_name === ar.source_tool);
      if (toolDef) {
        reliabilityWeight = toolDef.reliability_weight;
        serverName = toolDef.server_name;
        break;
      }
    }

    const normalized = normalizeResults(ar.source_tool, serverName, reliabilityWeight, ar.data);
    allNormalized.push(...normalized);
    sourceBreakdown[ar.source_tool] = (sourceBreakdown[ar.source_tool] || 0) + normalized.length;
  }

  if (allNormalized.length === 0) {
    return {
      search_id: searchId,
      query,
      total_raw: 0,
      total_merged: 0,
      results: [],
      source_breakdown: sourceBreakdown,
      warnings: warnings.length > 0 ? warnings : ['No results from any source'],
    };
  }

  // Step 2: Deduplicate
  const groups = deduplicateResults(allNormalized);

  // Step 3: Rank
  const ranked = rankResults(groups);

  // Clean up session
  searchSessions.delete(searchId);

  return {
    search_id: searchId,
    query,
    total_raw: allNormalized.length,
    total_merged: ranked.length,
    results: ranked,
    source_breakdown: sourceBreakdown,
    warnings,
  };
}
