import { getDb } from '../db/database.js';
import type { Finding, Thread, ConfidenceAssessment } from './types.js';

/**
 * Calculate overall project confidence score.
 */
export function calculateProjectConfidence(projectId: string): ConfidenceAssessment {
  const db = getDb();

  const threads = db.prepare('SELECT * FROM threads WHERE project_id = ?')
    .all(projectId) as Thread[];
  const findings = db.prepare('SELECT * FROM findings WHERE project_id = ? ORDER BY confidence DESC')
    .all(projectId) as Finding[];

  if (findings.length === 0) {
    return {
      overall: 0,
      by_dimension: {},
      strongest_areas: [],
      weakest_areas: [],
    };
  }

  // Group findings by thread source_group (proxy for dimension)
  const byDimension: Record<string, Finding[]> = {};
  for (const thread of threads) {
    byDimension[thread.source_group] = [];
  }
  for (const finding of findings) {
    const thread = threads.find((t) => t.id === finding.thread_id);
    if (thread) {
      if (!byDimension[thread.source_group]) byDimension[thread.source_group] = [];
      byDimension[thread.source_group].push(finding);
    }
  }

  // Calculate confidence per dimension
  const dimensionScores: Record<string, number> = {};
  for (const [dim, dimFindings] of Object.entries(byDimension)) {
    if (dimFindings.length === 0) {
      dimensionScores[dim] = 0;
      continue;
    }

    // Weighted average: higher-confidence findings count more
    const totalWeight = dimFindings.reduce((sum, f) => sum + f.confidence, 0);
    const weightedScore = dimFindings.reduce((sum, f) => sum + f.confidence * f.confidence, 0);
    dimensionScores[dim] = weightedScore / totalWeight;
  }

  // Overall: weighted average across dimensions
  const dimEntries = Object.entries(dimensionScores).filter(([, s]) => s > 0);
  const overall = dimEntries.length > 0
    ? dimEntries.reduce((sum, [, s]) => sum + s, 0) / dimEntries.length
    : 0;

  // Thread completion factor
  const completedRatio = threads.filter((t) => t.status === 'complete').length / Math.max(threads.length, 1);
  const adjustedOverall = overall * (0.5 + 0.5 * completedRatio);

  // Identify strongest and weakest
  const sorted = dimEntries.sort((a, b) => b[1] - a[1]);
  const strongest = sorted.slice(0, 2).map(([dim]) => dim);
  const weakest = sorted.slice(-2).map(([dim]) => dim);

  return {
    overall: Math.round(adjustedOverall * 100) / 100,
    by_dimension: dimensionScores,
    strongest_areas: strongest,
    weakest_areas: weakest,
  };
}

/**
 * Calculate a single finding's adjusted confidence based on source corroboration.
 */
export function adjustedFindingConfidence(findingId: string): number {
  const db = getDb();
  const finding = db.prepare('SELECT * FROM findings WHERE id = ?').get(findingId) as Finding | undefined;
  if (!finding) return 0;

  // Check if corroborated by findings from different sources
  const related = db.prepare(`
    SELECT f.confidence, s.tool_name FROM findings f
    JOIN sources s ON s.finding_id = f.id
    WHERE f.thread_id = ? AND f.id != ?
  `).all(finding.thread_id, findingId) as Array<{ confidence: number; tool_name: string }>;

  const corroborationBoost = Math.min(0.15, related.length * 0.05);
  return Math.min(1.0, finding.confidence + corroborationBoost);
}
