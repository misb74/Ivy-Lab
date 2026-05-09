/**
 * Cross-source Consistency Check (Phase 3)
 *
 * Per scanner spec §3.3.3: For every set of EvidenceItems whose `field_path`
 * matches a canonical "same-fact" pattern (e.g. same wage for same SOC,
 * reported by different sources), compare values:
 *
 *   - Within 10% relative      → consistent
 *   - 10–50% relative          → soft warning (status stays pass; recorded)
 *   - > 50% relative OR sign-flip → SEM_CONTRADICTION (status = fail)
 *
 * The check is deterministic and never calls an LLM.
 *
 * Same-fact matching algorithm (v1):
 *   - Strip the leading source token from `field_path` (everything before
 *     the SOC token).
 *   - Extract the SOC code (the first `\d{2}-\d{4}` segment).
 *   - Take the trailing slug (everything after the SOC).
 *   - Items sharing both the SOC code AND the trailing slug are candidates
 *     for the same fact.
 *
 * Default canonical patterns recognized:
 *   - wage.{level}.{geo}.{period}     (e.g. "...13-2051.wage.p50")
 *   - employment.{soc}.{period}        (e.g. "...13-2051.employment.2024")
 *   - automation_score.{role}          (e.g. "...13-2051.automation_score")
 *
 * Override: yes (the contradiction is overridable). Cost: O(n²) in items
 * within a same-fact bucket — items first bucketed by (SOC, slug) so the
 * cross-product is small in practice.
 */

import type { CheckResult, EvidenceItem } from "../contracts/types.js";

export interface ConsistencyOptions {
  /**
   * Optional list of canonical same-fact patterns to honor. v1 ignores
   * this list as informational metadata — the actual matching uses the
   * (SOC, trailing_slug) extractor — but we accept it on the surface so
   * callers can record which patterns they intended.
   */
  same_fact_patterns?: string[];
}

export interface Contradiction {
  /** EvidenceItem id of the first item in the disagreeing pair. */
  a: string;
  /** EvidenceItem id of the second item in the disagreeing pair. */
  b: string;
  /** Relative gap |a - b| / max(|a|, |b|). 0 to 1+ (1 = 100% gap). */
  relative_gap: number;
  /**
   * "soft" (10–50% gap, no fail), "hard" (>50% or sign-flip, fail).
   * Sign-flip is always "hard" regardless of magnitude.
   */
  note: "soft" | "hard";
}

export interface ConsistencyCheckResult extends CheckResult {
  contradictions: Contradiction[];
}

const SOC_REGEX = /\b(\d{2}-\d{4})\b/;
const HARD_GAP_THRESHOLD = 0.5;
const SOFT_GAP_THRESHOLD = 0.1;

interface FactKey {
  soc: string;
  slug: string;
}

/**
 * Extract the canonical (SOC, slug) key from a field_path. Returns null when
 * the field_path doesn't match a recognized pattern (no SOC code present).
 *
 * Examples:
 *   "bls.oes.13-2051.wage.p50"     → { soc: "13-2051", slug: "wage.p50" }
 *   "lightcast.13-2051.wage.p50"   → { soc: "13-2051", slug: "wage.p50" }
 *   "workbank.13-2051.automation_score" → { soc: "13-2051", slug: "automation_score" }
 */
function extractFactKey(fieldPath: string): FactKey | null {
  const match = fieldPath.match(SOC_REGEX);
  if (!match) return null;
  const soc = match[1];
  const idx = fieldPath.indexOf(soc);
  // Slug = everything after the SOC and the separator that follows it.
  const after = fieldPath.slice(idx + soc.length).replace(/^[._/]+/, "");
  return { soc, slug: after };
}

/** Numeric value extractor — returns null if the EvidenceItem isn't numeric. */
function numericValue(item: EvidenceItem): number | null {
  const v = item.value;
  if (v.kind === "number") return v.value;
  // Range items can collapse to a midpoint when both bounds are numeric.
  if (v.kind === "range" && typeof v.lower === "number" && typeof v.upper === "number") {
    return (v.lower + v.upper) / 2;
  }
  return null;
}

function relativeGap(a: number, b: number): number {
  const denom = Math.max(Math.abs(a), Math.abs(b));
  if (denom === 0) {
    // Both zero → fully consistent. One zero, other nonzero → gap = 1.
    return Math.abs(a) === Math.abs(b) ? 0 : 1;
  }
  return Math.abs(a - b) / denom;
}

