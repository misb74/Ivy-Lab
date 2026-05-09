import { NormalizedResult, ResultType, SourceProvenance } from './types.js';

let idCounter = 0;
function nextId(): string {
  return `nr_${Date.now()}_${++idCounter}`;
}

function makeProvenance(toolName: string, serverName: string, weight: number): SourceProvenance {
  return {
    tool_name: toolName,
    server_name: serverName,
    reliability_weight: weight,
    retrieved_at: new Date().toISOString(),
  };
}

/** Normalize Adzuna job search results */
function normalizeAdzunaJobs(data: any, provenance: SourceProvenance): NormalizedResult[] {
  const jobs = Array.isArray(data) ? data : data?.results || data?.jobs || [];
  return jobs.map((j: any) => ({
    id: nextId(),
    canonical_key: `job:${(j.title || '').toLowerCase().trim()}:${(j.company?.display_name || j.company || '').toLowerCase().trim()}`,
    type: 'job_posting' as ResultType,
    title: j.title || 'Unknown',
    value: {
      company: j.company?.display_name || j.company,
      location: j.location?.display_name || j.location,
      salary_min: j.salary_min,
      salary_max: j.salary_max,
      description: j.description?.slice(0, 200),
      url: j.redirect_url || j.url,
      created: j.created,
    },
    numeric_value: j.salary_max || j.salary_min,
    unit: 'GBP/year',
    location: j.location?.display_name || j.location,
    date: j.created,
    source: provenance,
    raw: j,
  }));
}

/** Normalize Adzuna salary data */
function normalizeAdzunaSalary(data: any, provenance: SourceProvenance): NormalizedResult[] {
  if (!data) return [];
  const results: NormalizedResult[] = [];
  if (data.average || data.median) {
    results.push({
      id: nextId(),
      canonical_key: `salary:${(data.role || data.company || 'unknown').toLowerCase()}:${(data.location || 'unknown').toLowerCase()}`,
      type: 'salary',
      title: `Salary: ${data.role || data.company || 'Unknown'}`,
      value: data,
      numeric_value: data.median || data.average,
      unit: 'USD/year',
      location: data.location,
      source: provenance,
      raw: data,
    });
  }
  return results;
}

/** Normalize BLS wage data */
function normalizeBLSWages(data: any, provenance: SourceProvenance): NormalizedResult[] {
  if (!data) return [];
  const results: NormalizedResult[] = [];
  const wages = data.wages || data;
  if (wages.median || wages.annual_median || wages.mean) {
    results.push({
      id: nextId(),
      canonical_key: `wage:bls:${(data.occupation_code || data.occ_code || 'unknown').toLowerCase()}:${(data.area || 'national').toLowerCase()}`,
      type: 'wage_statistic',
      title: `BLS Wages: ${data.occupation_title || data.occ_title || 'Unknown'}`,
      value: wages,
      numeric_value: wages.annual_median || wages.median || wages.mean,
      unit: 'USD/year',
      location: data.area_title || data.area,
      source: provenance,
      raw: data,
    });
  }
  return results;
}

/** Normalize BLS employment trend */
function normalizeBLSTrend(data: any, provenance: SourceProvenance): NormalizedResult[] {
  if (!data) return [];
  return [{
    id: nextId(),
    canonical_key: `trend:bls:${(data.occupation_code || 'unknown').toLowerCase()}`,
    type: 'trend',
    title: `Employment Trend: ${data.occupation_title || 'Unknown'}`,
    value: data,
    source: provenance,
    raw: data,
  }];
}

/** Normalize Lightcast skills */
function normalizeLightcastSkills(data: any, provenance: SourceProvenance): NormalizedResult[] {
  const skills = Array.isArray(data) ? data : data?.skills || data?.data || [];
  return skills.map((s: any) => ({
    id: nextId(),
    canonical_key: `skill:${(s.name || s.skill_name || '').toLowerCase().trim()}`,
    type: 'skill' as ResultType,
    title: s.name || s.skill_name || 'Unknown',
    value: {
      id: s.id || s.skill_id,
      name: s.name || s.skill_name,
      category: s.category || s.type,
      subcategory: s.subcategory,
    },
    source: provenance,
    raw: s,
  }));
}

