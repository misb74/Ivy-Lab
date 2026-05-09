import Database from 'better-sqlite3';
import crypto from 'crypto';

export interface SuggestedTool {
  tool_name: string;
  server_name: string;
  description: string;
  required: boolean;
  reason: string;
}

interface ToolMappingSeed {
  l2_domain: string | null;
  l3_subdomain: string | null;
  tool_name: string;
  server_name: string;
  description: string;
  priority: number;
}

const SEED_TOOL_MAPPINGS: ToolMappingSeed[] = [
  // Talent Acquisition
  { l2_domain: 'Talent Acquisition', l3_subdomain: null, tool_name: 'get_role_details', server_name: 'hr-roles', description: 'Role requirements and details', priority: 8 },
  { l2_domain: 'Talent Acquisition', l3_subdomain: null, tool_name: 'get_skills_for_occupation', server_name: 'hr-skills', description: 'Skills taxonomy for occupations', priority: 7 },
  { l2_domain: 'Talent Acquisition', l3_subdomain: null, tool_name: 'get_occupation_outlook', server_name: 'data-bls', description: 'Labor market outlook', priority: 5 },
  // Payroll
  { l2_domain: 'Payroll', l3_subdomain: null, tool_name: 'get_occupation_wages', server_name: 'data-bls', description: 'Wage and compensation data', priority: 9 },
  // Reward
  { l2_domain: 'Reward', l3_subdomain: null, tool_name: 'get_occupation_wages', server_name: 'data-bls', description: 'Compensation benchmarking', priority: 8 },
  // Employee & Labour Relations
  { l2_domain: 'Employee and Labour Relations', l3_subdomain: null, tool_name: 'check_compliance', server_name: 'hr-compliance', description: 'Compliance and regulatory checks', priority: 9 },
  // People Strategy
  { l2_domain: 'People Strategy', l3_subdomain: null, tool_name: 'assess_automation_potential', server_name: 'hr-automation', description: 'Task automation assessment', priority: 7 },
  { l2_domain: 'People Strategy', l3_subdomain: null, tool_name: 'get_occupation_outlook', server_name: 'data-bls', description: 'Workforce planning outlook', priority: 6 },
  // Systems, Insights and Service
  { l2_domain: 'Systems, Insights and Service', l3_subdomain: null, tool_name: 'multi_search', server_name: 'agent-multi-search', description: 'Federated data search', priority: 8 },
  // Talent Management
  { l2_domain: 'Talent Management', l3_subdomain: null, tool_name: 'get_skills_for_occupation', server_name: 'hr-skills', description: 'Skills and competency mapping', priority: 8 },
  // Learning & Leadership Development
  { l2_domain: 'Learning & Leadership Development', l3_subdomain: null, tool_name: 'get_skills_for_occupation', server_name: 'hr-skills', description: 'Training needs analysis', priority: 8 },
  // Onboarding
  { l2_domain: 'Onboarding', l3_subdomain: null, tool_name: 'send_email', server_name: 'agent-email', description: 'Onboarding communications', priority: 6 },
  { l2_domain: 'Onboarding', l3_subdomain: null, tool_name: 'get_role_details', server_name: 'hr-roles', description: 'Role information for new hires', priority: 7 },
  // HR Administration
  { l2_domain: 'HR Administration', l3_subdomain: null, tool_name: 'multi_search', server_name: 'agent-multi-search', description: 'Employee data queries', priority: 6 },
  // Cross-cutting fallbacks (null L2 = applies to all)
  { l2_domain: null, l3_subdomain: null, tool_name: 'multi_search', server_name: 'agent-multi-search', description: 'General data search', priority: 3 },
  { l2_domain: null, l3_subdomain: null, tool_name: 'deep_research_create', server_name: 'agent-deep-research', description: 'Deep research', priority: 2 },
  { l2_domain: null, l3_subdomain: null, tool_name: 'render_mermaid', server_name: 'doc-generator', description: 'Document generation', priority: 2 },
];

function genId(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export function seedToolMappings(db: Database.Database): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO hr_tool_mapping
      (id, l2_domain, l3_subdomain, tool_name, server_name, description, priority, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  for (const m of SEED_TOOL_MAPPINGS) {
    const key = `${m.l2_domain || '_'}|${m.l3_subdomain || '_'}|${m.tool_name}`;
    insert.run(genId(key), m.l2_domain, m.l3_subdomain, m.tool_name, m.server_name, m.description, m.priority, now);
  }
}

export function lookupToolsForDomains(
  db: Database.Database,
  domains: Set<string>,
  subdomains: Map<string, Set<string>>,
): SuggestedTool[] {
  const domainList = [...domains];
  const subdomainList: string[] = [];
  for (const subs of subdomains.values()) {
    for (const s of subs) subdomainList.push(s);
  }

  // Build query: match domain-specific OR cross-cutting (null) mappings
  const placeholders = domainList.map(() => '?').join(',');
  const subPlaceholders = subdomainList.map(() => '?').join(',');

  let sql = `
    SELECT DISTINCT tool_name, server_name, description, MAX(priority) as priority,
      l2_domain
    FROM hr_tool_mapping
    WHERE (l2_domain IN (${placeholders || "'__none__'"}) OR l2_domain IS NULL)
  `;
  const params: (string | null)[] = [...domainList];

  if (subdomainList.length > 0) {
    sql += ` AND (l3_subdomain IN (${subPlaceholders}) OR l3_subdomain IS NULL)`;
    params.push(...subdomainList);
  } else {
    sql += ` AND (l3_subdomain IS NULL)`;
  }

  sql += ` GROUP BY tool_name, server_name ORDER BY priority DESC`;

  const rows = db.prepare(sql).all(...params) as Array<{
    tool_name: string;
    server_name: string;
    description: string;
    priority: number;
    l2_domain: string | null;
  }>;

  return rows.map(r => ({
    tool_name: r.tool_name,
    server_name: r.server_name,
    description: r.description,
    required: r.priority >= 7,
    reason: r.l2_domain
      ? `Mapped from HR domain: ${r.l2_domain}`
      : 'Cross-cutting tool (general purpose)',
  }));
}

export function getToolMappingsForDomain(
  db: Database.Database,
  l2Domain: string,
): Array<{ tool_name: string; server_name: string; priority: number }> {
  return db.prepare(`
    SELECT tool_name, server_name, priority
    FROM hr_tool_mapping
    WHERE l2_domain = ? OR l2_domain IS NULL
    ORDER BY priority DESC
  `).all(l2Domain) as Array<{ tool_name: string; server_name: string; priority: number }>;
}
