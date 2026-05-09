import type { ExtractedFinding, FindingType } from './types.js';
import crypto from 'crypto';

/**
 * Per-source finding extraction functions.
 * Each extractor takes raw tool output and produces structured findings.
 */

function hash(data: unknown): string {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex').slice(0, 12);
}

function extractBLS(data: any, toolName: string): ExtractedFinding[] {
  if (!data) return [];
  const findings: ExtractedFinding[] = [];

  if (data.wages || data.annual_median || data.median) {
    const wages = data.wages || data;
    findings.push({
      finding_type: 'statistic',
      content: `BLS wage data: ${data.occupation_title || data.occ_title || 'occupation'} — median annual: $${wages.annual_median || wages.median || 'N/A'}, mean: $${wages.mean || wages.annual_mean || 'N/A'}`,
      data: wages,
      confidence: 0.9,
      relevance: 0.8,
      source_tool: toolName,
      source_server: 'data-bls',
    });
  }

  if (data.trend || data.series || Array.isArray(data.data)) {
    findings.push({
      finding_type: 'trend',
      content: `Employment trend for ${data.occupation_title || 'occupation'}: ${JSON.stringify(data.trend || data.series || data.data).slice(0, 200)}`,
      data,
      confidence: 0.9,
      relevance: 0.7,
      source_tool: toolName,
      source_server: 'data-bls',
    });
  }

  if (findings.length === 0) {
    findings.push({
      finding_type: 'data_point',
      content: `BLS data: ${JSON.stringify(data).slice(0, 300)}`,
      data,
      confidence: 0.9,
      relevance: 0.6,
      source_tool: toolName,
      source_server: 'data-bls',
    });
  }

  return findings;
}

function extractAdzuna(data: any, toolName: string): ExtractedFinding[] {
  if (!data) return [];
  const findings: ExtractedFinding[] = [];

  if (toolName === 'adzuna_search_jobs') {
    const jobs = Array.isArray(data) ? data : data?.results || data?.jobs || [];
    if (jobs.length > 0) {
      findings.push({
        finding_type: 'data_point',
        content: `Found ${jobs.length} job postings. Top roles: ${jobs.slice(0, 5).map((j: any) => `${j.title} at ${j.company?.display_name || j.company}`).join('; ')}`,
        data: { count: jobs.length, sample: jobs.slice(0, 5) },
        confidence: 0.7,
        relevance: 0.7,
        source_tool: toolName,
        source_server: 'data-adzuna',
      });
    }
  } else if (toolName === 'adzuna_salary_data') {
    findings.push({
      finding_type: 'statistic',
      content: `Adzuna salary data: ${data.role || 'role'} — ${JSON.stringify(data).slice(0, 200)}`,
      data,
      confidence: 0.7,
      relevance: 0.8,
      source_tool: toolName,
      source_server: 'data-adzuna',
    });
  }

  return findings;
}

function extractLightcast(data: any, toolName: string): ExtractedFinding[] {
  if (!data) return [];
  const findings: ExtractedFinding[] = [];

  if (toolName.includes('skills')) {
    const skills = Array.isArray(data) ? data : data?.skills || data?.data || [];
    if (skills.length > 0) {
      findings.push({
        finding_type: 'data_point',
        content: `Lightcast skills: ${skills.slice(0, 10).map((s: any) => s.name || s.skill_name).filter(Boolean).join(', ')}`,
        data: { count: skills.length, skills: skills.slice(0, 15) },
        confidence: 0.85,
        relevance: 0.8,
        source_tool: toolName,
        source_server: 'data-lightcast',
      });
    }
  } else if (toolName.includes('demand')) {
    findings.push({
      finding_type: 'trend',
      content: `Lightcast demand forecast: ${JSON.stringify(data).slice(0, 300)}`,
      data,
      confidence: 0.85,
      relevance: 0.8,
      source_tool: toolName,
      source_server: 'data-lightcast',
    });
  }

  if (findings.length === 0) {
    findings.push({
      finding_type: 'data_point',
      content: `Lightcast data: ${JSON.stringify(data).slice(0, 300)}`,
      data,
      confidence: 0.85,
      relevance: 0.6,
      source_tool: toolName,
      source_server: 'data-lightcast',
    });
  }

  return findings;
}

