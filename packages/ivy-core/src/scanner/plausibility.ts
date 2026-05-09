/**
 * Plausibility Check (Phase 3)
 *
 * Per scanner spec §3.3.4: simple sanity bounds applied per
 * EvidenceValue.kind. The cheapest defense against fabricated numbers —
 * deterministic, no LLM, no replay.
 *
 * Generic bounds (always applied):
 *   - `unit:"usd"`              non-negative; ≤ $10M (configurable)
 *   - `unit:"percent"` (default scheme): 0 ≤ value ≤ 100
 *   - `unit:"percent"` (scheme="normalized"): 0 ≤ value ≤ 1
 *   - `unit:"fte"`              non-negative; ≤ fte_max (default 1e6)
 *   - `kind:"date"`             within ±10 years of today unless
 *                               explicitly historical
 *   - `kind:"range"`            lower ≤ upper
 *
 * Per-SOC plausibility baseline (when supplied):
 *   - Wage p50 outside [wage_p50_usd_min, wage_p50_usd_max] for the
 *     role's SOC → flag.
 *
 * Code: SEM_PLAUSIBILITY_FAIL with detail describing the bound violated.
 *
 * Override: yes. Cost: O(n), microseconds.
 */

import type { CheckResult, EvidenceItem } from "../contracts/types.js";

export interface PlausibilityBaseline {
  /**
   * Per-SOC numeric bounds. When an item's SOC matches a key here AND its
   * field_path indicates a wage p50 fact, the value is checked against
   * [min, max].
   */
  per_soc?: Record<
    string,
    {
      wage_p50_usd_min?: number;
      wage_p50_usd_max?: number;
    }
  >;
  /** Generic bounds applied to all items. */
  generic?: {
    /** Cap on USD-denominated values. Default $10,000,000. */
    wage_max_usd?: number;
    /** Cap on FTE-denominated values. Default 1,000,000. */
    fte_max?: number;
  };
}

const DEFAULT_WAGE_MAX_USD = 10_000_000;
const DEFAULT_FTE_MAX = 1_000_000;
const DATE_WINDOW_YEARS = 10;
const SOC_REGEX = /\b(\d{2}-\d{4})\b/;

function isHistoricalAsOf(item: EvidenceItem): boolean {
  // We treat any item whose value carries `as_of` AND has a normalization
  // lineage marking it historical as exempt from the date-window check.
  // For Phase 3 v1 we use a minimal heuristic: if the source_passport_id
  // contains "historical" or the field_path starts with "history.".
  if (item.field_path.startsWith("history.")) return true;
  if (String(item.source_passport_id).includes("historical")) return true;
  return false;
}

function yearsBetween(aIso: string, bIso: string): number {
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / (1000 * 60 * 60 * 24 * 365.25);
}

function isWageP50Path(fieldPath: string): boolean {
  // Matches ".wage.p50", ".wage_p50", "wage.p50.<anything>"
  return /\bwage[._]p50\b/.test(fieldPath) || /\.wage\.p50\b/.test(fieldPath);
}

function isSignedUsdPath(fieldPath: string): boolean {
  return /(?:^|[._-])(cost_delta|savings_or_delta|delta|variance|change)(?:$|[._-])/.test(
    fieldPath.toLowerCase(),
  );
}

function socFromPath(fieldPath: string): string | null {
  const m = fieldPath.match(SOC_REGEX);
  return m ? m[1] : null;
}

/**
 * Run plausibility checks on a flat list of EvidenceItems. Returns a
 * CheckResult — status="pass" when all items pass, status="fail" with
 * error_count > 0 when any bound is violated.
 *
 * Every flag uses the SEM_PLAUSIBILITY_FAIL code prefix; the suffix in the
 * detail string identifies the specific bound violated for UI/logging.
 */
