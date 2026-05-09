import { getDatabase } from "../db/database.js";
import { matchSkills, type CandidateSkill, type RoleRequirement } from "../engine/skill-matcher.js";
import { calculateMobilityScore, type MobilityProfile, type MobilityTarget } from "../engine/mobility-scorer.js";

export interface TalentMatchInput {
  roleId: string;
  limit?: number;
  minScore?: number;
  departmentFilter?: string;
}

export interface MatchedCandidate {
  profileId: string;
  name: string;
  currentRole: string;
  department: string;
  fitScore: number;
  skillMatchScore: number;
  mobilityScore: number;
  readinessCategory: string;
  strengths: string[];
  gaps: string[];
}

export interface TalentMatchOutput {
  roleId: string;
  roleTitle: string;
  totalCandidatesEvaluated: number;
  matches: MatchedCandidate[];
}

/**
 * Match internal candidates to an open role, ranked by composite fit score.
 */
export function talentMatchInternal(input: TalentMatchInput): TalentMatchOutput {
  const db = getDatabase();

  // Fetch the target role
  const role = db.prepare("SELECT * FROM open_roles WHERE id = ?").get(input.roleId) as Record<string, unknown> | undefined;

  if (!role) {
    throw new Error(`Role not found: ${input.roleId}`);
  }

  const requiredSkills: RoleRequirement[] = JSON.parse((role.required_skills as string) || "[]");
  const preferredSkills: RoleRequirement[] = JSON.parse((role.preferred_skills as string) || "[]");

  const target: MobilityTarget = {
    title: role.title as string,
    department: role.department as string || "",
    requiredSkills,
    preferredSkills,
  };

  // Fetch candidates
  let query = "SELECT * FROM talent_profiles";
  const params: unknown[] = [];

  if (input.departmentFilter) {
    query += " WHERE department = ?";
    params.push(input.departmentFilter);
  }

  const profiles = db.prepare(query).all(...params) as Record<string, unknown>[];

  const matches: MatchedCandidate[] = [];

  for (const profile of profiles) {
    const skills: CandidateSkill[] = JSON.parse((profile.skills as string) || "[]");
    const aspirations: string[] = JSON.parse((profile.aspirations as string) || "[]");

    const mobilityProfile: MobilityProfile = {
      skills,
      aspirations,
      performanceRating: (profile.performance_rating as number) || 3,
      tenureYears: (profile.tenure_years as number) || 0,
    };

    const mobilityResult = calculateMobilityScore(mobilityProfile, target);
    const skillMatch = matchSkills(skills, requiredSkills);

    // Composite fit score: weighted blend of mobility score and skill match
    const fitScore = Math.round(mobilityResult.overallScore * 0.6 + skillMatch.overallScore * 0.4);

    const minScore = input.minScore ?? 0;
    if (fitScore < minScore) {
      continue;
    }

    matches.push({
      profileId: profile.id as string,
      name: profile.name as string,
      currentRole: (profile.current_role as string) || "",
      department: (profile.department as string) || "",
      fitScore,
      skillMatchScore: skillMatch.overallScore,
      mobilityScore: mobilityResult.overallScore,
      readinessCategory: mobilityResult.readinessCategory,
      strengths: skillMatch.strongMatches,
      gaps: skillMatch.gaps,
    });
  }

  // Sort by fit score descending
  matches.sort((a, b) => b.fitScore - a.fitScore);

  // Apply limit
  const limit = input.limit ?? 10;
  const topMatches = matches.slice(0, limit);

  return {
    roleId: input.roleId,
    roleTitle: role.title as string,
    totalCandidatesEvaluated: profiles.length,
    matches: topMatches,
  };
}
