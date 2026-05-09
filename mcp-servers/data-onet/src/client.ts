import type {
  Occupation,
  OccupationDetails,
  OccupationTask,
  OccupationSkill,
  OccupationKnowledge,
  OccupationAbility,
  OccupationTechnology,
  OccupationEducation,
  CareerTransition,
  CareerPath,
} from '@auxia/shared';

const BASE_URL = 'https://api-v2.onetcenter.org';

export class ONetClient {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.ONET_API_KEY;
    if (!apiKey) {
      throw new Error('ONET_API_KEY must be set');
    }
    this.apiKey = apiKey;
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      headers: {
        'X-API-Key': this.apiKey,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`O*NET API error ${res.status}: ${errorText}`);
    }

    return (await res.json()) as T;
  }

  /**
   * Paginated fetcher — collects all pages from a v2 paginated endpoint.
   * `key` is the response array field name (e.g. 'task', 'element', 'career').
   */
  private async fetchAllPages<T>(path: string, key: string): Promise<T[]> {
    const items: T[] = [];
    let url: string | null = path;
    while (url) {
      const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
      const res = await fetch(fullUrl, {
        headers: { 'X-API-Key': this.apiKey, 'Accept': 'application/json' },
      });
      if (!res.ok) break;
      const data = await res.json() as Record<string, any>;
      const page = data[key] || [];
      items.push(...page);
      url = data.next || null;
    }
    return items;
  }

  async searchOccupations(keyword: string, limit: number = 20): Promise<Occupation[]> {
    const params = new URLSearchParams({ keyword, start: '1', end: String(limit) });
    const data = await this.request<{ career: any[] }>(`/mnm/search?${params}`);

    return (data.career || []).map((occ: any) => ({
      code: occ.code,
      title: occ.title,
      description: occ.title, // v2 mnm/search doesn't return description
      data_source: 'onet',
      metadata: { bright_outlook: occ.tags?.bright_outlook },
    }));
  }

  async getOccupation(code: string): Promise<Occupation> {
    const data = await this.request<any>(`/mnm/careers/${code}/`);

    return {
      code: data.code,
      title: data.title,
      description: data.what_they_do || data.title,
      data_source: 'onet',
      metadata: {
        bright_outlook: data.tags?.bright_outlook,
        green: data.tags?.green,
        sample_of_reported_titles: data.also_called?.title || [],
      },
    };
  }

  async getOccupationDetails(code: string): Promise<OccupationDetails> {
    // Fetch all detail categories in parallel
    const [occupation, tasks, skills, knowledge, abilities, tech, education] = await Promise.all([
      this.getOccupation(code),
      this.fetchTasks(code),
      this.fetchSkills(code),
      this.fetchKnowledge(code),
      this.fetchAbilities(code),
      this.fetchTechnologies(code),
      this.fetchEducation(code),
    ]);

    return {
      ...occupation,
      tasks,
      skills,
      knowledge,
      abilities,
      technologies: tech,
      education,
      related_occupations: [],
      bright_outlook: occupation.metadata?.bright_outlook,
      green_occupation: occupation.metadata?.green,
      sample_titles: occupation.metadata?.sample_of_reported_titles,
    };
  }

  private async fetchTasks(code: string): Promise<OccupationTask[]> {
    try {
      const tasks = await this.fetchAllPages<any>(
        `/online/occupations/${code}/details/tasks?start=1&end=50`, 'task'
      );
      return tasks.map((t: any) => ({
        id: t.id || '',
        statement: t.title || t.statement || '',
        importance: t.importance,
        category: t.category,
      }));
    } catch {
      return [];
    }
  }

  private async fetchSkills(code: string): Promise<OccupationSkill[]> {
    try {
      const elements = await this.fetchAllPages<any>(
        `/online/occupations/${code}/details/skills?start=1&end=50`, 'element'
      );
      return elements.map((s: any) => ({
        id: s.id || '',
        name: s.name,
        description: s.description || '',
        level: s.importance ?? 0,
        importance: s.importance ?? 0,
        category: 'general',
      }));
    } catch {
      return [];
    }
  }

  private async fetchKnowledge(code: string): Promise<OccupationKnowledge[]> {
    try {
      const elements = await this.fetchAllPages<any>(
        `/online/occupations/${code}/details/knowledge?start=1&end=50`, 'element'
      );
      return elements.map((k: any) => ({
        id: k.id || '',
        name: k.name,
        description: k.description || '',
        level: k.importance ?? 0,
        importance: k.importance ?? 0,
      }));
    } catch {
      return [];
    }
  }

  private async fetchAbilities(code: string): Promise<OccupationAbility[]> {
    try {
      const elements = await this.fetchAllPages<any>(
        `/online/occupations/${code}/details/abilities?start=1&end=50`, 'element'
      );
      return elements.map((a: any) => ({
        id: a.id || '',
        name: a.name,
        description: a.description || '',
        level: a.importance ?? 0,
        importance: a.importance ?? 0,
      }));
    } catch {
      return [];
    }
  }

  private async fetchTechnologies(code: string): Promise<OccupationTechnology[]> {
    try {
      const data = await this.request<{ category: any[] }>(
        `/online/occupations/${code}/details/technology_skills?start=1&end=50`
      );
      const results: OccupationTechnology[] = [];
      for (const cat of data.category || []) {
        // Each category has example technologies
        for (const ex of cat.example || []) {
          results.push({
            name: ex.title || ex.name,
            category: cat.title,
            hot_technology: !!ex.hot_technology || !!ex.href?.includes('hot_technology'),
          });
        }
        // If no examples, add the category itself
        if (!cat.example?.length) {
          results.push({
            name: cat.title,
            category: cat.title,
            hot_technology: false,
          });
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  private async fetchEducation(code: string): Promise<OccupationEducation[]> {
    try {
      const data = await this.request<{ response: any[] }>(
        `/online/occupations/${code}/details/education`
      );
      return (data.response || []).map((e: any) => ({
        level: e.title || e.level || '',
        percentage: e.percentage_of_respondents ?? e.percentage ?? 0,
        category: 'education',
      }));
    } catch {
      return [];
    }
  }

  async getCareerChangers(code: string, direction: string = 'both'): Promise<Occupation[]> {
    // v2 API uses /mnm/careers/{code}/explore_more which returns related careers
    try {
      const data = await this.request<{ careers: any[] }>(`/mnm/careers/${code}/explore_more`);
      return (data.careers || []).map((item: any) => ({
        code: item.code,
        title: item.title,
        description: item.title,
        data_source: 'onet',
        metadata: { direction, bright_outlook: item.tags?.bright_outlook },
      }));
    } catch {
      return [];
    }
  }

  async calculateCareerPath(fromCode: string, toCode: string): Promise<CareerPath> {
    // Fetch details for both occupations to compute skill overlap
    const [fromDetails, toDetails] = await Promise.all([
      this.getOccupationDetails(fromCode),
      this.getOccupationDetails(toCode),
    ]);

    const fromSkillNames = new Set(fromDetails.skills.map((s) => s.name.toLowerCase()));
    const toSkillNames = new Set(toDetails.skills.map((s) => s.name.toLowerCase()));

    const commonSkills = [...fromSkillNames].filter((s) => toSkillNames.has(s));
    const allSkills = new Set([...fromSkillNames, ...toSkillNames]);
    const skillOverlap = allSkills.size > 0 ? commonSkills.length / allSkills.size : 0;

    const missingSkills = [...toSkillNames].filter((s) => !fromSkillNames.has(s));

    const fromOccupation: Occupation = {
      code: fromDetails.code,
      title: fromDetails.title,
      description: fromDetails.description,
      data_source: 'onet',
    };

    const toOccupation: Occupation = {
      code: toDetails.code,
      title: toDetails.title,
      description: toDetails.description,
      data_source: 'onet',
    };

    const transition: CareerTransition = {
      from_occupation: fromOccupation,
      to_occupation: toOccupation,
      transition_score: skillOverlap,
      skill_overlap: skillOverlap,
    };

    return {
      from_role: fromDetails.title,
      to_role: toDetails.title,
      steps: [transition],
      total_skill_gaps: missingSkills,
      feasibility_score: skillOverlap,
      data_sources: ['onet'],
    };
  }

  async browseOccupations(careerCluster?: string): Promise<Occupation[]> {
    const keyword = careerCluster || '';
    const params = new URLSearchParams({ keyword, start: '1', end: '50' });
    const data = await this.request<{ career: any[] }>(`/mnm/search?${params}`);

    return (data.career || []).map((occ: any) => ({
      code: occ.code,
      title: occ.title,
      description: occ.title,
      career_cluster: careerCluster,
      data_source: 'onet',
    }));
  }
}
