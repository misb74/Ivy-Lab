import crypto from 'crypto';
import { getDb } from '../db/database.js';
import type { RoleRow, RoleSpec } from '../engine/types.js';

interface RoleNextParams {
  batch_id: string;
}

interface ResearchPrompts {
  profiles: string;
  movements: string;
  certifications: string;
}

interface SearchParamsForRole {
  primary: {
    job_titles: string[];
    locations: string[];
    seniority_levels: string[];
    industries: string[];
    company_sizes: string[];
    max_results: number;
  };
  secondary: {
    job_titles: string[];
    locations: string[];
    seniority_levels: string[];
    industries: string[];
    max_results: number;
  };
}

interface RoleNextResult {
  complete: boolean;
  message?: string;
  role_id?: string;
  role_index?: number;
  title?: string;
  location?: string;
  spec?: RoleSpec;
  research_prompts?: ResearchPrompts;
  search_params?: SearchParamsForRole;
}

/**
 * Returns the next unprocessed role for a batch, updates its status
 * to 'researching', and generates tailored research prompts.
 */
export async function roleNext(params: RoleNextParams): Promise<RoleNextResult> {
  const { batch_id } = params;
  const db = getDb();

  // Verify the batch exists
  const batch = db.prepare('SELECT id FROM batches WHERE id = ?').get(batch_id);
  if (!batch) {
    throw new Error(`Batch "${batch_id}" not found.`);
  }

  // Find the first queued role, ordered by role_index
  const role = db.prepare(
    `SELECT * FROM roles
     WHERE batch_id = ? AND status = 'queued'
     ORDER BY role_index ASC
     LIMIT 1`,
  ).get(batch_id) as RoleRow | undefined;

  if (!role) {
    return { complete: true, message: 'All roles processed.' };
  }

  // Update status to 'researching' and set started_at
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE roles
     SET status = 'researching', started_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(now, now, role.id);

  // Update batch status to 'running' if still pending
  db.prepare(
    `UPDATE batches SET status = 'running', updated_at = ? WHERE id = ? AND status = 'pending'`,
  ).run(now, batch_id);

  // Parse the role spec
  const spec: RoleSpec = JSON.parse(role.spec_json);

  // Generate research prompts and structured search params
  const research_prompts = generatePrompts(spec);
  const search_params = generateSearchParams(spec);

  return {
    complete: false,
    role_id: role.id,
    role_index: role.role_index,
    title: spec.title,
    location: spec.location,
    spec,
    research_prompts,
    search_params,
  };
}

// ── Prompt Generation ───────────────────────────────────────────────

function generatePrompts(spec: RoleSpec): ResearchPrompts {
  const {
    title,
    location,
    industry_experience,
    org_size,
    regulatory_requirements,
    certifications,
    nice_to_haves,
  } = spec;

  const industryList = industry_experience.join(', ');
  const certList = certifications.join(', ');
  const regulatoryList = regulatory_requirements.join(', ');
  const primaryIndustry = industry_experience[0] || 'the relevant industry';

  const profiles = [
    `You are the world's most experienced talent researcher.`,
    `Search for ${title} professionals at top ${org_size} organizations in ${location}.`,
    `Focus on people with ${industryList} experience.`,
    `Search for current holders of this role at Fortune 100 companies,`,
    `major ${primaryIndustry} companies, and leading organizations.`,
    `For each person, gather: full name, current title/company, previous roles,`,
    `certifications (${certList}), government/military background,`,
    `${primaryIndustry} experience, speaking/thought leadership.`,
    `Search at least 8-10 different queries.`,
  ].join(' ');

  const movements = [
    `Search for ${title} talent movement, career changes, and people open to new roles.`,
    `Search for recent appointments (2024-2026), people who left positions,`,
    `tenure data, ${primaryIndustry} crossover experience,`,
    `government-to-private transitions, conference speakers`,
    `(RSA, Black Hat, industry events), leadership changes at ${org_size} companies.`,
    `Key signals: advisory/fractional roles, 3-5+ year tenure, active speakers,`,
    `company restructuring/M&A, new certifications.`,
  ].join(' ');

  const certificationsPrompt = [
    `Search for ${title} professionals with specific ${regulatoryList} experience`,
    `and ${certList} certifications.`,
    `Search for people who have testified before Congress, worked with regulatory bodies,`,
    `served on advisory boards (CISA, NIST, FCC, industry ISACs).`,
    `Find people at companies operating in ${industryList} sectors.`,
    `Also list which certifications and regulatory frameworks are most important`,
    `for this specific role.`,
  ].join(' ');

  return {
    profiles,
    movements,
    certifications: certificationsPrompt,
  };
}

