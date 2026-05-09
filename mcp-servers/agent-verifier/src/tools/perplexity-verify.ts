/**
 * Perplexity Sonar API — fact verification tools.
 *
 * Uses Perplexity's real-time search index to:
 * 1. Verify specific claims against current web data
 * 2. Find the latest version of a statistic from a named source
 * 3. Run adversarial checks (framing, source primacy, attribution, scope)
 *
 * Designed for the pre-output audit step in the deep research pipeline.
 * Cost: ~$0.006 per basic Sonar query — a 30-claim report costs ~$0.18.
 */

import type { AdversarialReviewParams, AdversarialReviewResult } from './adversarial-checks.js';
export { type AdversarialReviewParams, type AdversarialReviewResult };

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

function getApiKey(): string {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error('PERPLEXITY_API_KEY not set in environment');
  return key;
}

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityCitation {
  url: string;
  title?: string;
}

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  citations?: PerplexityCitation[] | string[];
}

async function querySonar(
  systemPrompt: string,
  userPrompt: string,
  options?: { searchRecency?: 'month' | 'week' | 'day' | 'year' }
): Promise<{ answer: string; citations: string[] }> {
  const apiKey = getApiKey();

  const messages: PerplexityMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const body: Record<string, unknown> = {
    model: 'sonar',
    messages,
    temperature: 0.1,
    max_tokens: 1024,
    search_recency_filter: options?.searchRecency || 'month',
    return_citations: true,
  };

  const res = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Perplexity API error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as PerplexityResponse;
  const answer = data.choices?.[0]?.message?.content || '';
  const citations = (data.citations || []).map((c: PerplexityCitation | string) =>
    typeof c === 'string' ? c : c.url
  );

  return { answer, citations };
}

// ─── Tool 1: verify_claim ──────────────────────────────────────────────────

export interface VerifyClaimParams {
  claim: string;
  source: string;
  source_date: string;
  claim_type?: 'empirical' | 'prescriptive' | 'expectation' | 'projection';
  context?: string;
}

export interface VerifyClaimResult {
  claim: string;
  verdict: 'confirmed' | 'outdated' | 'disputed' | 'unverifiable' | 'nuance_needed';
  current_figure?: string;
  explanation: string;
  classification: string;
  citations: string[];
}

export async function verifyClaim(params: VerifyClaimParams): Promise<VerifyClaimResult> {
  const systemPrompt = `You are a fact-verification specialist. Your job is to verify a specific claim against current web data.

For each claim, determine:
1. VERDICT: Is the claim confirmed, outdated (newer data exists), disputed (conflicting sources), unverifiable (can't find evidence), or nuance_needed (technically correct but misleading without context)?
2. CURRENT FIGURE: If the claim contains a statistic, what is the most current version of that statistic?
3. CLASSIFICATION: Is this claim empirical (observed outcome), prescriptive (recommendation), expectation (what respondents intend), or projection (forecast)?
4. EXPLANATION: Brief explanation of your verdict, including any important context.

Be precise. Cite specific sources and dates. If you can't verify, say so — don't guess.

Respond in this exact JSON format:
{
  "verdict": "confirmed|outdated|disputed|unverifiable|nuance_needed",
  "current_figure": "the most current version of the statistic, or null",
  "classification": "empirical|prescriptive|expectation|projection",
  "explanation": "brief explanation with source names and dates"
}`;

  const userPrompt = `Verify this claim:
CLAIM: "${params.claim}"
ATTRIBUTED SOURCE: ${params.source}
SOURCE DATE: ${params.source_date}
${params.claim_type ? `STATED TYPE: ${params.claim_type}` : ''}
${params.context ? `CONTEXT: ${params.context}` : ''}

Find the most current data and check whether this claim is still accurate.`;

  const { answer, citations } = await querySonar(systemPrompt, userPrompt);

  // Parse JSON from response
  let parsed: Record<string, string>;
  try {
    const jsonMatch = answer.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {
      verdict: 'unverifiable',
      explanation: answer,
      classification: params.claim_type || 'unknown',
    };
  }

  return {
    claim: params.claim,
    verdict: (parsed.verdict as VerifyClaimResult['verdict']) || 'unverifiable',
    current_figure: parsed.current_figure || undefined,
    explanation: parsed.explanation || answer,
    classification: parsed.classification || params.claim_type || 'unknown',
    citations,
  };
}

// ─── Tool 2: find_latest ───────────────────────────────────────────────────

export interface FindLatestParams {
  statistic: string;
  source_org: string;
  known_value?: string;
  known_date?: string;
}

export interface FindLatestResult {
  statistic: string;
  source_org: string;
  latest_value: string;
  latest_date: string;
  latest_source: string;
  supersedes_known: boolean;
  explanation: string;
  citations: string[];
}

// ─── Tool 3: adversarial_review ───────────────────────────────────────────────

