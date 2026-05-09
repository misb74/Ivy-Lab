import { getDatabase } from "../db/database.js";
import { analyzeBenchStrength, type BenchCandidate, type BenchStrengthResult } from "../engine/bench-analyzer.js";
import type { CandidateSkill, RoleRequirement } from "../engine/skill-matcher.js";

export interface TalentBenchStrengthInput {
  roleId: string;
  includeDepartments?: string[];
  excludeCurrentHolder?: boolean;
}

export type TalentBenchStrengthOutput = BenchStrengthResult;

/**
 * Analyze succession pipeline depth (bench strength) for a specific role.
 */
export function talentBenchStrength(input: TalentBenchStrengthInput): TalentBenchStrengthOutput {
  const db = getDatabase();

  // Fetch the role
  const role = db.prepare("SELECT * FROM open_roles WHERE id = ?").get(input.roleId) as Record<string, unknown> | undefined;

  if (!role) {
    throw new Error(`Role not found: ${input.roleId}`);
  }

  const requiredSkills: RoleRequirement[] = JSON.parse((role.required_skills as string) || "[]");
  const preferredSkills: RoleRequirement[] = JSON.parse((role.preferred_skills as string) || "[]");

  // Fetch candidate profiles
  let query = "SELECT * FROM talent_profiles";
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (input.includeDepartments && input.includeDepartments.length > 0) {
    const placeholders = input.includeDepartments.map(() => "?").join(", ");
    conditions.push(`department IN (${placeholders})`);
    params.push(...input.includeDepartments);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  const profiles = db.prepare(query).all(...params) as Record<string, unknown>[];

  const candidates: BenchCandidate[] = profiles.map((p) => ({
    id: p.id as string,
    name: p.name as string,
    currentRole: (p.current_role as string) || "",
    department: (p.department as string) || "",
    skills: JSON.parse((p.skills as string) || "[]") as CandidateSkill[],
    aspirations: JSON.parse((p.aspirations as string) || "[]") as string[],
    performanceRating: (p.performance_rating as number) || 3,
    tenureYears: (p.tenure_years as number) || 0,
  }));

  // Optionally exclude the current holder of the role (by matching title)
  const filteredCandidates = input.excludeCurrentHolder
    ? candidates.filter((c) => c.currentRole.toLowerCase() !== (role.title as string).toLowerCase())
    : candidates;

  return analyzeBenchStrength(
    input.roleId,
    role.title as string,
    (role.department as string) || "",
    requiredSkills,
    preferredSkills,
    filteredCandidates,
  );
}
