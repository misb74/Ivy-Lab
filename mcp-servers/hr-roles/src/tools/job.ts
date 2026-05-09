import { OAuthClient, FileCache, WageData } from '@auxia/shared';

const ONET_BASE_URL = 'https://api-v2.onetcenter.org';
const BLS_BASE_URL = 'https://api.bls.gov/publicAPI/v2';
const LIGHTCAST_TOKEN_URL = 'https://auth.emsicloud.com/connect/token';

const cache = new FileCache('hr-roles-job', 3600 * 1000);

let lightcastClient: OAuthClient | null = null;

function getLightcastClient(): OAuthClient {
  if (!lightcastClient) {
    const clientId = process.env.LIGHTCAST_CLIENT_ID;
    const clientSecret = process.env.LIGHTCAST_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('LIGHTCAST_CLIENT_ID and LIGHTCAST_CLIENT_SECRET must be set');
    }
    lightcastClient = new OAuthClient({
      tokenUrl: LIGHTCAST_TOKEN_URL,
      clientId,
      clientSecret,
      scopeCandidates: ['emsi_open'],
    });
  }
  return lightcastClient;
}

async function getONetHeaders(): Promise<Record<string, string>> {
  const apiKey = process.env.ONET_API_KEY;
  if (!apiKey) throw new Error('ONET_API_KEY must be set');
  return {
    'X-API-Key': apiKey,
    Accept: 'application/json',
  };
}

async function searchOccupation(keyword: string): Promise<{ code: string; title: string; description?: string } | null> {
  const headers = await getONetHeaders();
  const url = `${ONET_BASE_URL}/online/search?keyword=${encodeURIComponent(keyword)}&end=1`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.occupation || [];
  return results.length > 0 ? { code: results[0].code, title: results[0].title, description: results[0].description } : null;
}

