import { OAuthClient, FileCache, TrendingSkill, Skill, SkillCategory, SkillTrend } from '@auxia/shared';

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

const cache = new FileCache('hr-skills-trending', 3600 * 1000);

interface TrendingResult {
  occupation?: string;
  location?: string;
  trending_skills: TrendingSkill[];
  total_count: number;
  data_source: string;
  time_period: string;
}

function classifyTrend(growthRate: number): SkillTrend {
  if (growthRate > 10) return SkillTrend.GROWING;
  if (growthRate < -5) return SkillTrend.DECLINING;
  return SkillTrend.STABLE;
}

export async function getTrendingSkills(
  occupation?: string,
  location?: string,
  limit: number = 20
): Promise<TrendingResult> {
  const cacheKey = `trending:${occupation || 'all'}:${location || 'all'}:${limit}`;
  const cached = await cache.get<TrendingResult>(cacheKey);
  if (cached) return cached;

  const client = getOAuthClient();
  const token = await client.getToken();

  // Build the job postings filter for Lightcast
  const filter: Record<string, any> = {
    when: {
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    },
  };

  if (occupation) {
    filter.title_name = [occupation];
  }

  if (location) {
    filter.city_name = [location];
  }

  const requestBody = {
    filter,
    rank: {
      by: 'significance',
      limit,
    },
    nested_rank: {
      by: 'significance',
      limit,
    },
  };

  const response = await fetch('https://emsiservices.com/jpa/rankings/skills', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lightcast trending skills request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rankings = data.data?.ranking?.buckets || [];

  const trendingSkills: TrendingSkill[] = rankings.map((bucket: any) => {
    const postingCount = bucket.unique_postings || bucket.doc_count || 0;
    const significancePercent = bucket.significance?.percentage || 0;
    const growthRate = significancePercent;

    return {
      skill: {
        id: bucket.id || bucket.name,
        name: bucket.name,
        category: SkillCategory.HARD_SKILL,
        data_source: 'lightcast',
      } as Skill,
      trend: classifyTrend(growthRate),
      growth_rate: growthRate,
      job_posting_count: postingCount,
    };
  });

  const result: TrendingResult = {
    occupation,
    location,
    trending_skills: trendingSkills,
    total_count: trendingSkills.length,
    data_source: 'lightcast_jpa',
    time_period: 'last_90_days',
  };

  await cache.set(cacheKey, result);
  return result;
}
