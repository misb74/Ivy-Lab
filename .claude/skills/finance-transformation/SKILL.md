---
name: finance-transformation
description: Flagship workflow for finance-function AI transformation. Use when the user wants a recommendation for how to redesign, model, or transform a finance team with AI - not just a generic simulation.
---

# Finance Transformation - Flagship Workflow

## When to activate
Trigger when the user is asking what to do with a finance function, finance team, or finance operating model under AI pressure. Typical prompts:

- "Transform our finance function with AI"
- "What should we do with our finance team over the next 18 months?"
- "Model finance scenarios and recommend the best path"
- "Redesign finance with AI agents"
- "Show me the best operating model for finance"

This is a decision workflow, not just a research workflow.

## Default stance

- Lead with a recommendation, not a menu.
- Treat the question as: "what should we do?" not "what could be simulated?"
- If trust conditions are weak, say so before the recommendation.
- If the grounding is not good enough, stop instead of bluffing.

## Current tool sequence

Use the existing stack in this order:

1. `customer_data_prepare_simulation`
2. `wrs_create`
3. `wrs_hydrate`
4. `wrs_run` for 3 scenarios:
   - conservative
   - moderate
   - aggressive
5. `wrs_compare`
6. `wrs_decision_record`

Current phase note:

- The canonical `decision_record` tool exists and should be the default finish for decision-grade finance recommendations.
- Prefer the deterministic `wrs_decision_record` artifact over prose-authored recommendation JSON.
- If `wrs_decision_record` returns `review_required`, stop and surface the blocking issues instead of improvising a recommendation.

## Grounding rule

`customer_data_prepare_simulation` is the trust gate.

- If uploaded org data exists, use it first.
- Call it with `fail_on_fallback_soc: true` for decision-grade finance asks.
- Inspect `soc_coverage` and `role_summary` before moving on.
- If any roles used generic fallback SOC mapping, stop and tell the user exactly which roles need review.
- Do not continue to `wrs_create` when the grounding is weak enough to make the recommendation non-decision-grade.

## Recommendation contract

For every finance-transformation answer, give the user:

1. **Recommendation** - the path you recommend
2. **Why it wins** - the 2-3 strongest reasons
3. **Why not the runner-up** - what loses or gets riskier
4. **What could change the answer** - assumptions, missing grounding, or sensitivity points
5. **Next 90 days** - the first operating moves to make

Do not leave the user with a balanced comparison and no call.

## Trust contract for this phase

- If grounding is weak, say the result is directional and stop if needed.
- If hydration is mock or degraded, say the recommendation is not decision-grade.
- Never present a simulation result as hard fact when inputs are inferred or fallback-based.

## Missing-context behavior

If the user gives no uploaded data and only a broad finance prompt:

- proceed with the existing finance-template simulation flow
- call out that the role mix and headcount assumptions are inferred
- present the recommendation as directional, not decision-grade

If the user gives structured org data:

- prioritize the real org path over inferred templates
- stay strict about grounding quality

## Finance-specific reminders

- Finance tradeoffs are usually between savings, control, resistance, and capability risk.
- Be explicit about where finance needs human judgment to remain in the loop.
- Do not collapse "can automate" into "should automate."
- Default audience is usually CFO + CHRO, even if only one is named.