async function getOccupationSummary(code: string): Promise<{
  title: string;
  description: string;
  tasks: string[];
  skills: Array<{ name: string; level: number }>;
  knowledge: Array<{ name: string; level: number }>;
  abilities: Array<{ name: string; level: number }>;
  technologies: string[];
  education: Array<{ level: string; percentage: number }>;
  brightOutlook: boolean;
  sampleTitles: string[];
}> {
  const headers = await getONetHeaders();

  const [detailRes, tasksRes, skillsRes, knowledgeRes, abilitiesRes, techRes, eduRes] = await Promise.all([
    fetch(`${ONET_BASE_URL}/online/occupations/${code}`, { headers }),
    fetch(`${ONET_BASE_URL}/online/occupations/${code}/summary/tasks`, { headers }),
    fetch(`${ONET_BASE_URL}/online/occupations/${code}/summary/skills`, { headers }),
    fetch(`${ONET_BASE_URL}/online/occupations/${code}/summary/knowledge`, { headers }),
    fetch(`${ONET_BASE_URL}/online/occupations/${code}/summary/abilities`, { headers }),
    fetch(`${ONET_BASE_URL}/online/occupations/${code}/summary/technology_skills`, { headers }),
    fetch(`${ONET_BASE_URL}/online/occupations/${code}/summary/education`, { headers }),
  ]);

  let title = code;
  let description = '';
  let brightOutlook = false;
  let sampleTitles: string[] = [];

  if (detailRes.ok) {
    const detail = await detailRes.json();
    title = detail.title || code;
    description = detail.description || '';
    brightOutlook = detail.bright_outlook === true || detail.tags?.bright_outlook === 'Y';
    sampleTitles = (detail.sample_of_reported_titles?.title || []).map((t: any) => t.name || t);
  }

  const tasks: string[] = [];
  if (tasksRes.ok) {
    const data = await tasksRes.json();
    for (const t of data.task || []) {
      tasks.push(t.statement || t.name || '');
    }
  }

  const skills: Array<{ name: string; level: number }> = [];
  if (skillsRes.ok) {
    const data = await skillsRes.json();
    for (const s of data.skill || []) {
      skills.push({ name: s.name, level: s.score?.value || 0 });
    }
  }

  const knowledge: Array<{ name: string; level: number }> = [];
  if (knowledgeRes.ok) {
    const data = await knowledgeRes.json();
    for (const k of data.knowledge || []) {
      knowledge.push({ name: k.name, level: k.score?.value || 0 });
    }
  }

  const abilities: Array<{ name: string; level: number }> = [];
  if (abilitiesRes.ok) {
    const data = await abilitiesRes.json();
    for (const a of data.ability || []) {
      abilities.push({ name: a.name, level: a.score?.value || 0 });
    }
  }

  const technologies: string[] = [];
  if (techRes.ok) {
    const data = await techRes.json();
    for (const cat of data.category || data.technology || []) {
      if (cat.example) {
        for (const ex of cat.example) {
          technologies.push(ex.name || ex);
        }
      } else {
        technologies.push(cat.name || '');
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

  return { title, description, tasks, skills, knowledge, abilities, technologies, education, brightOutlook, sampleTitles };
}

export async function benchmarkJob(
  jobTitle: string,
  location?: string
): Promise<{
  job_title: string;
  location: string;
  onet_match: { code: string; title: string } | null;
  description: string;
  key_tasks: string[];
  required_skills: Array<{ name: string; level: number }>;
  required_knowledge: Array<{ name: string; level: number }>;
  technologies: string[];
  education_profile: Array<{ level: string; percentage: number }>;
  bright_outlook: boolean;
  sample_titles: string[];
  data_source: string;
}> {
  const cacheKey = `benchmark:${jobTitle}:${location}`;
  const cached = await cache.get<any>(cacheKey);
  if (cached) return cached;

  const onetMatch = await searchOccupation(jobTitle);
  if (!onetMatch) {
    throw new Error(`Could not find O*NET occupation for: ${jobTitle}`);
  }

  const summary = await getOccupationSummary(onetMatch.code);

  const result = {
    job_title: jobTitle,
    location: location || 'National',
    onet_match: { code: onetMatch.code, title: onetMatch.title },
    description: summary.description,
    key_tasks: summary.tasks.slice(0, 10),
    required_skills: summary.skills.slice(0, 15),
    required_knowledge: summary.knowledge.slice(0, 10),
    technologies: summary.technologies.slice(0, 15),
    education_profile: summary.education,
    bright_outlook: summary.brightOutlook,
    sample_titles: summary.sampleTitles.slice(0, 10),
    data_source: 'onet',
  };

  await cache.set(cacheKey, result);
  return result;
}

export async function compareJobs(
  job1: string,
  job2: string
): Promise<{
  job1: { title: string; onet_code: string; skills: string[]; tasks_count: number };
  job2: { title: string; onet_code: string; skills: string[]; tasks_count: number };
  comparison: {
    shared_skills: string[];
    unique_to_job1: string[];
    unique_to_job2: string[];
    skill_overlap_percentage: number;
    transition_feasibility: string;
  };
}> {
  const [onet1, onet2] = await Promise.all([
    searchOccupation(job1),
    searchOccupation(job2),
  ]);

  if (!onet1) throw new Error(`Could not find O*NET occupation for: ${job1}`);
  if (!onet2) throw new Error(`Could not find O*NET occupation for: ${job2}`);

  const [summary1, summary2] = await Promise.all([
    getOccupationSummary(onet1.code),
    getOccupationSummary(onet2.code),
  ]);

  const skills1 = summary1.skills.map((s) => s.name);
  const skills2 = summary2.skills.map((s) => s.name);

  const set1 = new Set(skills1.map((s) => s.toLowerCase()));
  const set2 = new Set(skills2.map((s) => s.toLowerCase()));

  const shared = skills1.filter((s) => set2.has(s.toLowerCase()));
  const uniqueTo1 = skills1.filter((s) => !set2.has(s.toLowerCase()));
  const uniqueTo2 = skills2.filter((s) => !set1.has(s.toLowerCase()));

  const totalUnique = new Set([...set1, ...set2]).size;
  const overlapPct = totalUnique > 0 ? (shared.length / totalUnique) * 100 : 0;

  let feasibility: string;
  if (overlapPct > 60) feasibility = 'High — strong skill overlap supports career transition.';
  else if (overlapPct > 30) feasibility = 'Moderate — some reskilling needed for transition.';
  else feasibility = 'Low — significant reskilling required.';

  return {
    job1: { title: summary1.title, onet_code: onet1.code, skills: skills1, tasks_count: summary1.tasks.length },
    job2: { title: summary2.title, onet_code: onet2.code, skills: skills2, tasks_count: summary2.tasks.length },
    comparison: {
      shared_skills: shared,
      unique_to_job1: uniqueTo1,
      unique_to_job2: uniqueTo2,
      skill_overlap_percentage: Math.round(overlapPct * 10) / 10,
      transition_feasibility: feasibility,
    },
  };
}

export function mapJobFamilies(department: string): {
  department: string;
  job_families: Array<{
    family_name: string;
    description: string;
    typical_roles: string[];
    career_progression: string;
  }>;
  framework_note: string;
} {
  // Generic job family maps by department type
  const familyMaps: Record<string, Array<{ family_name: string; description: string; typical_roles: string[]; career_progression: string }>> = {
    engineering: [
      { family_name: 'Software Engineering', description: 'Design, develop, and maintain software systems.', typical_roles: ['Software Engineer', 'Senior Engineer', 'Staff Engineer', 'Principal Engineer'], career_progression: 'IC track from Associate to Principal/Distinguished' },
      { family_name: 'Engineering Management', description: 'Lead engineering teams and drive technical strategy.', typical_roles: ['Engineering Manager', 'Senior EM', 'Director of Engineering', 'VP Engineering'], career_progression: 'Manager track from EM to VP/CTO' },
      { family_name: 'Quality Assurance', description: 'Ensure software quality through testing and automation.', typical_roles: ['QA Engineer', 'Senior QA', 'QA Lead', 'QA Manager'], career_progression: 'IC or management track' },
      { family_name: 'DevOps / SRE', description: 'Build and maintain infrastructure and deployment systems.', typical_roles: ['DevOps Engineer', 'SRE', 'Senior SRE', 'Infrastructure Lead'], career_progression: 'IC track with optional management path' },
    ],
    sales: [
      { family_name: 'Account Executive', description: 'Drive new business acquisition and revenue.', typical_roles: ['SDR/BDR', 'Account Executive', 'Senior AE', 'Enterprise AE'], career_progression: 'SDR to AE to Enterprise to VP Sales' },
      { family_name: 'Sales Management', description: 'Lead sales teams and strategy.', typical_roles: ['Sales Manager', 'Regional Director', 'VP Sales', 'CRO'], career_progression: 'Manager to Director to VP to CRO' },
      { family_name: 'Sales Operations', description: 'Optimize sales processes, tools, and analytics.', typical_roles: ['Sales Ops Analyst', 'Senior Analyst', 'Sales Ops Manager', 'Director Sales Ops'], career_progression: 'Analyst to Manager to Director' },
      { family_name: 'Customer Success', description: 'Drive customer retention and expansion.', typical_roles: ['CSM', 'Senior CSM', 'CS Manager', 'VP Customer Success'], career_progression: 'CSM to Manager to VP' },
    ],
    finance: [
      { family_name: 'Financial Planning & Analysis', description: 'Budgeting, forecasting, and financial modeling.', typical_roles: ['Financial Analyst', 'Senior Analyst', 'FP&A Manager', 'Director FP&A'], career_progression: 'Analyst to Manager to Director to CFO' },
      { family_name: 'Accounting', description: 'Financial reporting, compliance, and controls.', typical_roles: ['Staff Accountant', 'Senior Accountant', 'Accounting Manager', 'Controller'], career_progression: 'Staff to Senior to Manager to Controller' },
      { family_name: 'Treasury', description: 'Cash management, investments, and risk.', typical_roles: ['Treasury Analyst', 'Senior Analyst', 'Treasury Manager', 'Treasurer'], career_progression: 'Analyst to Manager to Treasurer' },
    ],
    hr: [
      { family_name: 'HR Business Partner', description: 'Strategic HR partnership with business units.', typical_roles: ['HR Coordinator', 'HRBP', 'Senior HRBP', 'HR Director'], career_progression: 'Coordinator to HRBP to Director to CHRO' },
      { family_name: 'Talent Acquisition', description: 'Recruiting and employer branding.', typical_roles: ['Recruiter', 'Senior Recruiter', 'TA Manager', 'Head of TA'], career_progression: 'Recruiter to Manager to Head' },
      { family_name: 'Compensation & Benefits', description: 'Design and manage total rewards programs.', typical_roles: ['Comp Analyst', 'Senior Analyst', 'Comp Manager', 'VP Total Rewards'], career_progression: 'Analyst to Manager to VP' },
      { family_name: 'Learning & Development', description: 'Employee training and development programs.', typical_roles: ['L&D Specialist', 'Senior Specialist', 'L&D Manager', 'CLO'], career_progression: 'Specialist to Manager to CLO' },
    ],
    marketing: [
      { family_name: 'Product Marketing', description: 'Positioning, messaging, and go-to-market strategy.', typical_roles: ['PMM Associate', 'Product Marketing Manager', 'Senior PMM', 'Director PMM'], career_progression: 'Associate to Manager to Director to VP' },
      { family_name: 'Demand Generation', description: 'Drive pipeline through campaigns and channels.', typical_roles: ['Marketing Coordinator', 'Demand Gen Manager', 'Senior Manager', 'Director Demand Gen'], career_progression: 'Coordinator to Manager to Director' },
      { family_name: 'Content & Communications', description: 'Content strategy, PR, and brand communications.', typical_roles: ['Content Writer', 'Content Manager', 'Director of Content', 'VP Communications'], career_progression: 'Writer to Manager to Director to VP' },
      { family_name: 'Marketing Operations', description: 'Marketing technology, data, and analytics.', typical_roles: ['Marketing Ops Analyst', 'Senior Analyst', 'Ops Manager', 'Director Marketing Ops'], career_progression: 'Analyst to Manager to Director' },
    ],
  };

  const deptKey = department.toLowerCase().trim();
  const families = familyMaps[deptKey] || [
    {
      family_name: `${department} - General`,
      description: `General roles within the ${department} department.`,
      typical_roles: [`${department} Associate`, `${department} Specialist`, `Senior ${department} Specialist`, `${department} Manager`, `${department} Director`],
      career_progression: 'Associate to Specialist to Manager to Director',
    },
  ];

  return {
    department,
    job_families: families,
    framework_note: familyMaps[deptKey]
      ? 'Standard job family map for this department. Customize to your organization.'
      : 'Generic job family map generated. Provide a specific department (engineering, sales, finance, hr, marketing) for detailed mapping.',
  };
}

export function calibrateLevels(roles: string[]): {
  roles: string[];
  calibration_framework: {
    dimensions: Array<{ name: string; description: string; scale: string }>;
    level_definitions: Array<{ level: string; scope: string; impact: string; autonomy: string }>;
    calibration_process: string[];
  };
  framework_note: string;
} {
  return {
    roles,
    calibration_framework: {
      dimensions: [
        { name: 'Scope of responsibility', description: 'Breadth and depth of the work managed or performed.', scale: 'Task -> Project -> Program -> Function -> Enterprise' },
        { name: 'Decision complexity', description: 'Complexity and impact of decisions made.', scale: 'Routine -> Structured -> Complex -> Strategic -> Visionary' },
        { name: 'Technical depth', description: 'Level of domain or technical expertise required.', scale: 'Foundational -> Working -> Deep -> Expert -> Thought Leader' },
        { name: 'People leadership', description: 'Scope of people management or influence.', scale: 'Self -> Mentoring -> Team -> Department -> Organization' },
        { name: 'Business impact', description: 'Financial and strategic impact of the role.', scale: 'Team-level -> Department -> Business Unit -> Company -> Industry' },
      ],
      level_definitions: [
        { level: 'L1 - Entry', scope: 'Individual tasks', impact: 'Team-level', autonomy: 'Directed' },
        { level: 'L2 - Developing', scope: 'Projects/components', impact: 'Team-level', autonomy: 'Guided' },
        { level: 'L3 - Career', scope: 'Full projects', impact: 'Department', autonomy: 'Independent' },
        { level: 'L4 - Senior', scope: 'Programs/domains', impact: 'Department', autonomy: 'Self-directed' },
        { level: 'L5 - Staff/Principal', scope: 'Function/domain', impact: 'Business Unit', autonomy: 'Strategic' },
        { level: 'L6 - Director', scope: 'Multiple functions', impact: 'Business Unit', autonomy: 'Strategic' },
        { level: 'L7 - VP+', scope: 'Enterprise', impact: 'Company', autonomy: 'Visionary' },
      ],
      calibration_process: [
        '1. Score each role on all dimensions independently.',
        '2. Map scores to level definitions.',
        '3. Compare roles with similar total scores to ensure consistency.',
        '4. Identify outliers where a role scores very differently across dimensions.',
        '5. Validate with market data (use job_benchmark tool).',
        '6. Document rationale for level assignments.',
        '7. Conduct calibration sessions with managers to align assessments.',
      ],
    },
    framework_note: 'This is a calibration framework. Use job_benchmark on each role for data-backed context, then apply this framework for consistent leveling.',
  };
}

export async function generateJobDescription(
  title: string,
  department?: string,
  level?: string,
  skills?: string[]
): Promise<{
  title: string;
  department: string;
  level: string;
  job_description: {
    summary: string;
    responsibilities: string[];
    required_qualifications: string[];
    preferred_qualifications: string[];
    skills_and_competencies: string[];
    education: string;
    experience: string;
  };
  onet_match: { code: string; title: string } | null;
  data_source: string;
}> {
  const dept = department || 'General';
  const lvl = level || 'Mid-Level';

  const onetMatch = await searchOccupation(title);
  let onetSummary: Awaited<ReturnType<typeof getOccupationSummary>> | null = null;

  if (onetMatch) {
    onetSummary = await getOccupationSummary(onetMatch.code);
  }

  const onetSkills = onetSummary?.skills.slice(0, 10).map((s) => s.name) || [];
  const combinedSkills = [...new Set([...(skills || []), ...onetSkills])];

  const responsibilities = onetSummary
    ? onetSummary.tasks.slice(0, 8)
    : [
        `Execute core ${title.toLowerCase()} functions.`,
        'Collaborate with cross-functional teams.',
        'Contribute to department goals and objectives.',
      ];

  const educationLevels = onetSummary?.education || [];
  const topEducation = educationLevels.length > 0
    ? educationLevels.sort((a, b) => b.percentage - a.percentage)[0].level
    : "Bachelor's degree in a related field";

  const experienceMap: Record<string, string> = {
    'entry': '0-2 years of relevant experience.',
    'junior': '1-3 years of relevant experience.',
    'mid-level': '3-5 years of relevant experience.',
    'senior': '5-8 years of relevant experience.',
    'lead': '7-10 years of relevant experience.',
    'principal': '10+ years of relevant experience.',
    'director': '10-15 years of relevant experience, including 5+ years in leadership.',
  };

  return {
    title,
    department: dept,
    level: lvl,
    job_description: {
      summary: onetSummary?.description || `We are seeking a ${lvl} ${title} to join our ${dept} team.`,
      responsibilities,
      required_qualifications: [
        `${experienceMap[lvl.toLowerCase()] || '3-5 years of relevant experience.'}`,
        `Proficiency in ${combinedSkills.slice(0, 3).join(', ') || 'core domain skills'}.`,
        'Strong communication and collaboration skills.',
        `${topEducation} or equivalent practical experience.`,
      ],
      preferred_qualifications: [
        `Experience with ${combinedSkills.slice(3, 6).join(', ') || 'advanced tools and methodologies'}.`,
        'Track record of delivering results in a fast-paced environment.',
        `Industry experience in ${dept.toLowerCase()} or related fields.`,
      ],
      skills_and_competencies: combinedSkills,
      education: topEducation,
      experience: experienceMap[lvl.toLowerCase()] || '3-5 years of relevant experience.',
    },
    onet_match: onetMatch ? { code: onetMatch.code, title: onetMatch.title } : null,
    data_source: onetMatch ? 'onet' : 'framework',
  };
}

export async function analyzeJobDescription(jdText: string): Promise<{
  extracted_skills: Array<{ name: string; confidence: number; category: string }>;
  analysis: {
    total_skills_found: number;
    skill_categories: Record<string, number>;
    readability_notes: string[];
    completeness_check: {
      has_responsibilities: boolean;
      has_qualifications: boolean;
      has_skills: boolean;
      has_education: boolean;
      has_experience: boolean;
      has_compensation: boolean;
      completeness_score: number;
    };
    recommendations: string[];
  };
  data_source: string;
}> {
  // Use Lightcast for skills extraction from JD text
  const client = getLightcastClient();
  const token = await client.getToken();

  const response = await fetch('https://emsiservices.com/skills/versions/latest/extract', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: jdText, confidenceThreshold: 0.3 }),
  });

  let extractedSkills: Array<{ name: string; confidence: number; category: string }> = [];

  if (response.ok) {
    const data = await response.json();
    extractedSkills = (data.data || []).map((s: any) => ({
      name: s.name,
      confidence: s.confidence || 0,
      category: s.type?.name || 'Unknown',
    }));
  }

  const skillCategories: Record<string, number> = {};
  for (const s of extractedSkills) {
    skillCategories[s.category] = (skillCategories[s.category] || 0) + 1;
  }

  // Analyze JD completeness
  const textLower = jdText.toLowerCase();
  const hasResponsibilities = /responsibilit|duties|what you.ll do|role overview/i.test(jdText);
  const hasQualifications = /qualificat|requirement|what you.ll need|must have/i.test(jdText);
  const hasSkills = /skills|competenc|proficien/i.test(jdText);
  const hasEducation = /education|degree|bachelor|master|phd|diploma/i.test(jdText);
  const hasExperience = /experience|years|year/i.test(jdText);
  const hasCompensation = /salary|compensation|pay|benefits|bonus|\$/i.test(jdText);

  const checks = [hasResponsibilities, hasQualifications, hasSkills, hasEducation, hasExperience, hasCompensation];
  const completenessScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  const recommendations: string[] = [];
  if (!hasResponsibilities) recommendations.push('Add a clear responsibilities/duties section.');
  if (!hasQualifications) recommendations.push('Add required and preferred qualifications.');
  if (!hasSkills) recommendations.push('List specific skills and competencies needed.');
  if (!hasEducation) recommendations.push('Specify education requirements.');
  if (!hasExperience) recommendations.push('Specify years of experience required.');
  if (!hasCompensation) recommendations.push('Consider adding compensation range for transparency.');
  if (extractedSkills.length < 5) recommendations.push('The JD mentions few specific skills. Consider being more explicit about required skills.');
  if (jdText.length < 500) recommendations.push('The JD is quite short. Consider adding more detail about the role, team, and company.');

  const readabilityNotes: string[] = [];
  const sentences = jdText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0 ? jdText.split(/\s+/).length / sentences.length : 0;
  if (avgSentenceLength > 25) readabilityNotes.push('Some sentences are long. Consider breaking them up for clarity.');
  if (jdText.length > 5000) readabilityNotes.push('The JD is quite long. Consider condensing to focus on key requirements.');

  return {
    extracted_skills: extractedSkills,
    analysis: {
      total_skills_found: extractedSkills.length,
      skill_categories: skillCategories,
      readability_notes: readabilityNotes,
      completeness_check: {
        has_responsibilities: hasResponsibilities,
        has_qualifications: hasQualifications,
        has_skills: hasSkills,
        has_education: hasEducation,
        has_experience: hasExperience,
        has_compensation: hasCompensation,
        completeness_score: completenessScore,
      },
      recommendations,
    },
    data_source: 'lightcast',
  };
}

