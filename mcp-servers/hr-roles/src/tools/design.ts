import { FileCache, OccupationDetails, OccupationTask, OccupationSkill } from '@auxia/shared';

const ONET_BASE_URL = 'https://api-v2.onetcenter.org';
const cache = new FileCache('hr-roles-design', 3600 * 1000);

async function getONetHeaders(): Promise<Record<string, string>> {
  const apiKey = process.env.ONET_API_KEY;
  if (!apiKey) throw new Error('ONET_API_KEY must be set');
  return {
    'X-API-Key': apiKey,
    Accept: 'application/json',
  };
}

async function searchOccupation(keyword: string): Promise<{ code: string; title: string } | null> {
  const headers = await getONetHeaders();
  const url = `${ONET_BASE_URL}/mnm/search?keyword=${encodeURIComponent(keyword)}&start=1&end=3`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.career || data.occupation || [];
  return results.length > 0 ? { code: results[0].code, title: results[0].title } : null;
}

async function getOccupationDetails(code: string): Promise<{
  tasks: OccupationTask[];
  skills: OccupationSkill[];
  technologies: Array<{ name: string; hot_technology: boolean }>;
  education: Array<{ level: string; percentage: number }>;
  title: string;
}> {
  const headers = await getONetHeaders();

  const [tasksRes, skillsRes, techRes, eduRes, detailRes] = await Promise.all([
    fetch(`${ONET_BASE_URL}/online/occupations/${code}/details/tasks?start=1&end=50`, { headers }),
    fetch(`${ONET_BASE_URL}/online/occupations/${code}/details/skills?start=1&end=50`, { headers }),
    fetch(`${ONET_BASE_URL}/online/occupations/${code}/summary/technology_skills`, { headers }),
    fetch(`${ONET_BASE_URL}/online/occupations/${code}/summary/education`, { headers }),
    fetch(`${ONET_BASE_URL}/online/occupations/${code}`, { headers }),
  ]);

  let title = code;
  if (detailRes.ok) {
    const detail = await detailRes.json();
    title = detail.title || code;
  }

  const tasks: OccupationTask[] = [];
  if (tasksRes.ok) {
    const data = await tasksRes.json();
    for (const t of data.task || []) {
      const importance = t.importance ?? t.score?.value;
      tasks.push({
        id: t.id || String(tasks.length),
        statement: t.title || t.statement || t.name || '',
        importance,
        category: t.category,
      });
    }
  }

  const skills: OccupationSkill[] = [];
  if (skillsRes.ok) {
    const data = await skillsRes.json();
    const rows = data.element || data.skill || [];
    for (const s of rows) {
      const importance = s.importance ?? s.score?.value ?? 0;
      skills.push({
        id: s.id || String(skills.length),
        name: s.name || '',
        description: s.description,
        level: importance,
        importance,
        category: 'skill',
      });
    }
  }

  const technologies: Array<{ name: string; hot_technology: boolean }> = [];
  if (techRes.ok) {
    const data = await techRes.json();
    for (const t of data.category || data.technology || []) {
      if (t.example) {
        for (const ex of t.example) {
          technologies.push({ name: ex.name || ex, hot_technology: ex.hot_technology === 'Y' });
        }
      } else {
        technologies.push({ name: t.name || '', hot_technology: false });
      }
    }
  }

  const education: Array<{ level: string; percentage: number }> = [];
  if (eduRes.ok) {
    const data = await eduRes.json();
    for (const e of data.education || []) {
      education.push({
        level: e.name || e.category || '',
        percentage: e.percentage || e.score?.value || 0,
      });
    }
  }

  return { tasks, skills, technologies, education, title };
}

