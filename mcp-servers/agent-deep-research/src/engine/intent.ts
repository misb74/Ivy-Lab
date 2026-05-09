import type { ProjectContext } from './types.js';

const HIRING_KEYWORDS = [
  'talent',
  'hiring',
  'recruiting',
  'job',
  'jobs',
  'careers',
  'career site',
  'role mix',
  'open roles',
  'open positions',
  'vacancies',
  'headcount',
  'skills being hired',
  'skills they are hiring',
  'what they are building',
  "what they're building",
  'talent they are building',
  'talent build',
  'building talent',
  'investing in talent',
];

const NON_COMPANY_WORDS = new Set([
  'What',
  'Who',
  'Which',
  'Where',
  'When',
  'Why',
  'How',
  'Show',
  'Compare',
  'Between',
  'Against',
  'And',
  'Or',
  'Versus',
  'AI',
  'ML',
  'HR',
  'The',
  'Best',
  'Strategy',
]);

export function enrichProjectContext(question: string, context: ProjectContext): ProjectContext {
  const companies = context.companies && context.companies.length > 0
    ? context.companies
    : inferCompaniesFromQuestion(question);
  const gate = resolveCompanyJobsIntent(question, { ...context, companies });

  return {
    ...context,
    companies,
    hiring_intent: gate.enabled,
    jobs_lane_reason: gate.reason,
    ats_query: context.ats_query || buildAtsQuery(question),
  };
}

export function resolveCompanyJobsIntent(
  question: string,
  context: ProjectContext,
): { enabled: boolean; reason: string } {
  if (context.skip_hiring_data) return { enabled: false, reason: 'explicit_skip_hiring_data' };
  if (context.include_hiring_data) return { enabled: true, reason: 'explicit_include_hiring_data' };

  const q = question.toLowerCase();
  if (HIRING_KEYWORDS.some((keyword) => q.includes(keyword))) {
    return { enabled: true, reason: 'hiring_keyword' };
  }

  const hasStrategyComparison = /\b(compare|versus|vs\.?|between)\b/i.test(question)
    && /\b(ai strategy|strategy|investment|building|build)\b/i.test(question)
    && (context.companies?.length || 0) >= 2;
  if (hasStrategyComparison) {
    return { enabled: true, reason: 'planner_override_strategy_comparison' };
  }

  return { enabled: false, reason: 'no_hiring_intent_detected' };
}

export function inferCompaniesFromQuestion(question: string): string[] {
  const between = question.match(/\bbetween\s+(.+?)\s+(?:and|vs\.?|versus)\s+(.+?)(?:[,.?]|$|\s+also\b|\s+with\b)/i);
  if (between) {
    return uniqueCompanies([cleanCompanyName(between[1]), cleanCompanyName(between[2])]);
  }

  const vs = question.match(/\b(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:[,.?]|$)/i);
  if (vs) {
    return uniqueCompanies([cleanCompanyName(vs[1]), cleanCompanyName(vs[2])]);
  }

  const capitalized = Array.from(question.matchAll(/\b[A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,3}\b/g))
    .map((m) => cleanCompanyName(m[0]))
    .filter((name) => name && !NON_COMPANY_WORDS.has(name));
  return uniqueCompanies(capitalized).slice(0, 6);
}

function cleanCompanyName(value: string): string {
  return value
    .replace(/\b(who|what|which|show|compare|is|are|building|best|better|strongest|ai|strategy|between|also|talent|they|their|and|vs|versus)\b/gi, ' ')
    .replace(/[^A-Za-z0-9&.' -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueCompanies(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const cleaned = cleanCompanyName(value);
    if (!cleaned || cleaned.length < 2) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function buildAtsQuery(question: string): string {
  if (/\b(ai|artificial intelligence|machine learning|ml|genai|generative)\b/i.test(question)) {
    return 'AI machine learning data science generative AI';
  }
  return question;
}
