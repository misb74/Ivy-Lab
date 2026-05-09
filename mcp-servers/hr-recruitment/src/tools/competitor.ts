/**
 * Competitor hiring intelligence using Adzuna API.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompetitorHiringResult {
  company: string;
  location: string | null;
  country: string;
  total_jobs_found: number;
  jobs: CompetitorJob[];
  analysis: CompetitorAnalysis;
  data_source: string;
}

export interface CompetitorJob {
  title: string;
  company: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  category?: string;
  description_snippet?: string;
  posted_date?: string;
  source_url?: string;
}

export interface CompetitorAnalysis {
  total_postings: number;
  top_roles: Array<{ title: string; count: number }>;
  top_locations: Array<{ location: string; count: number }>;
  salary_range?: { min: number; max: number; median: number };
  hiring_intensity: 'very_high' | 'high' | 'moderate' | 'low';
  insights: string[];
}

export interface JobSearchResult {
  company: string;
  what: string | null;
  location: string | null;
  country: string;
  total_results: number;
  jobs: CompetitorJob[];
  data_source: string;
}

// ---------------------------------------------------------------------------
// Adzuna API country codes
// ---------------------------------------------------------------------------

const ADZUNA_COUNTRY_CODES: Record<string, string> = {
  us: 'us',
  usa: 'us',
  'united states': 'us',
  uk: 'gb',
  gb: 'gb',
  'united kingdom': 'gb',
  ca: 'ca',
  canada: 'ca',
  au: 'au',
  australia: 'au',
  de: 'de',
  germany: 'de',
  fr: 'fr',
  france: 'fr',
  in: 'in',
  india: 'in',
  nl: 'nl',
  netherlands: 'nl',
  nz: 'nz',
  'new zealand': 'nz',
  sg: 'sg',
  singapore: 'sg',
  za: 'za',
  'south africa': 'za',
  br: 'br',
  brazil: 'br',
  pl: 'pl',
  poland: 'pl',
  at: 'at',
  austria: 'at',
};

function resolveCountryCode(country?: string): string {
  if (!country) return 'us';
  const normalized = country.toLowerCase().trim();
  return ADZUNA_COUNTRY_CODES[normalized] || normalized.slice(0, 2);
}

// ---------------------------------------------------------------------------
// Adzuna API calls
// ---------------------------------------------------------------------------

const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID || '';
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY || '';
const ADZUNA_BASE_URL = 'https://api.adzuna.com/v1/api/jobs';

interface AdzunaResponse {
  count: number;
  results: Array<{
    title: string;
    company?: { display_name?: string };
    location?: { display_name?: string; area?: string[] };
    salary_min?: number;
    salary_max?: number;
    category?: { label?: string };
    description?: string;
    created?: string;
    redirect_url?: string;
  }>;
}

async function searchAdzuna(
  country: string,
  params: Record<string, string>
): Promise<AdzunaResponse> {
  const countryCode = resolveCountryCode(country);
  const url = new URL(`${ADZUNA_BASE_URL}/${countryCode}/search/1`);

  url.searchParams.set('app_id', ADZUNA_APP_ID);
  url.searchParams.set('app_key', ADZUNA_APP_KEY);
  url.searchParams.set('content-type', 'application/json');

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Adzuna API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<AdzunaResponse>;
}

function mapAdzunaResults(results: AdzunaResponse['results']): CompetitorJob[] {
  return results.map(r => ({
    title: r.title || 'Unknown',
    company: r.company?.display_name || 'Unknown',
    location: r.location?.display_name || 'Unknown',
    salary_min: r.salary_min,
    salary_max: r.salary_max,
    category: r.category?.label,
    description_snippet: r.description ? r.description.slice(0, 200) + '...' : undefined,
    posted_date: r.created,
    source_url: r.redirect_url,
  }));
}

// ---------------------------------------------------------------------------
// Competitor hiring analysis
// ---------------------------------------------------------------------------

/**
 * Analyze competitor hiring activity using Adzuna API.
 */
