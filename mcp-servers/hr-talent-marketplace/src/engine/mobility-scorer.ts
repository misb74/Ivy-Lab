import { matchSkills, type CandidateSkill, type RoleRequirement } from "./skill-matcher.js";

export interface MobilityProfile {
  skills: CandidateSkill[];
  aspirations: string[];
  performanceRating: number; // 1-5 scale
  tenureYears: number;
}

export interface MobilityTarget {
  title: string;
  requiredSkills: RoleRequirement[];
  preferredSkills: RoleRequirement[];
  department: string;
}

export interface MobilityFactorBreakdown {
  factor: string;
  weight: number;
  rawScore: number; // 0-100
  weightedScore: number;
  rationale: string;
}

export interface MobilityScoreResult {
  overallScore: number; // 0-100
  breakdown: MobilityFactorBreakdown[];
  recommendation: string;
  readinessCategory: "ready_now" | "ready_6mo" | "ready_12mo" | "develop";
}

const WEIGHTS = {
  skillOverlap: 0.4,
  growthTrajectory: 0.2,
  performance: 0.2,
  aspirationAlignment: 0.2,
};

/**
 * Calculate a composite mobility score for an internal candidate toward a target role.
 *
 * Factors:
 *   - Skill Overlap (40%): Weighted cosine similarity of current skills vs required + preferred skills.
 *   - Growth Trajectory (20%): Based on tenure and progression indicators.
 *   - Performance (20%): Directly derived from recent performance rating.
 *   - Aspiration Alignment (20%): How well the target role matches the candidate's stated aspirations.
 */
export function calculateMobilityScore(
  profile: MobilityProfile,
  target: MobilityTarget,
): MobilityScoreResult {
  const factors: MobilityFactorBreakdown[] = [];

  // --- 1. Skill Overlap (40%) ---
  const allRequirements: RoleRequirement[] = [
    ...target.requiredSkills,
    ...target.preferredSkills.map((s) => ({ ...s, weight: s.weight * 0.5 })),
  ];

  const skillMatch = matchSkills(profile.skills, allRequirements);
  const skillScore = skillMatch.overallScore;

  factors.push({
    factor: "Skill Overlap",
    weight: WEIGHTS.skillOverlap,
    rawScore: skillScore,
    weightedScore: Math.round(skillScore * WEIGHTS.skillOverlap),
    rationale: `Matched ${skillMatch.matchedSkills}/${skillMatch.totalRequired} required skills. Strong in: ${skillMatch.strongMatches.join(", ") || "none"}. Gaps: ${skillMatch.gaps.join(", ") || "none"}.`,
  });

  // --- 2. Growth Trajectory (20%) ---
  // Tenure-based growth curve: peaks around 3-6 years, tapers off
  let growthScore: number;
  const tenure = profile.tenureYears;

  if (tenure < 1) {
    growthScore = 40; // Too new to assess trajectory
  } else if (tenure < 3) {
    growthScore = 60 + (tenure - 1) * 15; // Ramping up: 60-90
  } else if (tenure <= 6) {
    growthScore = 90; // Prime mobility window
  } else if (tenure <= 10) {
    growthScore = 90 - (tenure - 6) * 5; // Gradual decline: 90-70
  } else {
    growthScore = 65; // Long-tenured, may be deeply specialized
  }

  // Boost if performance is strong (shows upward trajectory)
  if (profile.performanceRating >= 4) {
    growthScore = Math.min(100, growthScore + 10);
  }

  factors.push({
    factor: "Growth Trajectory",
    weight: WEIGHTS.growthTrajectory,
    rawScore: growthScore,
    weightedScore: Math.round(growthScore * WEIGHTS.growthTrajectory),
    rationale: `Tenure of ${tenure} years suggests ${tenure <= 6 ? "strong" : "moderate"} growth trajectory. ${profile.performanceRating >= 4 ? "High performance adds positive signal." : ""}`,
  });

  // --- 3. Performance (20%) ---
  // Direct mapping: rating 1-5 -> score 0-100
  const performanceScore = Math.min(100, Math.max(0, ((profile.performanceRating - 1) / 4) * 100));

  factors.push({
    factor: "Performance",
    weight: WEIGHTS.performance,
    rawScore: Math.round(performanceScore),
    weightedScore: Math.round(performanceScore * WEIGHTS.performance),
    rationale: `Performance rating of ${profile.performanceRating}/5 maps to ${Math.round(performanceScore)} score.`,
  });

  // --- 4. Aspiration Alignment (20%) ---
  const aspirationScore = computeAspirationAlignment(profile.aspirations, target);

  factors.push({
    factor: "Aspiration Alignment",
    weight: WEIGHTS.aspirationAlignment,
    rawScore: aspirationScore,
    weightedScore: Math.round(aspirationScore * WEIGHTS.aspirationAlignment),
    rationale: aspirationScore > 70
      ? `Candidate aspirations closely align with the target role and department.`
      : aspirationScore > 40
        ? `Some alignment between candidate aspirations and the target role.`
        : `Limited alignment between candidate aspirations and the target role.`,
  });

  // --- Composite Score ---
  const overallScore = factors.reduce((sum, f) => sum + f.weightedScore, 0);

  // --- Readiness Category ---
  let readinessCategory: MobilityScoreResult["readinessCategory"];
  if (overallScore >= 80) {
    readinessCategory = "ready_now";
  } else if (overallScore >= 60) {
    readinessCategory = "ready_6mo";
  } else if (overallScore >= 40) {
    readinessCategory = "ready_12mo";
  } else {
    readinessCategory = "develop";
  }

  // --- Recommendation ---
  const recommendations: Record<MobilityScoreResult["readinessCategory"], string> = {
    ready_now: "Candidate is well-suited for immediate transition. Recommend fast-track interview and onboarding.",
    ready_6mo: "Candidate shows strong potential with minor gaps. Recommend targeted skill development and reassessment in 6 months.",
    ready_12mo: "Candidate has foundational alignment but needs significant development. Create a structured 12-month development plan.",
    develop: "Candidate requires substantial development before being ready. Consider long-term development path with mentoring.",
  };

  return {
    overallScore,
    breakdown: factors,
    recommendation: recommendations[readinessCategory],
    readinessCategory,
  };
}

/**
 * Compute aspiration alignment score by checking if any aspirations
 * mention the target role title, department, or related keywords.
 */
function computeAspirationAlignment(
  aspirations: string[],
  target: MobilityTarget,
): number {
  if (aspirations.length === 0) {
    return 30; // Neutral score when aspirations are unknown
  }

  const targetKeywords = [
    target.title.toLowerCase(),
    target.department.toLowerCase(),
    ...target.title.toLowerCase().split(/\s+/),
    ...target.department.toLowerCase().split(/\s+/),
  ].filter((k) => k.length > 2);

  let matchCount = 0;
  let totalChecks = 0;

  for (const aspiration of aspirations) {
    const aspirationLower = aspiration.toLowerCase();
    for (const keyword of targetKeywords) {
      totalChecks++;
      if (aspirationLower.includes(keyword)) {
        matchCount++;
      }
    }
  }

  if (totalChecks === 0) {
    return 30;
  }

  const matchRatio = matchCount / totalChecks;

  // Scale: even a few keyword matches indicate interest
  if (matchRatio >= 0.3) return 95;
  if (matchRatio >= 0.2) return 85;
  if (matchRatio >= 0.1) return 70;
  if (matchRatio > 0) return 50;
  return 20;
}
