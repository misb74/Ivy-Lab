import { FileCache, CareerPath, CareerTransition, Occupation } from '@auxia/shared';

const ONET_BASE_URL = 'https://api-v2.onetcenter.org';
const cache = new FileCache('hr-roles-career', 3600 * 1000);

async function getONetHeaders(): Promise<Record<string, string>> {
  const apiKey = process.env.ONET_API_KEY;
  if (!apiKey) throw new Error('ONET_API_KEY must be set');
  return {
    'X-API-Key': apiKey,
    Accept: 'application/json',
  };
}

async function searchOccupation(keyword: string): Promise<Occupation | null> {
  const headers = await getONetHeaders();
  const url = `${ONET_BASE_URL}/online/search?keyword=${encodeURIComponent(keyword)}&end=3`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.occupation || [];
  if (results.length === 0) return null;
  return {
    code: results[0].code,
    title: results[0].title,
    data_source: 'onet',
  };
}

async function getOccupationSkills(code: string): Promise<Map<string, number>> {
  const headers = await getONetHeaders();
  const [skillsRes, knowledgeRes] = await Promise.all([
    fetch(`${ONET_BASE_URL}/online/occupations/${code}/summary/skills`, { headers }),
    fetch(`${ONET_BASE_URL}/online/occupations/${code}/summary/knowledge`, { headers }),
  ]);

  const skillMap = new Map<string, number>();

  if (skillsRes.ok) {
    const data = await skillsRes.json();
    for (const e of data.skill || []) {
      skillMap.set(e.name, e.score?.value || 0);
    }
  }

  if (knowledgeRes.ok) {
    const data = await knowledgeRes.json();
    for (const e of data.knowledge || []) {
      skillMap.set(e.name, e.score?.value || 0);
    }
  }

  return skillMap;
}

async function getRelatedOccupations(code: string): Promise<Array<{ code: string; title: string }>> {
  const headers = await getONetHeaders();
  const url = `${ONET_BASE_URL}/online/occupations/${code}/summary/related_occupations`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.occupation || []).map((o: any) => ({ code: o.code, title: o.title }));
  } catch {
    return [];
  }
}

function computeSkillOverlap(skills1: Map<string, number>, skills2: Map<string, number>): number {
  const allKeys = new Set([...skills1.keys(), ...skills2.keys()]);
  if (allKeys.size === 0) return 0;
  let overlap = 0;
  for (const key of allKeys) {
    if (skills1.has(key) && skills2.has(key)) overlap++;
  }
  return overlap / allKeys.size;
}

function identifySkillGaps(fromSkills: Map<string, number>, toSkills: Map<string, number>): string[] {
  const gaps: string[] = [];
  for (const [skill, level] of toSkills) {
    const currentLevel = fromSkills.get(skill) || 0;
    if (currentLevel < level) {
      gaps.push(skill);
    }
  }
  return gaps;
}

export async function generateCareerPath(
  fromRole: string,
  toRole: string
): Promise<CareerPath> {
  const cacheKey = `career-path:${fromRole}:${toRole}`;
  const cached = await cache.get<CareerPath>(cacheKey);
  if (cached) return cached;

  const [fromOcc, toOcc] = await Promise.all([
    searchOccupation(fromRole),
    searchOccupation(toRole),
  ]);

  if (!fromOcc) throw new Error(`Could not find O*NET occupation for: ${fromRole}`);
  if (!toOcc) throw new Error(`Could not find O*NET occupation for: ${toRole}`);

  const [fromSkills, toSkills] = await Promise.all([
    getOccupationSkills(fromOcc.code),
    getOccupationSkills(toOcc.code),
  ]);

  const directOverlap = computeSkillOverlap(fromSkills, toSkills);
  const skillGaps = identifySkillGaps(fromSkills, toSkills);

  // Try to find intermediate steps via related occupations
  const relatedToFrom = await getRelatedOccupations(fromOcc.code);
  const steps: CareerTransition[] = [];

  if (directOverlap > 0.5) {
    // Direct transition is feasible
    steps.push({
      from_occupation: fromOcc,
      to_occupation: toOcc,
      transition_score: directOverlap,
      skill_overlap: directOverlap,
    });
  } else {
    // Look for an intermediate role
    let bestIntermediate: { occ: Occupation; overlap1: number; overlap2: number } | null = null;
    let bestCombinedScore = 0;

    for (const related of relatedToFrom.slice(0, 5)) {
      try {
        const relatedSkills = await getOccupationSkills(related.code);
        const overlap1 = computeSkillOverlap(fromSkills, relatedSkills);
        const overlap2 = computeSkillOverlap(relatedSkills, toSkills);
        const combinedScore = (overlap1 + overlap2) / 2;

        if (combinedScore > bestCombinedScore) {
          bestCombinedScore = combinedScore;
          bestIntermediate = {
            occ: { code: related.code, title: related.title, data_source: 'onet' },
            overlap1,
            overlap2,
          };
        }
      } catch {
        continue;
      }
    }

    if (bestIntermediate && bestCombinedScore > directOverlap) {
      steps.push({
        from_occupation: fromOcc,
        to_occupation: bestIntermediate.occ,
        transition_score: bestIntermediate.overlap1,
        skill_overlap: bestIntermediate.overlap1,
      });
      steps.push({
        from_occupation: bestIntermediate.occ,
        to_occupation: toOcc,
        transition_score: bestIntermediate.overlap2,
        skill_overlap: bestIntermediate.overlap2,
      });
    } else {
      steps.push({
        from_occupation: fromOcc,
        to_occupation: toOcc,
        transition_score: directOverlap,
        skill_overlap: directOverlap,
      });
    }
  }

  const feasibility = steps.reduce((sum, s) => sum + s.transition_score, 0) / steps.length;

  const result: CareerPath = {
    from_role: fromRole,
    to_role: toRole,
    steps,
    total_skill_gaps: skillGaps,
    feasibility_score: Math.round(feasibility * 100) / 100,
    data_sources: ['onet'],
  };

  await cache.set(cacheKey, result);
  return result;
}

