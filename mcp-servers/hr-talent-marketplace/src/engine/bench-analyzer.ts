import { matchSkills, type CandidateSkill, type RoleRequirement } from "./skill-matcher.js";
import { calculateMobilityScore, type MobilityProfile, type MobilityTarget } from "./mobility-scorer.js";

export interface BenchCandidate {
  id: string;
  name: string;
  currentRole: string;
  department: string;
  skills: CandidateSkill[];
  aspirations: string[];
  performanceRating: number;
  tenureYears: number;
}

export interface BenchCandidateResult {
  id: string;
  name: string;
  currentRole: string;
  department: string;
  readinessCategory: "ready_now" | "ready_6mo" | "ready_12mo" | "develop";
  mobilityScore: number;
  skillMatchScore: number;
  keyStrengths: string[];
  developmentNeeds: string[];
}

export interface BenchStrengthResult {
  roleId: string;
  roleTitle: string;
  totalCandidates: number;
  readyNow: BenchCandidateResult[];
  ready6Mo: BenchCandidateResult[];
  ready12Mo: BenchCandidateResult[];
  develop: BenchCandidateResult[];
  benchStrengthRating: "strong" | "adequate" | "weak" | "critical";
  summary: string;
  riskFactors: string[];
}

/**
 * Analyze bench strength (succession pipeline depth) for a specific role.
 * Categorizes candidates into readiness buckets based on their mobility score
 * and skill match assessment.
 */
export function analyzeBenchStrength(
  roleId: string,
  roleTitle: string,
  roleDepartment: string,
  requiredSkills: RoleRequirement[],
  preferredSkills: RoleRequirement[],
  candidates: BenchCandidate[],
): BenchStrengthResult {
  const target: MobilityTarget = {
    title: roleTitle,
    department: roleDepartment,
    requiredSkills,
    preferredSkills,
  };

  const categorized: Record<string, BenchCandidateResult[]> = {
    ready_now: [],
    ready_6mo: [],
    ready_12mo: [],
    develop: [],
  };

  for (const candidate of candidates) {
    const profile: MobilityProfile = {
      skills: candidate.skills,
      aspirations: candidate.aspirations,
      performanceRating: candidate.performanceRating,
      tenureYears: candidate.tenureYears,
    };

    const mobilityResult = calculateMobilityScore(profile, target);
    const skillMatch = matchSkills(candidate.skills, requiredSkills);

    const result: BenchCandidateResult = {
      id: candidate.id,
      name: candidate.name,
      currentRole: candidate.currentRole,
      department: candidate.department,
      readinessCategory: mobilityResult.readinessCategory,
      mobilityScore: mobilityResult.overallScore,
      skillMatchScore: skillMatch.overallScore,
      keyStrengths: skillMatch.strongMatches,
      developmentNeeds: skillMatch.gaps,
    };

    categorized[mobilityResult.readinessCategory].push(result);
  }

  // Sort each category by mobility score descending
  for (const category of Object.values(categorized)) {
    category.sort((a, b) => b.mobilityScore - a.mobilityScore);
  }

  // Determine bench strength rating
  const readyNowCount = categorized.ready_now.length;
  const readySoonCount = categorized.ready_6mo.length;
  const totalAssessed = candidates.length;

  let benchStrengthRating: BenchStrengthResult["benchStrengthRating"];
  if (readyNowCount >= 3 || (readyNowCount >= 2 && readySoonCount >= 2)) {
    benchStrengthRating = "strong";
  } else if (readyNowCount >= 1 && readySoonCount >= 1) {
    benchStrengthRating = "adequate";
  } else if (readyNowCount >= 1 || readySoonCount >= 2) {
    benchStrengthRating = "weak";
  } else {
    benchStrengthRating = "critical";
  }

  // Identify risk factors
  const riskFactors: string[] = [];
  if (readyNowCount === 0) {
    riskFactors.push("No candidates are immediately ready for the role.");
  }
  if (readyNowCount === 1) {
    riskFactors.push("Single point of failure: only one candidate is ready now.");
  }
  if (readySoonCount === 0 && readyNowCount < 2) {
    riskFactors.push("Thin near-term pipeline: no candidates ready within 6 months.");
  }
  if (totalAssessed < 3) {
    riskFactors.push("Very small candidate pool assessed.");
  }
  if (categorized.develop.length > totalAssessed * 0.6 && totalAssessed > 0) {
    riskFactors.push("Majority of candidates require significant development.");
  }

  const summary = `Bench strength for "${roleTitle}" is ${benchStrengthRating}. ${readyNowCount} candidate${readyNowCount !== 1 ? "s" : ""} ready now, ${readySoonCount} ready in 6 months, ${categorized.ready_12mo.length} in 12 months, ${categorized.develop.length} in development pipeline. ${totalAssessed} total candidates assessed.`;

  return {
    roleId,
    roleTitle,
    totalCandidates: totalAssessed,
    readyNow: categorized.ready_now,
    ready6Mo: categorized.ready_6mo,
    ready12Mo: categorized.ready_12mo,
    develop: categorized.develop,
    benchStrengthRating,
    summary,
    riskFactors,
  };
}