/** Normalize Lightcast demand forecast */
function normalizeLightcastDemand(data: any, provenance: SourceProvenance): NormalizedResult[] {
  if (!data) return [];
  return [{
    id: nextId(),
    canonical_key: `demand:lightcast:${(data.occupation_code || data.soc || 'unknown').toLowerCase()}`,
    type: 'trend',
    title: `Demand Forecast: ${data.occupation_title || data.title || 'Unknown'}`,
    value: data,
    source: provenance,
    raw: data,
  }];
}

/** Normalize O*NET occupations */
function normalizeONETOccupations(data: any, provenance: SourceProvenance): NormalizedResult[] {
  const occs = Array.isArray(data) ? data : data?.occupations || data?.occupation || [];
  if (!Array.isArray(occs)) {
    // Single occupation detail
    return [{
      id: nextId(),
      canonical_key: `occ:${(data.code || data.soc_code || '').toLowerCase()}`,
      type: 'occupation',
      title: data.title || data.name || 'Unknown',
      value: data,
      source: provenance,
      raw: data,
    }];
  }
  return occs.map((o: any) => ({
    id: nextId(),
    canonical_key: `occ:${(o.code || o.soc_code || '').toLowerCase()}`,
    type: 'occupation' as ResultType,
    title: o.title || o.name || 'Unknown',
    value: {
      code: o.code || o.soc_code,
      title: o.title || o.name,
      description: o.description,
    },
    source: provenance,
    raw: o,
  }));
}

/** Normalize ESCO results */
function normalizeESCO(data: any, provenance: SourceProvenance, type: ResultType): NormalizedResult[] {
  const items = Array.isArray(data) ? data : data?.results || data?.occupations || data?.skills || [];
  return items.map((item: any) => ({
    id: nextId(),
    canonical_key: `esco:${type}:${(item.title || item.preferredLabel || '').toLowerCase().trim()}`,
    type,
    title: item.title || item.preferredLabel || 'Unknown',
    value: {
      uri: item.uri,
      title: item.title || item.preferredLabel,
      description: item.description || item.conceptUri,
    },
    source: provenance,
    raw: item,
  }));
}

/** Normalize Indeed trends */
function normalizeIndeed(data: any, provenance: SourceProvenance, type: ResultType): NormalizedResult[] {
  if (!data) return [];
  return [{
    id: nextId(),
    canonical_key: `indeed:${type}:${(data.sector || 'all').toLowerCase()}`,
    type,
    title: `Indeed ${type === 'trend' ? 'Posting Trend' : 'Wage Tracker'}: ${data.sector || 'All'}`,
    value: data,
    source: provenance,
    raw: data,
  }];
}

/** Normalize web/scholarly research */
function normalizeResearch(data: any, provenance: SourceProvenance): NormalizedResult[] {
  if (!data) return [];
  // Quick research returns a text summary
  if (typeof data === 'string') {
    return [{
      id: nextId(),
      canonical_key: `research:web:${Date.now()}`,
      type: 'research_finding',
      title: 'Web Research Finding',
      value: { summary: data },
      source: provenance,
      raw: data,
    }];
  }
  // Scholarly returns papers
  const papers = Array.isArray(data) ? data : data?.papers || data?.results || [];
  if (Array.isArray(papers) && papers.length > 0) {
    return papers.map((p: any) => ({
      id: nextId(),
      canonical_key: `paper:${(p.title || '').toLowerCase().slice(0, 60)}`,
      type: 'research_finding' as ResultType,
      title: p.title || 'Unknown Paper',
      value: {
        title: p.title,
        authors: p.authors,
        year: p.year,
        abstract: p.abstract?.slice(0, 300),
        citation_count: p.citationCount || p.citation_count,
        url: p.url || p.externalIds?.DOI,
      },
      source: provenance,
      raw: p,
    }));
  }
  return [{
    id: nextId(),
    canonical_key: `research:${Date.now()}`,
    type: 'research_finding',
    title: 'Research Finding',
    value: data,
    source: provenance,
    raw: data,
  }];
}

/** Normalize talent/people search results */
function normalizePeople(data: any, provenance: SourceProvenance): NormalizedResult[] {
  const profiles = Array.isArray(data) ? data : data?.profiles || data?.results || [];
  return profiles.map((p: any) => ({
    id: nextId(),
    canonical_key: `person:${(p.linkedin_url || `${p.name}:${p.current_company}` || '').toLowerCase().trim()}`,
    type: 'person' as ResultType,
    title: p.name || p.full_name || 'Unknown',
    value: {
      name: p.name || p.full_name,
      title: p.current_title || p.job_title,
      company: p.current_company || p.company,
      location: p.location,
      linkedin_url: p.linkedin_url || p.source_url,
    },
    source: provenance,
    raw: p,
  }));
}

