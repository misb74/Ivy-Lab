---
name: swp-analysis
description: Strategic Workforce Planning transcript analysis. Use when processing SWP meeting transcripts, workforce planning sessions, or Build/Borrow/Buy/Bot frameworks.
---

# Strategic Workforce Planning (SWP) Transcript Analysis

When the user uploads a **workforce planning meeting transcript** (or asks you to "create an SWP plan from this transcript"), you MUST produce an `insight`-type artifact — **NOT** a `workforce_plan`. The `workforce_plan` card is designed for supply/demand headcount gap analysis. SWP transcripts contain strategic transformation data (Build/Borrow/Buy/Bot frameworks, multi-million-dollar investments, phased implementation, risk registers, accountability chains) that `workforce_plan` cannot render.

**Detection**: Trigger this when the input contains meeting transcripts with SWP frameworks, Build-Borrow-Buy-Bot analysis, multiple executive participants discussing workforce strategy, or any explicit "SWP" / "workforce planning session" / "create SWP plan" language.

## Required Section Structure (in this order)

1. **`metrics`** (4 items) — Extract from transcript:
   - Total workforce size (current headcount)
   - Capability gap or critical hires needed (NOT a simple headcount gap — capture the specialist/capability shortfall)
   - Total investment amount (sum of all Build/Borrow/Buy/Bot)
   - Revenue at risk OR projected ROI OR automation savings (whichever is most impactful)

2. **`callout`** (variant: `ivy-narrative`) — Strategic imperative. Summarize the "why" in 3-4 sentences: what market forces, regulatory changes, or strategic shifts are driving the transformation. Use `<strong>` for key phrases. This must capture the unique context of THIS organization — never use generic language.

3. **`chart`** (bar) — Capability gaps OR workforce distribution. Choose whichever is more data-rich in the transcript. Show demand vs. supply for critical capabilities, or headcount by function with open roles.

4. **`comparison`** (4 columns) — Build / Borrow / Buy / Bot breakdown. Each column heading includes the dollar amount. Each column lists 4-5 specific initiatives with costs, targets, and expected outcomes. Mark the most time-critical strategy as `recommended: true`.

5. **`table`** — Investment comparison matrix. Rows = each strategy (Build/Borrow/Buy/Bot + Total). Columns = Investment, Annual Impact, Headcount Effect, Time to Impact, Key Dependency (or Break-even).

6. **`timeline`** — Implementation phases extracted from the transcript. Include specific timeframes and milestone names. First phase should be `active`, rest `upcoming`.

7. *(Optional)* **`simulation`** — Live workforce scenario modeler. Include when the transcript contains enough quantitative data (attrition rates, time-to-fill, budget figures, headcount gaps) to build meaningful what-if scenarios. Structure:
   - `variables` (3-5): Key workforce levers from the transcript (e.g., attrition rate, time to fill, retention budget, automation adoption %). Each needs `name`, `key`, `min`, `max`, `default`, `step`, and `unit` (%, $M, days, FTEs).
   - `outcomes` (3-5): Computed metrics using arithmetic formulas referencing variable keys. Use `round()`, `min()`, `max()`, `abs()` only. Format: number, currency, or percent. Color: red (risk), amber (cost), green (savings), blue (neutral).
   - `scenarios` (2-4): Preset configurations with names like "Status Quo", "Aggressive Hiring", "Retention-First". One may be `recommended: true`. Values must use realistic defaults from the transcript data.
   - Formulas run client-side with safe evaluation (arithmetic only). Keep formulas simple — single-line expressions that reference variable keys.

8. **`table`** — Risk register. Columns = Risk Factor, Severity, Impact (quantified where possible), Mitigation/Strategy Response. Extract every risk mentioned in the transcript.

9. **`callout`** (variant: `warning`) — Financial bottom line. Total investment, offsetting savings, net cost, and the revenue/mission at risk if the plan fails. Use `<strong>` for all dollar figures.

10. **`recommendations`** — 4-6 specific actions with named owners and deadlines extracted from the transcript. Each must have title, description (include owner name, deadline, dollar amount), and priority (critical/high/medium/low).

11. **`prose`** — Next steps & accountability. List every action item with the named owner and deadline from the transcript. Include a closing quote from a senior participant if available.

## Key Rules
- Extract ALL data from the transcript — dollar amounts, headcounts, timelines, named individuals, specific programs. Never fabricate or generalize.
- `pillLabel` must be `"SWP"`.
- `dataSources` must include the meeting date, participant count, and duration.
- The `subtitle` must name the specific organization and scope (department, division, workforce size).
- This template works for ANY org, department, or industry. The section structure is universal — only the content changes.
- Do NOT use `workforce_plan` type for SWP transcripts.

## Post-Generation Validation Protocol — MANDATORY

After generating ANY SWP artifact, you MUST execute a structured validation pass before returning it. Re-read the source transcript and perform every check below.

**Validation output**: Attach a `validation` field to the artifact JSON:
```json
{
  "validation": {
    "status": "passed" | "passed_with_warnings" | "failed",
    "score": 0-100,
    "checks": [
      {
        "category": "arithmetic" | "financial" | "headcount" | "classification" | "attribution" | "completeness" | "consistency",
        "item": "BUILD Academy total participants",
        "status": "pass" | "warn" | "fail",
        "expected": "3,550",
        "found": "2,730",
        "detail": "Sum of 7 academies: 1400+200+550+600+520+80+200 = 3,550"
      }
    ],
    "corrections": [
      {
        "section": 4,
        "field": "BUILD participants",
        "was": "2,730",
        "corrected": "3,550",
        "reason": "Arithmetic error — sum of 7 individual academy enrolments"
      }
    ],
    "summary": "14/14 checks passed. 0 corrections applied."
  }
}
```

### 7 Check Categories — Execute ALL

1. **Arithmetic**: Sum every group of sub-items and compare to the stated total. Explicitly write out the addition. Check investment subtotals sum to grand total. Check headcount tiers sum to stated total hires.

2. **Financial traceability**: Every dollar amount in the artifact must exist verbatim in the source transcript OR be a correct derivation of transcript figures. Flag any figure that cannot be traced.

3. **Headcount verification**: Every headcount figure must match the source transcript. Verify tier breakdowns sum to totals.

4. **Classification accuracy**: Verify one-time vs ongoing costs are labelled correctly. Verify severity levels match the transcript's characterisation. Verify cost categories (investment vs savings vs avoidance) are correct.

5. **Attribution**: Named owners and deadlines in recommendations and prose must match the transcript's actual assignments.

6. **Completeness**: No major data points, strategies, risks, or action items from the transcript should be omitted.

7. **Cross-section consistency**: Metrics totals must equal table totals must equal comparison heading totals must equal financial summary totals. The same figure cited in multiple sections must be identical everywhere.

### Procedure
- After generating the artifact, re-read the entire transcript
- Execute each of the 7 check categories
- For every discrepancy found: **correct the artifact first**, then log the correction
- Score: 100 if all checks pass; deduct points per severity (fail = -10, warn = -5)
- Set status: "passed" (score >= 90, no fails), "passed_with_warnings" (score >= 70 or has warns), "failed" (score < 70 or critical fails)