export async function analyzeCompetitorHiring(
  company: string,
  location?: string,
  country?: string
): Promise<CompetitorHiringResult> {
  const countryCode = resolveCountryCode(country);

  const params: Record<string, string> = {
    what: company,
    results_per_page: '50',
    sort_by: 'date',
  };
  if (location) {
    params.where = location;
  }

  let jobs: CompetitorJob[] = [];
  let totalFound = 0;

  try {
    if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
      throw new Error('ADZUNA_APP_ID and ADZUNA_APP_KEY environment variables are required.');
    }
    const data = await searchAdzuna(countryCode, params);
    totalFound = data.count;
    jobs = mapAdzunaResults(data.results);
  } catch (error) {
    // Return structured error with guidance
    return {
      company,
      location: location || null,
      country: countryCode,
      total_jobs_found: 0,
      jobs: [],
      analysis: {
        total_postings: 0,
        top_roles: [],
        top_locations: [],
        hiring_intensity: 'low',
        insights: [
          `Unable to fetch live data: ${(error as Error).message}`,
          'Ensure ADZUNA_APP_ID and ADZUNA_APP_KEY environment variables are set.',
          'You can get free API keys at https://developer.adzuna.com/',
        ],
      },
      data_source: 'adzuna (error)',
    };
  }

  // Analyze results
  const analysis = analyzeJobs(jobs, company, totalFound);

  return {
    company,
    location: location || null,
    country: countryCode,
    total_jobs_found: totalFound,
    jobs,
    analysis,
    data_source: 'adzuna',
  };
}

/**
 * Search competitor jobs with more specific filters.
 */
export async function searchCompetitorJobs(
  company: string,
  what?: string,
  location?: string,
  country?: string,
  maxResults?: number
): Promise<JobSearchResult> {
  const countryCode = resolveCountryCode(country);
  const resultsPerPage = Math.min(maxResults || 20, 50);

  const searchWhat = what ? `${company} ${what}` : company;
  const params: Record<string, string> = {
    what: searchWhat,
    results_per_page: String(resultsPerPage),
    sort_by: 'date',
  };
  if (location) {
    params.where = location;
  }

  let jobs: CompetitorJob[] = [];
  let totalResults = 0;

  try {
    if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
      throw new Error('ADZUNA_APP_ID and ADZUNA_APP_KEY environment variables are required.');
    }
    const data = await searchAdzuna(countryCode, params);
    totalResults = data.count;
    jobs = mapAdzunaResults(data.results);
  } catch (error) {
    return {
      company,
      what: what || null,
      location: location || null,
      country: countryCode,
      total_results: 0,
      jobs: [],
      data_source: `adzuna (error: ${(error as Error).message})`,
    };
  }

  return {
    company,
    what: what || null,
    location: location || null,
    country: countryCode,
    total_results: totalResults,
    jobs,
    data_source: 'adzuna',
  };
}

// ---------------------------------------------------------------------------
// Helper: Analyze a set of jobs
// ---------------------------------------------------------------------------

function analyzeJobs(jobs: CompetitorJob[], company: string, totalPostings: number): CompetitorAnalysis {
  // Count roles
  const roleCounts: Record<string, number> = {};
  const locationCounts: Record<string, number> = {};
  const salaries: number[] = [];

  for (const job of jobs) {
    // Role counting
    const roleKey = job.title.toLowerCase();
    roleCounts[roleKey] = (roleCounts[roleKey] || 0) + 1;

    // Location counting
    const locKey = job.location;
    locationCounts[locKey] = (locationCounts[locKey] || 0) + 1;

    // Salary data
    if (job.salary_min) salaries.push(job.salary_min);
    if (job.salary_max) salaries.push(job.salary_max);
  }

  // Top roles
  const topRoles = Object.entries(roleCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([title, count]) => ({ title, count }));

  // Top locations
  const topLocations = Object.entries(locationCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([location, count]) => ({ location, count }));

  // Salary range
  let salaryRange: CompetitorAnalysis['salary_range'];
  if (salaries.length > 0) {
    salaries.sort((a, b) => a - b);
    salaryRange = {
      min: salaries[0],
      max: salaries[salaries.length - 1],
      median: salaries[Math.floor(salaries.length / 2)],
    };
  }

  // Hiring intensity
  let hiringIntensity: CompetitorAnalysis['hiring_intensity'];
  if (totalPostings >= 100) hiringIntensity = 'very_high';
  else if (totalPostings >= 50) hiringIntensity = 'high';
  else if (totalPostings >= 20) hiringIntensity = 'moderate';
  else hiringIntensity = 'low';

  // Insights
  const insights: string[] = [];
  insights.push(`${company} has ${totalPostings} active job posting(s) found.`);
  if (topRoles.length > 0) {
    insights.push(`Most common role: "${topRoles[0].title}" with ${topRoles[0].count} posting(s).`);
  }
  if (topLocations.length > 1) {
    insights.push(`Hiring across ${topLocations.length} location(s). Top location: ${topLocations[0].location}.`);
  }
  if (salaryRange) {
    insights.push(`Salary range: $${salaryRange.min.toLocaleString()} - $${salaryRange.max.toLocaleString()} (median: $${salaryRange.median.toLocaleString()}).`);
  }
  insights.push(`Hiring intensity: ${hiringIntensity}.`);

  return {
    total_postings: totalPostings,
    top_roles: topRoles,
    top_locations: topLocations,
    salary_range: salaryRange,
    hiring_intensity: hiringIntensity,
    insights,
  };
}
