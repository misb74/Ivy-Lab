import { matchSkills, type CandidateSkill, type RoleRequirement, type SkillBreakdown } from "./skill-matcher.js";

export interface LearningResource {
  type: "course" | "mentoring" | "project" | "certification" | "workshop" | "reading";
  title: string;
  description: string;
  estimatedHours: number;
}

export interface Milestone {
  title: string;
  description: string;
  criteria: string;
}

export interface DevelopmentPhase {
  phase: number;
  name: string;
  durationMonths: number;
  skills: string[];
  learningResources: LearningResource[];
  milestones: Milestone[];
}

export interface DevelopmentPlanResult {
  profileId: string;
  targetRole: string;
  currentMatchScore: number;
  skillGaps: SkillGap[];
  phases: DevelopmentPhase[];
  estimatedTotalMonths: number;
  summary: string;
}

export interface SkillGap {
  skill: string;
  currentLevel: number;
  requiredWeight: number;
  gapSeverity: "critical" | "moderate" | "minor";
  priority: number; // 1 = highest
}

/**
 * Identify skill gaps between a candidate's current profile and a target role,
 * then generate a phased development plan (foundation, growth, mastery).
 */
export function generateDevelopmentPlan(
  profileId: string,
  targetRole: string,
  candidateSkills: CandidateSkill[],
  requiredSkills: RoleRequirement[],
  preferredSkills: RoleRequirement[],
): DevelopmentPlanResult {
  // Compute current match
  const allRequirements = [
    ...requiredSkills,
    ...preferredSkills.map((s) => ({ ...s, weight: s.weight * 0.5 })),
  ];

  const matchResult = matchSkills(candidateSkills, allRequirements);

  // Identify and prioritize skill gaps
  const skillGaps = identifySkillGaps(matchResult.breakdown, requiredSkills);

  // Generate phased plan
  const phases = buildPhases(skillGaps, requiredSkills, preferredSkills);

  const estimatedTotalMonths = phases.reduce((sum, p) => sum + p.durationMonths, 0);

  const criticalGaps = skillGaps.filter((g) => g.gapSeverity === "critical").length;
  const moderateGaps = skillGaps.filter((g) => g.gapSeverity === "moderate").length;

  const summary = `Development plan targets ${skillGaps.length} skill gap${skillGaps.length !== 1 ? "s" : ""} (${criticalGaps} critical, ${moderateGaps} moderate) across ${phases.length} phases over approximately ${estimatedTotalMonths} months. Current match score: ${matchResult.overallScore}/100.`;

  return {
    profileId,
    targetRole,
    currentMatchScore: matchResult.overallScore,
    skillGaps,
    phases,
    estimatedTotalMonths,
    summary,
  };
}

function identifySkillGaps(
  breakdown: SkillBreakdown[],
  requiredSkills: RoleRequirement[],
): SkillGap[] {
  const requiredSet = new Set(requiredSkills.map((s) => s.name.toLowerCase()));
  const gaps: SkillGap[] = [];

  for (const item of breakdown) {
    if (item.status === "exceeded" || item.status === "met") {
      continue;
    }

    const isRequired = requiredSet.has(item.skill.toLowerCase());
    let gapSeverity: SkillGap["gapSeverity"];

    if (item.status === "missing" && isRequired) {
      gapSeverity = "critical";
    } else if (item.status === "missing" || (item.status === "partial" && isRequired)) {
      gapSeverity = "moderate";
    } else {
      gapSeverity = "minor";
    }

    const priorityMap = { critical: 1, moderate: 2, minor: 3 };

    gaps.push({
      skill: item.skill,
      currentLevel: item.candidateLevel,
      requiredWeight: item.requiredWeight,
      gapSeverity,
      priority: priorityMap[gapSeverity],
    });
  }

  // Sort by priority (critical first), then by required weight descending
  gaps.sort((a, b) => a.priority - b.priority || b.requiredWeight - a.requiredWeight);

  return gaps;
}