export async function designRole(
  title: string,
  department?: string,
  level?: string
): Promise<{
  title: string;
  department: string;
  level: string;
  onet_match: { code: string; title: string } | null;
  core_responsibilities: string[];
  required_skills: Array<{ name: string; importance: number }>;
  technologies: string[];
  education_requirements: Array<{ level: string; percentage: number }>;
  role_design: {
    purpose_statement: string;
    key_accountabilities: string[];
    decision_authority: string;
    stakeholder_relationships: string[];
    success_metrics: string[];
  };
  data_source: string;
}> {
  const cacheKey = `design:${title}:${department}:${level}`;
  const cached = await cache.get<any>(cacheKey);
  if (cached) return cached;

  const onetMatch = await searchOccupation(title);
  let onetDetails: Awaited<ReturnType<typeof getOccupationDetails>> | null = null;

  if (onetMatch) {
    onetDetails = await getOccupationDetails(onetMatch.code);
  }

  const dept = department || 'General';
  const lvl = level || 'Mid-Level';

  const result = {
    title,
    department: dept,
    level: lvl,
    onet_match: onetMatch,
    core_responsibilities: onetDetails
      ? onetDetails.tasks.slice(0, 8).map((t) => t.statement)
      : [
          `Lead and execute ${title.toLowerCase()} responsibilities within the ${dept} department.`,
          'Collaborate with cross-functional teams to achieve objectives.',
          'Report on key metrics and progress to leadership.',
        ],
    required_skills: onetDetails
      ? onetDetails.skills.slice(0, 10).map((s) => ({ name: s.name, importance: s.importance }))
      : [],
    technologies: onetDetails
      ? onetDetails.technologies.slice(0, 10).map((t) => t.name)
      : [],
    education_requirements: onetDetails?.education || [],
    role_design: {
      purpose_statement: `The ${title} is responsible for delivering ${dept.toLowerCase()} outcomes at the ${lvl.toLowerCase()} scope, driving results through both individual contribution and cross-functional collaboration.`,
      key_accountabilities: [
        'Deliver on primary role objectives and KPIs.',
        'Maintain quality standards and compliance requirements.',
        'Contribute to team knowledge and best practices.',
        `Support ${dept.toLowerCase()} strategy and initiatives.`,
        lvl.toLowerCase().includes('senior') || lvl.toLowerCase().includes('lead')
          ? 'Mentor junior team members and support their development.'
          : 'Continuously develop expertise and skills relevant to the role.',
      ],
      decision_authority: lvl.toLowerCase().includes('senior') || lvl.toLowerCase().includes('director')
        ? 'Makes strategic decisions within functional area; escalates cross-functional and budget decisions.'
        : 'Makes tactical decisions within defined scope; escalates strategic matters to manager.',
      stakeholder_relationships: [
        'Direct manager / department head',
        'Cross-functional partners',
        'External vendors or clients (as applicable)',
        lvl.toLowerCase().includes('senior') ? 'Executive leadership' : 'Peer team members',
      ],
      success_metrics: [
        'Achievement of role-specific KPIs',
        'Stakeholder satisfaction scores',
        'Quality and timeliness of deliverables',
        'Professional development milestones',
      ],
    },
    data_source: onetMatch ? 'onet' : 'framework',
  };

  await cache.set(cacheKey, result);
  return result;
}

export async function decomposeRole(role: string, occupation_code?: string): Promise<{
  role: string;
  onet_match: { code: string; title: string } | null;
  tasks: OccupationTask[];
  task_categories: Record<string, OccupationTask[]>;
  skills_required: Array<{ name: string; level: number }>;
  time_allocation_estimate: Array<{ category: string; percentage: number }>;
  data_source: string;
}> {
  const cacheKey = `decompose:${occupation_code ?? role}`;
  const cached = await cache.get<any>(cacheKey);
  if (cached) return cached;

  // Use provided SOC code directly when available, fall back to keyword search
  const onetMatch = occupation_code
    ? { code: occupation_code, title: role }
    : await searchOccupation(role);
  let tasks: OccupationTask[] = [];
  let skills: Array<{ name: string; level: number }> = [];

  if (onetMatch) {
    const details = await getOccupationDetails(onetMatch.code);
    onetMatch.title = details.title || onetMatch.title;
    tasks = details.tasks;
    skills = details.skills.map((s) => ({ name: s.name, level: s.level }));
  }

  // Categorize tasks
  const taskCategories: Record<string, OccupationTask[]> = {
    core_functions: [],
    administrative: [],
    communication: [],
    analysis: [],
    other: [],
  };

  for (const task of tasks) {
    const stmt = task.statement.toLowerCase();
    if (stmt.includes('communicat') || stmt.includes('present') || stmt.includes('report') || stmt.includes('inform')) {
      taskCategories.communication.push(task);
    } else if (stmt.includes('analyz') || stmt.includes('evaluat') || stmt.includes('assess') || stmt.includes('review')) {
      taskCategories.analysis.push(task);
    } else if (stmt.includes('maintain') || stmt.includes('record') || stmt.includes('schedul') || stmt.includes('document')) {
      taskCategories.administrative.push(task);
    } else if (task.importance && task.importance > 60) {
      taskCategories.core_functions.push(task);
    } else {
      taskCategories.other.push(task);
    }
  }

  // If core_functions is empty, move uncategorized high-importance tasks
  if (taskCategories.core_functions.length === 0 && taskCategories.other.length > 0) {
    const sorted = [...taskCategories.other].sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
    taskCategories.core_functions = sorted.slice(0, Math.ceil(sorted.length / 2));
    taskCategories.other = sorted.slice(Math.ceil(sorted.length / 2));
  }

  const totalTasks = tasks.length || 1;
  const timeAllocation = [
    { category: 'Core functions', percentage: Math.round((taskCategories.core_functions.length / totalTasks) * 60) || 40 },
    { category: 'Analysis & evaluation', percentage: Math.round((taskCategories.analysis.length / totalTasks) * 40) || 20 },
    { category: 'Communication', percentage: Math.round((taskCategories.communication.length / totalTasks) * 30) || 15 },
    { category: 'Administrative', percentage: Math.round((taskCategories.administrative.length / totalTasks) * 20) || 10 },
    { category: 'Other', percentage: 15 },
  ];

  // Normalize to 100%
  const total = timeAllocation.reduce((s, t) => s + t.percentage, 0);
  if (total !== 100) {
    const diff = 100 - total;
    timeAllocation[0].percentage += diff;
  }

  const result = {
    role,
    onet_match: onetMatch,
    tasks,
    task_categories: taskCategories,
    skills_required: skills,
    time_allocation_estimate: timeAllocation,
    data_source: onetMatch ? 'onet' : 'framework',
  };

  await cache.set(cacheKey, result);
  return result;
}