export async function adversarialReview(params: AdversarialReviewParams): Promise<AdversarialReviewResult> {
  const { claim, source, source_date, checks } = params;

  // Build targeted prompt sections based on which checks are requested
  const checkInstructions: string[] = [];
  if (checks.directional_framing) {
    checkInstructions.push(
      `- directional_framing: The report says "${checks.directional_framing.report_says}". Check whether the source actually says this, or says the inverse/opposite. Pass = framing matches source. Fail = inverted or misframed.`
    );
  }
  if (checks.source_primacy) {
    checkInstructions.push(
      `- source_primacy: Classify "${source}" as one of: primary_dataset, peer_reviewed, industry_survey, derivative_commentary, aggregated_estimate, or unverifiable. Pass = primary_dataset, peer_reviewed, or industry_survey. Fail = derivative_commentary, aggregated_estimate, or unverifiable.`
    );
  }
  if (checks.attribution) {
    const { person, title, organization } = checks.attribution;
    checkInstructions.push(
      `- attribution: Does ${person} currently hold the title "${title}" at ${organization}? Pass = still in role. Fail = departed or title changed. Include departure date if known.`
    );
  }
  if (checks.scope_match) {
    checkInstructions.push(
      `- scope_match: The source's stated scope is: "${checks.scope_match.source_scope}". The report uses this figure as: "${checks.scope_match.report_usage}". Does the source scope match how the report uses it? Pass = matches. Fail = broader_than_source, narrower_than_source, or different_scope.`
    );
  }

  const systemPrompt = `You are an adversarial fact-checker specialising in source integrity and framing accuracy.

For the claim and source provided, run ONLY the checks listed below. For each check return a "passed" boolean and a "note" string explaining your finding in one or two sentences.

Checks to run:
${checkInstructions.join('\n')}

Respond in this exact JSON format — include only the keys for the checks you were asked to run:
{
  ${checks.directional_framing ? '"directional_framing": { "passed": true|false, "note": "..." },' : ''}
  ${checks.source_primacy ? '"source_primacy": { "passed": true|false, "note": "..." },' : ''}
  ${checks.attribution ? '"attribution": { "passed": true|false, "note": "..." },' : ''}
  ${checks.scope_match ? '"scope_match": { "passed": true|false, "note": "..." }' : ''}
}

Be precise and evidence-based. If you cannot determine an answer, set passed to false and explain why in the note.`;

  const userPrompt = `Run adversarial checks on this claim:
CLAIM: "${claim}"
SOURCE: ${source}
SOURCE DATE: ${source_date}`;

  const { answer, citations } = await querySonar(systemPrompt, userPrompt, {
    searchRecency: 'year',
  });

  // Parse JSON response
  let parsed: Record<string, { passed: boolean; note: string }>;
  try {
    const jsonMatch = answer.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {};
  }

  // Build typed check results
  const checkResults: AdversarialReviewResult['checks'] = {};
  if (checks.directional_framing && parsed.directional_framing) {
    checkResults.directional_framing = {
      passed: Boolean(parsed.directional_framing.passed),
      note: String(parsed.directional_framing.note || ''),
    };
  }
  if (checks.source_primacy && parsed.source_primacy) {
    checkResults.source_primacy = {
      passed: Boolean(parsed.source_primacy.passed),
      note: String(parsed.source_primacy.note || ''),
    };
  }
  if (checks.attribution && parsed.attribution) {
    checkResults.attribution = {
      passed: Boolean(parsed.attribution.passed),
      note: String(parsed.attribution.note || ''),
    };
  }
  if (checks.scope_match && parsed.scope_match) {
    checkResults.scope_match = {
      passed: Boolean(parsed.scope_match.passed),
      note: String(parsed.scope_match.note || ''),
    };
  }

  // Determine overall_risk
  // High: inverted framing (directional_framing failed) — note is the distinguishing signal
  const framingFailed = checkResults.directional_framing?.passed === false;
  const framingNoteInverted = checkResults.directional_framing?.note?.toLowerCase().includes('invert') ||
    checkResults.directional_framing?.note?.toLowerCase().includes('opposite');

  // Check for high-risk signals: inverted framing or attribution hard failure with "false" (not deprecated)
  const isHighRisk =
    (framingFailed && framingNoteInverted) ||
    (checkResults.scope_match?.passed === false &&
      checkResults.scope_match?.note?.toLowerCase().includes('different_scope'));

  // Medium risk: any failed check not already classified as high
  const anyFailed = Object.values(checkResults).some(c => c && !c.passed);

  let overall_risk: AdversarialReviewResult['overall_risk'];
  if (isHighRisk) {
    overall_risk = 'high';
  } else if (anyFailed) {
    overall_risk = 'medium';
  } else {
    overall_risk = 'low';
  }

  return {
    claim,
    checks: checkResults,
    overall_risk,
    citations,
  };
}

export async function findLatest(params: FindLatestParams): Promise<FindLatestResult> {
  const systemPrompt = `You are a data freshness specialist. Your job is to find the most recent version of a specific statistic from a named organisation.

Search for the latest publication, survey, or report from the named organisation that contains this statistic or its updated equivalent. Check whether the known value has been superseded.

Respond in this exact JSON format:
{
  "latest_value": "the most current version of the statistic",
  "latest_date": "publication or survey date of the latest version",
  "latest_source": "name of the specific report or publication",
  "supersedes_known": true/false,
  "explanation": "what changed and why"
}`;

  const userPrompt = `Find the most recent version of this statistic:
STATISTIC: "${params.statistic}"
SOURCE ORGANISATION: ${params.source_org}
${params.known_value ? `KNOWN VALUE: ${params.known_value}` : ''}
${params.known_date ? `KNOWN DATE: ${params.known_date}` : ''}

Search for the latest report or survey from ${params.source_org} that updates this figure.`;

  const { answer, citations } = await querySonar(systemPrompt, userPrompt, {
    searchRecency: 'month',
  });

  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = answer.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {
      latest_value: 'unable to determine',
      latest_date: 'unknown',
      latest_source: 'search inconclusive',
      supersedes_known: false,
      explanation: answer,
    };
  }

  return {
    statistic: params.statistic,
    source_org: params.source_org,
    latest_value: String(parsed.latest_value || 'unable to determine'),
    latest_date: String(parsed.latest_date || 'unknown'),
    latest_source: String(parsed.latest_source || 'search inconclusive'),
    supersedes_known: Boolean(parsed.supersedes_known),
    explanation: String(parsed.explanation || answer),
    citations,
  };
}
