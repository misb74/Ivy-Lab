---
name: deep-research
description: Structured deep research pipeline — multi-source, parallel threads, SQLite-persistent, with confidence scoring and provenance tracking. Use for thorough/comprehensive analysis, federated or cross-source search, academic research, curated institutional findings, "search all sources", or resuming/continuing an in-progress research thread.
---

# Deep Research Pipeline

## Triggers
- "deep research", "thorough analysis", "comprehensive study"
- "search all sources", "federated search", "cross-source"
- "resume research", "continue research"

## Workflow

### 1. Create & Plan
```
deep_research_create(question, context) → project_id
deep_research_plan(project_id) → plan with sub-questions
```
**Checkpoint:** Present the plan to the user. Show:
- Sub-questions and their source groups
- Number of threads and estimated scope
- Ask for confirmation before proceeding

### 2. Research Loop
```
deep_research_next(project_id) → thread actions
Execute all actions in PARALLEL → collect results
deep_research_submit(thread_id, results) → findings + gap analysis
```
Repeat until `deep_research_next` returns `complete: true`.

**If a thread uses federated search:**
```
multi_search(query, source_group, context) → action list
Execute all actions in PARALLEL → collect results
multi_search_merge(search_id, results) → merged results
Feed merged results into deep_research_submit
```

### 3. Synthesize
```
deep_research_synthesize(project_id) → synthesis report
```

### 3.5 Output — Artifact Card (Default)
After synthesis, ALWAYS produce an artifact card:
```
deep_research_to_artifact(project_id) → artifact JSON
```
Wrap the returned JSON in `<artifact>` tags and present to the user. This produces a rich insight card with metrics, callout, table, chart, findings list, recommendations, and methodology sections.

Save the artifact fixture to: `fixtures/insight_deep_research_{slug}.json` (where `{slug}` is a kebab-case version of the project name).

### 3.6 Output — Report/Export (On Request)
If the user asks for any output (HTML report, PDF, PPTX, etc.):
1. Read the artifact JSON from the fixture or from `deep_research_to_artifact`
2. Follow the output skill's decision tree (artifact already exists → route accordingly)
3. For HTML reports, save to: `outputs/deep-research/{slug}.html`

### 4. Gap Follow-up
If gaps are identified, ask the user:
- "Would you like me to run additional research on [gap areas]?"
- If yes, execute the `additional_actions` from gap analysis

## Rules

1. **Every finding must have source provenance** — no hallucinated data
2. **Show confidence scores transparently** — users deserve to know reliability
3. **When sources disagree, present both perspectives** — don't silently pick one
4. **Workforce questions must include at least one structured source** (BLS/Lightcast/O*NET) alongside web research
5. **Prefer parallel execution** of thread actions for speed
6. **Always present the plan before executing** — user controls scope
7. **Cross-session persistence** — projects survive session boundaries via SQLite

## Fact Integrity Protocol — MANDATORY

Every research thread and synthesis must follow these rules. They exist because prescriptive claims presented as empirical findings, stale statistics, and scope mismatches have caused errors in past reports.

### 1. Classify Every Claim
For each statistic or finding, assign one label:
- **EMPIRICAL** — observed, measured outcome (e.g. "revenue grew 12%")
- **PRESCRIPTIVE** — what the source recommends (e.g. "invest $5 in people per $1 in tech")
- **EXPECTATION** — what respondents say they intend to do (e.g. "68% expect to maintain workforce")
- **PROJECTION** — modelled or forecast figure (e.g. "57% of work hours technically automatable")

Never present PRESCRIPTIVE or EXPECTATION data as EMPIRICAL. Surface the classification in source notes. When synthesising, use language that matches the classification: "McKinsey advises..." (prescriptive), "68% of executives expect..." (expectation), "productivity grew 27%..." (empirical).

### 2. Always Specify Scope
For every statistic confirm and state:
- **Geography** (UK / US / Global — these are not interchangeable)
- **Time period** (survey fieldwork date, not just publication date — they often differ by 6-12 months)
- **Population** (executives vs frontline workers vs CEOs vs all employees — a CEO survey and an employee survey measure different things)

Flag any claim where scope is ambiguous. Do not mix geographies or populations without explicit labelling.

### 3. Require Independent Corroboration
For any headline claim, seek at least one source outside the originating organisation. Self-reported data from the entity being studied (e.g. Accenture citing its own productivity gains) carries lower evidential weight. Academic, financial, or regulatory sources provide essential counter-weighting. Flag claims supported only by the originating source as "single-source" in findings.

