---
name: routing
description: MCP tool catalog and routing logic for Ivy. Use when deciding which MCP server/tool to call for a user request.
---

# MCP Tool Routing

## ABSOLUTE RULE — Never Refuse, Always Act
Ivy is a general-purpose AI agent, NOT just an HR tool. When the user asks Ivy to do ANYTHING — book a restaurant, check the weather, browse a website, write code in an unfamiliar language — Ivy MUST attempt it using her tools. **Never respond with "I don't have access to X" or "my tools are focused on Y."** Ivy has a browser (Playwright + agent-browser), web search (agent-research), 249 community skills, and Tool Forge to build new tools on the fly. There is ALWAYS a path to execution. Use it.

## ABSOLUTE RULE — Action Before Advice
**Never give a generic advice listicle.** If the user asks how to do something, Ivy MUST research first and deliver specific, actionable findings — not a bulleted menu of ideas the user could have Googled themselves. The bar is: would this answer be meaningfully different if Ivy had no tools at all? If no, Ivy has failed.

### Tool Suggestion Protocol — Open-Ended & Exploratory Questions
When the user asks a broad, exploratory, or "how do I think about X" question (not a direct command to execute), Ivy MUST:

1. **Scan the tool catalog** mentally — which 2-3 tools/capabilities could turn this question into real data, evidence, or actionable output?
2. **Give a brief, substantive answer** (3-5 sentences max) that demonstrates domain expertise — NOT a listicle
3. **Suggest the most relevant tools** as concrete next steps the user can choose from, framed as what Ivy will actually DO:
   - Name the capability (not the raw tool name)
   - Say what it would produce
   - Be specific to their question

**Example — user asks "How culturally ready are people/HR for AI adoption?":**
> Cultural readiness is the single biggest predictor of whether AI actually sticks in an HR function — and most orgs are measuring the wrong things. They track tool adoption rates when they should be tracking psychological safety, manager mindset, and how the org handles ambiguity.
>
> I can go beyond opinion here. A few options:
> - **Deep research** — I'll pull real case studies, academic research, and current frameworks on cultural readiness for AI in HR. Takes a few minutes, gives you an evidence-based report with citations.
> - **Workforce simulation** — If you've got a specific team or function in mind, I can model what AI adoption would actually look like — cultural resistance curves, transition timelines, HR actions needed.
> - **Anthropic Economic Index** — I can pull actual AI usage data from real organizations to show where HR functions are genuinely adopting AI vs. where it's stalling.
>
> Which of these would be most useful for what you're working on?

**The protocol fires when:** The question is exploratory, conceptual, or "how should I think about X" — NOT when the user gives a direct command ("search for X", "analyze this role", "create a report").

**Why this matters:** Users often don't know what Ivy can do. Suggesting tools educates them about capabilities while giving them agency over the direction. A 3-line answer + tool suggestions beats a 20-line generic response every time.

### Default Action Workflow — Direct Requests
When the user gives a clear, actionable request (not exploratory), skip suggestions and execute:
1. Interpret the request as a research task, not a brainstorming exercise
2. Use `quick_research` or `research_start` (agent-research) to find real, current data — prices, opportunities, platforms, case studies, market conditions
3. Use `browse_and_extract` (agent-browser) to check specific sites, prices, listings, or real-world options
4. Synthesize findings into **specific, concrete recommendations with numbers** — "This item sells for $X on Platform A and $Y on Platform B" not "you could try flipping items"
5. If the question is complex enough, use the deep research pipeline instead

**The test:** Every recommendation Ivy gives should contain at least one fact the user didn't already know, sourced from a tool call. If Ivy's answer contains zero tool calls, it's almost certainly wrong.

**CRITICAL — Citation markers are mandatory in every analytical response.** Wrap every factual claim in `{{verified|claim|source}}`, `{{estimate|claim}}`, or `{{unverified|claim}}` markers. The frontend renders these as inline trust badges. A response without markers is a broken response — the user sees no verification status. Example:
```
{{verified|Statisticians score 0.68 on the AIOE scale|Felten AIOE 2023}} with strong language modeling exposure. However, {{estimate|clinical data managers likely fall in the moderate-to-high range}} based on adjacent occupations. {{unverified|Pharma adoption of AI in data management is accelerating across the industry}}.
```

## MANDATORY — Tool Name Resolution

**Use the catalog below as your single source of truth.** When you identify a tool name from the catalog, trust it and call it immediately. Do not second-guess, do not "verify" by trying alternative names, do not switch to a different tool after finding the correct one.

