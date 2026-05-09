/**
 * Unified skill proficiency normalizer.
 *
 * Maps between O*NET (importance 1-7, level 0-7) and Lightcast proficiency
 * scales into a unified 1-5 proficiency level with confidence score.
 *
 * Inspired by Claude Code's tool abstraction layer — every data point
 * should carry a confidence indicator so downstream consumers can weight
 * appropriately.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NormalizedSkill {
  name: string;
  proficiency: number; // 1-5 unified scale
  confidence: number;  // 0-1 mapping quality
  source: 'onet' | 'lightcast' | 'manual' | 'inferred';
  raw?: {
    importance?: number;
    level?: number;
    lightcast_category?: string;
  };
}

export type ProficiencyLevel = 1 | 2 | 3 | 4 | 5;

export const PROFICIENCY_LABELS: Record<ProficiencyLevel, string> = {
  1: 'Foundational',
  2: 'Developing',
  3: 'Proficient',
  4: 'Advanced',
  5: 'Expert',
};

// ─── O*NET Normalization ────────────────────────────────────────────────────

/**
 * Normalize O*NET importance (1-7) and level (0-7) to unified 1-5 scale.
 * Uses weighted combination: 60% level, 40% importance.
 * Falls back to importance-only if level is missing.
 */
export function normalizeOnet(
  name: string,
  importance: number,
  level?: number,
): NormalizedSkill {
  // Clamp inputs
  const imp = Math.max(1, Math.min(7, importance));
  const lvl = level != null ? Math.max(0, Math.min(7, level)) : null;

  let unified: number;
  let confidence: number;

  if (lvl != null) {
    // Weighted combination: level is more granular
    const impNorm = ((imp - 1) / 6) * 4 + 1; // 1-7 → 1-5
    const lvlNorm = (lvl / 7) * 4 + 1;       // 0-7 → 1-5
    unified = 0.4 * impNorm + 0.6 * lvlNorm;
    confidence = 0.9; // Both dimensions available
  } else {
    // Importance only
    unified = ((imp - 1) / 6) * 4 + 1; // 1-7 → 1-5
    confidence = 0.65; // Single dimension
  }

  return {
    name,
    proficiency: Math.round(Math.max(1, Math.min(5, unified)) * 10) / 10,
    confidence,
    source: 'onet',
    raw: { importance: imp, level: lvl ?? undefined },
  };
}

// ─── Lightcast Normalization ────────────────────────────────────────────────

/**
 * Lightcast skills don't carry explicit proficiency — they're tagged by
 * category (hard/soft/certification) and sometimes by confidence score
 * from NLP extraction. We infer proficiency from context signals.
 */
export function normalizeLightcast(
  name: string,
  category: 'hard_skill' | 'soft_skill' | 'certification',
  extractionConfidence?: number,
  jobPostingFrequency?: number, // 0-1 how often this appears in postings
): NormalizedSkill {
  // Certifications imply demonstrated competence
  let baseProficiency: number;
  if (category === 'certification') {
    baseProficiency = 4.0; // Certifications prove at least advanced
  } else {
    baseProficiency = 3.0; // Default: proficient (middle of scale)
  }

  // Adjust by extraction confidence (higher confidence = clearer signal)
  if (extractionConfidence != null) {
    const boost = (extractionConfidence - 0.5) * 1.0; // -0.5 to +0.5
    baseProficiency += boost;
  }

  // Job posting frequency can indicate market expectation level
  if (jobPostingFrequency != null && jobPostingFrequency > 0.7) {
    baseProficiency = Math.max(baseProficiency, 3.5); // Common skills ≥ proficient
  }

  return {
    name,
    proficiency: Math.round(Math.max(1, Math.min(5, baseProficiency)) * 10) / 10,
    confidence: category === 'certification' ? 0.85 : 0.5, // Lightcast lacks proficiency data
    source: 'lightcast',
    raw: { lightcast_category: category },
  };
}

// ─── Cross-source comparison ────────────────────────────────────────────────

/**
 * Compare two normalized skills and compute the gap.
 * Positive gap = target requires more than current.
 */
export function computeSkillGap(
  current: NormalizedSkill,
  target: NormalizedSkill,
): {
  skill: string;
  current_proficiency: number;
  target_proficiency: number;
  gap: number;
  gap_confidence: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
} {
  const gap = target.proficiency - current.proficiency;
  // Confidence is the minimum of both sources (weakest link)
  const gap_confidence = Math.min(current.confidence, target.confidence);

  let priority: 'critical' | 'high' | 'medium' | 'low';
  if (gap >= 2.0) priority = 'critical';
  else if (gap >= 1.0) priority = 'high';
  else if (gap >= 0.5) priority = 'medium';
  else priority = 'low';

  return {
    skill: current.name,
    current_proficiency: current.proficiency,
    target_proficiency: target.proficiency,
    gap: Math.round(gap * 10) / 10,
    gap_confidence,
    priority,
  };
}

/**
 * Batch normalize an array of O*NET OccupationSkill objects.
 */
export function normalizeOnetSkills(
  skills: Array<{ name: string; importance: number; level: number }>,
): NormalizedSkill[] {
  return skills.map(s => normalizeOnet(s.name, s.importance, s.level));
}

/**
 * Merge and deduplicate normalized skills from multiple sources.
 * When the same skill appears from multiple sources, prefer the one
 * with higher confidence.
 */
export function mergeNormalizedSkills(
  ...skillSets: NormalizedSkill[][]
): NormalizedSkill[] {
  const byName = new Map<string, NormalizedSkill>();

  for (const set of skillSets) {
    for (const skill of set) {
      const key = skill.name.toLowerCase().trim();
      const existing = byName.get(key);
      if (!existing || skill.confidence > existing.confidence) {
        byName.set(key, skill);
      }
    }
  }

  return Array.from(byName.values()).sort((a, b) => b.proficiency - a.proficiency);
}