function extractONET(data: any, toolName: string): ExtractedFinding[] {
  if (!data) return [];
  const findings: ExtractedFinding[] = [];

  if (toolName === 'onet_get_occupation_details') {
    findings.push({
      finding_type: 'fact',
      content: `O*NET occupation: ${data.title || data.name} (${data.code}) — ${(data.description || '').slice(0, 200)}`,
      data,
      confidence: 0.9,
      relevance: 0.9,
      source_tool: toolName,
      source_server: 'data-onet',
    });
  } else {
    const occs = Array.isArray(data) ? data : data?.occupations || [];
    if (occs.length > 0) {
      findings.push({
        finding_type: 'data_point',
        content: `O*NET occupations found: ${occs.slice(0, 5).map((o: any) => `${o.title} (${o.code})`).join(', ')}`,
        data: { count: occs.length, occupations: occs.slice(0, 10) },
        confidence: 0.9,
        relevance: 0.7,
        source_tool: toolName,
        source_server: 'data-onet',
      });
    }
  }

  return findings;
}

function extractESCO(data: any, toolName: string): ExtractedFinding[] {
  if (!data) return [];
  const items = Array.isArray(data) ? data : data?.results || data?.occupations || data?.skills || [];
  if (items.length === 0) return [];

  return [{
    finding_type: 'data_point',
    content: `ESCO ${toolName.includes('skill') ? 'skills' : 'occupations'}: ${items.slice(0, 5).map((i: any) => i.title || i.preferredLabel).filter(Boolean).join(', ')}`,
    data: { count: items.length, items: items.slice(0, 10) },
    confidence: 0.8,
    relevance: 0.7,
    source_tool: toolName,
    source_server: 'data-esco',
  }];
}

function extractResearch(data: any, toolName: string): ExtractedFinding[] {
  if (!data) return [];

  if (typeof data === 'string') {
    return [{
      finding_type: 'insight',
      content: data.slice(0, 500),
      data: { summary: data },
      confidence: 0.5,
      relevance: 0.6,
      source_tool: toolName,
      source_server: 'agent-research',
    }];
  }

  const papers = Array.isArray(data) ? data : data?.papers || data?.results || [];
  if (Array.isArray(papers) && papers.length > 0) {
    return papers.slice(0, 5).map((p: any) => ({
      finding_type: 'quote' as FindingType,
      content: `"${(p.title || 'Untitled').slice(0, 100)}" (${p.year || 'n.d.'}) — ${(p.abstract || '').slice(0, 200)}`,
      data: {
        title: p.title,
        authors: p.authors,
        year: p.year,
        citation_count: p.citationCount || p.citation_count,
        url: p.url,
      },
      confidence: 0.75,
      relevance: 0.7,
      source_tool: toolName,
      source_server: 'agent-research',
      source_url: p.url,
    }));
  }

  return [{
    finding_type: 'insight',
    content: JSON.stringify(data).slice(0, 400),
    data,
    confidence: 0.5,
    relevance: 0.5,
    source_tool: toolName,
    source_server: 'agent-research',
  }];
}

function extractAIImpact(data: any, toolName: string): ExtractedFinding[] {
  if (!data) return [];
  const findings: ExtractedFinding[] = [];

  // Handle array results
  const items = Array.isArray(data) ? data : [data];
  for (const item of items.slice(0, 5)) {
    const score = item.score || item.exposure || item.penetration_rate || item.automation_score;
    findings.push({
      finding_type: 'statistic',
      content: `${toolName}: ${item.title || item.occupation_title || 'occupation'} — score: ${score ?? 'N/A'}`,
      data: item,
      confidence: 0.85,
      relevance: 0.8,
      source_tool: toolName,
      source_server: toolName.startsWith('aei_') ? 'data-anthropic-econ-index'
        : toolName.startsWith('aioe_') ? 'data-felten-aioe'
        : 'data-workbank',
    });
  }

  return findings;
}