export async function splitRole(
  role: string,
  splitCriteria?: string
): Promise<{
  original_role: string;
  split_criteria: string;
  role_a: { title: string; tasks: string[]; skills: string[]; focus: string };
  role_b: { title: string; tasks: string[]; skills: string[]; focus: string };
  split_rationale: string;
  considerations: string[];
}> {
  const criteria = splitCriteria || 'strategic_vs_operational';

  const decomposed = await decomposeRole(role);
  const allTasks = decomposed.tasks;

  // Split tasks based on criteria
  let tasksA: OccupationTask[] = [];
  let tasksB: OccupationTask[] = [];
  let focusA = '';
  let focusB = '';
  let titleA = '';
  let titleB = '';

  switch (criteria) {
    case 'strategic_vs_operational':
      focusA = 'Strategic & planning';
      focusB = 'Operational & execution';
      titleA = `Senior ${role}`;
      titleB = `${role} Specialist`;
      for (const t of allTasks) {
        const stmt = t.statement.toLowerCase();
        if (stmt.includes('plan') || stmt.includes('strateg') || stmt.includes('develop') || stmt.includes('design') || stmt.includes('lead')) {
          tasksA.push(t);
        } else {
          tasksB.push(t);
        }
      }
      break;
    case 'internal_vs_external':
      focusA = 'Internal stakeholders';
      focusB = 'External stakeholders';
      titleA = `Internal ${role}`;
      titleB = `External ${role}`;
      for (const t of allTasks) {
        const stmt = t.statement.toLowerCase();
        if (stmt.includes('client') || stmt.includes('customer') || stmt.includes('vendor') || stmt.includes('partner') || stmt.includes('external')) {
          tasksB.push(t);
        } else {
          tasksA.push(t);
        }
      }
      break;
    default:
      // Default: split by importance
      focusA = 'Primary / high-importance';
      focusB = 'Secondary / support';
      titleA = `Lead ${role}`;
      titleB = `${role} Associate`;
      const sorted = [...allTasks].sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
      const mid = Math.ceil(sorted.length / 2);
      tasksA = sorted.slice(0, mid);
      tasksB = sorted.slice(mid);
  }

  // Ensure both have tasks
  if (tasksA.length === 0 && tasksB.length > 0) {
    tasksA = tasksB.splice(0, Math.ceil(tasksB.length / 2));
  }
  if (tasksB.length === 0 && tasksA.length > 0) {
    tasksB = tasksA.splice(Math.ceil(tasksA.length / 2));
  }

  const allSkills = decomposed.skills_required.map((s) => s.name);

  return {
    original_role: role,
    split_criteria: criteria,
    role_a: {
      title: titleA,
      tasks: tasksA.map((t) => t.statement),
      skills: allSkills.slice(0, Math.ceil(allSkills.length / 2)),
      focus: focusA,
    },
    role_b: {
      title: titleB,
      tasks: tasksB.map((t) => t.statement),
      skills: allSkills.slice(Math.ceil(allSkills.length / 2)),
      focus: focusB,
    },
    split_rationale: `Role split based on '${criteria}' criteria. Review task assignments and adjust based on organizational context.`,
    considerations: [
      'Ensure clear handoff points between the two roles.',
      'Define shared responsibilities and collaboration expectations.',
      'Review compensation levels for both new roles.',
      'Plan transition timeline for incumbent.',
      'Communicate changes clearly to stakeholders.',
    ],
  };
}

