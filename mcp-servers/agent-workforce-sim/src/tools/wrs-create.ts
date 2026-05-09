import crypto from 'crypto';
import { getDatabase } from '../db/database.js';

export interface WrsCreateInput {
  simulation_name: string;
  org_name: string;
  industry_naics?: string;
  headcount: number;
  time_horizon_months?: number;
  monte_carlo_iterations?: number;
  department_name?: string;
  team_name?: string;
  roles?: Array<{
    title: string;
    onet_soc_code: string;
    fte_count: number;
    annual_cost_per_fte?: number;
    level?: string;
    location?: string;
  }>;
  input_provenance?: {
    status?: 'verified' | 'inferred';
    headcount_source?: string;
    role_fte_source?: string;
    requires_confirmation?: boolean;
    warnings?: string[];
    evidence?: string;
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function rebalanceRoleHeadcount<T extends { fte_count: number }>(
  roles: T[],
  targetHeadcount: number
): { roles: T[]; rebalanced: boolean; original_total_fte: number } {
  const safeTarget = Number.isFinite(targetHeadcount) ? Math.max(0, targetHeadcount) : 0;
  if (roles.length === 0 || safeTarget <= 0) {
    return { roles, rebalanced: false, original_total_fte: roles.reduce((s, r) => s + (r.fte_count || 0), 0) };
  }

  const totalFte = roles.reduce((s, r) => s + (Number.isFinite(r.fte_count) ? r.fte_count : 0), 0);
  if (totalFte <= 0) return { roles, rebalanced: false, original_total_fte: totalFte };
  if (Math.abs(totalFte - safeTarget) < 0.01) return { roles, rebalanced: false, original_total_fte: totalFte };

  const scale = safeTarget / totalFte;
  const scaled = roles.map((role) => ({
    ...role,
    fte_count: round2(Math.max(0, role.fte_count * scale)),
  }));

  const scaledTotal = scaled.reduce((s, r) => s + r.fte_count, 0);
  const diff = round2(safeTarget - scaledTotal);
  if (Math.abs(diff) >= 0.01) {
    let adjustIdx = 0;
    for (let i = 1; i < scaled.length; i++) {
      if (scaled[i].fte_count > scaled[adjustIdx].fte_count) adjustIdx = i;
    }
    scaled[adjustIdx] = {
      ...scaled[adjustIdx],
      fte_count: round2(Math.max(0, scaled[adjustIdx].fte_count + diff)),
    };
  }

  return { roles: scaled, rebalanced: true, original_total_fte: totalFte };
}

function normalizeInputProvenance(
  input: WrsCreateInput,
  roleTotalBeforeRebalance: number,
  roleTotalAfterRebalance: number,
  rebalanced: boolean
) {
  const provided = input.input_provenance ?? {};
  const status = provided.status === 'verified' ? 'verified' : 'inferred';
  const headcount_source =
    typeof provided.headcount_source === 'string' && provided.headcount_source.trim().length > 0
      ? provided.headcount_source.trim()
      : 'model_inferred';
  const role_fte_source =
    typeof provided.role_fte_source === 'string' && provided.role_fte_source.trim().length > 0
      ? provided.role_fte_source.trim()
      : 'model_inferred';
  const warnings = Array.isArray(provided.warnings)
    ? provided.warnings.filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
    : [];

  return {
    status,
    headcount_source,
    role_fte_source,
    requires_confirmation: provided.requires_confirmation ?? status !== 'verified',
    warnings,
    ...(typeof provided.evidence === 'string' && provided.evidence.trim().length > 0
      ? { evidence: provided.evidence.trim() }
      : {}),
    headcount_value: input.headcount,
    roles_total_fte_before_rebalance: round2(roleTotalBeforeRebalance),
    roles_total_fte_after_rebalance: round2(roleTotalAfterRebalance),
    roles_fte_rebalanced: rebalanced,
  };
}

/**
 * Common HR/business title abbreviations → O*NET search terms.
 * These expand abbreviations that don't appear in O*NET titles.
 */
const TITLE_ALIASES: Record<string, string> = {
  'l&d': 'training and development',
  'hrbp': 'human resources',
  'hr': 'human resources',
  'it': 'information technology',
  'qa': 'quality assurance',
  'ux': 'user experience',
  'ui': 'user interface',
  'devops': 'software developer',
  'sre': 'software developer',
  'pm': 'project management',
  'scrum master': 'project management',
  'swe': 'software developer',
  'cto': 'computer and information systems manager',
  'cfo': 'financial manager',
  'coo': 'general and operations manager',
  'vp': 'manager',
  'svp': 'manager',
  'evp': 'manager',
  'sdet': 'software quality assurance',
  'ba': 'business analyst',
  'fp&a': 'financial analyst',
  'ar': 'accounts receivable',
  'ap': 'accounts payable',
  'gl': 'general ledger',
  'erp': 'database administrator',
};

/**
 * Resolve a role title to the best-matching O*NET SOC code.
 * Queries the Supabase occupations table by title keywords.
 * Returns the corrected SOC code if a better match is found.
 */
async function resolveSocCode(
  roleTitle: string,
  providedSoc: string,
): Promise<{ soc_code: string; title: string; corrected: boolean }> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { soc_code: providedSoc, title: roleTitle, corrected: false };

  try {
    // Priority 1: Curated title→SOC lookup (handles common business titles not in O*NET)
    const titleLower = roleTitle.toLowerCase().trim();
    try {
      const mapPath = new URL('../data/title-soc-map.json', import.meta.url);
      const { default: fs } = await import('fs');
      if (fs.existsSync(mapPath)) {
        const titleMap: Record<string, string> = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
        const directMatch = titleMap[titleLower];
        if (directMatch) {
          console.log(`[SOC Resolution] "${roleTitle}": direct lookup → ${directMatch}`);
          return { soc_code: directMatch, title: roleTitle, corrected: directMatch !== providedSoc };
        }
        // Try partial: "senior l&d specialist" → check if any key is a substring
        for (const [mapTitle, mapSoc] of Object.entries(titleMap)) {
          if (titleLower.includes(mapTitle) || mapTitle.includes(titleLower)) {
            console.log(`[SOC Resolution] "${roleTitle}": partial lookup "${mapTitle}" → ${mapSoc}`);
            return { soc_code: mapSoc, title: roleTitle, corrected: mapSoc !== providedSoc };
          }
        }
      }
    } catch { /* file not found — fall through to keyword matching */ }

    // Priority 2: Expand abbreviations before keyword extraction
    let expandedTitle = roleTitle;
    for (const [abbr, expansion] of Object.entries(TITLE_ALIASES)) {
      const re = new RegExp(`\\b${abbr.replace(/[&]/g, '\\$&')}\\b`, 'gi');
      if (re.test(expandedTitle)) {
        expandedTitle = expandedTitle.replace(re, expansion);
      }
    }

    // Priority 3: Keyword search against O*NET titles
    const stopwords = new Set(['and', 'the', 'of', 'in', 'for', 'a', 'an', 'or', 'at', 'to', 'with']);
    const keywords = expandedTitle
      .split(/[\s,\-\/]+/)
      .filter(w => w.length > 2 && !stopwords.has(w.toLowerCase()));

    // Try each keyword until we get results, starting with the most specific (longest words first)
    const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);

    let bestMatch: { soc_code: string; title: string } | null = null;
    let bestScore = 0;

    for (const keyword of sortedKeywords.slice(0, 3)) {
      const resp = await fetch(
        `${url}/rest/v1/occupations?title=ilike.*${encodeURIComponent(keyword)}*&select=soc_code,title&limit=20`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      if (!resp.ok) continue;
      const candidates: Array<{ soc_code: string; title: string }> = await resp.json();
      if (!candidates.length) continue;

      // Score each candidate: how many title keywords appear in the candidate title?
      for (const c of candidates) {
        const cLower = c.title.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          if (cLower.includes(kw.toLowerCase())) score += kw.length; // Weight by keyword length
        }
        // Bonus for exact SOC match (caller was right)
        if (c.soc_code === providedSoc) score += 5;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = c;
        }
      }
    }