// ── Search Params Generation ──────────────────────────────────────────

function generateTitleVariations(title: string): string[] {
  const titles = [title];
  const lower = title.toLowerCase();

  // Generate common title prefix swaps
  const prefixSwaps: [string, string[]][] = [
    ['head of', ['VP', 'Director of', 'Head of']],
    ['vp', ['VP', 'Head of', 'SVP']],
    ['vice president', ['VP', 'Head of', 'SVP']],
    ['director of', ['Director of', 'Head of', 'VP']],
    ['director', ['Director', 'Senior Director', 'Head of']],
    ['chief', ['Chief', 'SVP', 'VP']],
    ['senior director', ['Senior Director', 'VP', 'Director']],
  ];

  for (const [prefix, replacements] of prefixSwaps) {
    if (lower.startsWith(prefix)) {
      const suffix = title.slice(prefix.length).trim();
      for (const replacement of replacements) {
        const variant = `${replacement} ${suffix}`;
        if (variant.toLowerCase() !== lower) {
          titles.push(variant);
        }
      }
      break;
    }
  }

  return [...new Set(titles)];
}

function inferSeniority(title: string): string[] {
  const lower = title.toLowerCase();

  if (/\b(chief|cxo|cto|cfo|cio|cpo|chro|coo|ceo)\b/.test(lower)) {
    return ['c_suite', 'vp'];
  }
  if (/\b(svp|senior vice president)\b/.test(lower)) {
    return ['vp', 'c_suite'];
  }
  if (/\b(head of|vp|vice president)\b/.test(lower)) {
    return ['vp', 'director'];
  }
  if (/\b(senior director)\b/.test(lower)) {
    return ['director', 'vp'];
  }
  if (/\b(director)\b/.test(lower)) {
    return ['director', 'manager'];
  }
  if (/\b(manager|lead)\b/.test(lower)) {
    return ['manager', 'senior'];
  }

  return ['director', 'vp', 'senior'];
}

function mapOrgSizeToApiRange(orgSize: string): string[] {
  const lower = orgSize.toLowerCase().replace(/,/g, '');
  if (/10000\+|10k\+/.test(lower)) return ['5001-10000', '10000+'];
  if (/5000\+|5k\+/.test(lower)) return ['1001-5000', '5001-10000', '10000+'];
  if (/1000\+|1k\+/.test(lower)) return ['501-1000', '1001-5000', '5001-10000'];
  if (/500\+/.test(lower)) return ['201-500', '501-1000', '1001-5000'];
  if (/100\+/.test(lower)) return ['51-200', '201-500', '501-1000'];
  return ['1001-5000', '5001-10000'];
}

function generateSearchParams(spec: RoleSpec): SearchParamsForRole {
  const titleVariations = generateTitleVariations(spec.title);
  const primarySeniority = inferSeniority(spec.title);
  const companySizes = mapOrgSizeToApiRange(spec.org_size);

  // Broader seniority for secondary (add one level down)
  const secondarySeniority = primarySeniority.includes('director')
    ? primarySeniority
    : [...primarySeniority, 'director'];

  return {
    primary: {
      job_titles: titleVariations.slice(0, 3),
      locations: [spec.location],
      seniority_levels: primarySeniority,
      industries: spec.industry_experience,
      company_sizes: companySizes,
      max_results: 25,
    },
    secondary: {
      job_titles: titleVariations,
      locations: [spec.location],
      seniority_levels: secondarySeniority,
      industries: spec.industry_experience,
      max_results: 15,
    },
  };
}
