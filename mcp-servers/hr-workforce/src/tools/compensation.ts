import { FileCache, WageData, Compensation } from '@auxia/shared';

const BLS_BASE_URL = 'https://api.bls.gov/publicAPI/v2';
const cache = new FileCache('hr-workforce-compensation', 3600 * 1000);

async function getONetHeaders(): Promise<Record<string, string>> {
  const apiKey = process.env.ONET_API_KEY;
  if (!apiKey) throw new Error('ONET_API_KEY must be set');
  return {
    'X-API-Key': apiKey,
    Accept: 'application/json',
  };
}

async function resolveSOCCode(occupationCode: string): Promise<string> {
  // If already looks like SOC (e.g., 15-1252), return as-is
  if (/^\d{2}-\d{4}$/.test(occupationCode)) return occupationCode;
  // If it's O*NET format (e.g., 15-1252.00), strip suffix
  if (/^\d{2}-\d{4}\.\d{2}$/.test(occupationCode)) return occupationCode.replace(/\.\d+$/, '');
  // Otherwise, try to search O*NET
  const headers = await getONetHeaders();
  const url = `https://api-v2.onetcenter.org/online/search?keyword=${encodeURIComponent(occupationCode)}&end=1`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Could not resolve occupation code: ${occupationCode}`);
  const data = await res.json();
  const results = data.occupation || [];
  if (results.length === 0) throw new Error(`No occupation found for: ${occupationCode}`);
  return results[0].code.replace(/\.\d+$/, '');
}

async function fetchBLSWages(socCode: string, areaCode: string = '0000000'): Promise<WageData | null> {
  const codeNum = socCode.replace('-', '');

  // BLS OES series IDs for different percentiles
  // Data type codes: 01=employment, 03=hourly mean, 04=annual mean, 07=10th pct, 08=25th pct, 11=median, 12=75th pct, 13=90th pct
  const dataTypes: Record<string, string> = {
    hourly_mean: '03',
    annual_mean: '04',
    p10: '07',
    p25: '08',
    median: '11',
    p75: '12',
    p90: '13',
  };

  const seriesIds = Object.entries(dataTypes).map(
    ([_key, dt]) => `OEUM${areaCode}00000000${codeNum}${dt}`
  );

  try {
    const res = await fetch(`${BLS_BASE_URL}/timeseries/data/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: seriesIds,
        startyear: String(new Date().getFullYear() - 1),
        endyear: String(new Date().getFullYear()),
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();

    const wages: WageData = {};
    const series = data.Results?.series || [];
    const keys = Object.keys(dataTypes);

    for (let i = 0; i < series.length; i++) {
      const s = series[i];
      const latestValue = s.data?.[0]?.value;
      if (latestValue && latestValue !== '-') {
        const numValue = parseFloat(latestValue);
        const key = keys[i] as keyof WageData;
        (wages as any)[key] = numValue;
      }
    }

    return Object.keys(wages).length > 0 ? wages : null;
  } catch {
    return null;
  }
}

export async function getCompensation(
  occupationCode: string,
  location: string = 'National'
): Promise<Compensation> {
  const cacheKey = `compensation:${occupationCode}:${location}`;
  const cached = await cache.get<Compensation>(cacheKey);
  if (cached) return cached;

  const socCode = await resolveSOCCode(occupationCode);
  const wages = await fetchBLSWages(socCode);

  if (!wages) {
    throw new Error(`No BLS wage data available for SOC code: ${socCode}`);
  }

  const result: Compensation = {
    role: occupationCode,
    location,
    wages,
    currency: 'USD',
    wage_type: 'annual',
    occupation_code: socCode,
    data_source: 'bls_oes',
    reference_period: `${new Date().getFullYear() - 1}`,
    metadata: {
      note: 'Wages are from BLS Occupational Employment and Wage Statistics. Annual figures in USD.',
    },
  };

  await cache.set(cacheKey, result);
  return result;
}