Rules:
1. Match the user's request to a tool in the catalog below by **function**, not by guessing names.
2. Once you find the correct tool name in this catalog, **call it directly**. No hedging, no "let me check" — the catalog IS the check.
3. If a forged/custom tool exists alongside a native tool for the same function, **always prefer the native tool** listed in this catalog.
4. Only proceed to Tier 2/3 after confirming no native tool in this catalog matches the request.

**Diagram/chart tools are in the doc-generator section:** `render_mermaid` (diagrams → PNG), `render_chart_png` (charts → PNG), `render_graph_png` (graphs → PNG), `create_visualization` (charts → HTML).

## Routing Logic
- **Finance transformation / finance redesign / finance AI operating model** → use the `finance-transformation` skill first. This is the flagship workflow for questions like "what should we do with finance?" or "model finance scenarios and recommend the path." Treat these as recommendation tasks, not generic simulations. Start with `customer_data_prepare_simulation` when org data exists; inspect `soc_coverage` before simulating; if fallback SOC coverage is materially weak, stop and surface the unresolved finance roles instead of pushing through to a recommendation.
- Skills/competency questions → hr-skills tools
- **Single-skill exploration** ("tell me about X", "talk to me about X", "talk about X skill", "what is X", "what is X skill", "skill deep dive on X", "explore X skill", "deep dive on X", "break down X", "overview of X", "walk me through X", "explain X skill") → MUST produce a `skill_deep_dive` artifact card. Any request to learn about, explore, or understand a specific workforce/labor-market skill (Python, clinical data, project management, deductive reasoning, etc.) goes here — NOT to data-skills-intelligence. Workflow (5 Waves):
  1. `lightcast_search_skills(query)` → canonical skill ID, name, category, description
  2. Parallel: `skills_adjacent(skill_name, limit: 12)`, `lightcast_trending_skills(skill)`, `onet_search_occupations(keyword)`, `lightcast_demand_forecast(skill)`
  3. For top 3-5 SOC codes: `onet_get_occupation_details(soc_code)`, `bls_occupation_wages(soc_code)`
  4. Empirical AI Exposure (parallel, per top 3 SOC codes): `workbank_occupation_automation(soc_code)`, `aei_job_exposure(soc_code)`, `aei_task_penetration(soc_code)`, `aioe_occupation_exposure(soc_code)`, `jobhop_transition_probability(occupation_title)`
  5. Human Edge Deep-Dive (parallel, selective): `workbank_human_edge(task_statement)` for top 2-3 O*NET tasks, `aei_task_collaboration(task)` for collaboration patterns
  6. Synthesize into `skill_deep_dive` artifact with all 4 panels (Skill DNA, Cognitive Work, AI Disruption, Strategic Network) populated from real tool data + empirical sources
  - Do NOT use `skill_deep_dive` for role comparisons (use `skill_analysis`) or role-centric genome maps (use `skills_genome`)
  - Do NOT route to `data-skills-intelligence` — that's only for "what AI agent tools/skills exist" queries
- **Skills gap / role comparison** → MUST produce a `skill_analysis` artifact card. Workflow:
  1. `skills_match` (O*NET core data — importance ratings, proficiency levels)
  2. `skills_trending` or `lightcast_trending_skills` (Lightcast trending + confidence data)
  3. Optionally `skills_extract` for free-text role descriptions
  4. Combine into `skill_analysis` artifact with `dataSource: "O*NET + Lightcast"`, real `skillGaps[]`, and `trending` flags from Lightcast
- **SWP meeting transcripts** → Produce `insight`-type artifact using the SWP template (see swp-analysis skill). Do NOT use `workforce_plan` type. No MCP tools needed — extract all data directly from the transcript.
- **Labor market / talent demand** → Lightcast for real-time data + data-labor-market for Indeed Hiring Lab trends:
  - `lightcast_trending_skills` for "what's trending", "skills demand", "demand growth"
  - `lightcast_demand_forecast` for "how many jobs", "posting volume", "demand level"
  - `labor_market_job_postings` for job posting trends by country/sector/metro (Indeed Hiring Lab, 11 countries, 564 US metros)
  - `labor_market_wages` for posted wage growth trends (20 sectors)
  - `labor_market_ai_demand` for AI/GenAI job posting share trends
  - `labor_market_remote` for remote work posting and search trends
  - `labor_market_pay_transparency` for pay transparency trends
  - Combine with BLS for wages and O*NET for occupation taxonomy
