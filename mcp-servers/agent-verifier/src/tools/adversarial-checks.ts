/**
 * Adversarial consistency checker — local (no API) internal claim verification.
 *
 * The caller (LLM orchestrator) extracts structured claim data from a report
 * and passes it in. This tool finds contradictions between claims by comparing
 * direction, magnitude, and logical coherence across matching subjects/populations.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConsistencyClaimInput {
  /** Unique identifier for this claim */
  id: string;
  /** The full text of the claim */
  text: string;
  /** Numeric value associated with the claim (e.g., 85 for "85%") */
  metric_value?: number;
  /** The subject/metric being described (e.g., "AI governance", "AI training") */
  metric_subject: string;
  /** Whether this claim asserts presence ('has'), absence ('lacks'), or is neutral */
  direction: 'has' | 'lacks' | 'neutral';
  /** The population the claim applies to (e.g., "legal departments") */
  population: string;
  /** Citation or source of the claim */
  source: string;
}

export interface ConsistencyRequest {
  claims: ConsistencyClaimInput[];
}

export interface Contradiction {
  claim_a_id: string;
  claim_b_id: string;
  /** Type of contradiction detected */
  type: 'directional' | 'magnitude' | 'logical';
  /** Human-readable explanation of the contradiction */
  explanation: string;
  severity: 'critical' | 'warning';
}

export interface ConsistencyResult {
  /** Score from 0 (many contradictions) to 1 (fully consistent) */
  score: number;
  contradictions: Contradiction[];
  recommendation: string;
}

/** Parameters for adversarial single-claim review (used by Task 2 / perplexity-verify) */
export interface AdversarialReviewParams {
  claim: string;
  source: string;
  source_date: string;
  checks: {
    directional_framing?: { report_says: string };
    source_primacy?: boolean;
    attribution?: { person: string; title: string; organization: string };
    scope_match?: { source_scope: string; report_usage: string };
  };
}

/** Result of adversarial single-claim review */
export interface AdversarialReviewResult {
  claim: string;
  checks: {
    directional_framing?: { passed: boolean; note: string };
    source_primacy?: { passed: boolean; note: string };
    attribution?: { passed: boolean; note: string };
    scope_match?: { passed: boolean; note: string };
  };
  overall_risk: 'low' | 'medium' | 'high';
  citations: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or',
  'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
  'by', 'with', 'from', 'that', 'this', 'which', 'it',
]);

/**
 * Normalize a subject string: lowercase, strip stop words, sort tokens.
 * e.g. "AI governance resources" → ["ai", "governance", "resources"]
 */
export function normalizeSubject(subject: string): string[] {
  return subject
    .toLowerCase()
    .split(/\s+/)
    .map(t => t.replace(/[^a-z0-9]/g, ''))
    .filter(t => t.length > 0 && !STOP_WORDS.has(t))
    .sort();
}

/**
 * True when two subjects share >50% of the shorter subject's tokens.
 */
export function subjectsOverlap(a: string, b: string): boolean {
  const tokA = new Set(normalizeSubject(a));
  const tokB = new Set(normalizeSubject(b));
  if (tokA.size === 0 || tokB.size === 0) return false;
  const shorter = tokA.size <= tokB.size ? tokA : tokB;
  const longer = tokA.size <= tokB.size ? tokB : tokA;
  const intersection = [...shorter].filter(t => longer.has(t));
  return intersection.length / shorter.size > 0.5;
}

/** Known population equivalence groups */
const POPULATION_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  ['legal departments', 'legal teams', 'legal ops', 'legal operations'],
  ['lawyers', 'attorneys', 'legal professionals', 'solicitors', 'barristers'],
  ['firms', 'law firms', 'organisations', 'organizations', 'companies'],
  ['general counsel', 'gcs', 'clos', 'chief legal officers'],
];

function canonicalizePopulation(pop: string): string {
  const lower = pop.toLowerCase().trim();
  for (const group of POPULATION_GROUPS) {
    if (group.some(alias => lower === alias || lower.includes(alias) || alias.includes(lower))) {
      return group[0];
    }
  }
  return lower;
}

/**
 * True when two population strings refer to the same group.
 */
export function populationsMatch(a: string, b: string): boolean {
  return canonicalizePopulation(a) === canonicalizePopulation(b);
}

// ─── Core checker ─────────────────────────────────────────────────────────────

/**
 * Compare every pair of claims and detect contradictions.
 *
 * Three contradiction types:
 * - directional: one claim says "has", the other "lacks" on the same subject/population
 * - magnitude: both claim the same metric but with values that differ by >15% relative
 * - logical: both say "has" but values are far apart in a logically suspicious way (>70% vs <20%)
 */
