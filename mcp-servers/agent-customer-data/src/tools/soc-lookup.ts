/**
 * SOC Code Lookup Tool
 *
 * Maps job titles to O*NET SOC codes using a built-in dictionary of common
 * occupations with fuzzy matching. Designed for batch use during customer
 * data ingestion — no external API calls required.
 */

export interface SocLookupParams {
  _ctx?: { tenant_id?: string };
  job_titles: string[];      // array of job titles to look up (batch)
  min_confidence?: number;   // minimum match confidence 0-1, default 0.3
}

interface SocEntry {
  soc: string;
  title: string;
  aliases: string[];
}

interface SocMatch {
  input_title: string;
  soc_code: string;
  soc_title: string;
  confidence: number;
  matched_via: 'exact_alias' | 'fuzzy_title' | 'token_overlap';
}

// ---------------------------------------------------------------------------
// SOC Dictionary — top ~50 most common roles with aliases
// ---------------------------------------------------------------------------

const SOC_DICTIONARY: SocEntry[] = [
  { soc: '11-1011.00', title: 'Chief Executives', aliases: ['CEO', 'Chief Executive Officer', 'Managing Director'] },
  { soc: '11-1021.00', title: 'General and Operations Managers', aliases: ['Operations Manager', 'General Manager', 'COO'] },
  { soc: '11-3031.00', title: 'Financial Managers', aliases: ['Finance Director', 'CFO', 'VP Finance'] },
  { soc: '11-3021.00', title: 'Computer and Information Systems Managers', aliases: ['IT Director', 'CTO', 'IT Manager', 'VP Technology'] },
  { soc: '11-3111.00', title: 'Compensation and Benefits Managers', aliases: ['Total Rewards Manager', 'Benefits Director'] },
  { soc: '11-3121.00', title: 'Human Resources Managers', aliases: ['HR Director', 'HR Manager', 'VP HR', 'CHRO', 'People Manager', 'HR Business Partner', 'Senior HR Business Partner', 'Talent Acquisition Manager', 'HR Solutions Manager', 'Senior HR Solutions Manager'] },
  { soc: '13-1071.00', title: 'Human Resources Specialists', aliases: ['HR Specialist', 'HR Coordinator', 'Senior HR Coordinator', 'HR Generalist', 'HR Administrator', 'HR Solutions Specialist', 'People Partner', 'Recruiter', 'Senior Recruiter', 'Talent Acquisition Specialist', 'Employee Relations Specialist', 'HRIS Analyst'] },
  { soc: '13-1141.00', title: 'Compensation, Benefits, and Job Analysis Specialists', aliases: ['Compensation Analyst', 'Compensation Specialist', 'Benefits Specialist', 'Benefits Analyst', 'Total Rewards Analyst'] },
  { soc: '13-1111.00', title: 'Management Analysts', aliases: ['Business Analyst', 'Strategy Consultant', 'Management Consultant'] },
  { soc: '13-2011.00', title: 'Accountants and Auditors', aliases: ['Staff Accountant', 'Senior Accountant', 'Auditor', 'Internal Auditor'] },
  { soc: '13-2051.00', title: 'Financial Analysts', aliases: ['Financial Analyst', 'Senior Financial Analyst', 'FP&A Analyst', 'Finance Analyst'] },
  { soc: '13-2052.00', title: 'Personal Financial Advisors', aliases: ['Financial Advisor', 'Wealth Manager'] },
  { soc: '13-2061.00', title: 'Financial Examiners', aliases: ['Bank Examiner', 'Compliance Examiner'] },
  { soc: '13-2082.00', title: 'Tax Preparers', aliases: ['Tax Specialist', 'Tax Accountant', 'Tax Analyst'] },
  { soc: '13-2099.00', title: 'Financial Specialists, All Other', aliases: ['Finance Specialist', 'Treasury Analyst'] },
  { soc: '15-1211.00', title: 'Computer Systems Analysts', aliases: ['Systems Analyst', 'IT Analyst', 'Business Systems Analyst'] },
  { soc: '15-1232.00', title: 'Computer User Support Specialists', aliases: ['IT Support', 'Help Desk', 'Desktop Support', 'IT Support Specialist'] },
  { soc: '15-1252.00', title: 'Software Developers', aliases: ['Software Engineer', 'Developer', 'Programmer', 'Full Stack Developer', 'Backend Engineer'] },
  { soc: '15-1299.00', title: 'Computer Occupations, All Other', aliases: ['IT Specialist', 'Technology Specialist'] },
  { soc: '17-2112.00', title: 'Industrial Engineers', aliases: ['Process Engineer', 'Manufacturing Engineer'] },
  { soc: '23-1011.00', title: 'Lawyers', aliases: ['Attorney', 'Legal Counsel', 'General Counsel'] },
  { soc: '23-2011.00', title: 'Paralegals and Legal Assistants', aliases: ['Paralegal', 'Legal Assistant'] },
  { soc: '27-1024.00', title: 'Graphic Designers', aliases: ['Visual Designer', 'UI Designer', 'Graphic Artist'] },
  { soc: '41-3031.00', title: 'Securities, Commodities, and Financial Services Sales Agents', aliases: ['Financial Sales', 'Investment Sales'] },
  { soc: '41-4012.00', title: 'Sales Representatives, Wholesale and Manufacturing', aliases: ['Sales Representative', 'Account Executive'] },
  { soc: '43-1011.00', title: 'First-Line Supervisors of Office and Administrative Support Workers', aliases: ['Office Manager', 'Administrative Supervisor'] },
  { soc: '43-3011.00', title: 'Bill and Account Collectors', aliases: ['Collections Specialist', 'AR Collector'] },
  { soc: '43-3021.00', title: 'Billing and Posting Clerks', aliases: ['Billing Clerk', 'Billing Specialist'] },
  { soc: '43-3031.00', title: 'Bookkeeping, Accounting, and Auditing Clerks', aliases: ['Bookkeeper', 'Accounting Clerk', 'AP Clerk', 'AR Clerk', 'Accounts Payable Clerk', 'Accounts Receivable Clerk'] },
  { soc: '43-3051.00', title: 'Payroll and Timekeeping Clerks', aliases: ['Payroll Specialist', 'Payroll Clerk', 'Payroll Administrator', 'Payroll Coordinator'] },
  { soc: '43-3061.00', title: 'Procurement Clerks', aliases: ['Purchasing Clerk', 'Procurement Specialist'] },
  { soc: '43-4051.00', title: 'Customer Service Representatives', aliases: ['Customer Support', 'Client Services', 'Support Specialist'] },
  { soc: '43-4161.00', title: 'Human Resources Assistants', aliases: ['HR Assistant', 'HR Admin', 'HR Admin Assistant', 'HR Administrative Assistant', 'Human Resources Admin', 'Human Resources Admin Assistant', 'People Operations Coordinator', 'People Ops Coordinator'] },
  { soc: '43-6014.00', title: 'Secretaries and Administrative Assistants', aliases: ['Admin Assistant', 'Executive Assistant', 'Secretary', 'Office Coordinator'] },
  { soc: '43-9061.00', title: 'Office Clerks, General', aliases: ['Office Clerk', 'Administrative Clerk', 'General Clerk'] },
  { soc: '11-3031.01', title: 'Treasurers and Controllers', aliases: ['Controller', 'Treasurer', 'Finance Controller', 'Financial Controller'] },
  { soc: '13-1081.00', title: 'Logisticians', aliases: ['Supply Chain Analyst', 'Logistics Coordinator'] },
  { soc: '13-1082.00', title: 'Project Management Specialists', aliases: ['Project Manager', 'Program Manager', 'PMO Lead'] },
  { soc: '15-1241.00', title: 'Computer Network Architects', aliases: ['Network Engineer', 'Network Architect'] },
  { soc: '15-1212.00', title: 'Information Security Analysts', aliases: ['Security Analyst', 'Cybersecurity Analyst', 'InfoSec'] },
  { soc: '15-1243.00', title: 'Database Administrators', aliases: ['DBA', 'Database Engineer'] },
  { soc: '15-1244.00', title: 'Network and Computer Systems Administrators', aliases: ['Sysadmin', 'Systems Administrator', 'IT Admin'] },
  { soc: '15-2031.00', title: 'Operations Research Analysts', aliases: ['Operations Analyst', 'Decision Analyst', 'Quantitative Analyst'] },
  { soc: '15-2051.00', title: 'Data Scientists', aliases: ['Data Scientist', 'ML Engineer', 'Machine Learning Engineer'] },
  { soc: '11-2021.00', title: 'Marketing Managers', aliases: ['Marketing Director', 'VP Marketing', 'Head of Marketing', 'Brand Manager', 'Product Manager'] },
  { soc: '11-2022.00', title: 'Sales Managers', aliases: ['Sales Director', 'VP Sales', 'Head of Sales', 'Sales Manager', 'Regional Sales Director'] },
  { soc: '11-2032.00', title: 'Public Relations Managers', aliases: ['Social Media Manager', 'Communications Director'] },
  { soc: '11-3013.00', title: 'Facilities Managers', aliases: ['Facilities Coordinator', 'Facilities Manager'] },
  { soc: '11-9111.00', title: 'Medical and Health Services Managers', aliases: ['Healthcare Manager', 'Clinical Director'] },
  { soc: '11-9199.00', title: 'Managers, All Other', aliases: ['Department Manager', 'Team Lead', 'Team Manager'] },
  { soc: '13-1041.00', title: 'Compliance Officers', aliases: ['Compliance Manager', 'Compliance Analyst', 'Regulatory Specialist'] },
  { soc: '13-1023.00', title: 'Purchasing Agents', aliases: ['Contract Administrator', 'Contract Admin'] },
  { soc: '13-1151.00', title: 'Training and Development Specialists', aliases: ['L&D Specialist', 'Training Coordinator', 'Learning Specialist'] },
  { soc: '13-1161.00', title: 'Market Research Analysts and Marketing Specialists', aliases: ['Market Analyst', 'Research Analyst', 'Marketing Analyst', 'Marketing Coordinator', 'Digital Marketing Analyst', 'SEO Specialist', 'Search Marketing Specialist'] },
  { soc: '27-3031.00', title: 'Public Relations Specialists', aliases: ['PR Specialist', 'Communications Manager', 'PR Manager', 'Customer Experience Analyst'] },
  { soc: '27-3042.00', title: 'Technical Writers', aliases: ['Technical Writer'] },
  { soc: '27-3043.00', title: 'Writers and Authors', aliases: ['Content Specialist', 'Content Writer', 'Copywriter'] },
  { soc: '41-9031.00', title: 'Sales Engineers', aliases: ['Sales Engineer'] },
  { soc: '15-1253.00', title: 'Software Quality Assurance Analysts and Testers', aliases: ['QA Engineer', 'Quality Assurance Specialist', 'QA Analyst', 'Software QA Engineer'] },
  { soc: '15-1255.00', title: 'Web and Digital Interface Designers', aliases: ['UX Designer', 'UI Designer', 'Product Designer'] },
  { soc: '53-1042.00', title: 'First-Line Supervisors of Helpers, Laborers, and Material Movers, Hand', aliases: ['Warehouse Supervisor'] },
];

