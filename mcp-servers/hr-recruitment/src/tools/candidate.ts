/**
 * Candidate matching and skills analysis for recruitment.
 *
 * Uses hybrid matching: semantic embeddings (cosine similarity via all-MiniLM-L6-v2)
 * combined with Levenshtein fuzzy matching for robust skill comparison.
 * Inspired by Claude Code's embedding-based similarity patterns.
 */

// ---------------------------------------------------------------------------
// Embedding-based semantic matching
// ---------------------------------------------------------------------------

let embeddingCache: Map<string, Float32Array> = new Map();
let embeddingProvider: any = null;

async function getProvider() {
  if (!embeddingProvider) {
    try {
      const { getEmbeddingProvider } = await import(
        '../../shared/src/embeddings/provider.js'
      );
      embeddingProvider = await getEmbeddingProvider();
    } catch {
      // Fallback: try agent-memory's provider path
      try {
        const { getEmbeddingProvider } = await import(
          '../../../agent-memory/src/embeddings/provider.js'
        );
        embeddingProvider = await getEmbeddingProvider();
      } catch {
        embeddingProvider = null;
      }
    }
  }
  return embeddingProvider;
}

async function embedSkill(skill: string): Promise<Float32Array | null> {
  const key = skill.toLowerCase().trim();
  if (embeddingCache.has(key)) return embeddingCache.get(key)!;
  const provider = await getProvider();
  if (!provider) return null;
  const vec = await provider.embed(key);
  embeddingCache.set(key, vec);
  return vec;
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Compute semantic similarity between two skills using embeddings.
 * Falls back to Levenshtein if embeddings are unavailable.
 */
async function semanticSimilarity(a: string, b: string): Promise<number> {
  const vecA = await embedSkill(a);
  const vecB = await embedSkill(b);
  if (vecA && vecB) {
    return cosineSimilarity(vecA, vecB);
  }
  // Fallback to Levenshtein
  return levenshteinSimilarity(a.toLowerCase().trim(), b.toLowerCase().trim());
}

// ---------------------------------------------------------------------------
// Candidate matching
// ---------------------------------------------------------------------------

export interface CandidateMatchResult {
  match_percentage: number;
  match_level: 'excellent' | 'strong' | 'moderate' | 'weak' | 'poor';
  overlapping_skills: string[];
  missing_skills: string[];
  extra_skills: string[];
  gap_analysis: SkillGapItem[];
  recommendations: string[];
  matching_method: 'semantic' | 'fuzzy';
}

export interface SkillGapItem {
  skill: string;
  importance: 'critical' | 'important' | 'nice_to_have';
  trainability: 'easily_trainable' | 'moderately_trainable' | 'difficult_to_train';
  estimated_ramp_time: string;
}

/**
 * Skills that are generally harder to train vs. easier to learn.
 */
const HARD_TO_TRAIN_PATTERNS: string[] = [
  'leadership', 'strategic', 'communication', 'negotiation',
  'problem-solving', 'critical thinking', 'creativity', 'empathy',
  'emotional intelligence', 'judgment', 'decision-making', 'vision',
  'influence', 'adaptability', 'resilience', 'integrity',
  'cultural awareness', 'mentoring',
];

const EASILY_TRAINABLE_PATTERNS: string[] = [
  'excel', 'powerpoint', 'word', 'google sheets', 'jira',
  'confluence', 'slack', 'teams', 'zoom', 'salesforce',
  'hubspot', 'sap', 'workday', 'tableau', 'sql',
  'git', 'html', 'css', 'compliance', 'reporting',
  'data entry', 'filing', 'scheduling',
];

/**
 * Match a candidate's skills against role requirements.
 * Uses hybrid approach: semantic embeddings when available, Levenshtein fallback.
 */
export async function matchCandidate(
  candidateSkills: string[],
  roleRequirements: string[]
): Promise<CandidateMatchResult> {
  const SEMANTIC_THRESHOLD = 0.75; // Cosine similarity threshold for semantic match
  const FUZZY_THRESHOLD = 0.8;     // Levenshtein threshold for fuzzy match

  const provider = await getProvider();
  const useSemantic = provider !== null;

  // Find overlaps using semantic + fuzzy matching
  const overlapping: string[] = [];
  const missing: string[] = [];

  for (const req of roleRequirements) {
    const reqLower = req.toLowerCase().trim();
    let matched = false;

    for (const cs of candidateSkills) {
      const csLower = cs.toLowerCase().trim();

      // Exact or substring match (fast path)
      if (csLower === reqLower || csLower.includes(reqLower) || reqLower.includes(csLower)) {
        matched = true;
        break;
      }

      // Semantic match via embeddings (if available)
      if (useSemantic) {
        const sim = await semanticSimilarity(cs, req);
        if (sim >= SEMANTIC_THRESHOLD) {
          matched = true;
          break;
        }
      } else {
        // Fallback to Levenshtein
        if (levenshteinSimilarity(csLower, reqLower) >= FUZZY_THRESHOLD) {
          matched = true;
          break;
        }
      }
    }

    if (matched) {
      overlapping.push(req);
    } else {
      missing.push(req);
    }
  }

  // Extra skills the candidate has
  const extra: string[] = [];
  for (const skill of candidateSkills) {
    let isRequired = false;
    for (const rr of roleRequirements) {
      const rrLower = rr.toLowerCase().trim();
      const skillLower = skill.toLowerCase().trim();

      if (rrLower === skillLower || rrLower.includes(skillLower) || skillLower.includes(rrLower)) {
        isRequired = true;
        break;
      }
      if (useSemantic) {
        const sim = await semanticSimilarity(skill, rr);
        if (sim >= SEMANTIC_THRESHOLD) { isRequired = true; break; }
      } else {
        if (levenshteinSimilarity(rrLower, skillLower) >= FUZZY_THRESHOLD) { isRequired = true; break; }
      }
    }
    if (!isRequired) {
      extra.push(skill);
    }
  }

  // Calculate match percentage
  const matchPct = roleRequirements.length > 0
    ? Math.round((overlapping.length / roleRequirements.length) * 100)
    : 0;

  // Determine match level
  let matchLevel: CandidateMatchResult['match_level'];
  if (matchPct >= 90) matchLevel = 'excellent';
  else if (matchPct >= 75) matchLevel = 'strong';
  else if (matchPct >= 55) matchLevel = 'moderate';
  else if (matchPct >= 35) matchLevel = 'weak';
  else matchLevel = 'poor';

  // Gap analysis for missing skills
  const gapAnalysis: SkillGapItem[] = missing.map((skill, idx) => {
    const skillLower = skill.toLowerCase();

    // Determine importance (first third = critical, second = important, rest = nice to have)
    const reqIdx = roleRequirements.findIndex(r => r === skill);
    const relativePosition = roleRequirements.length > 0 ? reqIdx / roleRequirements.length : 0;
    let importance: SkillGapItem['importance'];
    if (relativePosition < 0.33) importance = 'critical';
    else if (relativePosition < 0.67) importance = 'important';
    else importance = 'nice_to_have';

    // Determine trainability
    let trainability: SkillGapItem['trainability'];
    let rampTime: string;
    if (EASILY_TRAINABLE_PATTERNS.some(p => skillLower.includes(p))) {
      trainability = 'easily_trainable';
      rampTime = '1-4 weeks';
    } else if (HARD_TO_TRAIN_PATTERNS.some(p => skillLower.includes(p))) {
      trainability = 'difficult_to_train';
      rampTime = '6-12+ months';
    } else {
      trainability = 'moderately_trainable';
      rampTime = '1-3 months';
    }

    return {
      skill,
      importance,
      trainability,
      estimated_ramp_time: rampTime,
    };
  });

  // Generate recommendations
  const recommendations: string[] = [];
  if (matchPct >= 75) {
    recommendations.push('Strong candidate match. Proceed to interview stage.');
  }
  if (missing.length > 0) {
    const criticalMissing = gapAnalysis.filter(g => g.importance === 'critical');
    if (criticalMissing.length > 0) {
      recommendations.push(
        `${criticalMissing.length} critical skill gap(s): ${criticalMissing.map(g => g.skill).join(', ')}. Assess via interview or practical test.`
      );
    }
    const trainable = gapAnalysis.filter(g => g.trainability === 'easily_trainable');
    if (trainable.length > 0) {
      recommendations.push(
        `${trainable.length} missing skill(s) are easily trainable: ${trainable.map(g => g.skill).join(', ')}.`
      );
    }
  }
  if (extra.length > 0) {
    recommendations.push(
      `Candidate brings ${extra.length} additional skill(s) not in requirements: ${extra.slice(0, 5).join(', ')}${extra.length > 5 ? '...' : ''}.`
    );
  }
  if (matchPct < 50) {
    recommendations.push('Low match rate. Consider whether candidate could be suitable for a different role.');
  }

  return {
    match_percentage: matchPct,
    match_level: matchLevel,
    overlapping_skills: overlapping,
    missing_skills: missing,
    extra_skills: extra,
    gap_analysis: gapAnalysis,
    recommendations,
    matching_method: useSemantic ? 'semantic' : 'fuzzy',
  };
}

// ---------------------------------------------------------------------------
// Levenshtein similarity for fuzzy matching
// ---------------------------------------------------------------------------

function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return 1 - matrix[a.length][b.length] / maxLen;
}
