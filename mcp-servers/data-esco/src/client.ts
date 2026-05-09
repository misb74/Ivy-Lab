import { RateLimiter } from '@auxia/shared';

const BASE_URL = 'https://ec.europa.eu/esco/api';

export class EscoClient {
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter({ requestsPerMinute: 60, maxConcurrent: 3 });
  }

  private async request<T>(path: string): Promise<T> {
    await this.rateLimiter.acquire();
    try {
      const url = `${BASE_URL}${path}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`ESCO API error ${res.status}: ${errorText}`);
      }

      return (await res.json()) as T;
    } finally {
      this.rateLimiter.release();
    }
  }

  async searchOccupations(
    query: string,
    language: string = 'en',
    limit: number = 20
  ): Promise<any[]> {
    const params = new URLSearchParams({
      text: query,
      type: 'occupation',
      language,
      limit: String(limit),
    });

    const data = await this.request<{ _embedded?: { results: any[] }; total?: number }>(
      `/search?${params}`
    );

    const results = data._embedded?.results || [];

    return results.map((item: any) => ({
      uri: item.uri,
      title: item.title,
      class_name: item.className,
      data_source: 'esco',
      metadata: {
        total_results: data.total,
      },
    }));
  }

  async getOccupation(uri: string, language: string = 'en'): Promise<any> {
    const params = new URLSearchParams({ uri, language });

    const data = await this.request<any>(`/resource/occupation?${params}`);

    return {
      uri: data.uri,
      title: data.title,
      description: data.description,
      code: data.code,
      isco_group: data.iscoGroup,
      data_source: 'esco',
      essential_skills: (data._links?.hasEssentialSkill || []).map((s: any) => ({
        uri: s.uri,
        title: s.title,
      })),
      optional_skills: (data._links?.hasOptionalSkill || []).map((s: any) => ({
        uri: s.uri,
        title: s.title,
      })),
      broader_occupations: (data._links?.broaderOccupation || []).map((o: any) => ({
        uri: o.uri,
        title: o.title,
      })),
    };
  }

  async searchSkills(
    query: string,
    language: string = 'en',
    limit: number = 20
  ): Promise<any[]> {
    const params = new URLSearchParams({
      text: query,
      type: 'skill',
      language,
      limit: String(limit),
    });

    const data = await this.request<{ _embedded?: { results: any[] }; total?: number }>(
      `/search?${params}`
    );

    const results = data._embedded?.results || [];

    return results.map((item: any) => ({
      uri: item.uri,
      title: item.title,
      class_name: item.className,
      data_source: 'esco',
      metadata: {
        total_results: data.total,
      },
    }));
  }

  async getSkillsForOccupation(
    uri: string,
    language: string = 'en'
  ): Promise<{ essential: any[]; optional: any[] }> {
    const params = new URLSearchParams({ uri, language });

    const data = await this.request<any>(`/resource/occupation?${params}`);

    return {
      essential: (data._links?.hasEssentialSkill || []).map((s: any) => ({
        uri: s.uri,
        title: s.title,
        data_source: 'esco',
      })),
      optional: (data._links?.hasOptionalSkill || []).map((s: any) => ({
        uri: s.uri,
        title: s.title,
        data_source: 'esco',
      })),
    };
  }
}