/**
 * Check cross-source consistency on a flat list of EvidenceItems. Returns a
 * CheckResult plus the structured contradictions array. Soft warnings keep
 * status="pass"; any hard contradiction (>50% gap or sign-flip) flips
 * status="fail" and emits SEM_CONTRADICTION + SEM_CROSS_SOURCE_DISAGREE
 * codes in `details`.
 */
export function checkConsistency(
  items: EvidenceItem[],
  _options?: ConsistencyOptions,
): ConsistencyCheckResult {
  // Bucket items by (SOC, slug). Items missing a SOC are ignored — they
  // aren't candidates for the v1 same-fact patterns.
  const buckets = new Map<string, EvidenceItem[]>();
  for (const item of items) {
    const key = extractFactKey(item.field_path);
    if (!key) continue;
    const numeric = numericValue(item);
    if (numeric === null) continue;
    const bucketKey = `${key.soc}::${key.slug}`;
    const arr = buckets.get(bucketKey);
    if (arr) {
      arr.push(item);
    } else {
      buckets.set(bucketKey, [item]);
    }
  }

  const contradictions: Contradiction[] = [];
  const details: string[] = [];
  let errorCount = 0;

  for (const [bucketKey, bucket] of buckets) {
    if (bucket.length < 2) continue;

    // Pairwise compare every item in the bucket. Skip identical-id pairs
    // (defensive — same-id duplicates shouldn't appear, but we handle them).
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const a = bucket[i];
        const b = bucket[j];
        if (a.id === b.id) continue;

        const va = numericValue(a) as number;
        const vb = numericValue(b) as number;

        const gap = relativeGap(va, vb);
        const signFlip =
          (va > 0 && vb < 0) || (va < 0 && vb > 0);

        // Sign-flip is ALWAYS a hard contradiction regardless of magnitude.
        if (signFlip) {
          const c: Contradiction = {
            a: String(a.id),
            b: String(b.id),
            relative_gap: gap,
            note: "hard",
          };
          contradictions.push(c);
          errorCount += 1;
          const reason = `sign flip (a=${va}, b=${vb})`;
          details.push(
            `SEM_CONTRADICTION: cross-source disagreement on ${bucketKey}: items ${String(a.id)} vs ${String(b.id)} — ${reason}`,
          );
          details.push(
            `SEM_CROSS_SOURCE_DISAGREE: items ${String(a.id)} and ${String(b.id)} disagree on ${bucketKey} (${reason})`,
          );
          continue;
        }

        if (gap > HARD_GAP_THRESHOLD) {
          const c: Contradiction = {
            a: String(a.id),
            b: String(b.id),
            relative_gap: gap,
            note: "hard",
          };
          contradictions.push(c);
          errorCount += 1;
          const pctStr = (gap * 100).toFixed(1);
          details.push(
            `SEM_CONTRADICTION: cross-source disagreement on ${bucketKey}: items ${String(a.id)} (${va}) vs ${String(b.id)} (${vb}) — ${pctStr}% relative gap exceeds 50% threshold`,
          );
          details.push(
            `SEM_CROSS_SOURCE_DISAGREE: items ${String(a.id)} and ${String(b.id)} disagree on ${bucketKey} by ${pctStr}%`,
          );
          continue;
        }

        if (gap > SOFT_GAP_THRESHOLD) {
          const c: Contradiction = {
            a: String(a.id),
            b: String(b.id),
            relative_gap: gap,
            note: "soft",
          };
          contradictions.push(c);
          // Soft warnings don't increment error_count and don't fail status.
          // They are recorded for downstream review queues.
          const pctStr = (gap * 100).toFixed(1);
          details.push(
            `SEM_CROSS_SOURCE_SOFT: items ${String(a.id)} (${va}) vs ${String(b.id)} (${vb}) on ${bucketKey} — ${pctStr}% relative gap (within tolerance, recorded)`,
          );
          continue;
        }
        // gap ≤ 10% → consistent, no record.
      }
    }
  }

  const status: CheckResult["status"] = errorCount > 0 ? "fail" : "pass";
  return {
    status,
    error_count: errorCount,
    details,
    contradictions,
  };
}