const EXACT_TITLE_OVERRIDES = new Map<string, { soc: string; title: string }>([
  ['brand manager', { soc: '11-2021.00', title: 'Marketing Managers' }],
  ['business development rep', { soc: '41-4012.00', title: 'Sales Representatives, Wholesale and Manufacturing' }],
  ['call center manager', { soc: '43-1011.00', title: 'First-Line Supervisors of Office and Administrative Support Workers' }],
  ['content specialist', { soc: '27-3043.00', title: 'Writers and Authors' }],
  ['contract administrator', { soc: '13-1023.00', title: 'Purchasing Agents' }],
  ['customer experience analyst', { soc: '27-3031.00', title: 'Public Relations Specialists' }],
  ['customer success manager', { soc: '41-4012.00', title: 'Sales Representatives, Wholesale and Manufacturing' }],
  ['data analyst', { soc: '15-2051.00', title: 'Data Scientists' }],
  ['devops engineer', { soc: '15-1252.00', title: 'Software Developers' }],
  ['digital marketing analyst', { soc: '13-1161.00', title: 'Market Research Analysts and Marketing Specialists' }],
  ['facilities coordinator', { soc: '11-3013.00', title: 'Facilities Managers' }],
  ['marketing analyst', { soc: '13-1161.00', title: 'Market Research Analysts and Marketing Specialists' }],
  ['marketing coordinator', { soc: '13-1161.00', title: 'Market Research Analysts and Marketing Specialists' }],
  ['product manager', { soc: '11-2021.00', title: 'Marketing Managers' }],
  ['qa engineer', { soc: '15-1253.00', title: 'Software Quality Assurance Analysts and Testers' }],
  ['quality assurance specialist', { soc: '15-1253.00', title: 'Software Quality Assurance Analysts and Testers' }],
  ['sales engineer', { soc: '41-9031.00', title: 'Sales Engineers' }],
  ['sales manager', { soc: '11-2022.00', title: 'Sales Managers' }],
  ['seo specialist', { soc: '13-1161.00', title: 'Market Research Analysts and Marketing Specialists' }],
  ['social media manager', { soc: '11-2032.00', title: 'Public Relations Managers' }],
  ['technical writer', { soc: '27-3042.00', title: 'Technical Writers' }],
  ['ux designer', { soc: '15-1255.00', title: 'Web and Digital Interface Designers' }],
  ['warehouse supervisor', { soc: '53-1042.00', title: 'First-Line Supervisors of Helpers, Laborers, and Material Movers, Hand' }],
]);

