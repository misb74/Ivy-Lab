/**
 * Adversarial consistency checker — local (no API) internal claim verification.
 *
 * The caller (LLM orchestrator) extracts structured claim data from a report
 * and passes it in. This tool finds contradictions between claims by comparing
 * direction, magnitude, and logical coherence across matching subjects/populations.
 */
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
        directional_framing?: {
            report_says: string;
        };
        source_primacy?: boolean;
        attribution?: {
            person: string;
            title: string;
            organization: string;
        };
        scope_match?: {
            source_scope: string;
            report_usage: string;
        };
    };
}
/** Result of adversarial single-claim review */
export interface AdversarialReviewResult {
    claim: string;
    checks: {
        directional_framing?: {
            passed: boolean;
            note: string;
        };
        source_primacy?: {
            passed: boolean;
            note: string;
        };
        attribution?: {
            passed: boolean;
            note: string;
        };
        scope_match?: {
            passed: boolean;
            note: string;
        };
    };
    overall_risk: 'low' | 'medium' | 'high';
    citations: string[];
}
/**
 * Normalize a subject string: lowercase, strip stop words, sort tokens.
 * e.g. "AI governance resources" → ["ai", "governance", "resources"]
 */
export declare function normalizeSubject(subject: string): string[];
/**
 * True when two subjects share >50% of the shorter subject's tokens.
 */
export declare function subjectsOverlap(a: string, b: string): boolean;
/**
 * True when two population strings refer to the same group.
 */
export declare function populationsMatch(a: string, b: string): boolean;
/**
 * Compare every pair of claims and detect contradictions.
 *
 * Three contradiction types:
 * - directional: one claim says "has", the other "lacks" on the same subject/population
 * - magnitude: both claim the same metric but with values that differ by >15% relative
 * - logical: both say "has" but values are far apart in a logically suspicious way (>70% vs <20%)
 */
export declare function checkInternalConsistency(request: ConsistencyRequest): ConsistencyResult;
//# sourceMappingURL=adversarial-checks.d.ts.map