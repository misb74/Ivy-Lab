---
name: workforce-sim
description: WorkVine Simulate — Workforce Redesign Skill. Use when the user wants to simulate, model, or redesign a workforce with AI agents — including "what happens when I introduce agents", maturation curves, cultural resistance, transition plans, Build/Buy/Borrow/Bot (BBBOB), scenario comparison, AI impact on a team, "where to start with AI", roles/tasks most affected, agent adoption timelines, finance team transformation, or any 18-month workforce redesign.
---

# WorkVine Simulate — Workforce Redesign Skill

## When to Activate
Trigger when the user asks to simulate, model, or redesign a workforce with AI agents. Key phrases: "simulate", "workforce redesign", "what happens when I introduce AI agents", "maturation curve", "cultural resistance", "transition plan", "BBBOB", "build buy borrow bot", "compare scenarios".

## Available Tools (MCP server: agent-workforce-sim)

### wrs_create
Create a simulation with org structure and roles.
```
wrs_create({
  simulation_name: "Finance Function 18-Month Redesign",
  org_name: "Acme Corp",
  headcount: 150,
  time_horizon_months: 18,
  roles: [
    { title: "AP Clerks", onet_soc_code: "43-3031.00", fte_count: 30, annual_cost_per_fte: 48000 },
    { title: "Financial Analysts", onet_soc_code: "13-2051.00", fte_count: 20, annual_cost_per_fte: 95000 },
    ...
  ]
})
```

### wrs_hydrate
Populate role/task data from O*NET, WorkBank, AEI, BLS, Lightcast, Felten AIOE.
```
wrs_hydrate({ simulation_id: "...", use_mock_data: true })
```

### wrs_run
Execute simulation with maturation curve projections and cultural impact scoring.
```
wrs_run({
  simulation_id: "...",
  scenario_name: "Moderate Adoption",
  seed: 42,
  maturation_params: { preset: "moderate" }  // conservative | moderate | aggressive
})
```

### wrs_compare
Compare 2+ scenarios side-by-side.
```
wrs_compare({ simulation_id: "...", scenario_ids: ["id1", "id2", "id3"] })
```

### wrs_transition
Generate phased transition plan with risk hotspots.
```
wrs_transition({ simulation_id: "...", scenario_id: "..." })
```

### wrs_export
Export results for reporting (HTML/DOCX/PPTX).
```
wrs_export({ simulation_id: "...", scenario_id: "...", format: "html" })
```

## Typical Workflow

1. **Create** — user describes org/roles → `wrs_create`
2. **Hydrate** — populate with data → `wrs_hydrate`
3. **Simulate** — run 3 scenarios (conservative/moderate/aggressive) → `wrs_run` x 3
4. **Compare** — side-by-side analysis → `wrs_compare`
5. **Plan** — transition roadmap → `wrs_transition`
6. **Export** — executive report → `wrs_export` → output skill

## Missing-Context Handling (important)

If the user asks in business language without structured inputs:
- infer a default finance template (8-role split) and proceed with `wrs_create` + `wrs_hydrate` + `wrs_run`
- clearly state inferred assumptions in one short block
- always return the `workforce_simulation_workbench` artifact first so the user can edit assumptions in-chat
- do not stall waiting for perfect inputs unless the user explicitly asks to pause

If uploaded workforce calibration data is present in the prompt (look for `Parsed workforce calibration data`):
- pass it into `wrs_run.parameter_overrides.company_calibration` (preserve `role_cost_model` and `geography_mix`)
- keep company-calibrated costs as first-class assumptions
- if calibration is partial, proceed and call out fallback roles explicitly

## Business-Style User Phrasing (preferred)

Use conversational business language and infer structure:
- "I need to understand what AI changes in our finance team over the next 18 months. Show me the roles most affected, the tasks shifting to agents, and where people will push back."
- "If we limit workforce reduction to 15% and keep at least 40% of tasks human-led, what does that do to savings and risk?"
- "Which skills become more important when agents take repetitive work, and which skills are at risk?"
- "Give me the first two pilot areas and the HR actions I should take before rollout."

## Key Concepts

- **Maturation curves**: Agent capability grows via logistic function, dampened by task complexity
- **Cultural quadrants**: Green Light (safe), Red Light (friction), R&D Opportunity, Low Priority
- **Resistance scoring**: 40% red-light proportion + 30% desire-capability gap + 30% human edge
- **Deterministic contract**: Same seed + inputs → identical output (SHA-256 verified)
- **BBBOB**: Build (reskill) / Buy (hire) / Borrow (contract) / Bot (deploy agent) per task cluster

## O*NET SOC Codes for Common Finance Roles
- AP/AR Clerks: 43-3031.00
- Staff Accountants: 13-2011.00
- Financial Analysts: 13-2051.00
- Controllers: 11-3031.00
- Tax Specialists: 13-2082.00
- Payroll: 43-3051.00
- Internal Auditors: 13-2011.01
- FP&A Analysts: 13-2051.01

## Important Notes
- Numbers come from the deterministic engine, NEVER from LLM generation
- LLM role: scenario setup via chat, interpretation of results, natural-language explanations
- All results traceable to versioned assumptions and data source snapshots
- `use_mock_data: true` uses built-in role profiles; `false` calls real MCP connectors
- When `wrs_run`, `wrs_compare`, or `wrs_transition` returns an `artifacts` object, emit those objects directly inside `<artifact>...</artifact>` blocks without renaming keys
- For chat-native simulation UX, prioritize emitting `workforce_simulation_workbench` first from `wrs_run` artifacts, then `workforce_redesign` and `capability_timeline`