export function checkInternalConsistency(request: ConsistencyRequest): ConsistencyResult {
  const { claims } = request;
  const contradictions: Contradiction[] = [];

  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i];
      const b = claims[j];

      const sameSubject = subjectsOverlap(a.metric_subject, b.metric_subject);
      const samePop = populationsMatch(a.population, b.population);

      if (!sameSubject || !samePop) continue;

      // ── Directional check ────────────────────────────────────────────────
      if (a.direction !== b.direction &&
          a.direction !== 'neutral' && b.direction !== 'neutral') {
        // Both have numeric values — check if they're complements (sum ≈ 100)
        if (a.metric_value !== undefined && b.metric_value !== undefined) {
          const sum = a.metric_value + b.metric_value;
          if (Math.abs(sum - 100) <= 10) {
            // Complements (e.g., 85% has, 15% lacks) — not a contradiction
            continue;
          }
        }
        // One or both lack metric_value, or values are not complementary
        contradictions.push({
          claim_a_id: a.id,
          claim_b_id: b.id,
          type: 'directional',
          explanation:
            `"${a.id}" asserts '${a.direction}' while "${b.id}" asserts '${b.direction}' ` +
            `on the same subject ('${a.metric_subject}') and population ('${a.population}'). ` +
            `These claims are directionally opposed without a complementary relationship.`,
          severity: 'critical',
        });
        continue; // Don't stack checks on the same pair
      }

      // ── Logical check (evaluated before magnitude — more specific) ──────
      if (a.direction === 'has' && b.direction === 'has' &&
          a.metric_value !== undefined && b.metric_value !== undefined) {
        const high = Math.max(a.metric_value, b.metric_value);
        const low = Math.min(a.metric_value, b.metric_value);
        const gap = high - low;

        // Majority vs minority threshold — catches 'most have' vs 'few have' contradictions
        if (high > 70 && low < 20 && gap > 60) {
          const highId = a.metric_value > b.metric_value ? a.id : b.id;
          const lowId = a.metric_value > b.metric_value ? b.id : a.id;
          contradictions.push({
            claim_a_id: highId,
            claim_b_id: lowId,
            type: 'logical',
            explanation:
              `"${highId}" reports ${high}% while "${lowId}" reports ${low}% on the same ` +
              `subject ('${a.metric_subject}', '${a.population}'). ` +
              `A ${gap}-point gap between claims about the same population is logically suspect ` +
              `and may indicate different definitions or scope.`,
            severity: 'warning',
          });
          continue; // Don't also flag as magnitude
        }
      }

      // ── Magnitude check ──────────────────────────────────────────────────
      if (a.direction === b.direction &&
          a.metric_value !== undefined && b.metric_value !== undefined) {
        const avg = (a.metric_value + b.metric_value) / 2;
        const diff = Math.abs(a.metric_value - b.metric_value);
        const relativeDiff = avg > 0 ? diff / avg : 0;

        // Skip trivial absolute differences to avoid false positives at low values
        if (diff < 5) continue;

        if (relativeDiff > 0.15) {
          const severity: Contradiction['severity'] = diff > 20 ? 'critical' : 'warning';
          contradictions.push({
            claim_a_id: a.id,
            claim_b_id: b.id,
            type: 'magnitude',
            explanation:
              `"${a.id}" reports ${a.metric_value}% while "${b.id}" reports ${b.metric_value}% ` +
              `for the same metric ('${a.metric_subject}', '${a.population}'). ` +
              `Relative difference is ${(relativeDiff * 100).toFixed(1)}% (threshold: 15%).`,
            severity,
          });
          continue;
        }
      }
    }
  }

  // ── Score ────────────────────────────────────────────────────────────────
  const criticalCount = contradictions.filter(c => c.severity === 'critical').length;
  const warningCount = contradictions.filter(c => c.severity === 'warning').length;
  const penalty = criticalCount * 0.3 + warningCount * 0.1;
  const score = Math.max(0, Math.min(1, 1 - penalty));

  // ── Recommendation ───────────────────────────────────────────────────────
  let recommendation: string;
  if (contradictions.length === 0) {
    recommendation = 'No internal contradictions detected. Claims appear mutually consistent.';
  } else {
    const parts: string[] = [];
    if (criticalCount > 0) {
      parts.push(`${criticalCount} critical contradiction(s) require resolution before publication.`);
    }
    if (warningCount > 0) {
      parts.push(`${warningCount} warning(s) indicate potential inconsistencies that should be reviewed.`);
    }
    recommendation = parts.join(' ') +
      ' Consider harmonising conflicting data sources or clarifying scope differences.';
  }

  return { score, contradictions, recommendation };
}
