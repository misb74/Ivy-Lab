import { RateLimiter } from '@auxia/shared';
import type { JobPosting, Compensation, WageData } from '@auxia/shared';

const BASE_URL = 'https://api.adzuna.com/v1/api/jobs';

const COUNTRY_CURRENCIES: Record<string, string> = {
  us: 'USD',
  gb: 'GBP',
  uk: 'GBP',
  ca: 'CAD',
  au: 'AUD',
  de: 'EUR',
  fr: 'EUR',
  nl: 'EUR',
  it: 'EUR',
  es: 'EUR',
  at: 'EUR',
  be: 'EUR',
  br: 'BRL',
  in: 'INR',
  nz: 'NZD',
  pl: 'PLN',
  sg: 'SGD',
  za: 'ZAR',
  ru: 'RUB',
  mx: 'MXN',
};

const LOCATION_COUNTRY_HINTS: Record<string, string> = {
  'new york': 'us',
  'los angeles': 'us',
  'san francisco': 'us',
  'chicago': 'us',
  'boston': 'us',
  'seattle': 'us',
  'austin': 'us',
  'denver': 'us',
  'miami': 'us',
  'houston': 'us',
  'dallas': 'us',
  'atlanta': 'us',
  'washington': 'us',
  'london': 'gb',
  'manchester': 'gb',
  'birmingham': 'gb',
  'edinburgh': 'gb',
  'bristol': 'gb',
  'leeds': 'gb',
  'glasgow': 'gb',
  'cambridge': 'gb',
  'oxford': 'gb',
  'toronto': 'ca',
  'vancouver': 'ca',
  'montreal': 'ca',
  'ottawa': 'ca',
  'calgary': 'ca',
  'sydney': 'au',
  'melbourne': 'au',
  'brisbane': 'au',
  'perth': 'au',
  'berlin': 'de',
  'munich': 'de',
  'hamburg': 'de',
  'frankfurt': 'de',
  'paris': 'fr',
  'lyon': 'fr',
  'amsterdam': 'nl',
  'singapore': 'sg',
  'mumbai': 'in',
  'bangalore': 'in',
  'delhi': 'in',
  'sao paulo': 'br',
  'rio de janeiro': 'br',
  'mexico city': 'mx',
  'auckland': 'nz',
  'wellington': 'nz',
  'cape town': 'za',
  'johannesburg': 'za',
  'warsaw': 'pl',
  'moscow': 'ru',
};

export class AdzunaClient {
  private appId: string;
  private appKey: string;
  private rateLimiter: RateLimiter;

  constructor() {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;

    if (!appId || !appKey) {
      throw new Error('ADZUNA_APP_ID and ADZUNA_APP_KEY must be set');
    }

    this.appId = appId;
    this.appKey = appKey;

    // 1 request per second = 60 requests per minute
    this.rateLimiter = new RateLimiter({ requestsPerMinute: 60, maxConcurrent: 1 });
  }

