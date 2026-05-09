import { FileCache, Skill } from '@auxia/shared';

const ONET_BASE_URL = 'https://api-v2.onetcenter.org';

const cache = new FileCache('hr-skills-match', 3600 * 1000);

interface ONetSkill {
  id: string;
  name: string;
  score: { value: number };
}

interface MatchResult {
  role1: string;
  role2: string;
  role1_skills: string[];
  role2_skills: string[];
  shared_skills: string[];
  role1_unique: string[];
  role2_unique: string[];
  overlap_percentage: number;
  match_score: number;
  gaps: Array<{ skill: string; present_in: string; missing_from: string }>;
  data_source: string;
}

async function getONetHeaders(): Promise<Record<string, string>> {
  const apiKey = process.env.ONET_API_KEY;
  if (!apiKey) throw new Error('ONET_API_KEY must be set');
  return {
    'X-API-Key': apiKey,
    Accept: 'application/json',
  };
}

async function searchOccupation(keyword: string): Promise<string | null> {
  const headers = await getONetHeaders();
  const url = `${ONET_BASE_URL}/online/search?keyword=${encodeURIComponent(keyword)}&end=1`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.occupation || [];
  return results.length > 0 ? results[0].code : null;
}

async function getOccupationSkills(code: string): Promise<string[]> {
  const headers = await getONetHeaders();

  const [skillsRes, knowledgeRes, abilitiesRes] = await Promise.all([
    fetch(`${ONET_BASE_URL}/online/occupations/${code}/summary/skills`, { headers }),
    fetch(`${ONET_BASE_URL}/online/occupations/${code}/summary/knowledge`, { headers }),
    fetch(`${ONET_BASE_URL}/online/occupations/${code}/summary/abilities`, { headers }),
  ]);

  const allSkills: string[] = [];

  if (skillsRes.ok) {
    const skillsData = await skillsRes.json();
    const elements = skillsData.element || [];
    allSkills.push(...elements.map((e: any) => e.name));
  }

  if (knowledgeRes.ok) {
    const knowledgeData = await knowledgeRes.json();
    const elements = knowledgeData.element || [];
    allSkills.push(...elements.map((e: any) => e.name));
  }

  if (abilitiesRes.ok) {
    const abilitiesData = await abilitiesRes.json();
    const elements = abilitiesData.element || [];
    allSkills.push(...elements.map((e: any) => e.name));
  }

  return [...new Set(allSkills)];
}

export async function matchSkills(role1: string, role2: string): Promise<MatchResult> {
  const cacheKey = `match:${role1}:${role2}`;
  const cached = await cache.get<MatchResult>(cacheKey);
  if (cached) return cached;

  const [code1, code2] = await Promise.all([
    searchOccupation(role1),
    searchOccupation(role2),
  ]);

  if (!code1) throw new Error(`Could not find O*NET occupation for: ${role1}`);
  if (!code2) throw new Error(`Could not find O*NET occupation for: ${role2}`);

  const [skills1, skills2] = await Promise.all([
    getOccupationSkills(code1),
    getOccupationSkills(code2),
  ]);

  const set1 = new Set(skills1.map((s) => s.toLowerCase()));
  const set2 = new Set(skills2.map((s) => s.toLowerCase()));

  const shared = skills1.filter((s) => set2.has(s.toLowerCase()));
  const unique1 = skills1.filter((s) => !set2.has(s.toLowerCase()));
  const unique2 = skills2.filter((s) => !set1.has(s.toLowerCase()));

  const totalUnique = new Set([...set1, ...set2]).size;
  const overlapPct = totalUnique > 0 ? (shared.length / totalUnique) * 100 : 0;

  const gaps = [
    ...unique1.map((s) => ({ skill: s, present_in: role1, missing_from: role2 })),
    ...unique2.map((s) => ({ skill: s, present_in: role2, missing_from: role1 })),
  ];

  const result: MatchResult = {
    role1,
    role2,
    role1_skills: skills1,
    role2_skills: skills2,
    shared_skills: shared,
    role1_unique: unique1,
    role2_unique: unique2,
    overlap_percentage: Math.round(overlapPct * 10) / 10,
    match_score: Math.round(overlapPct) / 100,
    gaps,
    data_source: 'onet',
  };

  await cache.set(cacheKey, result);
  return result;
}

export async function compareSkillProfiles(
  text1: string,
  text2: string,
  label1: string = 'Profile 1',
  label2: string = 'Profile 2'
): Promise<{
  label1: string;
  label2: string;
  profile1_skills: string[];
  profile2_skills: string[];
  shared_skills: string[];
  unique_to_1: string[];
  unique_to_2: string[];
  overlap_percentage: number;
  similarity_score: number;
}> {
  // Use Lightcast extraction for both texts
  const { extractSkills } = await import('./extract.js');
  const [result1, result2] = await Promise.all([
    extractSkills(text1, 0.3),
    extractSkills(text2, 0.3),
  ]);

  const skills1 = result1.skills.map((s) => s.name);
  const skills2 = result2.skills.map((s) => s.name);

  const set1 = new Set(skills1.map((s) => s.toLowerCase()));
  const set2 = new Set(skills2.map((s) => s.toLowerCase()));

  const shared = skills1.filter((s) => set2.has(s.toLowerCase()));
  const uniqueTo1 = skills1.filter((s) => !set2.has(s.toLowerCase()));
  const uniqueTo2 = skills2.filter((s) => !set1.has(s.toLowerCase()));

  const totalUnique = new Set([...set1, ...set2]).size;
  const overlapPct = totalUnique > 0 ? (shared.length / totalUnique) * 100 : 0;

  return {
    label1,
    label2,
    profile1_skills: skills1,
    profile2_skills: skills2,
    shared_skills: shared,
    unique_to_1: uniqueTo1,
    unique_to_2: uniqueTo2,
    overlap_percentage: Math.round(overlapPct * 10) / 10,
    similarity_score: Math.round(overlapPct) / 100,
  };
}
