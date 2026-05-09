import type { JobRecord, TalentBuildInput } from './types.js';
import { getCompanyJobs } from './repository.js';
import { fetchJobAds, scanCompanyJobs } from './scanner.js';
import { matchesTerms, termsFromQuery } from './utils.js';

const SKILL_TERMS = [
  'artificial intelligence',
  'machine learning',
  'deep learning',
  'generative ai',
  'llm',
  'nlp',
  'computer vision',
  'python',
  'r',
  'sql',
  'spark',
  'databricks',
  'aws',
  'azure',
  'gcp',
  'kubernetes',
  'data science',
  'data engineering',
  'bioinformatics',
  'clinical',
  'oncology',
  'regulatory',
  'product management',
  'cybersecurity',
  'privacy',
  'mlops',
  'model governance',
  'prompt engineering',
  'knowledge graph',
  'statistics',
];

export async function analyzeTalentBuild(input: TalentBuildInput): Promise<Record<string, unknown>> {
  const maxJobs = input.max_jobs_per_company || 200;
  const queryTerms = termsFromQuery(input.query);
  const companies = [];

  for (const company of input.companies) {
    let refreshResult: Record<string, unknown> | null = null;
    if (input.refresh !== false) {
      refreshResult = await scanCompanyJobs({
        company_name: company,
        include_descriptions: Boolean(input.fetch_descriptions),
        search_terms: queryTerms,
        _ctx: input._ctx,
      });
    }

    if (input.fetch_descriptions) {
      await fetchJobAds({
        company_name: company,
        query: input.query,
        limit: Math.min(maxJobs, 50),
        _ctx: input._ctx,
      }).catch(() => null);
    }

    const { jobs } = await getCompanyJobs({
      company_name: company,
      active_only: true,
      limit: maxJobs,
      _ctx: input._ctx,
    });
    const relevantJobs = queryTerms.length > 0
      ? jobs.filter((job) => matchesTerms(job, queryTerms))
      : jobs;

    companies.push({
      company,
      refresh: refreshResult ? summarizeRefresh(refreshResult) : { skipped: true },
      active_jobs_total: jobs.length,
      relevant_jobs_count: relevantJobs.length,
      talent_build: summarizeCompanyTalent(company, relevantJobs),
      sample_jobs: relevantJobs.slice(0, 15).map((job) => ({
        title: job.title,
        location: job.location,
        department: job.department,
        seniority: job.seniority,
        url: job.url,
      })),
    });
  }

  return {
    query: input.query || null,
    companies,
    comparison: buildComparison(companies),
    data_source: 'agent-ats-scanner/Supabase ats_* tables',
    caveats: [
      'Phase 1 scans Group A public ATS feeds directly. Workday, Eightfold, Phenom, and other enterprise systems require later handlers.',
      'Talent-build analysis reflects public open roles, not filled roles or contractor/vendor work.',
    ],
  };
}

function summarizeRefresh(result: Record<string, unknown>): Record<string, unknown> {
  return {
    status: result.status,
    system: result.system,
    jobs_found: result.jobs_found,
    jobs_returned: result.jobs_returned,
    persistence: result.persistence,
    message: result.message,
  };
}

function summarizeCompanyTalent(company: string, jobs: JobRecord[]): Record<string, unknown> {
  const categoryCounts = countBy(jobs, categorizeJob);
  const locationCounts = countBy(jobs, (job) => clean(job.location) || 'Unknown');
  const departmentCounts = countBy(jobs, (job) => clean(job.department) || 'Unknown');
  const seniorityCounts = countBy(jobs, (job) => job.seniority || 'mid');
  const skillCounts = extractSkillCounts(jobs);

  const dominantCategory = firstEntry(categoryCounts)?.[0] || 'No clear pattern';
  const topLocations = topEntries(locationCounts, 5);
  const topSkills = topEntries(skillCounts, 12);
  const seniorShare = share(
    (seniorityCounts.senior || 0) + (seniorityCounts.leadership || 0),
    jobs.length,
  );

  return {
    summary: jobs.length === 0
      ? `${company}: no relevant active jobs found in persisted ATS data.`
      : `${company}: ${jobs.length} relevant active roles, led by ${dominantCategory}; ${seniorShare}% are senior or leadership roles.`,
    role_categories: categoryCounts,
    top_locations: topLocations,
    top_departments: topEntries(departmentCounts, 8),
    seniority_mix: seniorityCounts,
    senior_or_leadership_share_pct: seniorShare,
    top_skills: topSkills,
  };
}

function categorizeJob(job: JobRecord): string {
  const text = `${job.title} ${job.department || ''} ${job.description_text || ''}`.toLowerCase();
  if (/\b(ai|artificial intelligence|machine learning|ml\b|deep learning|llm|generative|nlp|computer vision|data scientist)\b/.test(text)) return 'AI / ML';
  if (/\b(data engineer|analytics|business intelligence|bi\b|data platform|data architect)\b/.test(text)) return 'Data / Analytics';
  if (/\b(software|engineer|developer|platform|cloud|devops|site reliability|sre)\b/.test(text)) return 'Software / Platform';
  if (/\b(product manager|product owner|program manager)\b/.test(text)) return 'Product / Program';
  if (/\b(clinical|medical|oncology|drug|trial|patient|pharma|bioinformatics|research scientist)\b/.test(text)) return 'Clinical / R&D';
  if (/\b(sales|commercial|marketing|customer|account)\b/.test(text)) return 'Commercial';
  if (/\b(security|privacy|risk|compliance|regulatory)\b/.test(text)) return 'Risk / Compliance';
  return 'Other';
}

function extractSkillCounts(jobs: JobRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const job of jobs) {
    const text = `${job.title} ${job.department || ''} ${job.description_text || ''}`.toLowerCase();
    for (const skill of SKILL_TERMS) {
      if (text.includes(skill)) counts[skill] = (counts[skill] || 0) + 1;
    }
  }
  return Object.fromEntries(topEntries(counts, SKILL_TERMS.length));
}

function countBy(jobs: JobRecord[], fn: (job: JobRecord) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const job of jobs) {
    const key = fn(job);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(topEntries(counts, 50));
}

function topEntries(counts: Record<string, number>, limit: number): Array<[string, number]> {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function firstEntry(counts: Record<string, number>): [string, number] | undefined {
  return topEntries(counts, 1)[0];
}

function clean(value?: string | null): string | null {
  const v = value?.trim();
  return v || null;
}

function share(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

function buildComparison(companies: Array<Record<string, any>>): string[] {
  const lines: string[] = [];
  const ranked = [...companies].sort((a, b) => (b.relevant_jobs_count || 0) - (a.relevant_jobs_count || 0));
  if (ranked.length >= 2) {
    lines.push(`${ranked[0].company} currently shows the strongest relevant hiring signal by open-role count (${ranked[0].relevant_jobs_count} vs ${ranked[1].relevant_jobs_count}).`);
  }
  for (const company of ranked) {
    const topCategory = firstEntry(company.talent_build?.role_categories || {})?.[0];
    if (topCategory) lines.push(`${company.company}: dominant hiring category is ${topCategory}.`);
  }
  return lines;
}