function buildPhases(
  skillGaps: SkillGap[],
  requiredSkills: RoleRequirement[],
  preferredSkills: RoleRequirement[],
): DevelopmentPhase[] {
  if (skillGaps.length === 0) {
    return [
      {
        phase: 1,
        name: "Mastery",
        durationMonths: 2,
        skills: [],
        learningResources: [
          {
            type: "mentoring",
            title: "Role shadowing",
            description: "Shadow current role holders to learn organizational context and nuances.",
            estimatedHours: 20,
          },
        ],
        milestones: [
          {
            title: "Role transition readiness",
            description: "Complete all onboarding prerequisites.",
            criteria: "Sign-off from hiring manager and current manager.",
          },
        ],
      },
    ];
  }

  const criticalGaps = skillGaps.filter((g) => g.gapSeverity === "critical");
  const moderateGaps = skillGaps.filter((g) => g.gapSeverity === "moderate");
  const minorGaps = skillGaps.filter((g) => g.gapSeverity === "minor");

  const phases: DevelopmentPhase[] = [];

  // --- Phase 1: Foundation (3 months) ---
  const foundationSkills = criticalGaps.length > 0
    ? criticalGaps.map((g) => g.skill)
    : moderateGaps.slice(0, Math.ceil(moderateGaps.length / 2)).map((g) => g.skill);

  phases.push({
    phase: 1,
    name: "Foundation",
    durationMonths: 3,
    skills: foundationSkills,
    learningResources: foundationSkills.flatMap((skill) => generateResources(skill, "foundation")),
    milestones: [
      {
        title: "Foundational assessment",
        description: `Demonstrate baseline competency in: ${foundationSkills.join(", ")}.`,
        criteria: "Pass skills assessment with minimum 60% proficiency.",
      },
      {
        title: "Learning path completion",
        description: "Complete all assigned foundation-level courses and exercises.",
        criteria: "All foundation learning resources marked complete with evidence.",
      },
    ],
  });

  // --- Phase 2: Growth (4 months) ---
  const growthSkills = [
    ...moderateGaps.filter((g) => !foundationSkills.includes(g.skill)).map((g) => g.skill),
    ...minorGaps.slice(0, Math.ceil(minorGaps.length / 2)).map((g) => g.skill),
  ];

  if (growthSkills.length === 0 && foundationSkills.length > 0) {
    // Deepen foundation skills in growth phase
    growthSkills.push(...foundationSkills);
  }

  phases.push({
    phase: 2,
    name: "Growth",
    durationMonths: 4,
    skills: growthSkills,
    learningResources: growthSkills.flatMap((skill) => generateResources(skill, "growth")),
    milestones: [
      {
        title: "Intermediate proficiency",
        description: `Achieve intermediate level in: ${growthSkills.join(", ")}.`,
        criteria: "Pass skills assessment with minimum 75% proficiency.",
      },
      {
        title: "Applied project completion",
        description: "Complete a hands-on project applying growth-phase skills.",
        criteria: "Project reviewed and approved by mentor or subject-matter expert.",
      },
    ],
  });

  // --- Phase 3: Mastery (3 months) ---
  const masterySkills = [
    ...minorGaps.filter((g) => !growthSkills.includes(g.skill)).map((g) => g.skill),
    ...foundationSkills.slice(0, 2), // Revisit top critical skills at mastery level
  ];

  phases.push({
    phase: 3,
    name: "Mastery",
    durationMonths: 3,
    skills: masterySkills.length > 0 ? masterySkills : foundationSkills,
    learningResources: (masterySkills.length > 0 ? masterySkills : foundationSkills).flatMap(
      (skill) => generateResources(skill, "mastery"),
    ),
    milestones: [
      {
        title: "Advanced competency demonstration",
        description: "Demonstrate advanced proficiency through a capstone deliverable.",
        criteria: "Capstone reviewed by leadership panel with passing score.",
      },
      {
        title: "Role readiness certification",
        description: "Formal sign-off that candidate is ready for the target role transition.",
        criteria: "Approval from hiring manager, current manager, and HR business partner.",
      },
    ],
  });

  return phases;
}

function generateResources(skill: string, phase: "foundation" | "growth" | "mastery"): LearningResource[] {
  const resources: Record<string, LearningResource[]> = {
    foundation: [
      {
        type: "course",
        title: `${skill} Fundamentals`,
        description: `Comprehensive introductory course covering core concepts of ${skill}.`,
        estimatedHours: 20,
      },
      {
        type: "reading",
        title: `${skill} Reference Guide`,
        description: `Curated reading materials and documentation for building foundational knowledge in ${skill}.`,
        estimatedHours: 8,
      },
      {
        type: "mentoring",
        title: `${skill} Mentor Pairing`,
        description: `Weekly 1:1 sessions with a ${skill} subject-matter expert.`,
        estimatedHours: 12,
      },
    ],
    growth: [
      {
        type: "project",
        title: `${skill} Applied Project`,
        description: `Hands-on project to apply ${skill} in a real-world context within the organization.`,
        estimatedHours: 30,
      },
      {
        type: "workshop",
        title: `${skill} Intermediate Workshop`,
        description: `Interactive workshop focusing on intermediate patterns and best practices for ${skill}.`,
        estimatedHours: 16,
      },
      {
        type: "mentoring",
        title: `${skill} Peer Learning Group`,
        description: `Bi-weekly peer group sessions to share experiences and solve challenges related to ${skill}.`,
        estimatedHours: 10,
      },
    ],
    mastery: [
      {
        type: "certification",
        title: `${skill} Advanced Certification`,
        description: `Industry-recognized certification validating advanced proficiency in ${skill}.`,
        estimatedHours: 40,
      },
      {
        type: "project",
        title: `${skill} Leadership Initiative`,
        description: `Lead a cross-functional initiative that showcases mastery of ${skill} and organizational impact.`,
        estimatedHours: 50,
      },
      {
        type: "mentoring",
        title: `${skill} Reverse Mentoring`,
        description: `Mentor others in ${skill} to solidify expertise and demonstrate mastery.`,
        estimatedHours: 15,
      },
    ],
  };

  return resources[phase];
}