function extractIndeed(data: any, toolName: string): ExtractedFinding[] {
  if (!data) return [];
  return [{
    finding_type: 'trend',
    content: `Indeed ${toolName.includes('wage') ? 'wage' : 'posting'} trend: ${JSON.stringify(data).slice(0, 300)}`,
    data,
    confidence: 0.8,
    relevance: 0.7,
    source_tool: toolName,
    source_server: 'data-indeed',
  }];
}

function extractLaborMarket(data: any, toolName: string): ExtractedFinding[] {
  if (!data) return [];
  const findings: ExtractedFinding[] = [];

  if (data.data && Array.isArray(data.data) && data.data.length > 0) {
    const sample = data.data.slice(0, 5);
    const meta = data.metadata || {};
    findings.push({
      finding_type: 'trend',
      content: `Labor market data (${toolName}): ${meta.country || ''} ${meta.sector || ''} — ${data.data.length} data points. Sample: ${JSON.stringify(sample).slice(0, 300)}`,
      data: { metadata: meta, sample, total: data.data.length },
      confidence: 0.85,
      relevance: 0.8,
      source_tool: toolName,
      source_server: 'data-labor-market',
    });
  } else if (data.postings) {
    findings.push({
      finding_type: 'trend',
      content: `Remote work trends: ${data.postings.count} posting data points, ${data.searches?.count || 0} search data points`,
      data,
      confidence: 0.8,
      relevance: 0.7,
      source_tool: toolName,
      source_server: 'data-labor-market',
    });
  } else {
    findings.push({
      finding_type: 'data_point',
      content: `Labor market: ${JSON.stringify(data).slice(0, 400)}`,
      data,
      confidence: 0.8,
      relevance: 0.6,
      source_tool: toolName,
      source_server: 'data-labor-market',
    });
  }

  return findings;
}

function extractResearchIndex(data: any, toolName: string): ExtractedFinding[] {
  if (!data) return [];
  const findings: ExtractedFinding[] = [];

  if (data.results && Array.isArray(data.results)) {
    for (const r of data.results.slice(0, 5)) {
      findings.push({
        finding_type: (r.finding_type as FindingType) || 'insight',
        content: `${r.institution_name}: ${r.content}`,
        data: {
          data_value: r.data_value,
          data_unit: r.data_unit,
          publication: r.publication_title,
          institution: r.institution_name,
          time_period: r.time_period,
        },
        confidence: r.confidence || 0.7,
        relevance: 0.85,
        source_tool: toolName,
        source_server: 'data-research-index',
        source_url: r.publication_url,
      });
    }
  }

  if (findings.length === 0) {
    findings.push({
      finding_type: 'data_point',
      content: `Research index: ${JSON.stringify(data).slice(0, 400)}`,
      data,
      confidence: 0.7,
      relevance: 0.5,
      source_tool: toolName,
      source_server: 'data-research-index',
    });
  }

  return findings;
}

function extractAtsTalentBuild(data: any, toolName: string): ExtractedFinding[] {
  if (!data) return [];
  const findings: ExtractedFinding[] = [];
  const companies = Array.isArray(data.companies) ? data.companies : [];

  for (const company of companies) {
    const talent = company.talent_build || {};
    findings.push({
      finding_type: 'insight',
      content: talent.summary || `${company.company}: ${company.relevant_jobs_count || 0} relevant active jobs in first-party ATS data.`,
      data: {
        company: company.company,
        active_jobs_total: company.active_jobs_total,
        relevant_jobs_count: company.relevant_jobs_count,
        role_categories: talent.role_categories,
        top_locations: talent.top_locations,
        top_skills: talent.top_skills,
        sample_jobs: company.sample_jobs,
        refresh: company.refresh,
      },
      confidence: company.refresh?.status === 'success' ? 0.85 : 0.65,
      relevance: 0.9,
      source_tool: toolName,
      source_server: 'agent-ats-scanner',
    });
  }

  if (Array.isArray(data.comparison) && data.comparison.length > 0) {
    findings.push({
      finding_type: 'insight',
      content: `ATS talent-build comparison: ${data.comparison.join(' ')}`,
      data: { comparison: data.comparison, query: data.query },
      confidence: 0.8,
      relevance: 0.9,
      source_tool: toolName,
      source_server: 'agent-ats-scanner',
    });
  }

  if (findings.length === 0) {
    findings.push({
      finding_type: 'data_point',
      content: `ATS scanner data: ${JSON.stringify(data).slice(0, 400)}`,
      data,
      confidence: 0.55,
      relevance: 0.7,
      source_tool: toolName,
      source_server: 'agent-ats-scanner',
    });
  }

  return findings;
}

