import Database from 'better-sqlite3';
import crypto from 'crypto';

export const RULES_VERSION = '1.0';

export interface ProcessLabels {
  automation_likelihood: 'high' | 'medium' | 'low';
  judgment_risk: 'high' | 'medium' | 'low';
  data_sensitivity: 'high' | 'medium' | 'low';
  human_in_loop_required: boolean;
  risk_tags: string[];
}

const HIGH_AUTOMATION_L2 = new Set([
  'HR Administration',
  'Systems, Insights and Service',
]);

const HIGH_AUTOMATION_L3_KEYWORDS = ['reporting', 'data', 'scheduling', 'filing', 'payments', 'filings'];

const LOW_AUTOMATION_L2 = new Set([
  'Employee and Labour Relations',
  'Inclusion & Diversity',
]);

const LOW_AUTOMATION_L3_KEYWORDS = ['grievance', 'investigation', 'counseling', 'counselling'];

const HIGH_JUDGMENT_L2 = new Set([
  'Employee and Labour Relations',
  'People Strategy',
]);

const HIGH_JUDGMENT_DESC_KEYWORDS = [
  'decision', 'assess', 'evaluat', 'review', 'investigat', 'determin',
  'advise', 'advisory', 'counsel', 'mediat', 'negotiat',
];

const LOW_JUDGMENT_L2 = new Set([
  'HR Administration',
  'Systems, Insights and Service',
]);

const LOW_JUDGMENT_DESC_KEYWORDS = [
  'file', 'record', 'update', 'log', 'entry', 'archive', 'store', 'storage',
];

const HIGH_SENSITIVITY_L2 = new Set([
  'Payroll',
  'Reward',
  'Employee and Labour Relations',
]);

const HIGH_SENSITIVITY_KEYWORDS = [
  'salary', 'compensation', 'medical', 'disability', 'personal',
  'confidential', 'grievance', 'disciplinary', 'wage', 'pay ',
  'pension', 'benefit', 'garnishment',
];

const PII_KEYWORDS = [
  'personal', 'employee data', 'record', 'confidential', 'medical',
  'candidate data', 'new hire', 'personnel',
];

const FINANCIAL_L2 = new Set(['Payroll', 'Reward']);
const FINANCIAL_KEYWORDS = [
  'salary', 'pay', 'compensation', 'benefit', 'pension',
  'wage', 'garnishment', 'deduction', 'remittance', 'gross', 'net',
];

const LEGAL_L2 = new Set(['Employee and Labour Relations']);
const LEGAL_KEYWORDS = [
  'legal', 'compliance', 'regulatory', 'disciplinary', 'grievance',
  'labour relation', 'labor relation', 'union', 'collective',
];

const ETHICAL_KEYWORDS = [
  'diversity', 'equity', 'inclusion', 'bias', 'fair',
  'discrimination', 'equitable',
];

function descContains(description: string, keywords: string[]): boolean {
  const lower = description.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

function l3Contains(l3: string, keywords: string[]): boolean {
  const lower = l3.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

export function deriveProcessLabels(
  l2Domain: string,
  l3Subdomain: string,
  description: string,
  descriptionValid: boolean,
): ProcessLabels {
  const desc = descriptionValid ? description : '';

  // automation_likelihood
  let automation_likelihood: ProcessLabels['automation_likelihood'] = 'medium';
  if (HIGH_AUTOMATION_L2.has(l2Domain) || l3Contains(l3Subdomain, HIGH_AUTOMATION_L3_KEYWORDS)) {
    automation_likelihood = 'high';
  } else if (LOW_AUTOMATION_L2.has(l2Domain) || l3Contains(l3Subdomain, LOW_AUTOMATION_L3_KEYWORDS)) {
    automation_likelihood = 'low';
  }
  // Broken descriptions default conservative
  if (!descriptionValid && automation_likelihood !== 'low') {
    automation_likelihood = 'low';
  }

  // judgment_risk
  let judgment_risk: ProcessLabels['judgment_risk'] = 'medium';
  if (HIGH_JUDGMENT_L2.has(l2Domain) || (desc && descContains(desc, HIGH_JUDGMENT_DESC_KEYWORDS))) {
    judgment_risk = 'high';
  } else if (LOW_JUDGMENT_L2.has(l2Domain) || (desc && descContains(desc, LOW_JUDGMENT_DESC_KEYWORDS))) {
    judgment_risk = 'low';
  }

  // data_sensitivity
  let data_sensitivity: ProcessLabels['data_sensitivity'] = 'medium';
  if (HIGH_SENSITIVITY_L2.has(l2Domain) || (desc && descContains(desc, HIGH_SENSITIVITY_KEYWORDS))) {
    data_sensitivity = 'high';
  } else if (
    l2Domain === 'Systems, Insights and Service' &&
    (!desc || !descContains(desc, HIGH_SENSITIVITY_KEYWORDS))
  ) {
    data_sensitivity = 'low';
  }

  // human_in_loop_required
  const human_in_loop_required =
    judgment_risk === 'high' ||
    data_sensitivity === 'high' ||
    LOW_AUTOMATION_L2.has(l2Domain);

  // risk_tags
  const risk_tags: string[] = [];

  if (desc && descContains(desc, PII_KEYWORDS)) {
    risk_tags.push('pii');
  } else if (HIGH_SENSITIVITY_L2.has(l2Domain)) {
    // Domain-level PII inference even without keyword match
    risk_tags.push('pii');
  }

  if (FINANCIAL_L2.has(l2Domain) || (desc && descContains(desc, FINANCIAL_KEYWORDS))) {
    risk_tags.push('financial');
  }

  if (LEGAL_L2.has(l2Domain) || (desc && descContains(desc, LEGAL_KEYWORDS))) {
    risk_tags.push('legal');
  }

  if (l2Domain === 'Inclusion & Diversity' || (desc && descContains(desc, ETHICAL_KEYWORDS))) {
    risk_tags.push('ethical');
  }

  return { automation_likelihood, judgment_risk, data_sensitivity, human_in_loop_required, risk_tags };
}

export function applyLabels(
  db: Database.Database,
  processId: string,
  l2Domain: string,
  l3Subdomain: string,
  description: string,
  descriptionValid: boolean,
): void {
  const labels = deriveProcessLabels(l2Domain, l3Subdomain, description, descriptionValid);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR REPLACE INTO hr_process_labels
      (process_id, automation_likelihood, judgment_risk, data_sensitivity,
       human_in_loop_required, risk_tags, derivation_rules_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    processId,
    labels.automation_likelihood,
    labels.judgment_risk,
    labels.data_sensitivity,
    labels.human_in_loop_required ? 1 : 0,
    JSON.stringify(labels.risk_tags),
    RULES_VERSION,
    now,
    now,
  );
}