export function buildCareerLadder(
  roleFamily: string,
  levels: number = 5
): {
  role_family: string;
  ladder: Array<{
    level: number;
    title: string;
    scope: string;
    key_responsibilities: string[];
    skills_progression: string;
    typical_experience: string;
  }>;
  progression_criteria: string[];
  framework_note: string;
} {
  const levelDefinitions = [
    {
      suffix: 'Associate',
      scope: 'Individual tasks under supervision',
      responsibilities: [
        'Execute assigned tasks with guidance.',
        'Learn core processes and tools.',
        'Seek feedback and apply it to improve.',
      ],
      skills: 'Foundational technical skills; learning orientation.',
      experience: '0-2 years',
    },
    {
      suffix: '',
      scope: 'Individual contributor, full ownership of work',
      responsibilities: [
        'Own end-to-end delivery of assignments.',
        'Collaborate with peers across functions.',
        'Identify and resolve standard issues independently.',
      ],
      skills: 'Solid technical proficiency; communication skills.',
      experience: '2-5 years',
    },
    {
      suffix: 'Senior',
      scope: 'Complex projects and mentoring',
      responsibilities: [
        'Lead complex projects and workstreams.',
        'Mentor junior team members.',
        'Drive process improvements.',
        'Contribute to team strategy.',
      ],
      skills: 'Deep expertise; leadership and mentoring ability.',
      experience: '5-8 years',
    },
    {
      suffix: 'Lead / Principal',
      scope: 'Team or domain leadership',
      responsibilities: [
        'Set technical direction for the team/domain.',
        'Manage stakeholder relationships at senior level.',
        'Drive strategic initiatives.',
        'Influence organizational decisions.',
      ],
      skills: 'Strategic thinking; cross-functional influence; expert-level domain knowledge.',
      experience: '8-12 years',
    },
    {
      suffix: 'Director / Head',
      scope: 'Function or department leadership',
      responsibilities: [
        'Own functional strategy and outcomes.',
        'Build and develop high-performing teams.',
        'Manage budgets and resource allocation.',
        'Represent the function at executive level.',
      ],
      skills: 'Executive leadership; business acumen; organizational development.',
      experience: '12+ years',
    },
    {
      suffix: 'VP / SVP',
      scope: 'Multi-function or enterprise leadership',
      responsibilities: [
        'Define enterprise-level strategy.',
        'Lead multiple functions or business units.',
        'Drive organizational transformation.',
        'Board and investor engagement.',
      ],
      skills: 'Enterprise leadership; P&L management; industry thought leadership.',
      experience: '15+ years',
    },
  ];

  const ladder = levelDefinitions.slice(0, levels).map((def, i) => ({
    level: i + 1,
    title: def.suffix ? `${def.suffix} ${roleFamily}` : roleFamily,
    scope: def.scope,
    key_responsibilities: def.responsibilities,
    skills_progression: def.skills,
    typical_experience: def.experience,
  }));

  return {
    role_family: roleFamily,
    ladder,
    progression_criteria: [
      'Demonstrated mastery of current-level competencies.',
      'Consistent high performance over 2+ review cycles.',
      'Evidence of operating at next-level scope.',
      'Stakeholder feedback supporting readiness.',
      'Completion of required development activities.',
    ],
    framework_note: 'This is a generic career ladder framework. Customize titles, responsibilities, and criteria to match organizational context.',
  };
}
