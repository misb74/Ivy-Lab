# Adversarial Corpus

**Status:** Phase 2 seed.
**Purpose:** Known-bad inputs that the scanner MUST detect. Each case
isolates one failure mode against one scanner check.

## The Rule

Same as golden cases: **humans author the cases; agents author the
harness that runs them.** The agent being evaluated must never be the
author of the standard it's evaluated against. Codex implements the
scanner; this directory holds the ground truth that proves the scanner
catches what it should.

## What Adversarial Cases Are (vs. Golden Failure Cases)

A *golden* failure case (e.g., `cases/03-fabricated-role-failure.ts`)
tests fail-closed behavior on a fundamentally broken input — a role
that doesn't exist with no real evidence. The pipeline correctly
refuses to produce decision-grade output.

An *adversarial* case is a **mutation of a known-good input** designed
to slip past the scanner. It has a clear "should fail because X"
contract, where X is a specific scanner check. If the scanner misses
it, the system can be deceived into shipping fabricated decisions.

Both serve different roles:

| | Tests | Failure Mode |
|---|---|---|
| Golden failure | Fail-closed on hopeless input | Coverage too low, no recoverable signal |
| Adversarial | Fail-closed on subtle deception | Inputs that look valid but break a check |

## Phase 2 Seed Cases

| # | Target check | Mutation type | Base case |
|---|---|---|---|
| A01 | structural | `DecisionRecord` at `status=validated` missing `reasoning_trace_id` | Case 01 |
| A02 | reference | Hard claim in recommendation has empty `evidence_refs` and no `AssumptionMarker` | Case 01 |
| A03 | scope | Claim cites `EvidenceItem` from a packet outside active `ResourceScope` | Case 04 |
| A04 | replay (semantic deterministic) | `ReasoningStep.output_value` differs from recomputed result by > tolerance | Case 01 |
| A05 | reference | Cited `EvidencePacket.status = "superseded"` (stale evidence) | Case 04 |

## Acceptance for Phase 2

All 5 adversarial cases must be detected by **at least one** check.
Specifically:
- A01 → `structural.fail` with code `STRUCT_MISSING_REQUIRED`
- A02 → `reference.fail` with code `REF_UNCITED_CLAIM`
- A03 → `scope.fail` with code matching `SCOPE_*_VIOLATION`
- A04 → `semantic.fail` (deterministic replay) with code `SEM_REPLAY_DRIFT`
- A05 → `reference.fail` with code `REF_STALE_EVIDENCE`

If any adversarial passes the scanner, that's a **block-the-merge**
finding. The scanner is broken on a known failure mode.

## Adding New Adversarial Cases

1. Pick a real scanner check (or combination). Don't invent failure
   modes the scanner can't currently detect — those are gaps in the
   scanner spec, not adversarial test cases.
2. Mutate a known-good golden case so exactly one check should fire.
3. Document the `base_case_id`, the mutation, and the expected
   `target_check` + `expected_fail_codes`.
4. Submit for human review before merging — the standard is held by
   humans.

## Phase Applicability

Phase 2 ships with structural + reference + scope + semantic-deterministic.
Adversarial cases that exercise:
- LLM-as-judge semantic detection → Phase 3
- Plausibility bounds → Phase 3
- Cross-source consistency → Phase 3

Mark these with `phases_applicable: ["P3", ...]` so the harness skips
them in P2 runs.
