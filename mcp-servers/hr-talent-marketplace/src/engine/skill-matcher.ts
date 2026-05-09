export interface CandidateSkill {
  name: string;
  level: number; // 1-5 scale: 1=beginner, 2=basic, 3=intermediate, 4=advanced, 5=expert
}

export interface RoleRequirement {
  name: string;
  weight: number; // 0-1 importance weight
}

export interface SkillBreakdown {
  skill: string;
  candidateLevel: number;
  requiredWeight: number;
  matchScore: number;
  status: "exceeded" | "met" | "partial" | "missing";
}

export interface SkillMatchResult {
  overallScore: number; // 0-100
  breakdown: SkillBreakdown[];
  matchedSkills: number;
  totalRequired: number;
  strongMatches: string[];
  gaps: string[];
}

/**
 * Compute weighted cosine similarity between candidate skills and role requirements.
 *
 * The algorithm builds two vectors over the union of skill names:
 *   - Candidate vector: skill level (0 if absent) normalized to 0-1 by dividing by 5.
 *   - Role vector: requirement weight (0 if absent).
 *
 * Cosine similarity = dot(A, B) / (||A|| * ||B||), scaled to 0-100.
 */
export function matchSkills(
  candidateSkills: CandidateSkill[],
  roleRequirements: RoleRequirement[],
): SkillMatchResult {
  if (roleRequirements.length === 0) {
    return {
      overallScore: 100,
      breakdown: [],
      matchedSkills: 0,
      totalRequired: 0,
      strongMatches: [],
      gaps: [],
    };
  }

  const candidateMap = new Map<string, number>();
  for (const skill of candidateSkills) {
    candidateMap.set(skill.name.toLowerCase(), skill.level);
  }

  const requirementMap = new Map<string, number>();
  for (const req of roleRequirements) {
    requirementMap.set(req.name.toLowerCase(), req.weight);
  }

  // Build the union of all skill names
  const allSkills = new Set<string>([
    ...candidateMap.keys(),
    ...requirementMap.keys(),
  ]);

  let dotProduct = 0;
  let candidateMagnitude = 0;
  let roleMagnitude = 0;

  for (const skill of allSkills) {
    const candidateValue = (candidateMap.get(skill) ?? 0) / 5; // normalize to 0-1
    const roleValue = requirementMap.get(skill) ?? 0;

    dotProduct += candidateValue * roleValue;
    candidateMagnitude += candidateValue * candidateValue;
    roleMagnitude += roleValue * roleValue;
  }

  candidateMagnitude = Math.sqrt(candidateMagnitude);
  roleMagnitude = Math.sqrt(roleMagnitude);

  const cosineSimilarity =
    candidateMagnitude > 0 && roleMagnitude > 0
      ? dotProduct / (candidateMagnitude * roleMagnitude)
      : 0;

  // Per-skill breakdown
  const breakdown: SkillBreakdown[] = [];
  const strongMatches: string[] = [];
  const gaps: string[] = [];
  let matchedSkills = 0;

  for (const req of roleRequirements) {
    const skillName = req.name.toLowerCase();
    const candidateLevel = candidateMap.get(skillName) ?? 0;
    const normalizedLevel = candidateLevel / 5;
    const matchScore = Math.min(100, (normalizedLevel / Math.max(req.weight, 0.01)) * 100);

    let status: SkillBreakdown["status"];
    if (candidateLevel === 0) {
      status = "missing";
      gaps.push(req.name);
    } else if (normalizedLevel >= req.weight) {
      status = "exceeded";
      matchedSkills++;
      strongMatches.push(req.name);
    } else if (normalizedLevel >= req.weight * 0.75) {
      status = "met";
      matchedSkills++;
    } else {
      status = "partial";
      gaps.push(req.name);
    }

    breakdown.push({
      skill: req.name,
      candidateLevel,
      requiredWeight: req.weight,
      matchScore: Math.round(matchScore),
      status,
    });
  }

  return {
    overallScore: Math.round(cosineSimilarity * 100),
    breakdown,
    matchedSkills,
    totalRequired: roleRequirements.length,
    strongMatches,
    gaps,
  };
}