/** Normalize AI impact / automation scores */
function normalizeStatistic(data: any, provenance: SourceProvenance, toolName: string): NormalizedResult[] {
  if (!data) return [];
  // Handle array results (e.g., aei_job_exposure returns list)
  if (Array.isArray(data)) {
    return data.map((item: any) => ({
      id: nextId(),
      canonical_key: `stat:${toolName}:${(item.occupation_code || item.code || item.title || '').toLowerCase()}`,
      type: 'statistic' as ResultType,
      title: item.title || item.occupation_title || `${toolName} result`,
      value: item,
      numeric_value: item.score || item.exposure || item.penetration_rate,
      source: provenance,
      raw: item,
    }));
  }
  return [{
    id: nextId(),
    canonical_key: `stat:${toolName}:${(data.occupation_code || data.code || '').toLowerCase()}`,
    type: 'statistic',
    title: data.title || data.occupation_title || `${toolName} result`,
    value: data,
    numeric_value: data.score || data.exposure || data.automation_score,
    source: provenance,
    raw: data,
  }];
}

// ── Normalizer registry ──

const NORMALIZERS: Record<string, (data: any, provenance: SourceProvenance) => NormalizedResult[]> = {
  adzuna_search_jobs: normalizeAdzunaJobs,
  adzuna_salary_data: normalizeAdzunaSalary,
  bls_occupation_wages: normalizeBLSWages,
  bls_wage_comparison: normalizeBLSWages,
  bls_employment_trend: normalizeBLSTrend,
  lightcast_search_skills: normalizeLightcastSkills,
  lightcast_trending_skills: normalizeLightcastSkills,
  lightcast_demand_forecast: normalizeLightcastDemand,
  onet_search_occupations: normalizeONETOccupations,
  onet_get_occupation_details: normalizeONETOccupations,
  esco_search_occupations: (d, p) => normalizeESCO(d, p, 'occupation'),
  esco_search_skills: (d, p) => normalizeESCO(d, p, 'skill'),
  quick_research: normalizeResearch,
  scholarly_search: normalizeResearch,
  talent_search_profiles: normalizePeople,
  indeed_job_postings_trend: (d, p) => normalizeIndeed(d, p, 'trend'),
  indeed_wage_tracker: (d, p) => normalizeIndeed(d, p, 'wage_statistic'),
  aei_job_exposure: (d, p) => normalizeStatistic(d, p, 'aei_job_exposure'),
  aioe_occupation_exposure: (d, p) => normalizeStatistic(d, p, 'aioe_occupation_exposure'),
  workbank_occupation_automation: (d, p) => normalizeStatistic(d, p, 'workbank_automation'),
  revelio_labor_stats: (d, p) => normalizeStatistic(d, p, 'revelio_labor_stats'),
  revelio_hiring_trends: (d, p) => normalizeStatistic(d, p, 'revelio_hiring_trends'),
  fred_labor_dashboard: (d, p) => normalizeStatistic(d, p, 'fred_labor_dashboard'),
  jobhop_transition_probability: (d, p) => normalizeStatistic(d, p, 'jobhop_transition'),
};

export function normalizeResults(
  toolName: string,
  serverName: string,
  reliabilityWeight: number,
  data: unknown,
): NormalizedResult[] {
  const provenance = makeProvenance(toolName, serverName, reliabilityWeight);
  const normalizer = NORMALIZERS[toolName];
  if (!normalizer) {
    // Fallback: wrap raw data
    return [{
      id: nextId(),
      canonical_key: `raw:${toolName}:${Date.now()}`,
      type: 'research_finding',
      title: `${toolName} result`,
      value: data,
      source: provenance,
      raw: data,
    }];
  }
  try {
    return normalizer(data, provenance);
  } catch {
    return [{
      id: nextId(),
      canonical_key: `error:${toolName}:${Date.now()}`,
      type: 'research_finding',
      title: `${toolName} result (normalization fallback)`,
      value: data,
      source: provenance,
      raw: data,
    }];
  }
}