export async function mergeRoles(
  role1: string,
  role2: string
): Promise<{
  role1: string;
  role2: string;
  merged_role: {
    suggested_title: string;
    combined_tasks: string[];
    combined_skills: string[];
    estimated_scope: string;
  };
  overlap_analysis: {
    shared_tasks: string[];
    unique_to_role1: string[];
    unique_to_role2: string[];
    task_overlap_percentage: number;
  };
  feasibility: {
    score: number;
    assessment: string;
    risks: string[];
    benefits: string[];
  };
}> {
  const [decomp1, decomp2] = await Promise.all([
    decomposeRole(role1),
    decomposeRole(role2),
  ]);

  const tasks1 = decomp1.tasks.map((t) => t.statement);
  const tasks2 = decomp2.tasks.map((t) => t.statement);

  const skills1 = decomp1.skills_required.map((s) => s.name);
  const skills2 = decomp2.skills_required.map((s) => s.name);

  // Simple overlap: check for similar tasks by keyword overlap
  const sharedTasks: string[] = [];
  const uniqueToRole1: string[] = [];
  const uniqueToRole2 = [...tasks2];

  for (const t1 of tasks1) {
    const words1 = new Set(t1.toLowerCase().split(/\s+/).filter((w) => w.length > 4));
    let matched = false;
    for (let i = 0; i < uniqueToRole2.length; i++) {
      const words2 = new Set(uniqueToRole2[i].toLowerCase().split(/\s+/).filter((w) => w.length > 4));
      const intersection = [...words1].filter((w) => words2.has(w));
      if (intersection.length >= 3) {
        sharedTasks.push(t1);
        uniqueToRole2.splice(i, 1);
        matched = true;
        break;
      }
    }
    if (!matched) uniqueToRole1.push(t1);
  }

  const totalTasks = tasks1.length + tasks2.length;
  const overlapPct = totalTasks > 0 ? (sharedTasks.length * 2 / totalTasks) * 100 : 0;

  const combinedSkills = [...new Set([...skills1, ...skills2])];
  const combinedTasks = [...new Set([...sharedTasks, ...uniqueToRole1, ...uniqueToRole2])];

  // Feasibility assessment
  const feasibilityScore = Math.min(1, overlapPct / 50 + (combinedTasks.length <= 15 ? 0.3 : 0));
  let assessment: string;
  if (feasibilityScore > 0.7) {
    assessment = 'Highly feasible — significant overlap suggests these roles naturally combine.';
  } else if (feasibilityScore > 0.4) {
    assessment = 'Moderately feasible — some overlap exists but the merged role may have a wide scope.';
  } else {
    assessment = 'Low feasibility — minimal overlap; merging may overload the combined role.';
  }

  return {
    role1,
    role2,
    merged_role: {
      suggested_title: `${role1} & ${role2} Specialist`,
      combined_tasks: combinedTasks,
      combined_skills: combinedSkills,
      estimated_scope: combinedTasks.length > 15 ? 'Very broad — consider if this is sustainable' : 'Manageable scope',
    },
    overlap_analysis: {
      shared_tasks: sharedTasks,
      unique_to_role1: uniqueToRole1,
      unique_to_role2: uniqueToRole2,
      task_overlap_percentage: Math.round(overlapPct * 10) / 10,
    },
    feasibility: {
      score: Math.round(feasibilityScore * 100) / 100,
      assessment,
      risks: [
        'Overloading the merged role may reduce quality of work.',
        'Different skill profiles may make it hard to find qualified candidates.',
        'Incumbent employees may resist role changes.',
        'Manager span of control may be affected.',
      ],
      benefits: [
        'Reduced headcount and labor costs.',
        'Eliminated coordination overhead between two roles.',
        'Broader perspective and cross-functional capability.',
        'Simplified organizational structure.',
      ],
    },
  };
}