const NOISE_TOKENS = new Set([
  'and', 'of', 'the', 'for', 'to',
  'senior', 'sr', 'junior', 'jr', 'lead', 'principal', 'staff',
  'specialist', 'manager', 'analyst', 'coordinator', 'associate',
  'representative', 'officer', 'administrator', 'assistant', 'director',
  'partner', 'head', 'vp',
]);

function normalizeToken(token: string): string {
  let t = token.toLowerCase().trim();
  if (t.endsWith('ies') && t.length > 4) t = `${t.slice(0, -3)}y`;
  else if (t.endsWith('s') && t.length > 3) t = t.slice(0, -1);
  return t;
}

function normalizeTitle(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Pre-compute lowercase alias lookup for O(1) exact matching
// ---------------------------------------------------------------------------

const ALIAS_MAP = new Map<string, { soc: string; title: string }>();
for (const entry of SOC_DICTIONARY) {
  // Index canonical title as an alias too
  ALIAS_MAP.set(normalizeTitle(entry.title), { soc: entry.soc, title: entry.title });
  for (const alias of entry.aliases) {
    ALIAS_MAP.set(normalizeTitle(alias), { soc: entry.soc, title: entry.title });
  }
}

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

function tokenize(text: string): Set<string> {
  const raw = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map(normalizeToken);
  const filtered = raw.filter((token) => token.length > 1 && !NOISE_TOKENS.has(token));
  return new Set(filtered.length > 0 ? filtered : raw);
}

function scoreTokenOverlap(input: string, candidate: string): number {
  const inputTokens = tokenize(input);
  const candidateTokens = tokenize(candidate);

  let matchCount = 0;
  for (const token of inputTokens) {
    if (candidateTokens.has(token)) {
      matchCount++;
    }
  }

  return matchCount / Math.max(inputTokens.size, candidateTokens.size);
}

function findBestMatch(
  inputTitle: string,
  minConfidence: number,
): SocMatch | null {
  const inputNormalized = normalizeTitle(inputTitle.trim());

  // 0. High-priority exact title overrides
  const override = EXACT_TITLE_OVERRIDES.get(inputNormalized);
  if (override) {
    return {
      input_title: inputTitle,
      soc_code: override.soc,
      soc_title: override.title,
      confidence: 1.0,
      matched_via: 'exact_alias',
    };
  }

  // 1. Exact alias match (confidence 1.0)
  const exactHit = ALIAS_MAP.get(inputNormalized);
  if (exactHit) {
    return {
      input_title: inputTitle,
      soc_code: exactHit.soc,
      soc_title: exactHit.title,
      confidence: 1.0,
      matched_via: 'exact_alias',
    };
  }

  // 2. Contains alias / alias contains input (confidence 0.85)
  for (const [alias, entry] of ALIAS_MAP) {
    // Avoid tiny-token false positives ("benefits" matching "it", etc.)
    if (alias.length < 4) continue;
    if (inputNormalized.includes(alias) || alias.includes(inputNormalized)) {
      return {
        input_title: inputTitle,
        soc_code: entry.soc,
        soc_title: entry.title,
        confidence: 0.85,
        matched_via: 'fuzzy_title',
      };
    }
  }

  // 3. Token overlap scoring — check canonical title + all aliases, keep best
  let bestScore = 0;
  let bestEntry: SocEntry | null = null;

  for (const entry of SOC_DICTIONARY) {
    // Score against canonical title
    const titleScore = scoreTokenOverlap(inputTitle, entry.title);
    if (titleScore > bestScore) {
      bestScore = titleScore;
      bestEntry = entry;
    }

    // Score against each alias
    for (const alias of entry.aliases) {
      const aliasScore = scoreTokenOverlap(inputTitle, alias);
      if (aliasScore > bestScore) {
        bestScore = aliasScore;
        bestEntry = entry;
      }
    }
  }

  if (bestEntry && bestScore >= minConfidence) {
    return {
      input_title: inputTitle,
      soc_code: bestEntry.soc,
      soc_title: bestEntry.title,
      confidence: Math.round(bestScore * 100) / 100,
      matched_via: 'token_overlap',
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Exported tool function
// ---------------------------------------------------------------------------

/**
 * Map an array of job titles to O*NET SOC codes using a built-in dictionary
 * and fuzzy token-overlap matching. Returns matches with confidence scores
 * and lists any unmatched titles.
 */
export function customerDataSocLookup(input: SocLookupParams): string {
  const { job_titles, min_confidence = 0.3 } = input;

  if (!job_titles || job_titles.length === 0) {
    throw new Error('job_titles array is required and must not be empty');
  }

  const matches: SocMatch[] = [];
  const unmatched: string[] = [];

  for (const title of job_titles) {
    if (!title || typeof title !== 'string' || title.trim() === '') {
      unmatched.push(title ?? '');
      continue;
    }

    const result = findBestMatch(title.trim(), min_confidence);
    if (result) {
      matches.push(result);
    } else {
      unmatched.push(title);
    }
  }

  return JSON.stringify({
    matches,
    unmatched,
    total_input: job_titles.length,
    total_matched: matches.length,
    total_unmatched: unmatched.length,
  });
}
