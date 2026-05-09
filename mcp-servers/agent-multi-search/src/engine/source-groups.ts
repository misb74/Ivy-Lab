import { SourceGroupDef, SourceToolDef, SearchContext } from './types.js';

// ── Source tool definitions ──

const adzunaJobs: SourceToolDef = {
  tool_name: 'adzuna_search_jobs',
  server_name: 'data-adzuna',
  result_type: 'job_posting',
  reliability_weight: 0.7,
  param_builder: (query, ctx) => ({
    company: query,
    location: ctx.location,
    country: ctx.country || 'gb',
    max_results: 20,
  }),
};

const adzunaSalary: SourceToolDef = {
  tool_name: 'adzuna_salary_data',
  server_name: 'data-adzuna',
  result_type: 'salary',
  reliability_weight: 0.7,
  param_builder: (query, ctx) => ({
    company: query,
    role: ctx.occupation,
    country: ctx.country || 'us',
  }),
};

const blsWages: SourceToolDef = {
  tool_name: 'bls_occupation_wages',
  server_name: 'data-bls',
  result_type: 'wage_statistic',
  reliability_weight: 0.9,
  param_builder: (query, ctx) => ({
    occupation_code: ctx.occupation_code || query,
    location: ctx.location,
  }),
};

const blsWageComparison: SourceToolDef = {
  tool_name: 'bls_wage_comparison',
  server_name: 'data-bls',
  result_type: 'wage_statistic',
  reliability_weight: 0.9,
  param_builder: (query, ctx) => ({
    occupation_code: ctx.occupation_code || query,
    locations: ctx.location ? [ctx.location] : ['national'],
  }),
};

const blsTrend: SourceToolDef = {
  tool_name: 'bls_employment_trend',
  server_name: 'data-bls',
  result_type: 'trend',
  reliability_weight: 0.9,
  param_builder: (query, ctx) => ({
    occupation_code: ctx.occupation_code || query,
    location: ctx.location,
    years: 5,
  }),
};

const lightcastSkills: SourceToolDef = {
  tool_name: 'lightcast_search_skills',
  server_name: 'data-lightcast',
  result_type: 'skill',
  reliability_weight: 0.85,
  param_builder: (query) => ({
    query,
    limit: 20,
  }),
};

const lightcastTrending: SourceToolDef = {
  tool_name: 'lightcast_trending_skills',
  server_name: 'data-lightcast',
  result_type: 'skill',
  reliability_weight: 0.85,
  param_builder: (query, ctx) => ({
    occupation_code: ctx.occupation_code,
    location: ctx.location,
    limit: 20,
    country: ctx.country,
  }),
};

const lightcastDemand: SourceToolDef = {
  tool_name: 'lightcast_demand_forecast',
  server_name: 'data-lightcast',
  result_type: 'trend',
  reliability_weight: 0.85,
  param_builder: (query, ctx) => ({
    occupation_code: ctx.occupation_code || query,
    location: ctx.location,
    country: ctx.country,
  }),
};

const onetSearch: SourceToolDef = {
  tool_name: 'onet_search_occupations',
  server_name: 'data-onet',
  result_type: 'occupation',
  reliability_weight: 0.9,
  param_builder: (query) => ({
    keyword: query,
    limit: 10,
  }),
};

const onetDetails: SourceToolDef = {
  tool_name: 'onet_get_occupation_details',
  server_name: 'data-onet',
  result_type: 'occupation',
  reliability_weight: 0.9,
  param_builder: (query, ctx) => ({
    code: ctx.occupation_code || query,
  }),
};

const escoOccupations: SourceToolDef = {
  tool_name: 'esco_search_occupations',
  server_name: 'data-esco',
  result_type: 'occupation',
  reliability_weight: 0.8,
  param_builder: (query) => ({
    query,
    limit: 10,
  }),
};

const escoSkills: SourceToolDef = {
  tool_name: 'esco_search_skills',
  server_name: 'data-esco',
  result_type: 'skill',
  reliability_weight: 0.8,
  param_builder: (query) => ({
    query,
    limit: 20,
  }),
};

const quickResearch: SourceToolDef = {
  tool_name: 'quick_research',
  server_name: 'agent-research',
  result_type: 'research_finding',
  reliability_weight: 0.5,
  param_builder: (query) => ({
    query,
  }),
};