export function assessAttritionRisk(
  occupation: string,
  industry?: string
): {
  occupation: string;
  industry: string;
  risk_factors: Array<{ factor: string; risk_level: 'high' | 'medium' | 'low'; description: string }>;
  overall_risk: 'high' | 'medium' | 'low';
  mitigation_strategies: string[];
  framework_note: string;
} {
  const ind = industry || 'General';

  const riskFactors = [
    {
      factor: 'Market demand',
      risk_level: 'medium' as const,
      description: 'Assess current job market demand for this role. Higher demand increases flight risk.',
    },
    {
      factor: 'Compensation competitiveness',
      risk_level: 'medium' as const,
      description: 'Compare internal compensation against market benchmarks.',
    },
    {
      factor: 'Career growth opportunities',
      risk_level: 'medium' as const,
      description: 'Evaluate internal career progression paths and promotion cadence.',
    },
    {
      factor: 'Skills portability',
      risk_level: 'medium' as const,
      description: 'Highly portable skills increase attrition risk as employees can easily transition.',
    },
    {
      factor: 'Remote work availability',
      risk_level: 'low' as const,
      description: 'Roles with rigid location requirements may lose talent to remote-friendly competitors.',
    },
    {
      factor: 'Industry turnover norms',
      risk_level: 'medium' as const,
      description: `Baseline attrition rates vary by industry (${ind}).`,
    },
  ];

  const mitigationStrategies = [
    'Conduct regular compensation benchmarking and adjust proactively.',
    'Create clear career development plans with visible growth paths.',
    'Implement stay interviews to identify concerns before they become resignations.',
    'Offer skill development opportunities and learning budgets.',
    'Build strong team culture and employee engagement programs.',
    'Provide flexible work arrangements where possible.',
  ];

  return {
    occupation,
    industry: ind,
    risk_factors: riskFactors,
    overall_risk: 'medium',
    mitigation_strategies: mitigationStrategies,
    framework_note: 'This is a structured assessment framework. Populate with organization-specific data and the compensation_benchmark tool for actionable insights.',
  };
}

export function planSuccession(
  role: string,
  department?: string
): {
  role: string;
  department: string;
  succession_framework: {
    criticality_assessment: { factors: string[]; questions: string[] };
    readiness_levels: Array<{ level: string; description: string; timeline: string }>;
    development_actions: string[];
    pipeline_metrics: Array<{ metric: string; target: string }>;
  };
  framework_note: string;
} {
  const dept = department || 'General';

  return {
    role,
    department: dept,
    succession_framework: {
      criticality_assessment: {
        factors: [
          'Role impact on revenue/operations',
          'Difficulty to fill externally',
          'Unique institutional knowledge requirements',
          'Number of direct reports/scope of influence',
          'Strategic importance to upcoming initiatives',
        ],
        questions: [
          'What would happen if this role were vacant for 90 days?',
          'How many people in the organization could step into this role today?',
          'What is the time-to-productivity for an external hire?',
          'Does this role require rare or specialized skills?',
        ],
      },
      readiness_levels: [
        { level: 'Ready Now', description: 'Could step in within 0-6 months with minimal ramp-up.', timeline: '0-6 months' },
        { level: 'Ready Soon', description: 'Needs targeted development; could be ready in 6-18 months.', timeline: '6-18 months' },
        { level: 'Developing', description: 'High-potential candidate requiring 1-3 years of development.', timeline: '1-3 years' },
      ],
      development_actions: [
        'Shadow current role holder on key decisions and stakeholder interactions.',
        'Lead cross-functional projects to build strategic thinking.',
        'Rotate through related functions to broaden perspective.',
        'Assign an executive mentor for leadership development.',
        'Provide formal leadership training and coaching.',
        'Create stretch assignments with increasing responsibility.',
      ],
      pipeline_metrics: [
        { metric: 'Bench strength ratio', target: 'At least 2 "Ready Now" or "Ready Soon" candidates per critical role' },
        { metric: 'Diversity of pipeline', target: 'Pipeline reflects organizational diversity goals' },
        { metric: 'Development plan completion', target: '80%+ of identified successors on active development plans' },
        { metric: 'Internal fill rate', target: '70%+ of leadership roles filled internally' },
      ],
    },
    framework_note: 'This is a succession planning framework. Use with organizational context and individual employee data for specific planning.',
  };
}

