import { RateLimiter } from '@auxia/shared';
import type { PersonProfile, SearchParams } from './types.js';

const APOLLO_BASE = 'https://api.apollo.io/api/v1';

const rateLimiter = new RateLimiter({ requestsPerMinute: 45, maxConcurrent: 2 });

function getApiKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error('APOLLO_API_KEY not set');
  return key;
}

/** Map seniority level strings to Apollo seniority values */
function mapSeniority(levels?: string[]): string[] | undefined {
  if (!levels?.length) return undefined;
  const mapping: Record<string, string> = {
    c_suite: 'c_suite',
    vp: 'vp',
    director: 'director',
    manager: 'manager',
    senior: 'senior',
  };
  return levels.map(l => mapping[l] || l).filter(Boolean);
}

/** Map company size strings to Apollo employee ranges */
function mapCompanySizes(sizes?: string[]): string[] | undefined {
  if (!sizes?.length) return undefined;
  // Apollo uses ranges like "1,10", "11,50", "51,200", "201,500", "501,1000", "1001,5000", "5001,10000", "10001"
  const mapping: Record<string, string> = {
    '1-10': '1,10',
    '11-50': '11,50',
    '51-200': '51,200',
    '201-500': '201,500',
    '501-1000': '501,1000',
    '1001-5000': '1001,5000',
    '5001-10000': '5001,10000',
    '10000+': '10001',
    '10,000+': '10001',
    '5,000+': '5001,10000',
    '1,000+': '1001,5000',
    '500+': '501,1000',
  };
  return sizes.map(s => mapping[s] || s).filter(Boolean);
}

function normalizeProfile(person: any): PersonProfile | null {
  if (!person) return null;

  const sourceUrl = person.linkedin_url || `https://app.apollo.io/#/people/${person.id}`;
  if (!sourceUrl) return null;

  return {
    name: [person.first_name, person.last_name].filter(Boolean).join(' ') || person.name || 'Unknown',
    first_name: person.first_name || '',
    last_name: person.last_name || '',
    current_title: person.title || '',
    current_company: person.organization?.name || person.organization_name || '',
    linkedin_url: person.linkedin_url || null,
    source_url: sourceUrl,
    source: 'apollo',
    location: [person.city, person.state, person.country].filter(Boolean).join(', '),
    seniority: person.seniority || '',
    industry: person.organization?.industry || '',
    headline: person.headline || person.title || '',
    employment_history: (person.employment_history || []).map((e: any) => ({
      title: e.title || '',
      company: e.organization_name || '',
      start_date: e.start_date || null,
      end_date: e.end_date || null,
      is_current: e.current || false,
    })),
    education: (person.education || []).map((e: any) => ({
      school: e.school_name || e.organization_name || '',
      degree: e.degree || null,
      field: e.field_of_study || null,
    })),
    skills: person.skills || [],
  };
}

/** Search for people using Apollo's free mixed_people/search endpoint */
export async function apolloSearch(params: SearchParams): Promise<PersonProfile[]> {
  const apiKey = getApiKey();
  const maxResults = params.max_results || 25;
  const perPage = Math.min(maxResults, 25);

  const body: Record<string, any> = {
    page: 1,
    per_page: perPage,
    person_titles: params.job_titles,
  };

  if (params.locations?.length) {
    body.person_locations = params.locations;
  }

  const seniorities = mapSeniority(params.seniority_levels);
  if (seniorities?.length) {
    body.person_seniorities = seniorities;
  }

  if (params.industries?.length) {
    body.q_organization_keyword_tags = params.industries;
  }

  const companySizes = mapCompanySizes(params.company_sizes);
  if (companySizes?.length) {
    body.organization_num_employees_ranges = companySizes;
  }

  if (params.current_companies?.length) {
    body.q_organization_name = params.current_companies.join(' OR ');
  }

  if (params.keywords?.length) {
    body.q_keywords = params.keywords.join(' ');
  }

  const profiles: PersonProfile[] = [];
  let page = 1;
  const maxPages = Math.ceil(maxResults / perPage);

  while (page <= maxPages && profiles.length < maxResults) {
    body.page = page;

    await rateLimiter.acquire();
    try {
      const res = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Apollo search failed (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const people = data.people || [];

      if (people.length === 0) break;

      for (const person of people) {
        const profile = normalizeProfile(person);
        if (profile) profiles.push(profile);
      }

      if (people.length < perPage) break;
      page++;
    } finally {
      rateLimiter.release();
    }
  }

  return profiles.slice(0, maxResults);
}

/** Enrich a person by LinkedIn URL or name+company using Apollo (1 credit/call) */
export async function apolloEnrich(opts: {
  linkedin_url?: string;
  name?: string;
  company?: string;
  email?: string;
}): Promise<PersonProfile | null> {
  const apiKey = getApiKey();

  const body: Record<string, any> = {};

  if (opts.linkedin_url) {
    body.linkedin_url = opts.linkedin_url;
  } else if (opts.name && opts.company) {
    const parts = opts.name.split(' ');
    body.first_name = parts[0] || '';
    body.last_name = parts.slice(1).join(' ') || '';
    body.organization_name = opts.company;
  } else if (opts.email) {
    body.email = opts.email;
  } else {
    throw new Error('Provide linkedin_url, name+company, or email for enrichment');
  }

  await rateLimiter.acquire();
  try {
    const res = await fetch(`${APOLLO_BASE}/people/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Apollo enrich failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return normalizeProfile(data.person);
  } finally {
    rateLimiter.release();
  }
}