  private async request<T>(url: string): Promise<T> {
    await this.rateLimiter.acquire();
    try {
      const separator = url.includes('?') ? '&' : '?';
      const fullUrl = `${url}${separator}app_id=${this.appId}&app_key=${this.appKey}`;

      const res = await fetch(fullUrl, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Adzuna API error ${res.status}: ${errorText}`);
      }

      return (await res.json()) as T;
    } finally {
      this.rateLimiter.release();
    }
  }

  detectCountry(location?: string, country?: string): string {
    if (country) {
      return country.toLowerCase();
    }
    if (location) {
      const lowerLoc = location.toLowerCase();
      for (const [city, cc] of Object.entries(LOCATION_COUNTRY_HINTS)) {
        if (lowerLoc.includes(city)) {
          return cc;
        }
      }
    }
    return 'us'; // Default to US
  }

  async searchJobs(opts: {
    company: string;
    location?: string;
    country?: string;
    maxResults?: number;
    what?: string;
  }): Promise<JobPosting[]> {
    const countryCode = this.detectCountry(opts.location, opts.country);
    const maxResults = opts.maxResults || 20;
    const resultsPerPage = Math.min(maxResults, 50);

    const params = new URLSearchParams({
      results_per_page: String(resultsPerPage),
      content_type: 'application/json',
    });

    // Build what/what_and query
    const whatParts: string[] = [];
    if (opts.company) whatParts.push(opts.company);
    if (opts.what) whatParts.push(opts.what);

    if (whatParts.length > 0) {
      params.set('what', whatParts.join(' '));
    }

    if (opts.location) {
      params.set('where', opts.location);
    }

    const url = `${BASE_URL}/${countryCode}/search/1?${params}`;
    const data = await this.request<{ results: any[]; count?: number }>(url);

    const currency = COUNTRY_CURRENCIES[countryCode] || 'USD';

    return (data.results || []).map((job: any) => ({
      title: job.title,
      company: job.company?.display_name || opts.company,
      location: job.location?.display_name || opts.location || '',
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      currency,
      category: job.category?.label,
      description: job.description,
      posted_date: job.created,
      source: 'adzuna',
      source_url: job.redirect_url,
      country_code: countryCode.toUpperCase(),
      metadata: {
        contract_type: job.contract_type,
        contract_time: job.contract_time,
        latitude: job.latitude,
        longitude: job.longitude,
        adzuna_id: job.id,
      },
    }));
  }

  async searchJobsBySkill(opts: {
    skill: string;
    location?: string;
    country?: string;
    maxResults?: number;
  }): Promise<JobPosting[]> {
    return this.searchJobs({
      company: '',
      what: opts.skill,
      location: opts.location,
      country: opts.country,
      maxResults: opts.maxResults,
    });
  }

  async getSalaryData(opts: {
    company: string;
    role?: string;
    country?: string;
  }): Promise<Compensation> {
    const countryCode = this.detectCountry(undefined, opts.country);
    const currency = COUNTRY_CURRENCIES[countryCode] || 'USD';

    // Search for jobs at this company (with optional role) to compute salary stats
    const searchQuery = opts.role
      ? `${opts.company} ${opts.role}`
      : opts.company;

    const params = new URLSearchParams({
      what: searchQuery,
      results_per_page: '50',
      content_type: 'application/json',
    });

    const url = `${BASE_URL}/${countryCode}/search/1?${params}`;
    const data = await this.request<{ results: any[]; count?: number; mean?: number }>(url);

    const results = data.results || [];

    // Compute salary statistics from job postings
    const salaries: number[] = [];
    for (const job of results) {
      if (job.salary_min && job.salary_max) {
        salaries.push((job.salary_min + job.salary_max) / 2);
      } else if (job.salary_min) {
        salaries.push(job.salary_min);
      } else if (job.salary_max) {
        salaries.push(job.salary_max);
      }
    }

    salaries.sort((a, b) => a - b);

    const wages: WageData = {};

    if (salaries.length > 0) {
      const sum = salaries.reduce((a, b) => a + b, 0);
      wages.mean = Math.round(sum / salaries.length);
      wages.annual_mean = wages.mean;
      wages.median = salaries[Math.floor(salaries.length / 2)];
      wages.p10 = salaries[Math.floor(salaries.length * 0.1)] || salaries[0];
      wages.p25 = salaries[Math.floor(salaries.length * 0.25)] || salaries[0];
      wages.p75 =
        salaries[Math.floor(salaries.length * 0.75)] ||
        salaries[salaries.length - 1];
      wages.p90 =
        salaries[Math.floor(salaries.length * 0.9)] ||
        salaries[salaries.length - 1];
    }

    // Also try histogram endpoint for more accurate data
    try {
      const histParams = new URLSearchParams({
        what: searchQuery,
        content_type: 'application/json',
      });
      const histUrl = `${BASE_URL}/${countryCode}/histogram?${histParams}`;
      const histData = await this.request<{ histogram: Record<string, number> }>(histUrl);

      if (histData.histogram) {
        const bins = Object.entries(histData.histogram)
          .map(([k, v]) => ({ salary: parseInt(k), count: v }))
          .sort((a, b) => a.salary - b.salary);

        if (bins.length > 0) {
          const totalCount = bins.reduce((sum, b) => sum + b.count, 0);
          const weightedSum = bins.reduce((sum, b) => sum + b.salary * b.count, 0);
          if (totalCount > 0) {
            wages.mean = Math.round(weightedSum / totalCount);
            wages.annual_mean = wages.mean;
          }
        }
      }
    } catch {
      // Histogram endpoint may not be available for all countries
    }

    return {
      role: opts.role || opts.company,
      location: countryCode.toUpperCase(),
      wages,
      currency,
      data_source: 'adzuna',
      metadata: {
        company: opts.company,
        total_postings_analyzed: salaries.length,
        total_postings_found: data.count || results.length,
      },
    };
  }

  async getCategories(country?: string): Promise<{ tag: string; label: string }[]> {
    const countryCode = this.detectCountry(undefined, country);
    const url = `${BASE_URL}/${countryCode}/categories`;
    const data = await this.request<{ results: any[] }>(url);

    return (data.results || []).map((cat: any) => ({
      tag: cat.tag,
      label: cat.label,
    }));
  }
}