### 4. Cross-Check Revealed Preferences Against Stated Positions
For any organisation covered in the research, compare:
- What they publicly advise or claim
- What their own internal actions show (hiring, layoffs, investment, restructuring)

Revealed preferences (actual decisions) carry more evidential weight than published frameworks or survey responses. Flag say-do gaps explicitly in the synthesis. Example: a firm advising "invest in reskilling" while cutting 33% of graduate intake is a say-do gap that must be surfaced.

### 5. Treat Suspicious Precision as a Verification Trigger
Highly specific figures (e.g. "14 hrs/wk saved", "1.6x ROI", "76% premium") signal a methodology claim that warrants scrutiny. Before including them:
- Verify sample size is sufficient to support the stated precision
- Confirm geography and conditions match the context being applied
- Check whether the figure has been independently replicated
- Note whether the metric measures what it appears to (e.g. "1.6x more likely to avoid failure" ≠ "1.6x ROI")

### 6. Enforce Scope Consistency Throughout
Maintain a defined entity list at the start of research (e.g. "this report covers McKinsey, BCG, Deloitte, Accenture, EY, KPMG"). Any data point from an out-of-scope entity (e.g. PwC, Forrester, Gartner) must be explicitly labelled as external context. Do not allow out-of-scope figures to appear inline as if they belong to the primary comparison set.

### 7. Version-Stamp All Statistics
For every quantitative claim record:
- Source publication name and date
- Whether a more recent version of the same publication exists

Superseded figures must be replaced or flagged. Do not carry forward statistics from earlier editions (e.g. "18,000 custom GPTs" from mid-2025) when an updated figure exists (e.g. "36,000" from December 2025).

### 8. Pre-Output Audit (with Perplexity Verification)
Before returning synthesis or any research output, run this self-check:
- [ ] All figures classified (empirical / prescriptive / expectation / projection)?
- [ ] Every headline stat has scope stated (geography, population, time)?
- [ ] Headline claims have independent corroboration or are flagged as single-source?
- [ ] Revealed preferences checked against stated positions for covered entities?
- [ ] Out-of-scope entities clearly labelled?
- [ ] All statistics from the most recent available source version?
- [ ] Suspiciously precise figures verified for methodology and replication?
- [ ] Internal consistency check passed? (`check_internal_consistency` — all critical contradictions resolved)
- [ ] Headline claims adversarially reviewed? (`perplexity_adversarial_review` — framing, primacy, attribution, scope)
- [ ] Derivative sources flagged with hedging language?
- [ ] All attributed quotes verified for title currency?

**Perplexity verification step (MANDATORY for executive reports):**
For each headline statistic in the synthesis (typically 15-30 claims per report):
1. Call `perplexity_verify_claim` with the claim, source, date, and claim type
2. For any claim returned as `outdated`, call `perplexity_find_latest` to get the current figure
3. For any claim returned as `nuance_needed`, add a caveat note to the output
4. For any claim returned as `disputed`, present both positions
5. After standard verification, run adversarial review on headline claims:
   - Call `check_internal_consistency` with all structured claims
   - Call `perplexity_adversarial_review` for each headline stat with: directional_framing, source_primacy, and scope_match checks
   - For any quotes with named individuals: include attribution check
6. Resolve all critical contradictions and inverted framings before proceeding to artifact/output

This step uses the Perplexity Sonar API (~$0.006/query) via agent-verifier. It catches stale statistics, misclassified claim types, and scope mismatches that manual review often misses. Total cost per report: ~$0.10-$0.20.

If any check fails, resolve it or flag it explicitly in the output with a caveat note.

## Resume Flow
For "resume research" or "continue research":
```
deep_research_list() → find project
deep_research_resume(project_id) → status + next step
```
The server handles resetting interrupted threads and picking up where you left off.

## Quick vs Deep Decision
| Signal | Route |
|--------|-------|
| "quick lookup", "what is X" | `agent-research` (quick_research) |
| "search all sources for X" | `agent-multi-search` (multi_search) |
| "deep research on X", "thorough analysis" | `agent-deep-research` (this pipeline) |

## Multi-Search Standalone
For ad-hoc federated queries without a full research project:
```
multi_search_groups() → see available source groups
multi_search(query, source_group, context) → action list
Execute actions → multi_search_merge(search_id, results) → ranked results
```

Available source groups: `job_market`, `talent`, `skills_occupation`, `web`, `wages`, `ai_impact`, `labor_trends`, `all_workforce`, `custom`.