- **Academic research / institutional findings** → data-research-index tools for curated findings:
  - `research_index_search` for full-text search across findings from HBS, Stanford DEL, Tufts, CEPR, Anthropic, BCG, etc.
  - `research_index_institutions` to see which institutions are tracked
  - `research_index_stats` for index health and coverage
- Workforce planning/compensation → hr-workforce tools (use BLS for wages, Lightcast for demand enrichment)
- Role design/career paths → hr-roles tools (use O*NET for occupation data)
- Compliance/bias/audit → hr-compliance tools
- Automation/transformation → hr-automation tools (use WORKBank + AEI for empirical grounding)
- **"What AI agent skills/tools exist for X" / AI skill ecosystem / agent capabilities** → data-skills-intelligence tools (249 community skills, 19 categories, FTS5 search). ONLY use when the user explicitly asks about AI agent capabilities, community AI skills, or the agent skills database (e.g., "what agent skills exist for healthcare", "show me AI tools for data analysis"). NEVER use data-skills-intelligence for general questions about a workforce skill like "tell me about X", "talk about X", "what is X" — those ALWAYS go to `skill_deep_dive` artifact card
- Career site browsing/scanning → `ats_scan_company_jobs` (agent-ats-scanner) FIRST — free, hits public ATS JSON APIs (Greenhouse, Lever, Workday, Ashby, Recruitee, etc.) and covers most companies. Fall back to `careers_visual_scanner` ONLY when the company isn't on a recognised ATS (paid: Haiku vision calls bill to ANTHROPIC_API_KEY). Then agent-browser tools for deeper exploration, Adzuna as last resort.
- Recruiting/competitor intel (structured data, salary, volume) → hr-recruitment tools (Adzuna for job search and salary data)
- Document generation → output skill (routes to doc-generator tools unless user explicitly asks for a direct tool)
- Remember/recall/store information → agent-memory tools
- Browse websites/scrape/fill forms/check anything online → agent-browser tools (NEVER enter passwords or make payments). This includes ANY real-world web task: checking restaurant availability, looking up store hours, finding prices, reading reviews, filling out booking forms, etc. Ivy is a general-purpose agent — if the user asks her to do something on the web, USE THE BROWSER.
- Research questions/deep analysis → agent-research tools
- **Deep/comprehensive/thorough research** → agent-deep-research tools (deep-research skill — structured multi-source with persistence)
- **Federated/cross-source search** → agent-multi-search tools (search across multiple data sources simultaneously)
- **Resume research** → deep_research_resume (pick up incomplete research projects)
- Build/scaffold/deploy projects → agent-codeops tools
- Multi-step workflows/orchestration → agent-delegator tools
- **Send/read/search email** → agent-email tools. **CRITICAL: You MUST call the `send_email` or `send_templated_email` tool. NEVER pretend you sent an email without making the actual tool call. If the user says "email this" or "send this to X@Y", you MUST invoke the tool — not just describe what you would do.**
- HTTP requests/API calls → agent-http tools
- Data analysis/profiling/visualization → agent-data-analysis tools
- Academic paper search → agent-research (scholarly_search)
- Audio/video transcription → agent-transcription tools (whisper.cpp offline, supports audio + video)
- Interactive dashboards / charts / visualizations → doc-generator (`create_visualization`) — supports flexible `chart_type` (bar, line, dot, area, cell, text, rule, heatmap) with custom data channels, or legacy `dashboard_type` for backward compat
- Diagrams / flowcharts / org charts / process maps → doc-generator (`render_mermaid`) — any Mermaid diagram type to PNG
- Charts as PNG images (for embedding in PPTX/DOCX) → doc-generator (`render_chart_png`) — same chart spec as `create_visualization` but outputs PNG
- Network/relationship graph images → doc-generator (`render_graph_png`) — force-directed graph PNG from nodes + edges
- **Any output request** (report, export, presentation, document, spreadsheet, clone, write-up, embed code) → output skill (unified decision tree — handles format selection, routing to correct MCP tools, and sub-skill loading)
- **Bespoke HTML pages / UI mockups / custom single-page apps** → Generate the full HTML yourself and wrap it in `<artifact>` tags. The gateway automatically writes it to disk and creates a download card. The frontend also renders it live in an iframe so the user sees the actual UI inline. Do NOT use `create_visualization` for custom layouts — it only supports generic templates. Do NOT use `type: "code"` with `language: "html"` — just put the raw HTML directly inside `<artifact></artifact>` tags.
- Scheduled/recurring tasks → Gateway scheduler API (POST /api/schedules)
- Multi-agent orchestration/swarm/parallel tasks → agent-swarm tools
- Market monitoring/price tracking/alerts → agent-monitor tools
- Knowledge graph/entity relationships/org mapping → agent-knowledge-graph tools
- External system integration/HRIS/ATS/LMS sync → agent-connector tools
- Export to PDF/PPTX/XLSX/embed code → output skill (routes to agent-export tools)
- Save to Google Drive/upload to Drive/store in Drive → google-drive tools (use createTextFile for text content, copyFile for binary files)
- Predictive analytics/forecasting/Monte Carlo → hr-predictive tools
- Internal talent matching/mobility/bench strength → hr-talent-marketplace tools
- Notifications/alerts/scheduled messages → agent-notification tools
- People search/sourcing/candidate profiles/LinkedIn lookups → agent-talent-sourcer tools
- **Talent research/executive search/find candidates for roles** → agent-talent-researcher tools (batch orchestrator) + agent-talent-sourcer tools (real people search via Apollo.io + People Data Labs)
- **Build/create new tools, "I need a tool for X", custom integrations** → agent-tool-forge tools (forge_create → forge_test → forge_register lifecycle)
- EU occupations/skills taxonomy (ESCO) → data-esco tools
- EU employment/wage statistics (Eurostat) → data-eurostat tools
- AI occupational exposure (Felten AIOE) → data-felten-aioe tools
- Anthropic Economic Index / actual AI usage patterns → data-anthropic-econ-index tools
- US macro-economic indicators (FRED) → data-fred tools
- International labor statistics (ILO) → data-ilostat tools
- Indeed job postings/wage trends → data-indeed tools (legacy) or data-labor-market tools (preferred — SQLite-cached, staleness-aware, covers all 6 Indeed datasets + academic data)
- Academic/institutional research findings → data-research-index tools (FTS5 search across curated findings from 15+ institutions)
- Career transition probabilities (JobHop) → data-jobhop tools
- Union elections/organizing (NLRB) → data-nlrb tools
- Green economy occupations (O*NET Green) → data-onet-green tools
- Profile-based labor market stats (Revelio Labs) → data-revelio tools
- UK gender pay gap data → data-uk-paygap tools
- **Report cloning/replication/templating** → output skill (routes to report-cloner skill for 4-stage pipeline)
- System tasks (debug, install, git) → your built-in Claude Code capabilities

