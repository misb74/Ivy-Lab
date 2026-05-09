import { OAuthClient, FileCache, DemandForecast, JobPostingMetrics } from '@auxia/shared';

const LIGHTCAST_TOKEN_URL = 'https://auth.emsicloud.com/connect/token';

let oauthClient: OAuthClient | null = null;

function getOAuthClient(): OAuthClient {
  if (!oauthClient) {
    const clientId = process.env.LIGHTCAST_CLIENT_ID;
    const clientSecret = process.env.LIGHTCAST_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('LIGHTCAST_CLIENT_ID and LIGHTCAST_CLIENT_SECRET must be set');
    }
    oauthClient = new OAuthClient({
      tokenUrl: LIGHTCAST_TOKEN_URL,
      clientId,
      clientSecret,
      scopeCandidates: ['emsi_open', 'postings:us'],
    });
  }
  return oauthClient;
}

const cache = new FileCache('hr-workforce-demand', 3600 * 1000);

interface DemandAnalysis {
  occupation: string;
  location: string;
  posting_metrics: JobPostingMetrics;
  demand_level: 'very_high' | 'high' | 'moderate' | 'low';
  top_employers: string[];
  top_skills_requested: string[];
  salary_range: { min: number | null; max: number | null; median: number | null };
  demand_trend: string;
  data_source: string;
}

function assessDemandLevel(totalPostings: number): 'very_high' | 'high' | 'moderate' | 'low' {
  if (totalPostings > 10000) return 'very_high';
  if (totalPostings > 3000) return 'high';
  if (totalPostings > 500) return 'moderate';
  return 'low';
}

export async function analyzeDemand(
  occupation: string,
  location: string = 'National'
): Promise<DemandAnalysis> {
  const cacheKey = `demand:${occupation}:${location}`;
  const cached = await cache.get<DemandAnalysis>(cacheKey);
  if (cached) return cached;

  const client = getOAuthClient();
  const token = await client.getToken();

  const filter: Record<string, any> = {
    when: {
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    },
    title_name: [occupation],
  };

  if (location && location !== 'National') {
    filter.city_name = [location];
  }

  // Get total posting count and top employers
  const [totalsRes, employersRes, skillsRes] = await Promise.all([
    fetch('https://emsiservices.com/jpa/totals', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter }),
    }),
    fetch('https://emsiservices.com/jpa/rankings/company_name', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter, rank: { by: 'unique_postings', limit: 10 } }),
    }),
    fetch('https://emsiservices.com/jpa/rankings/skills', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter, rank: { by: 'unique_postings', limit: 15 } }),
    }),
  ]);

  let totalPostings = 0;
  let uniquePostings = 0;
  let medianSalary: number | null = null;
  let medianDuration: number | null = null;

  if (totalsRes.ok) {
    const totalsData = await totalsRes.json();
    totalPostings = totalsData.data?.totals?.total_postings || 0;
    uniquePostings = totalsData.data?.totals?.unique_postings || 0;
    medianSalary = totalsData.data?.totals?.median_salary || null;
    medianDuration = totalsData.data?.totals?.median_posting_duration || null;
  }

  let topEmployers: string[] = [];
  if (employersRes.ok) {
    const employersData = await employersRes.json();
    const buckets = employersData.data?.ranking?.buckets || [];
    topEmployers = buckets.map((b: any) => b.name).filter(Boolean);
  }

  let topSkills: string[] = [];
  if (skillsRes.ok) {
    const skillsData = await skillsRes.json();
    const buckets = skillsData.data?.ranking?.buckets || [];
    topSkills = buckets.map((b: any) => b.name).filter(Boolean);
  }

  const demandLevel = assessDemandLevel(uniquePostings || totalPostings);

  const result: DemandAnalysis = {
    occupation,
    location,
    posting_metrics: {
      total_postings: totalPostings,
      unique_postings: uniquePostings,
      median_posting_duration: medianDuration ?? undefined,
      median_salary: medianSalary ?? undefined,
    },
    demand_level: demandLevel,
    top_employers: topEmployers,
    top_skills_requested: topSkills,
    salary_range: {
      min: null,
      max: null,
      median: medianSalary,
    },
    demand_trend: uniquePostings > 1000 ? 'Growing — significant hiring activity' : 'Stable',
    data_source: 'lightcast_jpa',
  };

  await cache.set(cacheKey, result);
  return result;
}
