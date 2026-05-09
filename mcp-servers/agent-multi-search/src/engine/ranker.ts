import { DedupGroup } from './deduplicator.js';
import { MergedResult } from './types.js';

const MULTI_SOURCE_BOOST = 0.15;
const RECENCY_DECAY_DAYS = 365;

/**
 * Calculate confidence score for a dedup group:
 * - Base: weighted average of source reliability
 * - Boost: multi-source corroboration
 * - Recency: small bonus for recent data
 */
function calculateConfidence(group: DedupGroup): number {
  const results = group.results;

  // Base: average reliability weight across unique sources
  const uniqueSources = new Map<string, number>();
  for (const r of results) {
    const key = r.source.server_name;
    if (!uniqueSources.has(key) || uniqueSources.get(key)! < r.source.reliability_weight) {
      uniqueSources.set(key, r.source.reliability_weight);
    }
  }

  let totalWeight = 0;
  for (const w of uniqueSources.values()) totalWeight += w;
  const baseConfidence = totalWeight / uniqueSources.size;

  // Multi-source corroboration boost
  const corroborationBoost = uniqueSources.size > 1
    ? Math.min(MULTI_SOURCE_BOOST * (uniqueSources.size - 1), 0.3)
    : 0;

  // Recency bonus (most recent result in group)
  let recencyBonus = 0;
  for (const r of results) {
    if (r.date) {
      const ageMs = Date.now() - new Date(r.date).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const bonus = Math.max(0, 0.05 * (1 - ageDays / RECENCY_DECAY_DAYS));
      recencyBonus = Math.max(recencyBonus, bonus);
    }
  }

  return Math.min(1.0, baseConfidence + corroborationBoost + recencyBonus);
}

/**
 * Calculate relevance score — how well does this result match the query.
 * Uses simple heuristics since we don't have query text at this stage.
 */
function calculateRelevance(group: DedupGroup): number {
  // More sources = more relevant
  const sourceCount = new Set(group.results.map((r) => r.source.server_name)).size;
  const sourceRelevance = Math.min(1.0, 0.5 + sourceCount * 0.15);

  // Has numeric data = more useful
  const hasNumeric = group.results.some((r) => r.numeric_value != null);
  const numericBonus = hasNumeric ? 0.1 : 0;

  return Math.min(1.0, sourceRelevance + numericBonus);
}

/**
 * Rank dedup groups into merged results, sorted by confidence then relevance.
 */
export function rankResults(groups: DedupGroup[]): MergedResult[] {
  const merged: MergedResult[] = groups.map((group) => {
    const primary = group.results[0];
    const confidence = calculateConfidence(group);
    const relevance = calculateRelevance(group);
    const uniqueSources = new Map<string, typeof primary.source>();
    for (const r of group.results) {
      uniqueSources.set(`${r.source.server_name}:${r.source.tool_name}`, r.source);
    }

    return {
      id: primary.id,
      canonical_key: group.canonical_key,
      type: primary.type,
      title: primary.title,
      value: primary.value,
      numeric_value: primary.numeric_value,
      unit: primary.unit,
      location: primary.location,
      date: primary.date,
      confidence,
      relevance,
      sources: Array.from(uniqueSources.values()),
      corroborated_by: uniqueSources.size,
      raw_results: group.results,
    };
  });

  // Sort: confidence desc, then relevance desc
  merged.sort((a, b) => {
    const confDiff = b.confidence - a.confidence;
    if (Math.abs(confDiff) > 0.01) return confDiff;
    return b.relevance - a.relevance;
  });

  return merged;
}