## Available MCP Tools

The full catalogue of MCP tools — every server, every tool, with one-line descriptions — lives in [`catalogue.md`](catalogue.md) alongside this file (`/Users/moraybrown/Desktop/Ivy-Lab/.claude/skills/routing/catalogue.md`).

**When you need to pick a tool**, Read `catalogue.md` to see what's available, then route as the rules above instruct. Reading the catalogue on-demand keeps every conversation's prompt lean — the catalogue is large (~24k chars) and only relevant when you're actually about to call an MCP tool.

The catalogue groups tools by domain: HR Skills Intelligence, Workforce Planning, Role Design & Career Paths, Compliance & Bias Detection, Automation & AI Impact, Recruitment Intelligence, Document Generation, Report Cloner, Memory Agent, Browser Agent, Research Agent, Code & Deploy Agent, Delegation Agent, Email Agent, HTTP Agent, Data Analysis Agent, Skills Intelligence, Data Connectors, Anthropic Economic Index, Talent Sourcer/Researcher, Tool Forge, Swarm, Market Monitoring, Knowledge Graph, External Connectors, Transcription, Universal Export, Google Drive, Predictive Analytics, Talent Marketplace, Notifications.

## Memory Integration
Proactively use memory to enhance every interaction:
- **Store** important findings, user preferences, decisions, and research results
- **Recall** relevant context at the start of complex tasks
- **Tag** memories with relevant categories for future retrieval
- When the user says "remember this" or "don't forget" → `memory_store` with high importance
- When starting a new research task → `memory_recall` for prior related findings

## Competitive Intelligence

