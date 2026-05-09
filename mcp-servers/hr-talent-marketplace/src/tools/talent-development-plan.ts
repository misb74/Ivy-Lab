import { getDatabase } from "../db/database.js";
import { generateDevelopmentPlan, type DevelopmentPlanResult } from "../engine/development-planner.js";
import type { CandidateSkill, RoleRequirement } from "../engine/skill-matcher.js";
import crypto from "node:crypto";

export interface TalentDevelopmentPlanInput {
  profileId: string;
  targetRoleId: string;
  savePlan?: boolean;
}

export interface TalentDevelopmentPlanOutput extends DevelopmentPlanResult {
  planId: string | null;
  saved: boolean;
}

/**
 * Generate a personalized development plan for a profile-to-target-role transition.
 * Optionally persists the plan to the database.
 */
export function talentDevelopmentPlan(input: TalentDevelopmentPlanInput): TalentDevelopmentPlanOutput {
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

  const candidateSkills: CandidateSkill[] = JSON.parse((profile.skills as string) || "[]");
  const requiredSkills: RoleRequirement[] = JSON.parse((role.required_skills as string) || "[]");
  const preferredSkills: RoleRequirement[] = JSON.parse((role.preferred_skills as string) || "[]");

  const plan = generateDevelopmentPlan(
    input.profileId,
    role.title as string,
    candidateSkills,
    requiredSkills,
    preferredSkills,
  );

  let planId: string | null = null;
  let saved = false;

  if (input.savePlan) {
    planId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO development_plans (id, profile_id, target_role, phases, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    ).run(planId, input.profileId, role.title as string, JSON.stringify(plan.phases), now, now);

    saved = true;
  }

  return {
    ...plan,
    planId,
    saved,
  };
}
