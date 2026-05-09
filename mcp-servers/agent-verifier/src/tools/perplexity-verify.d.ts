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
export declare function verifyClaim(params: VerifyClaimParams): Promise<VerifyClaimResult>;
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
export declare function adversarialReview(params: AdversarialReviewParams): Promise<AdversarialReviewResult>;
export declare function findLatest(params: FindLatestParams): Promise<FindLatestResult>;
//# sourceMappingURL=perplexity-verify.d.ts.map