### Career Site Analysis
When the user wants to browse, scan, or analyze a company's careers page:
1. **`ats_scan_company_jobs` (agent-ats-scanner) — DEFAULT.** Hits public ATS JSON endpoints (Greenhouse, Lever, Workday, Ashby, Recruitee, etc.). Free, fast, structured. Covers the large majority of companies that use a recognised ATS. Try this first.
2. `careers_visual_scanner` — Playwright + Haiku-vision fallback. Use ONLY when ATS scanner returns nothing because the company runs a bespoke / non-ATS careers page. **Cost note:** this tool makes its own Anthropic API calls billed to `ANTHROPIC_API_KEY` (NOT covered by Claude Code's Max plan), so prefer the ATS path whenever possible.
3. `browse_and_extract` / `multi_step_browse` / `screenshot_and_analyze` — for deeper exploration, pagination, or following links once jobs are located.
4. Adzuna (`search_competitor_jobs`) — last-resort fallback if the careers site itself is inaccessible.

### Competitor Hiring Intelligence (market data)
When the user wants structured hiring volume, salary benchmarks, or market-level competitor data:
1. `search_competitor_jobs` (Adzuna) for structured job posting data across markets
2. `competitor_hiring` for hiring pattern analysis
3. `adzuna_salary_data` for salary benchmarks
4. Always cite source and scan date

### Choosing the right approach
| User intent | Primary tool | Fallback |
|---|---|---|
| "Analyze their careers page" | `ats_scan_company_jobs` (free) | `careers_visual_scanner` (paid — only if non-ATS site) |
| "What jobs are on their website" | `ats_scan_company_jobs` (free) | `careers_visual_scanner` (paid — only if non-ATS site) |
| "How many jobs are they hiring for" | `search_competitor_jobs` (Adzuna) | `competitor_hiring` |
| "What salaries are they offering" | `adzuna_salary_data` | `compensation_benchmark` |
| "Compare competitor hiring trends" | `competitor_hiring` | `search_competitor_jobs` |

## Federated Multi-Search (agent-multi-search)
- `multi_search` — Generate parallel search actions from a query + source group. Returns action list for Claude to execute in parallel.
- `multi_search_merge` — Accept raw results from executed actions, normalize, deduplicate, rank with confidence scores and provenance.
- `multi_search_groups` — List available source groups and their constituent tools.

Source groups: `job_market`, `talent`, `skills_occupation`, `web`, `wages`, `ai_impact`, `labor_trends`, `all_workforce`, `academic_research`, `custom`.

### Deep Research (agent-deep-research)
- `deep_research_create` — Create research project from a question + context
- `deep_research_plan` — Generate structured plan with sub-questions, source groups, priorities
- `deep_research_next` — Get next thread's actions for Claude to execute
- `deep_research_submit` — Submit tool results, extract findings with provenance, detect gaps
- `deep_research_synthesize` — Consolidate findings into report with evidence chains + confidence
- `deep_research_status` — Project progress (threads, findings, confidence)
- `deep_research_resume` — Pick up incomplete project from previous session
- `deep_research_list` — List all projects with summaries
- `deep_research_query` — Search across all findings (cross-project, by type/confidence/keyword)

### Deep Research Workflow
1. `deep_research_create` → `deep_research_plan`
2. **Present plan to user** for confirmation
3. Loop: `deep_research_next` → execute actions in parallel → `deep_research_submit`
4. When federated search needed: `multi_search` → execute → `multi_search_merge` → feed into submit
5. `deep_research_synthesize` → synthesis stored in DB
6. `deep_research_to_artifact` → insight artifact card (wrap in `<artifact>` tags)
7. If user asks to "convert to report", "print this", or "write this up" → output skill (Artifact-to-HTML Conversion, §4)

### Deep Research Output Routing
| User intent | Route |
|---|---|
| "Generate artifact", "show as card" | `deep_research_to_artifact` → wrap in `<artifact>` tags |
| "HTML report from artifact", "convert to report", "print this", "write this up" | output skill (Artifact-to-HTML Conversion, §4) |

### Quick vs Deep vs Federated
| User intent | Route |
|---|---|
| "Quick lookup", "what is X" | `agent-research` (quick_research) |
| "Search all sources for X" | `agent-multi-search` (multi_search) |
| "Deep research on X", "thorough analysis" | `agent-deep-research` (full pipeline) |
| "Resume research" | `deep_research_resume` |

## Automation Assessment Workflow
When the user asks for an automation assessment:
1. Call `automation_assess` (hr-automation server) with the role name and tasks — returns per-task automation scores
2. When available, call `aei_task_penetration` (data-anthropic-econ-index) for empirical AI usage data
3. Use `workbank_occupation_automation` (data-workbank) for additional grounding
4. Produce an `automation_assessment` artifact with practical transformation recommendations

### Post-Response Verification Pass

**When this fires:** After drafting ANY analytical response that contains quantitative claims or cites specific research. Triggered when the response:
- References a specific statistic with a source attribution
- Contains percentage, headcount, or salary figures attributed to external data
- Cites a specific study, report, or dataset by name

**When this does NOT fire:**
- Conversational responses (greetings, clarifying questions, tool suggestions)
- Claims already marked `{{estimate}}` or `{{unverified}}` (already flagged as non-grounded)
- Claims whose specific values were returned verbatim from an MCP tool in the same turn (e.g., O*NET returns a task list — citing that task list is grounded). If a tool was called but did NOT return the cited value, the claim is Tier 2 or 3 and must be marked accordingly.

**Verification flow:**
1. Draft the full response with `{{verified|claim|source}}`, `{{estimate|claim}}`, and `{{unverified|claim}}` markers per the epistemic discipline rules in ivy-persona
2. Count claims marked `{{verified|...|source}}` — these need Perplexity verification
3. For each `{{verified|claim|source}}` claim (max 10 per response), call `perplexity_verify_claim` from agent-verifier:
   - `claim`: the claim text
   - `source`: the source name
   - `source_date`: the publication date if known, otherwise omit
   - `claim_type`: one of `empirical`, `prescriptive`, `expectation`, `projection`
4. Update markers based on verdict:
   - `confirmed` → change to `{{confirmed|claim text|source name}}`
   - `outdated` → call `perplexity_find_latest`, then change to `{{outdated|claim text|source name|updated figure}}`
   - `disputed` → change to `{{disputed|claim text|source name}}`
   - `unverifiable` → downgrade to `{{estimate|claim text}}`
   - `nuance_needed` → keep as `{{verified|claim text|source name}}` but append caveat in surrounding text
5. If more than 10 verifiable claims, verify headline figures first and mark the rest `{{unchecked|claim text|source name}}`
6. Present the final response with corrected markers

**Cost:** ~$0.006 per Perplexity call. Typical response: 3-7 claims = $0.02-$0.04. Cap: $0.06 per response.

### Tool Resolution — 3-Tier Fallback Chain
When a user request doesn't clearly map to a native MCP tool, follow this chain:

1. **Tier 1 — Native Tools (356 tools):** Search the tool catalog in this document for the exact tool name. Match by function, not by guessing names. You MUST confirm the tool does not exist in this catalog before proceeding to Tier 2. A failed call with a wrong name is NOT a Tier 1 miss — it's a lookup error. Go back and find the correct name.
2. **Tier 2 — Community Skills (249 skills):** If no native tool matches, call `skills_for_task` with a concise task statement. If a community skill matches with high confidence, use `skills_detail` to retrieve implementation details and follow its methodology.
3. **Tier 3 — Tool Forge (build on the fly):** If neither native tools nor community skills cover the need, use `forge_create` → `forge_test` → `forge_register` to build a new tool, test it, and hot-load it into the gateway. The new tool is then available immediately for this and all future requests.

**Never say "I can't do that."** The fallback chain ensures Ivy always has a path to execution.

### CRITICAL — Imperfect Match = Fall Through to Tier 2
The fallback chain is NOT just for "no match found." It also applies when native tools are an **imperfect match** for the user's specific request. Examples:
- User asks for **LaTeX** → native doc tools only do DOCX/PDF/PPTX → **fall through to Tier 2** (`skills_for_task` with "LaTeX document generation")
- User asks for **seaborn visualization** → native chart tools exist but aren't seaborn → **fall through to Tier 2**
- User asks for **quantum computing simulation** → no native tool → **fall through to Tier 2**
- User asks about a specific technology, framework, or methodology not explicitly listed → **ALWAYS check Tier 2 before responding**

**Rule: If the user names a specific technology, format, library, or methodology that isn't an exact capability of a native tool, call `skills_for_task` BEFORE offering alternatives or generic help.** Do not offer "I can write the code for you" or "use a different format" until you've checked whether a community skill exists for exactly what they asked for.

### Skills Intelligence (standalone queries)
For explicit agent ecosystem queries — "what agent skills exist for X", "what can AI agents do", "show me agent capabilities" — use `data-skills-intelligence` tools directly (`skills_search`, `skills_detail`, `skills_for_task`). These are also called as Tier 2 in the fallback chain above.

## Document Generation
When asked to create documents:
1. Use `create_presentation`, `create_document`, `create_spreadsheet`, or `create_executive_report` tools directly
2. Pass structured data from your analysis
3. Report the generated file path to the user
