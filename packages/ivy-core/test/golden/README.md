# Wedge Golden Cases — Seed Set

**Status:** Seed. These are the 3 hand-authored golden cases that gate
Phase 0 and establish the baseline for every phase after.

**Destination:** `packages/ivy-core/test/golden/` (Codex moves them here
during Phase 0 scaffolding).

---

## What Golden Cases Are

Golden cases are **hand-authored pairs of `{input → expected outcome}`
across the full WRS → req-decision pipeline**. They are the acceptance
gate for every phase. They answer one question:

> Given this role, this simulation, and these source responses — does the
> system produce the right `DecisionRecord` with the right
> `ValidationResult` and the right `granted_mode`?

If the answer is yes, the phase ships. If no, investigate before moving on.

## The Rule

**Humans author golden cases. Agents author the harness that runs them.**

The agent being evaluated must never be the author of the standard it's
evaluated against. Codex builds `harness.ts`; this directory holds the
ground truth it runs.

## The Three Seed Cases

| # | Case | Category | Purpose |
|---|---|---|---|
| 01 | Senior Financial Analyst | full-coverage | Happy path; `decision_grade` granted end-to-end |
| 02 | Chief AI Ethics Officer | partial-coverage | Degrade path; mode caps at `exploratory` |
| 03 | Senior Quantum Workforce Strategist | failure | Fail-closed path; scanner detects reference failure |

Each case is a `.ts` file in `cases/` conforming to `schema.ts`.

## Phase Applicability

Each case is annotated with which phases should run it. A case can be
loaded before its full pipeline exists — earlier phases assert subsets
of the expected outcomes (e.g., Phase 1 asserts `stage3_evidence_packet`
only; Phase 5 asserts the full chain).

| Phase | Subset asserted |
|---|---|
| P1 | `stage3_evidence_packet` |
| P2 | P1 + `stage4_reasoning_trace` + `stage6_validation` (deterministic checks only) |
| P3 | P2 + `stage5_decision_record` + `stage6_validation` (incl. LLM-judge) |
| P4 | P3 + Workvine integration shape (not asserted here; UI tests) |
| P5 | All stages incl. `stage9_export` |

## How to Add a New Case (post-seed)

1. Pick a real role, real simulation context.
2. Draft the input + expected outcomes by hand, based on what a WFP lead
   would rightly expect.
3. Have a human subject-matter reviewer approve the expected outcomes
   before merging. **Never auto-generate the expected outcomes from a
   model run** — that collapses the test into a regression check against
   the model rather than against truth.
4. Add the `.ts` file with a unique `id` conforming to `schema.ts`.
5. Annotate `phases_applicable` to match which pipeline stages the case
   tests.
6. CI runs `npm run eval -w packages/ivy-core` on every PR; new case
   must pass.

## Adversarial Corpus (separate, not in this seed)

Adversarial cases (claims that should fail the scanner) live under
`test/adversarial/`. The seed here contains one failure case (Case 03)
primarily to ensure the harness can handle failure assertions, not to
cover adversarial breadth. Full adversarial corpus curation is part of
Phase 2–5 parallel workstream.

## Case File Conventions

- Filename: `NN-short-slug.ts`
- `id` in the file matches the slug portion of the filename
- All source mocks explicit — no external fetches during eval
- All dates as ISO strings; timestamps relative to `created_at`
- Numeric values with explicit units
- Prose kept short; these are specs, not documentation

## Human Review Requirement

Any change to the three seed cases requires human review. A PR that
alters expected outcomes without a comment justifying the change (citing
evidence, scope update, or corrected error) is rejected.