export function analyzeTalentFlow(
  occupation: string,
  fromLocation?: string,
  toLocation?: string
): {
  occupation: string;
  from_location: string;
  to_location: string;
  flow_analysis: {
    factors: Array<{ factor: string; description: string }>;
    data_sources_to_consult: string[];
    analysis_dimensions: string[];
  };
  framework_note: string;
} {
  const from = fromLocation || 'All locations';
  const to = toLocation || 'All locations';

  return {
    occupation,
    from_location: from,
    to_location: to,
    flow_analysis: {
      factors: [
        { factor: 'Cost of living differential', description: 'Compare cost of living between origin and destination to understand migration incentives.' },
        { factor: 'Compensation differential', description: 'Compare compensation levels using the compensation_benchmark tool.' },
        { factor: 'Industry concentration', description: 'Higher industry concentration in destination attracts specialized talent.' },
        { factor: 'Remote work trends', description: 'Remote work has decoupled talent location from employer location for many roles.' },
        { factor: 'Quality of life', description: 'Non-compensation factors including climate, culture, and infrastructure.' },
        { factor: 'Regulatory environment', description: 'Tax policies, business climate, and labor regulations affect talent movement.' },
      ],
      data_sources_to_consult: [
        'Census Bureau migration data',
        'BLS QCEW (Quarterly Census of Employment and Wages)',
        'Lightcast job postings by geography',
        'LinkedIn Talent Insights (if available)',
        'IRS Statistics of Income migration data',
      ],
      analysis_dimensions: [
        'Net migration rate for the occupation',
        'Top origin and destination metro areas',
        'Salary-adjusted migration patterns',
        'Industry-specific movement patterns',
        'Remote vs. relocation trends',
      ],
    },
    framework_note: 'Talent flow analysis requires combining multiple data sources. Use workforce_supply and workforce_demand tools for specific location comparisons.',
  };
}

export function buildTeamSkillsMatrix(
  roles: string[]
): {
  roles: string[];
  matrix_framework: {
    skill_dimensions: Array<{ dimension: string; description: string }>;
    assessment_scale: Array<{ level: number; label: string; description: string }>;
    analysis_steps: string[];
  };
  recommended_tools: string[];
  framework_note: string;
} {
  return {
    roles,
    matrix_framework: {
      skill_dimensions: [
        { dimension: 'Technical skills', description: 'Role-specific hard skills and tools proficiency.' },
        { dimension: 'Domain knowledge', description: 'Industry and function-specific expertise.' },
        { dimension: 'Leadership skills', description: 'People management, strategic thinking, decision-making.' },
        { dimension: 'Communication skills', description: 'Written, verbal, and presentation abilities.' },
        { dimension: 'Collaboration skills', description: 'Cross-functional work, teamwork, stakeholder management.' },
        { dimension: 'Problem-solving', description: 'Analytical thinking, creativity, troubleshooting.' },
      ],
      assessment_scale: [
        { level: 1, label: 'Novice', description: 'Basic awareness; needs significant guidance.' },
        { level: 2, label: 'Advanced Beginner', description: 'Can perform with some guidance.' },
        { level: 3, label: 'Competent', description: 'Can perform independently in standard situations.' },
        { level: 4, label: 'Proficient', description: 'Can handle complex situations and mentor others.' },
        { level: 5, label: 'Expert', description: 'Recognized authority; can innovate and lead in the domain.' },
      ],
      analysis_steps: [
        '1. Use skills_extract on each role description to identify required skills.',
        '2. Map extracted skills to the dimension categories above.',
        '3. For each role, set target proficiency levels per skill.',
        '4. Assess current team members against targets.',
        '5. Identify coverage gaps where no team member meets the target.',
        '6. Prioritize development plans for critical gaps.',
      ],
    },
    recommended_tools: [
      'skills_extract — to identify role-specific skills',
      'skills_match — to find overlap between roles',
      'skills_adjacent — to discover development opportunities',
      'compensation_benchmark — to inform retention strategy for critical skills',
    ],
    framework_note: 'This provides the framework for building a team skills matrix. Combine with skills_extract for each role to populate with specific skills.',
  };
}