export async function decomposeTasksForRole(
  role: string,
  detailLevel?: string
): Promise<{
  role: string;
  detail_level: string;
  onet_match: { code: string; title: string } | null;
  tasks: Array<{
    statement: string;
    importance: number | undefined;
    frequency_estimate: string;
    automation_potential: string;
  }>;
  summary: {
    total_tasks: number;
    high_importance_count: number;
    categories: Record<string, number>;
  };
  data_source: string;
}> {
  const level = detailLevel || 'standard';

  const onetMatch = await searchOccupation(role);
  if (!onetMatch) throw new Error(`Could not find O*NET occupation for: ${role}`);

  const headers = await getONetHeaders();
  const tasksRes = await fetch(`${ONET_BASE_URL}/online/occupations/${onetMatch.code}/summary/tasks`, { headers });

  let rawTasks: Array<{ statement: string; importance?: number }> = [];
  if (tasksRes.ok) {
    const data = await tasksRes.json();
    rawTasks = (data.task || []).map((t: any) => ({
      statement: t.statement || t.name || '',
      importance: t.score?.value,
    }));
  }

  const tasks = rawTasks.map((t) => {
    const stmt = t.statement.toLowerCase();
    let freq = 'Weekly';
    if (stmt.includes('daily') || stmt.includes('monitor') || stmt.includes('review')) freq = 'Daily';
    if (stmt.includes('annual') || stmt.includes('yearly') || stmt.includes('strategic')) freq = 'Quarterly/Annual';
    if (stmt.includes('project') || stmt.includes('initiat')) freq = 'Project-based';

    let automationPotential = 'Medium';
    if (stmt.includes('analyz') || stmt.includes('data') || stmt.includes('report') || stmt.includes('calculate')) automationPotential = 'High';
    if (stmt.includes('lead') || stmt.includes('mentor') || stmt.includes('negotiat') || stmt.includes('counsel')) automationPotential = 'Low';

    return {
      statement: t.statement,
      importance: t.importance,
      frequency_estimate: freq,
      automation_potential: automationPotential,
    };
  });

  const highImportance = tasks.filter((t) => (t.importance ?? 0) > 60).length;
  const categories: Record<string, number> = { 'Daily': 0, 'Weekly': 0, 'Project-based': 0, 'Quarterly/Annual': 0 };
  for (const t of tasks) {
    categories[t.frequency_estimate] = (categories[t.frequency_estimate] || 0) + 1;
  }

  return {
    role,
    detail_level: level,
    onet_match: { code: onetMatch.code, title: onetMatch.title },
    tasks,
    summary: {
      total_tasks: tasks.length,
      high_importance_count: highImportance,
      categories,
    },
    data_source: 'onet',
  };
}
