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

const cache = new FileCache('hr-skills-extract', 3600 * 1000);

interface LightcastSkillResult {
  id: string;
  name: string;
  type?: { id: string; name: string };
  confidence: number;
  infoUrl?: string;
  description?: string;
}

interface ExtractResult {
  skills: Skill[];
  total_count: number;
  filtered_count: number;
  confidence_threshold: number;
}

function classifySkillCategory(typeId?: string, typeName?: string): SkillCategory {
  if (typeId === 'ST1' || typeName === 'Hard Skill') return SkillCategory.HARD_SKILL;
  if (typeId === 'ST2' || typeName === 'Soft Skill') return SkillCategory.SOFT_SKILL;
  if (typeId === 'ST3' || typeName === 'Certification') return SkillCategory.CERTIFICATION;
  return SkillCategory.HARD_SKILL;
}

export async function extractSkills(
  text: string,
  confidenceThreshold: number = 0.5
): Promise<ExtractResult> {
  const cacheKey = `extract:${text.slice(0, 200)}:${confidenceThreshold}`;
  const cached = await cache.get<ExtractResult>(cacheKey);
  if (cached) return cached;

  const client = getOAuthClient();
  const token = await client.getToken();

  const response = await fetch('https://emsiservices.com/skills/versions/latest/extract', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      confidenceThreshold,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lightcast skills extraction failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawSkills: LightcastSkillResult[] = data.data || [];

  const allSkills: Skill[] = rawSkills.map((s) => ({
    id: s.id,
    name: s.name,
    type_id: s.type?.id,
    type_name: s.type?.name,
    category: classifySkillCategory(s.type?.id, s.type?.name),
    confidence: s.confidence,
    description: s.description,
    info_url: s.infoUrl,
    data_source: 'lightcast',
  }));

  const filteredSkills = allSkills.filter((s) => (s.confidence ?? 0) >= confidenceThreshold);

  const result: ExtractResult = {
    skills: filteredSkills,
    total_count: allSkills.length,
    filtered_count: filteredSkills.length,
    confidence_threshold: confidenceThreshold,
  };

  await cache.set(cacheKey, result);
  return result;
}

export async function extractResumeSkills(resumeText: string): Promise<ExtractResult & { sections: Record<string, Skill[]> }> {
  const baseResult = await extractSkills(resumeText, 0.4);

  const sections: Record<string, Skill[]> = {
    hard_skills: [],
    soft_skills: [],
    certifications: [],
  };

  for (const skill of baseResult.skills) {
    switch (skill.category) {
      case SkillCategory.HARD_SKILL:
        sections.hard_skills.push(skill);
        break;
      case SkillCategory.SOFT_SKILL:
        sections.soft_skills.push(skill);
        break;
      case SkillCategory.CERTIFICATION:
        sections.certifications.push(skill);
        break;
      default:
        sections.hard_skills.push(skill);
    }
  }

  return {
    ...baseResult,
    sections,
  };
}

export async function extractLinkedInSkills(profileText: string): Promise<ExtractResult & { endorsement_priority: Skill[] }> {
  const baseResult = await extractSkills(profileText, 0.3);

  const endorsementPriority = [...baseResult.skills]
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 10);

  return {
    ...baseResult,
    endorsement_priority: endorsementPriority,
  };
}
