import { getDatabase } from "../db/database.js";
import { calculateMobilityScore, type MobilityProfile, type MobilityTarget } from "../engine/mobility-scorer.js";
import type { CandidateSkill } from "../engine/skill-matcher.js";
import type { RoleRequirement } from "../engine/skill-matcher.js";

export interface TalentMobilityScoreInput {
  profileId: string;
  targetRoleId: string;
}

export interface TalentMobilityScoreOutput {
  profileId: string;
  profileName: string;
  targetRoleId: string;
  targetRoleTitle: string;
  overallScore: number;
  readinessCategory: string;
  recommendation: string;
  breakdown: Array<{
    factor: string;
    weight: number;
    rawScore: number;
    weightedScore: number;
    rationale: string;
  }>;
}

/**
 * Calculate mobility score for a specific profile toward a target role.
 */
export function talentMobilityScore(input: TalentMobilityScoreInput): TalentMobilityScoreOutput {
  const db = getDatabase();

  // Fetch the profile
  const profile = db.prepare("SELECT * FROM talent_profiles WHERE id = ?").get(input.profileId) as Record<string, unknown> | undefined;

  if (!profile) {
    throw new Error(`Profile not found: ${input.profileId}`);
  }

  // Fetch the target role
  const role = db.prepare("SELECT * FROM open_roles WHERE id = ?").get(input.targetRoleId) as Record<string, unknown> | undefined;

  if (!role) {
    throw new Error(`Role not found: ${input.targetRoleId}`);
  }

  const skills: CandidateSkill[] = JSON.parse((profile.skills as string) || "[]");
  const aspirations: string[] = JSON.parse((profile.aspirations as string) || "[]");

  const mobilityProfile: MobilityProfile = {
    skills,
    aspirations,
    performanceRating: (profile.performance_rating as number) || 3,
    tenureYears: (profile.tenure_years as number) || 0,
  };

  const requiredSkills: RoleRequirement[] = JSON.parse((role.required_skills as string) || "[]");
  const preferredSkills: RoleRequirement[] = JSON.parse((role.preferred_skills as string) || "[]");

  const target: MobilityTarget = {
    title: role.title as string,
    department: (role.department as string) || "",
    requiredSkills,
    preferredSkills,
  };

  const result = calculateMobilityScore(mobilityProfile, target);

  return {
    profileId: input.profileId,
    profileName: profile.name as string,
    targetRoleId: input.targetRoleId,
    targetRoleTitle: role.title as string,
    overallScore: result.overallScore,
    readinessCategory: result.readinessCategory,
    recommendation: result.recommendation,
    breakdown: result.breakdown,
  };
}