const scholarlySearch: SourceToolDef = {
  tool_name: 'scholarly_search',
  server_name: 'agent-research',
  result_type: 'research_finding',
  reliability_weight: 0.75,
  param_builder: (query) => ({
    query,
    num_results: 10,
  }),
};

const pdlSearch: SourceToolDef = {
  tool_name: 'talent_search_profiles',
  server_name: 'agent-talent-sourcer',
  result_type: 'person',
  reliability_weight: 0.8,
  param_builder: (query, ctx) => ({
    job_titles: [query],
    locations: ctx.location ? [ctx.location] : [],
    max_results: 15,
  }),
};

const indeedTrend: SourceToolDef = {
  tool_name: 'indeed_job_postings_trend',
  server_name: 'data-indeed',
  result_type: 'trend',
  reliability_weight: 0.8,
  param_builder: (query, ctx) => ({
    country: ctx.country || 'US',
    sector: query,
    months: 24,
  }),
};

const indeedWage: SourceToolDef = {
  tool_name: 'indeed_wage_tracker',
  server_name: 'data-indeed',
  result_type: 'wage_statistic',
  reliability_weight: 0.75,
  param_builder: (query) => ({
    sector: query,
    months: 12,
  }),
};

const aeiExposure: SourceToolDef = {
  tool_name: 'aei_job_exposure',
  server_name: 'data-anthropic-econ-index',
  result_type: 'statistic',
  reliability_weight: 0.85,
  param_builder: (query, ctx) => ({
    occupation_code: ctx.occupation_code,
    query: ctx.occupation_code ? undefined : query,
    limit: 10,
  }),
};

const feltenAioe: SourceToolDef = {
  tool_name: 'aioe_occupation_exposure',
  server_name: 'data-felten-aioe',
  result_type: 'statistic',
  reliability_weight: 0.8,
  param_builder: (query, ctx) => ({
    occupation_code: ctx.occupation_code,
    query: ctx.occupation_code ? undefined : query,
  }),
};

const workbankAutomation: SourceToolDef = {
  tool_name: 'workbank_occupation_automation',
  server_name: 'data-workbank',
  result_type: 'statistic',
  reliability_weight: 0.85,
  param_builder: (query, ctx) => ({
    occupation_code: ctx.occupation_code || query,
  }),
};

const revelioStats: SourceToolDef = {
  tool_name: 'revelio_labor_stats',
  server_name: 'data-revelio',
  result_type: 'statistic',
  reliability_weight: 0.75,
  param_builder: () => ({}),
};

const revelioHiring: SourceToolDef = {
  tool_name: 'revelio_hiring_trends',
  server_name: 'data-revelio',
  result_type: 'trend',
  reliability_weight: 0.75,
  param_builder: () => ({
    months: 12,
  }),
};

const fredLabor: SourceToolDef = {
  tool_name: 'fred_labor_dashboard',
  server_name: 'data-fred',
  result_type: 'statistic',
  reliability_weight: 0.9,
  param_builder: () => ({}),
};

const jobhopTransition: SourceToolDef = {
  tool_name: 'jobhop_transition_probability',
  server_name: 'data-jobhop',
  result_type: 'statistic',
  reliability_weight: 0.7,
  param_builder: (query) => ({
    from_occupation: query,
    limit: 10,
  }),
};

// ── Labor Market tools ──

const laborMarketPostings: SourceToolDef = {
  tool_name: 'labor_market_job_postings',
  server_name: 'data-labor-market',
  result_type: 'trend',
  reliability_weight: 0.85,
  param_builder: (query, ctx) => ({
    country: ctx.country || 'US',
    sector: query,
    date_from: undefined,
    date_to: undefined,
  }),
};

const laborMarketWages: SourceToolDef = {
  tool_name: 'labor_market_wages',
  server_name: 'data-labor-market',
  result_type: 'wage_statistic',
  reliability_weight: 0.8,
  param_builder: (query, ctx) => ({
    country: ctx.country || 'US',
    sector: query,
  }),
};

const laborMarketAi: SourceToolDef = {
  tool_name: 'labor_market_ai_demand',
  server_name: 'data-labor-market',
  result_type: 'trend',
  reliability_weight: 0.85,
  param_builder: (query, ctx) => ({
    country: ctx.country || 'US',
  }),
};

