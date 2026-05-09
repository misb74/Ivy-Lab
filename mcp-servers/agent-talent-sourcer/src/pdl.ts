import { RateLimiter } from '@auxia/shared';
import type { PersonProfile, SearchParams } from './types.js';

const PDL_BASE = 'https://api.peopledatalabs.com/v5';

const rateLimiter = new RateLimiter({ requestsPerMinute: 50, maxConcurrent: 2 });

function getApiKey(): string {
  const key = process.env.PDL_API_KEY;
  if (!key) throw new Error('PDL_API_KEY not set');
  return key;
}

/** Map seniority levels to PDL job_title_levels */
function mapSeniority(levels?: string[]): string[] | undefined {
  if (!levels?.length) return undefined;
  const mapping: Record<string, string> = {
    c_suite: 'cxo',
    vp: 'vp',
    director: 'director',
    manager: 'manager',
    senior: 'senior',
  };
  return levels.map(l => mapping[l] || l).filter(Boolean);
}

function normalizeProfile(person: any): PersonProfile | null {
  if (!person) return null;

  // Normalize LinkedIn URL — PDL returns without protocol
  const rawLinkedin = person.linkedin_url || null;
  const linkedinUrl = rawLinkedin && !rawLinkedin.startsWith('http')
    ? `https://${rawLinkedin}`
    : rawLinkedin;
  const sourceUrl = linkedinUrl || `https://api.peopledatalabs.com/v5/person?id=${person.id}`;
  if (!sourceUrl) return null;

  // Parse experience from PDL format
  const employment_history = (person.experience || []).map((e: any) => ({
    title: e.title?.name || e.title || '',
    company: e.company?.name || e.company || '',
    start_date: e.start_date || null,
    end_date: e.end_date || null,
    is_current: e.is_primary || !e.end_date || false,
  }));

  const education = (person.education || []).map((e: any) => ({
    school: e.school?.name || e.school || '',
    degree: e.degrees?.join(', ') || e.degree || null,
    field: e.majors?.join(', ') || e.field_of_study || null,
  }));

  return {
    name: person.full_name || [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unknown',
    first_name: person.first_name || '',
    last_name: person.last_name || '',
    current_title: person.job_title || '',
    current_company: person.job_company_name || '',
    linkedin_url: linkedinUrl,
    source_url: sourceUrl,
    source: 'pdl',
    location: [person.location_locality, person.location_region, person.location_country]
      .filter(v => v && typeof v === 'string')
      .join(', '),
    seniority: person.job_title_levels?.join(', ') || '',
    industry: person.industry || person.job_company_industry || '',
    headline: person.headline || person.job_title || '',
    employment_history,
    education,
    skills: person.skills || [],
  };
}

/** Escape a value for use in PDL SQL queries */
function sqlEscape(val: string): string {
  return val.replace(/'/g, "''");
}

/** Normalize country codes/abbreviations to PDL's full country names */
function normalizeCountry(raw: string): string {
  const lower = raw.toLowerCase().trim();
  const countryMap: Record<string, string> = {
    'uk': 'united kingdom',
    'gb': 'united kingdom',
    'gbr': 'united kingdom',
    'us': 'united states',
    'usa': 'united states',
    'ae': 'united arab emirates',
    'uae': 'united arab emirates',
    'de': 'germany',
    'fr': 'france',
    'es': 'spain',
    'it': 'italy',
    'nl': 'netherlands',
    'be': 'belgium',
    'ch': 'switzerland',
    'se': 'sweden',
    'no': 'norway',
    'dk': 'denmark',
    'fi': 'finland',
    'ie': 'ireland',
    'at': 'austria',
    'pt': 'portugal',
    'pl': 'poland',
    'au': 'australia',
    'nz': 'new zealand',
    'ca': 'canada',
    'sg': 'singapore',
    'hk': 'hong kong',
    'jp': 'japan',
    'kr': 'south korea',
    'cn': 'china',
    'in': 'india',
    'br': 'brazil',
    'mx': 'mexico',
    'za': 'south africa',
    'il': 'israel',
    'sa': 'saudi arabia',
  };
  return countryMap[lower] || lower;
}

/** Build a PDL SQL WHERE clause from SearchParams */
function buildSqlQuery(params: SearchParams): string {
  const clauses: string[] = [];

  // Job titles — OR together
  if (params.job_titles.length > 0) {
    const titleClauses = params.job_titles.map(t => `job_title='${sqlEscape(t)}'`);
    clauses.push(titleClauses.length === 1 ? titleClauses[0] : `(${titleClauses.join(' OR ')})`);
  }

  // Locations — map to location_country, normalizing codes like "UK" → "united kingdom"
  if (params.locations?.length) {
    const locClauses = params.locations.map(loc => {
      if (loc.includes(',')) {
        const country = normalizeCountry(loc.split(',').pop()!.trim());
        return `location_country='${sqlEscape(country)}'`;
      }
      return `location_country='${sqlEscape(normalizeCountry(loc))}'`;
    });
    clauses.push(locClauses.length === 1 ? locClauses[0] : `(${locClauses.join(' OR ')})`);
  }

  // Seniority levels — PDL uses field='value' for array containment
  const titleLevels = mapSeniority(params.seniority_levels);
  if (titleLevels?.length) {
    const levelClauses = titleLevels.map(l => `job_title_levels='${sqlEscape(l)}'`);
    clauses.push(levelClauses.length === 1 ? levelClauses[0] : `(${levelClauses.join(' OR ')})`);
  }

  // Industries
  if (params.industries?.length) {
    const indClauses = params.industries.map(i => `industry='${sqlEscape(i.toLowerCase())}'`);
    clauses.push(indClauses.length === 1 ? indClauses[0] : `(${indClauses.join(' OR ')})`);
  }

  // Current companies
  if (params.current_companies?.length) {
    const compClauses = params.current_companies.map(c => `job_company_name='${sqlEscape(c)}'`);
    clauses.push(compClauses.length === 1 ? compClauses[0] : `(${compClauses.join(' OR ')})`);
  }

  return `SELECT * FROM person WHERE ${clauses.join(' AND ')}`;
}

/** Search for people using PDL's person search endpoint with SQL */
export async function pdlSearch(params: SearchParams): Promise<PersonProfile[]> {
  const apiKey = getApiKey();
  const maxResults = params.max_results || 25;

  const sql = buildSqlQuery(params);

  await rateLimiter.acquire();
  try {
    const res = await fetch(`${PDL_BASE}/person/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        sql,
        size: Math.min(maxResults, 100),
        dataset: 'all',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`PDL search failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const people = data.data || [];

    const profiles: PersonProfile[] = [];
    for (const person of people) {
      const profile = normalizeProfile(person);
      if (profile) profiles.push(profile);
    }

    return profiles.slice(0, maxResults);
  } finally {
    rateLimiter.release();
  }
}

/** Enrich a person by LinkedIn URL, name+company, or email using PDL */
export async function pdlEnrich(opts: {
  linkedin_url?: string;
  name?: string;
  company?: string;
  email?: string;
}): Promise<PersonProfile | null> {
  const apiKey = getApiKey();

  const queryParams = new URLSearchParams();

  if (opts.linkedin_url) {
    queryParams.set('profile', opts.linkedin_url);
  } else if (opts.name && opts.company) {
    queryParams.set('name', opts.name);
    queryParams.set('company', opts.company);
  } else if (opts.email) {
    queryParams.set('email', opts.email);
  } else {
    throw new Error('Provide linkedin_url, name+company, or email for enrichment');
  }

  await rateLimiter.acquire();
  try {
    const res = await fetch(`${PDL_BASE}/person/enrich?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
      },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      const errText = await res.text();
      throw new Error(`PDL enrich failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return normalizeProfile(data.data || data);
  } finally {
    rateLimiter.release();
  }
}
