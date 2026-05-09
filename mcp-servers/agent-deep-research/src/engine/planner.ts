import type { ProjectContext, ResearchPlan, SubQuestion, ResearchDimension } from './types.js';
import { resolveCompanyJobsIntent } from './intent.js';

/** Standard research dimensions with default source mapping */
const DIMENSION_SOURCES: Record<ResearchDimension, string> = {
  current_state: 'skills_occupation',
  trends: 'labor_trends',
  comparative: 'all_workforce',
  expert_academic: 'academic_research',
  practical_implications: 'job_market',
  ai_impact: 'ai_impact',
  workforce_dynamics: 'labor_trends',
  company_jobs: 'company_jobs',
};

/** Domain-specific dimension expansions for workforce topics */
const WORKFORCE_PATTERNS: Array<{
  keywords: string[];
  dimensions: ResearchDimension[];
  extra_questions: (q: string, ctx: ProjectContext) => SubQuestion[];
}> = [
  {
    keywords: ['automation', 'ai risk', 'ai impact', 'ai exposure', 'replaced by ai'],
    dimensions: ['current_state', 'ai_impact', 'trends', 'practical_implications'],
    extra_questions: (q, ctx) => [
      {
        question: `What are the specific tasks of ${ctx.occupation_code ? `occupation ${ctx.occupation_code}` : 'this role'} most susceptible to AI automation?`,
        dimension: 'ai_impact',
        source_group: 'ai_impact',
        priority: 9,
        rationale: 'Task-level AI impact from AEI + Felten + WORKBank gives empirical automation risk',
      },
    ],
  },
  {
    keywords: ['skills', 'competencies', 'capabilities', 'upskill', 'reskill'],
    dimensions: ['current_state', 'trends', 'comparative'],
    extra_questions: (q, ctx) => [
      {
        question: `What are the trending and emerging skills for ${ctx.occupation_code ? `occupation ${ctx.occupation_code}` : 'this area'}?`,
        dimension: 'trends',
        source_group: 'skills_occupation',
        priority: 8,
        rationale: 'Lightcast + O*NET + ESCO provide comprehensive skills taxonomy data',
      },
    ],
  },
  {
    keywords: ['salary', 'compensation', 'pay', 'wage', 'earning'],
    dimensions: ['current_state', 'trends', 'comparative'],
    extra_questions: (q, ctx) => [
      {
        question: `What are the current wage benchmarks and compensation trends for this role${ctx.location ? ` in ${ctx.location}` : ''}?`,
        dimension: 'current_state',
        source_group: 'wages',
        priority: 9,
        rationale: 'BLS + Adzuna + Indeed wage data for statistical compensation analysis',
      },
    ],
  },
  {
    keywords: ['career', 'transition', 'path', 'mobility', 'progression'],
    dimensions: ['current_state', 'comparative', 'practical_implications'],
    extra_questions: (q, ctx) => [
      {
        question: `What are the most common career transitions and paths for this role?`,
        dimension: 'comparative',
        source_group: 'labor_trends',
        priority: 7,
        rationale: 'JobHop transition data + O*NET career changers for evidence-based paths',
      },
    ],
  },
  {
    keywords: ['demand', 'hiring', 'outlook', 'forecast', 'growth'],
    dimensions: ['current_state', 'trends', 'practical_implications'],
    extra_questions: () => [],
  },
];

/**
 * Decompose a research question into sub-questions with source group mapping.
 */
export function generatePlan(question: string, context: ProjectContext): ResearchPlan {
  const qLower = question.toLowerCase();
  const subQuestions: SubQuestion[] = [];
  const usedDimensions = new Set<ResearchDimension>();
  const companyJobsGate = resolveCompanyJobsIntent(question, context);

  if (companyJobsGate.enabled && (context.companies?.length || 0) > 0) {
    usedDimensions.add('company_jobs');
    subQuestions.push({
      question: `What do current first-party ATS job postings reveal about talent being built at ${context.companies!.join(' vs ')} for: ${context.ats_query || question}?`,
      dimension: 'company_jobs',
      source_group: 'company_jobs',
      priority: 10,
      rationale: `Company jobs lane enabled (${companyJobsGate.reason}); first-party ATS postings provide evidence of talent build.`,
    });
  }

  // Check for workforce-specific patterns
  for (const pattern of WORKFORCE_PATTERNS) {
    if (pattern.keywords.some((kw) => qLower.includes(kw))) {
      for (const dim of pattern.dimensions) {
        usedDimensions.add(dim);
      }
      subQuestions.push(...pattern.extra_questions(question, context));
    }
  }

  // Standard dimensions — always include current_state and at least one other
  const standardDimensions: Array<{ dim: ResearchDimension; question: (q: string, ctx: ProjectContext) => string; priority: number }> = [
    {
      dim: 'current_state',
      question: (q, ctx) =>
        `What is the current state of ${q}?${ctx.occupation_code ? ` (SOC: ${ctx.occupation_code})` : ''}`,
      priority: 9,
    },
    {
      dim: 'trends',
      question: (q) => `What are the recent trends and changes related to ${q}?`,
      priority: 7,
    },
    {
      dim: 'comparative',
      question: (q, ctx) =>
        `How does ${q} compare across different ${ctx.location ? 'locations' : 'contexts'}?`,
      priority: 6,
    },
    {
      dim: 'expert_academic',
      question: (q) => `What does current research and expert opinion say about ${q}?`,
      priority: 5,
    },
    {
      dim: 'practical_implications',
      question: (q) => `What are the practical implications and actionable insights for ${q}?`,
      priority: 4,
    },
  ];

  for (const std of standardDimensions) {
    if (!usedDimensions.has(std.dim)) {
      subQuestions.push({
        question: std.question(question, context),
        dimension: std.dim,
        source_group: DIMENSION_SOURCES[std.dim],
        priority: std.priority,
        rationale: `Standard ${std.dim} dimension for comprehensive analysis`,
      });
      usedDimensions.add(std.dim);
    }
  }

  // Deduplicate by question text
  const seen = new Set<string>();
  const unique = subQuestions.filter((sq) => {
    const key = sq.question.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by priority descending
  unique.sort((a, b) => b.priority - a.priority);

  return {
    sub_questions: unique,
    approach: buildApproachSummary(unique, context),
    estimated_threads: unique.length,
  };
}

function buildApproachSummary(subQuestions: SubQuestion[], context: ProjectContext): string {
  const groups = new Set(subQuestions.map((sq) => sq.source_group));
  const lines = [
    `Research plan with ${subQuestions.length} threads across ${groups.size} source groups.`,
    `Source groups: ${Array.from(groups).join(', ')}.`,
  ];
  if (context.hiring_intent) {
    lines.push(`Jobs lane: enabled (${context.jobs_lane_reason || 'intent detected'}).`);
    if (context.companies?.length) lines.push(`Company ATS targets: ${context.companies.join(', ')}.`);
  } else {
    lines.push(`Jobs lane: not run (${context.jobs_lane_reason || 'no hiring intent detected'}).`);
  }
  if (context.domain) lines.push(`Domain focus: ${context.domain}.`);
  if (context.location) lines.push(`Location context: ${context.location}.`);
  if (context.occupation_code) lines.push(`Occupation: ${context.occupation_code}.`);
  lines.push(`Threads ordered by priority (${subQuestions[0]?.priority} highest → ${subQuestions[subQuestions.length - 1]?.priority} lowest).`);
  return lines.join(' ');
}