const laborMarketRemote: SourceToolDef = {
  tool_name: 'labor_market_remote',
  server_name: 'data-labor-market',
  result_type: 'trend',
  reliability_weight: 0.8,
  param_builder: (query, ctx) => ({
    country: ctx.country || 'US',
    sector: query,
    include_searches: true,
  }),
};

const laborMarketPayTransparency: SourceToolDef = {
  tool_name: 'labor_market_pay_transparency',
  server_name: 'data-labor-market',
  result_type: 'statistic',
  reliability_weight: 0.8,
  param_builder: (query, ctx) => ({
    country: ctx.country || 'US',
    sector: query,
  }),
};

const laborMarketAcademic: SourceToolDef = {
  tool_name: 'labor_market_academic',
  server_name: 'data-labor-market',
  result_type: 'statistic',
  reliability_weight: 0.85,
  param_builder: (query) => ({
    dataset: 'geographic_risk',
    metro: query,
  }),
};

const researchIndexSearch: SourceToolDef = {
  tool_name: 'research_index_search',
  server_name: 'data-research-index',
  result_type: 'research_finding',
  reliability_weight: 0.8,
  param_builder: (query) => ({
    query,
    limit: 10,
  }),
};

// ── Source groups ──

export const SOURCE_GROUPS: Record<string, SourceGroupDef> = {
  job_market: {
    name: 'job_market',
    description: 'Job postings, hiring demand, and market trends (Adzuna + Indeed + Lightcast + Labor Market)',
    tools: [adzunaJobs, indeedTrend, lightcastDemand, laborMarketPostings, laborMarketAi],
  },

  talent: {
    name: 'talent',
    description: 'People search across PDL and Apollo (parallel, not fallback)',
    tools: [pdlSearch],
  },

  skills_occupation: {
    name: 'skills_occupation',
    description: 'Skills taxonomies and occupation data (Lightcast + O*NET + ESCO)',
    tools: [lightcastSkills, lightcastTrending, onetSearch, onetDetails, escoOccupations, escoSkills],
  },

  web: {
    name: 'web',
    description: 'Web research and academic papers (DuckDuckGo + Semantic Scholar)',
    tools: [quickResearch, scholarlySearch],
  },

  wages: {
    name: 'wages',
    description: 'Compensation and wage data (BLS + Adzuna salary + Indeed wage tracker + Labor Market)',
    tools: [blsWages, blsWageComparison, adzunaSalary, indeedWage, laborMarketWages, laborMarketPayTransparency],
  },

  ai_impact: {
    name: 'ai_impact',
    description: 'AI automation and exposure indices (AEI + Felten AIOE + WORKBank + Labor Market + Research Index)',
    tools: [aeiExposure, feltenAioe, workbankAutomation, laborMarketAi, researchIndexSearch],
  },

  labor_trends: {
    name: 'labor_trends',
    description: 'Macro labor market trends (BLS + Indeed + FRED + Revelio + JobHop + Labor Market)',
    tools: [blsTrend, indeedTrend, fredLabor, revelioStats, revelioHiring, jobhopTransition, laborMarketPostings, laborMarketWages, laborMarketRemote],
  },

  all_workforce: {
    name: 'all_workforce',
    description: 'Comprehensive workforce data: jobs + skills + wages + Labor Market combined',
    tools: [
      // job_market
      adzunaJobs, indeedTrend, lightcastDemand,
      // skills_occupation
      lightcastSkills, onetSearch, escoOccupations,
      // wages
      blsWages, adzunaSalary, indeedWage,
      // labor market
      laborMarketPostings, laborMarketWages, laborMarketAi, laborMarketRemote,
    ],
  },

  academic_research: {
    name: 'academic_research',
    description: 'Academic and institutional research findings (Research Index + Labor Market academic datasets)',
    tools: [researchIndexSearch, laborMarketAcademic, scholarlySearch],
  },
};

export function getSourceGroup(name: string): SourceGroupDef | undefined {
  return SOURCE_GROUPS[name];
}

export function listSourceGroups(): Array<{ name: string; description: string; tool_count: number; tools: string[] }> {
  return Object.values(SOURCE_GROUPS).map((g) => ({
    name: g.name,
    description: g.description,
    tool_count: g.tools.length,
    tools: g.tools.map((t) => t.tool_name),
  }));
}
