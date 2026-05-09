import { OAuthClient, FileCache, Skill, SkillCategory } from '@auxia/shared';

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
      scopeCandidates: ['emsi_open'],
    });
  }
  return oauthClient;
}

const cache = new FileCache('hr-skills-adjacent', 3600 * 1000);

interface RelatedSkill {
  skill: Skill;
  relevance_score: number;
  co_occurrence_count?: number;
}

interface AdjacentResult {
  source_skill: string;
  related_skills: RelatedSkill[];
  total_count: number;
  data_source: string;
}

async function lookupSkillId(skillName: string, token: string): Promise<string | null> {
  const response = await fetch(
    `https://emsiservices.com/skills/versions/latest/skills?q=${encodeURIComponent(skillName)}&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) return null;
  const data = await response.json();
  const skills = data.data || [];
  return skills.length > 0 ? skills[0].id : null;
}

/**
 * Fetch adjacent skills using data-driven approach:
 * 1. Lightcast related skills API (co-occurrence from job postings)
 * 2. Lightcast job postings co-occurrence enrichment (skills that appear together)
 *
 * Inspired by Claude Code's pattern of learning from real data rather
 * than hardcoded relationship graphs.
 */
export async function getAdjacentSkills(
  skillName: string,
  limit: number = 15
): Promise<AdjacentResult> {
  const cacheKey = `adjacent_v2:${skillName}:${limit}`;
  const cached = await cache.get<AdjacentResult>(cacheKey);
  if (cached) return cached;

  const client = getOAuthClient();
  const token = await client.getToken();

  // First, look up the skill ID
  const skillId = await lookupSkillId(skillName, token);
  if (!skillId) {
    throw new Error(`Could not find skill in Lightcast taxonomy: ${skillName}`);
  }

  // Source 1: Lightcast related skills API (primary)
  const relatedPromise = fetchRelatedSkills(skillId, token, limit);

  // Source 2: Co-occurrence from job postings (enrichment)
  const coOccurrencePromise = fetchCoOccurrenceSkills(skillName, token, Math.ceil(limit * 1.5));

  const [relatedSkills, coOccurrenceSkills] = await Promise.all([
    relatedPromise.catch(() => [] as RelatedSkill[]),
    coOccurrencePromise.catch(() => [] as RelatedSkill[]),
  ]);

  // Merge and deduplicate: prefer co-occurrence data when available
  const mergedMap = new Map<string, RelatedSkill>();

  for (const skill of relatedSkills) {
    mergedMap.set(skill.skill.name.toLowerCase(), skill);
  }

  for (const skill of coOccurrenceSkills) {
    const key = skill.skill.name.toLowerCase();
    const existing = mergedMap.get(key);
    if (existing) {
      // Boost relevance when skill appears in both sources
      existing.relevance_score = Math.min(1.0, existing.relevance_score * 1.2);
      existing.co_occurrence_count = skill.co_occurrence_count || existing.co_occurrence_count;
      existing.skill.data_source = 'lightcast (related + co-occurrence)';
    } else {
      mergedMap.set(key, skill);
    }
  }

  const merged = Array.from(mergedMap.values())
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, limit);

  const result: AdjacentResult = {
    source_skill: skillName,
    related_skills: merged,
    total_count: merged.length,
    data_source: coOccurrenceSkills.length > 0
      ? 'lightcast (related + co-occurrence from job postings)'
      : 'lightcast',
  };

  await cache.set(cacheKey, result);
  return result;
}

async function fetchRelatedSkills(
  skillId: string,
  token: string,
  limit: number,
): Promise<RelatedSkill[]> {
  const response = await fetch(
    `https://emsiservices.com/skills/versions/latest/related`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: [skillId], limit }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lightcast related skills request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const relatedRaw = data.data || [];

  return relatedRaw.map((item: any) => ({
    skill: {
      id: item.id,
      name: item.name,
      type_id: item.type?.id,
      type_name: item.type?.name,
      category: item.type?.id === 'ST2' ? SkillCategory.SOFT_SKILL : SkillCategory.HARD_SKILL,
      info_url: item.infoUrl,
      data_source: 'lightcast',
    } as Skill,
    relevance_score: item.confidence || item.score || 0,
    co_occurrence_count: item.coOccurrenceCount,
  }));
}

/**
 * Fetch skills that co-occur with the given skill in recent job postings.
 * Uses Lightcast job postings filter to find skills commonly requested together.
 */
async function fetchCoOccurrenceSkills(
  skillName: string,
  token: string,
  limit: number,
): Promise<RelatedSkill[]> {
  try {
    // Use Lightcast's JPA (Job Posting Analytics) to find co-occurring skills
    const response = await fetch(
      `https://emsiservices.com/jpa/rankings/skills`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: {
            when: { start: getThreeMonthsAgo(), end: getToday() },
            skills: { include: [{ name: skillName }] },
          },
          rank: { by: 'unique_postings', limit },
        }),
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const rankings = data.data?.ranking?.buckets || [];

    return rankings
      .filter((bucket: any) => bucket.name?.toLowerCase() !== skillName.toLowerCase())
      .map((bucket: any) => ({
        skill: {
          id: bucket.id || '',
          name: bucket.name,
          data_source: 'lightcast (job posting co-occurrence)',
        } as Skill,
        relevance_score: bucket.unique_postings
          ? Math.min(1.0, bucket.unique_postings / (rankings[0]?.unique_postings || 1))
          : 0.5,
        co_occurrence_count: bucket.unique_postings,
      }));
  } catch {
    return [];
  }
}

function getThreeMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().split('T')[0];
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}