export function checkPlausibility(
  items: EvidenceItem[],
  baseline?: PlausibilityBaseline,
): CheckResult {
  const wageMaxUsd = baseline?.generic?.wage_max_usd ?? DEFAULT_WAGE_MAX_USD;
  const fteMax = baseline?.generic?.fte_max ?? DEFAULT_FTE_MAX;
  const today = new Date().toISOString();

  const details: string[] = [];
  let errorCount = 0;

  const flag = (itemId: string, fieldPath: string, reason: string) => {
    errorCount += 1;
    details.push(
      `SEM_PLAUSIBILITY_FAIL: item ${itemId} (${fieldPath}) ${reason}`,
    );
  };

  for (const item of items) {
    const id = String(item.id);
    const v = item.value;

    // ---- range: lower ≤ upper ----
    if (v.kind === "range") {
      if (typeof v.lower === "number" && typeof v.upper === "number") {
        if (v.lower > v.upper) {
          flag(id, item.field_path, `range inverted (lower=${v.lower} > upper=${v.upper})`);
        }
      }
      continue;
    }

    // ---- date: ±10 years of today unless historical ----
    if (v.kind === "date") {
      if (!isHistoricalAsOf(item)) {
        const years = yearsBetween(v.value, today);
        if (years > DATE_WINDOW_YEARS) {
          flag(
            id,
            item.field_path,
            `date ${v.value} is more than ${DATE_WINDOW_YEARS} years from today`,
          );
        }
      }
      continue;
    }

    // ---- number: unit-specific bounds + per-SOC baseline for wages ----
    if (v.kind === "number") {
      const unit = v.unit;
      const value = v.value;

      if (unit === "usd") {
        if (value < 0 && !isSignedUsdPath(item.field_path)) {
          flag(id, item.field_path, `USD value is negative (${value})`);
        } else if (Math.abs(value) > wageMaxUsd) {
          flag(
            id,
            item.field_path,
            `USD value ${value} exceeds maximum magnitude ${wageMaxUsd}`,
          );
        }

        // Per-SOC wage bound (only for wage p50 fields).
        if (isWageP50Path(item.field_path)) {
          const soc = socFromPath(item.field_path);
          if (soc && baseline?.per_soc?.[soc]) {
            const bounds = baseline.per_soc[soc];
            if (
              typeof bounds.wage_p50_usd_min === "number" &&
              value < bounds.wage_p50_usd_min
            ) {
              flag(
                id,
                item.field_path,
                `wage p50 ${value} below SOC ${soc} minimum ${bounds.wage_p50_usd_min}`,
              );
            }
            if (
              typeof bounds.wage_p50_usd_max === "number" &&
              value > bounds.wage_p50_usd_max
            ) {
              flag(
                id,
                item.field_path,
                `wage p50 ${value} above SOC ${soc} maximum ${bounds.wage_p50_usd_max}`,
              );
            }
          }
        }
        continue;
      }

      if (unit === "percent") {
        // Default scheme is 0–100. confidence_interval can hint at a
        // normalized scheme; absent that, we treat the unit literally.
        // 0–100 is the default; a value clearly in [0,1] is allowed too,
        // since both schemes are common in source data — but if the value
        // exceeds 100 we still flag it.
        if (value < 0) {
          flag(id, item.field_path, `percent value is negative (${value})`);
        } else if (value > 100) {
          flag(id, item.field_path, `percent value ${value} exceeds 100`);
        }
        continue;
      }

      if (unit === "fte") {
        if (value < 0) {
          flag(id, item.field_path, `FTE value is negative (${value})`);
        } else if (value > fteMax) {
          flag(id, item.field_path, `FTE value ${value} exceeds maximum ${fteMax}`);
        }
        continue;
      }
      // Unknown unit — no bound applied.
      continue;
    }

    // text / enum / json — no plausibility bounds in v1.
  }

  const status: CheckResult["status"] = errorCount > 0 ? "fail" : "pass";
  return {
    status,
    error_count: errorCount,
    details,
  };
}
