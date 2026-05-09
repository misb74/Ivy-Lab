import { OAuthClient, RateLimiter } from '@auxia/shared';
import type { Skill, TrendingSkill, JobPostingMetrics, DemandForecast } from '@auxia/shared';

const AUTH_URL = 'https://auth.emsicloud.com/connect/token';
const SKILLS_API = 'https://emsiservices.com/skills';
const JPA_US = 'https://emsiservices.com/jpa';
const JPA_UK = 'https://emsiservices.com/uk-jpa';

export class LightcastClient {
  private oauth: OAuthClient;
  private rateLimiter: RateLimiter;

  constructor() {
    const clientId = process.env.LIGHTCAST_CLIENT_ID;
    const clientSecret = process.env.LIGHTCAST_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('LIGHTCAST_CLIENT_ID and LIGHTCAST_CLIENT_SECRET must be set');
    }

    const scopeCandidates = process.env.LIGHTCAST_SCOPE
      ? [process.env.LIGHTCAST_SCOPE]
      : ['classification_api', 'lightcast_open', 'emsi_open'];

    this.oauth = new OAuthClient({
      tokenUrl: AUTH_URL,
      clientId,
      clientSecret,
      scopeCandidates,
    });

    this.rateLimiter = new RateLimiter({ requestsPerMinute: 30, maxConcurrent: 3 });
  }

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    await this.rateLimiter.acquire();
    try {
      const token = await this.oauth.getToken();
      const res = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Lightcast API error ${res.status}: ${errorText}`);
      }

      return (await res.json()) as T;
    } finally {
      this.rateLimiter.release();
    }
  }

  private getJpaUrl(country?: string): string {
    if (country?.toLowerCase() === 'uk' || country?.toLowerCase() === 'gb') {
      return JPA_UK;
    }
    return JPA_US;
  }

  async searchSkills(query: string, limit: number = 10): Promise<Skill[]> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const data = await this.request<{ data: any[] }>(`${SKILLS_API}/versions/latest/skills?${params}`);

    return (data.data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      type_id: item.type?.id,
      type_name: item.type?.name,
      description: item.description,
      info_url: item.infoUrl,
      data_source: 'lightcast',
    }));
  }

  async extractSkills(
    text: string,
    confidenceThreshold: number = 0.5
  ): Promise<Skill[]> {
    const data = await this.request<{ data: any[] }>(`${SKILLS_API}/versions/latest/extract`, {
      method: 'POST',
      body: JSON.stringify({ text, confidenceThreshold }),
    });

    return (data.data || []).map((item: any) => ({
      id: item.skill?.id || item.id,
      name: item.skill?.name || item.name,
      type_id: item.skill?.type?.id,
      type_name: item.skill?.type?.name,
      confidence: item.confidence,
      data_source: 'lightcast',
    }));
  }

  async extractSkillsBatch(
    texts: string[],
    confidenceThreshold: number = 0.5
  ): Promise<Skill[][]> {
    const results: Skill[][] = [];
    for (const text of texts) {
      const skills = await this.extractSkills(text, confidenceThreshold);
      results.push(skills);
    }
    return results;
  }

  async getRelatedSkills(skillId: string, limit: number = 10): Promise<Skill[]> {
    const data = await this.request<{ data: any[] }>(
      `${SKILLS_API}/versions/latest/skills/${skillId}/related?limit=${limit}`
    );

    return (data.data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      type_id: item.type?.id,
      type_name: item.type?.name,
      data_source: 'lightcast',
    }));
  }

  async getJobPostingMetrics(
    occupationCode?: string,
    location?: string,
    country?: string
  ): Promise<JobPostingMetrics> {
    const jpaUrl = this.getJpaUrl(country);
    const filter: Record<string, any> = {};

    if (occupationCode) {
      filter.soc5_code = [occupationCode];
    }
    if (location) {
      filter.city_name = [location];
    }

    const body = {
      filter,
      metrics: ['total_postings', 'unique_postings', 'median_posting_duration', 'median_salary'],
    };

    const data = await this.request<{ data: any }>(`${jpaUrl}/timeseries`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const latest = Array.isArray(data.data) ? data.data[data.data.length - 1] : data.data;

    return {
      total_postings: latest?.total_postings ?? 0,
      unique_postings: latest?.unique_postings,
      median_posting_duration: latest?.median_posting_duration,
      median_salary: latest?.median_salary,
    };
  }

  async getTrendingSkills(
    occupationCode?: string,
    location?: string,
    limit: number = 20,
    country?: string
  ): Promise<TrendingSkill[]> {
    const jpaUrl = this.getJpaUrl(country);
    const filter: Record<string, any> = {};

    if (occupationCode) {
      filter.soc5_code = [occupationCode];
    }
    if (location) {
      filter.city_name = [location];
    }

    const body = {
      filter,
      rank: {
        by: 'unique_postings',
        limit,
      },
      nested_rank: {
        by: 'significance',
        limit,
      },
    };

    const data = await this.request<{ data: { ranking: any } }>(`${jpaUrl}/rankings/skills`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const buckets = data.data?.ranking?.buckets || [];

    return buckets.map((bucket: any) => ({
      skill: {
        id: bucket.id || bucket.name,
        name: bucket.name,
        data_source: 'lightcast',
      },
      trend: bucket.significance > 1.2 ? 'growing' : bucket.significance < 0.8 ? 'declining' : 'stable',
      growth_rate: bucket.significance || 0,
      job_posting_count: bucket.unique_postings || 0,
    }));
  }

  async getDemandForecast(
    occupationCode: string,
    location?: string,
    country?: string
  ): Promise<DemandForecast> {
    const jpaUrl = this.getJpaUrl(country);
    const filter: Record<string, any> = {
      soc5_code: [occupationCode],
    };

    if (location) {
      filter.city_name = [location];
    }

    const body = {
      filter,
      metrics: ['total_postings', 'unique_postings'],
    };

    const data = await this.request<{ data: any }>(`${jpaUrl}/timeseries`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const timeseries = Array.isArray(data.data) ? data.data : [];
    const latest = timeseries[timeseries.length - 1];
    const currentPostings = latest?.unique_postings ?? latest?.total_postings ?? 0;

    let demandLevel = 'moderate';
    if (currentPostings > 10000) demandLevel = 'very_high';
    else if (currentPostings > 5000) demandLevel = 'high';
    else if (currentPostings < 500) demandLevel = 'low';

    // Get top employers
    const employerBody = {
      filter,
      rank: { by: 'unique_postings', limit: 10 },
    };

    let topEmployers: string[] = [];
    try {
      const employerData = await this.request<{ data: { ranking: any } }>(
        `${jpaUrl}/rankings/company_name`,
        {
          method: 'POST',
          body: JSON.stringify(employerBody),
        }
      );
      topEmployers = (employerData.data?.ranking?.buckets || []).map(
        (b: any) => b.name
      );
    } catch {
      // Employer ranking may not be available
    }

    return {
      occupation: occupationCode,
      location,
      current_postings: currentPostings,
      demand_level: demandLevel,
      top_employers: topEmployers,
      data_source: 'lightcast',
    };
  }
}