function extractGeneric(data: any, toolName: string, serverName: string): ExtractedFinding[] {
  if (!data) return [];
  return [{
    finding_type: 'data_point',
    content: `${toolName}: ${JSON.stringify(data).slice(0, 400)}`,
    data,
    confidence: 0.5,
    relevance: 0.5,
    source_tool: toolName,
    source_server: serverName,
  }];
}

// ── Extractor registry ──

const EXTRACTORS: Record<string, (data: any, toolName: string) => ExtractedFinding[]> = {
  bls_occupation_wages: extractBLS,
  bls_wage_comparison: extractBLS,
  bls_employment_trend: extractBLS,
  adzuna_search_jobs: extractAdzuna,
  adzuna_salary_data: extractAdzuna,
  lightcast_search_skills: extractLightcast,
  lightcast_trending_skills: extractLightcast,
  lightcast_demand_forecast: extractLightcast,
  lightcast_extract_skills: extractLightcast,
  onet_search_occupations: extractONET,
  onet_get_occupation_details: extractONET,
  onet_get_occupation: extractONET,
  esco_search_occupations: extractESCO,
  esco_search_skills: extractESCO,
  quick_research: extractResearch,
  scholarly_search: extractResearch,
  aei_job_exposure: extractAIImpact,
  aei_task_penetration: extractAIImpact,
  aei_task_collaboration: extractAIImpact,
  aei_task_autonomy: extractAIImpact,
  aioe_occupation_exposure: extractAIImpact,
  workbank_occupation_automation: extractAIImpact,
  indeed_job_postings_trend: extractIndeed,
  indeed_wage_tracker: extractIndeed,
  // Labor Market tools
  labor_market_job_postings: extractLaborMarket,
  labor_market_wages: extractLaborMarket,
  labor_market_ai_demand: extractLaborMarket,
  labor_market_remote: extractLaborMarket,
  labor_market_pay_transparency: extractLaborMarket,
  labor_market_academic: extractLaborMarket,
  // Research Index tools
  research_index_search: extractResearchIndex,
  ats_analyze_talent_build: extractAtsTalentBuild,
  ats_scan_company_jobs: (d, t) => extractGeneric(d, t, 'agent-ats-scanner'),
  ats_get_company_jobs: (d, t) => extractGeneric(d, t, 'agent-ats-scanner'),
  ats_get_job_deltas: (d, t) => extractGeneric(d, t, 'agent-ats-scanner'),
  ats_fetch_job_ads: (d, t) => extractGeneric(d, t, 'agent-ats-scanner'),
  fred_labor_dashboard: (d, t) => extractGeneric(d, t, 'data-fred'),
  revelio_labor_stats: (d, t) => extractGeneric(d, t, 'data-revelio'),
  revelio_hiring_trends: (d, t) => extractGeneric(d, t, 'data-revelio'),
  jobhop_transition_probability: (d, t) => extractGeneric(d, t, 'data-jobhop'),
};

/**
 * Extract findings from a tool's raw output.
 */
export function extractFindings(toolName: string, data: unknown): ExtractedFinding[] {
  const extractor = EXTRACTORS[toolName];
  if (extractor) {
    try {
      return extractor(data, toolName);
    } catch {
      return extractGeneric(data, toolName, 'unknown');
    }
  }
  return extractGeneric(data, toolName, 'unknown');
}

/**
 * Generate a hash of raw response data for provenance tracking.
 */
export function responseHash(data: unknown): string {
  return hash(data);
}