    if (bestMatch && bestMatch.soc_code !== providedSoc) {
      console.log(
        `[SOC Resolution] "${roleTitle}": corrected ${providedSoc} → ${bestMatch.soc_code} (${bestMatch.title})`,
      );
      return { soc_code: bestMatch.soc_code, title: bestMatch.title, corrected: true };
    }

    return { soc_code: providedSoc, title: roleTitle, corrected: false };
  } catch {
    return { soc_code: providedSoc, title: roleTitle, corrected: false };
  }
}

export async function handleWrsCreate(input: WrsCreateInput) {
  const now = new Date().toISOString();
  const db = getDatabase();

  const org_id = crypto.randomUUID();
  const dept_id = crypto.randomUUID();
  const team_id = crypto.randomUUID();
  const simulation_id = crypto.randomUUID();

  const inputRoles = input.roles ?? [];
  const rebalanced = rebalanceRoleHeadcount(inputRoles, input.headcount);
  const normalizedRoles = rebalanced.roles;
  const roles_total_fte = round2(normalizedRoles.reduce((sum, role) => sum + role.fte_count, 0));
  const input_credibility = normalizeInputProvenance(
    input,
    rebalanced.original_total_fte,
    roles_total_fte,
    rebalanced.rebalanced
  );

  // Resolve SOC codes — validate/correct each role's occupation mapping
  const roles = await Promise.all(
    normalizedRoles.map(async (role) => {
      const resolved = await resolveSocCode(role.title, role.onet_soc_code);
      return { ...role, onet_soc_code: resolved.soc_code };
    }),
  );

  const txn = db.transaction(() => {
    db.prepare(`
      INSERT INTO organization (id, name, industry_naics, headcount, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(org_id, input.org_name, input.industry_naics ?? null, input.headcount, now);

    db.prepare(`
      INSERT INTO department (id, org_id, name, parent_dept_id, headcount, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      dept_id,
      org_id,
      input.department_name ?? 'Finance & Accounting',
      null,
      input.headcount,
      now
    );

    db.prepare(`
      INSERT INTO team (id, dept_id, name, manager_role_id, headcount, change_readiness_score, trust_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      team_id,
      dept_id,
      input.team_name ?? 'Finance Core Team',
      null,
      input.headcount,
      0.5,
      0.5,
      now
    );

    for (const role of roles) {
      db.prepare(`
        INSERT INTO team_role (
          id, team_id, title, onet_soc_code, fte_count, annual_cost_per_fte,
          level, location, automation_potential, worker_desire_avg, aei_exposure_score,
          felten_aioe_score, human_edge_avg, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        team_id,
        role.title,
        role.onet_soc_code,
        role.fte_count,
        role.annual_cost_per_fte ?? null,
        role.level ?? null,
        role.location ?? null,
        null,
        null,
        null,
        null,
        null,
        now
      );
    }

    db.prepare(`
      INSERT INTO simulation (
        id, org_id, name, status, time_horizon_months, maturation_curve_id,
        monte_carlo_iterations, cost_params, degraded_sources, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      simulation_id,
      org_id,
      input.simulation_name,
      'created',
      input.time_horizon_months ?? 18,
      'curve-moderate',
      input.monte_carlo_iterations ?? 5000,
      JSON.stringify({ input_credibility }),
      JSON.stringify([]),
      now,
      now
    );
  });

  txn();

  const role_ids = db.prepare(
    `SELECT tr.id FROM team_role tr
     JOIN team t ON t.id = tr.team_id
     JOIN department d ON d.id = t.dept_id
     JOIN organization o ON o.id = d.org_id
     JOIN simulation s ON s.org_id = o.id
     WHERE s.id = ?
     ORDER BY tr.title ASC`
  ).all(simulation_id).map((r: any) => r.id);

  return {
    simulation_id,
    org_id,
    dept_id,
    team_id,
    roles_created: roles.length,
    input_headcount: input.headcount,
    roles_total_fte,
    original_roles_total_fte: round2(rebalanced.original_total_fte),
    roles_fte_rebalanced: rebalanced.rebalanced,
    input_credibility,
    role_ids,
    status: 'created',
  };
}
