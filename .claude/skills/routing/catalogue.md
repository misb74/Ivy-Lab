# Routing — MCP Tool Catalogue

> **This is a reference document, loaded on-demand by the routing skill.** The `routing/SKILL.md` skill instructs the agent to Read this file when it needs to pick an MCP tool. Keeping it out of `SKILL.md` keeps every conversation's context lean.

## Available MCP Tools

### HR Skills Intelligence
- `skills_extract` — Extract skills from any text using Lightcast AI
- `skills_match` — Compare skills between roles using O*NET
- `skills_trending` — Get trending skills from job postings
- `skills_adjacent` — Find related/adjacent skills
- `compare_skill_profiles` — Compare skill profiles between texts
- `resume_skill_extract` — Extract skills from resumes
- `linkedin_skill_extract` — Extract skills from LinkedIn profiles

### Workforce Planning
- `workforce_supply` — Analyze talent supply for an occupation
- `workforce_demand` — Analyze job market demand
- `workforce_gap_analysis` — Supply vs demand gap analysis
- `workforce_benchmark` — Benchmark workforce metrics across locations
- `workforce_compare` — Compare two occupations
- `headcount_forecast` — Forecast headcount needs
- `compensation_benchmark` — Get compensation data from BLS
- `attrition_risk` — Assess attrition risk factors
- `succession_planning` — Plan succession for roles
- `talent_flow` — Analyze talent movement patterns
- `team_skills_matrix` — Build team skills assessment matrix

### Role Design & Career Paths
- `role_design` — Design a new role with tasks and requirements
- `role_decompose` — Break role into O*NET tasks
- `role_split` — Split one role into two
- `role_merge` — Merge two roles
- `career_path` — Generate career transition path
- `career_ladder` — Build career progression ladder
- `job_benchmark` — Benchmark a job against market
- `job_comparison` — Compare two jobs side-by-side
- `job_family_map` — Map job families in a department
- `level_calibration` — Calibrate job levels
- `jd_generate` — Generate a job description
- `jd_analyze` — Analyze a job description for skills and requirements
- `task_decomposition` — Decompose role into detailed tasks

### Compliance & Bias Detection
- `compliance_check` — Check for compliance issues
- `compliance_report` — Generate compliance report
- `adverse_impact_monitor` — Monitor for adverse impact (4/5ths rule)
- `pay_equity_audit` — Audit pay equity
- `pay_equity_methodology` — Explain pay equity methods
- `jd_bias_scan` — Scan job descriptions for biased language
- `audit_trail_query` — Query the audit trail
- `bias_detector` — Detect bias in selection criteria

### Automation & AI Impact
- `automation_assess` — Assess automation potential of a role
- `automation_gap` — Identify automation gaps
- `transformation_model` — Model workforce transformation scenarios
- `process_map` — Map processes for automation opportunities
- `human_edge` — Assess human advantage for tasks (WORKBank)

### Recruitment Intelligence
- `candidate_match` — Match candidate skills to role requirements
- `competitor_hiring` — Analyze competitor hiring patterns (Adzuna)
- `search_competitor_jobs` — Search competitor job listings
- `careers_visual_scanner` — Scan company careers pages
- `onboarding_plan_generator` — Generate onboarding plans
- `org_chart_parser` — Parse organizational chart data
- `raci_matrix` — Generate RACI responsibility matrix

### Document Generation
- `create_presentation` — Generate PowerPoint (.pptx)
- `create_document` — Generate Word document (.docx)
- `create_spreadsheet` — Generate Excel (.xlsx)
- `create_pdf` — Generate PDF document
- `create_executive_report` — Generate formatted executive report (.docx)
- `create_visualization` — Generate interactive HTML visualization using Observable Plot. Supports flexible `chart_type` (bar, line, dot, area, cell, text, rule, heatmap) with custom x/y/color/size channels, or legacy `dashboard_type` for backward compat
- `create_cloned_report` — Generate a styled Word document replicating an original report's structure with fresh data. Supports rich inline formatting, styled tables with cell merging/row types/alternating shading, callout boxes, page breaks, TOC, headers/footers with page numbers, and a style profile to match the original
- `render_mermaid` — Render Mermaid diagram syntax to PNG (flowchart, sequence, class, state, ER, Gantt, pie, mindmap, timeline, org chart). Themes: default, dark, forest, neutral
- `render_chart_png` — Render Observable Plot chart spec to 2x retina PNG (bar, line, dot, area, cell, heatmap). Same PlotSpec as `create_visualization` but outputs PNG instead of HTML
- `render_graph_png` — Render D3 force-directed graph (nodes + edges) to PNG with colored node types and legend. Works with knowledge graph data from `kg_visualize`

### Report Cloner
- `clone_create` — Create a report cloning job (registers original PDF + data source Excel files, returns job_id)
- `clone_status` — Check clone job progress (stage, what's completed, what's pending)
- `ingest_pdf` — Extract text, headings, and tables from a PDF report (pdf-parse + pdfplumber)
- `profile_excel` — Profile an Excel file's structure, columns, data types, statistics, and quality flags
- `compute_metrics` — Execute data computations from a DataPlan (count, sum, mean, filter, group_aggregate, derived)
- `save_blueprint` — Persist a validated ReportBlueprint to the clone job
- `save_dataplan` — Persist a validated DataPlan to the clone job

### Memory Agent
- `memory_store` — Store a memory with content, type, tags, and importance (0-10)
- `memory_recall` — Semantic search via dense vector embeddings (all-MiniLM-L6-v2) with relevance decay
- `memory_search` — Filter memories by keyword, tags, type, date range
- `memory_list_recent` — List the most recent N memories
- `memory_forget` — Delete a memory by ID
- `memory_summarize` — Aggregate knowledge on a topic

### Browser Agent
- `browse_and_extract` — Navigate to URL, extract text/headings/links/metadata
- `fill_and_submit_form` — Fill form fields and submit (blocks passwords & payments)
- `monitor_page` — Poll a page for changes at intervals
- `multi_step_browse` — Execute ordered sequence of browser actions
- `screenshot_and_analyze` — Screenshot + structural page analysis

### Research Agent
- `research_start` — Start async deep research (returns task ID for polling)
- `research_status` — Check research progress
- `research_results` — Get completed research report
- `quick_research` — Synchronous single-pass research (<30s)
- `scholarly_search` — Search academic papers via Semantic Scholar (titles, authors, abstracts, citations, DOIs)

### Code & Deploy Agent
- `scaffold_project` — Create project from template (react-app, api-server, static-site, python-script)
- `deploy_local` — Start dev server, return localhost URL
- `deploy_ngrok` — Expose local port via ngrok tunnel
- `stop_deployment` — Kill a running deployment
- `list_deployments` — List active deployments with URLs
- `create_github_repo` — Init repo + push via gh CLI
- `run_command` — Sandboxed shell command in project directory

### Delegation Agent
- `create_workflow` — Define multi-step workflow with tool calls and dependencies
- `run_workflow` — Generate execution plan (step order, parallel groups)
- `workflow_status` — Check workflow execution progress
- `list_workflows` — List saved workflow templates
- `save_workflow` — Save workflow to persistent storage

### Email Agent
- `send_email` — Send email via SMTP (to, subject, body, cc, bcc, html support)
- `send_templated_email` — Render an Ivy-branded email from a template and send it. Templates: talent-research, competitor-intel, swp-analysis, weekly-digest, **insight-report**. For insight-report, pass the full artifact JSON as `variables.artifact`. Accepts template-specific variables and supports preview_only mode and attachment_paths
- `read_email` — Read emails from IMAP (folder, limit, unread_only filters)
- `search_email` — Search emails by query (subject, from, body text)

**Email Artifact Workflow — MANDATORY when user says "email this", "send this to X", "email the report" and an artifact exists in the conversation.**

**CRITICAL: You MUST actually call `send_templated_email` below. Do NOT skip the tool call. Do NOT say you sent it without calling the tool. The user will not receive the email unless you execute the tool call.**

1. Retrieve the insight artifact JSON from the conversation context (it was just generated/displayed)
2. Build the variables object and call the tool:
```
send_templated_email(
  to: "<recipient email>",
  template: "insight-report",
  variables: {
    recipientName: "<name or email prefix>",
    jobType: "insight-report",
    submittedAt: "<ISO 8601 now>",
    completedAt: "<ISO 8601 now>",
    durationMinutes: 0,
    artifact: {
      type: "insight",
      title: "<artifact title>",
      pillLabel: "<artifact pillLabel>",
      subtitle: "<artifact subtitle>",
      dataSources: "<artifact dataSources>",
      sections: [<copy the full sections array from the artifact>]
    },
    ivysTake: "<brief 1-2 sentence summary>"
  }
)
```
3. If `send_templated_email` fails or is unavailable, fall back to `send_email` with `html: true` and compose the body as formatted HTML including the key metrics, findings, and recommendations from the artifact.
4. Confirm to user with the messageId from the tool result.

**If no artifact exists** but user says "email this", use `send_email` with `html: true` and compose an HTML summary of the conversation content. NEVER skip the tool call.

### HTTP Agent
- `http_request` — Generic HTTP client (GET/POST/PUT/PATCH/DELETE with headers, body, form_data)

### Data Analysis Agent
- `analyze_data` — Full data analysis: profiling, visualization, and insights from CSV/Excel/JSON files
- `profile_dataset` — Quick statistical profile of a dataset (shape, types, stats, missing values)

### Skills Intelligence (AI Agent Ecosystem)
- `skills_search` — Search 249 community AI agent skills by keyword (FTS5) and/or category. With no params returns taxonomy summary (19 categories with counts)
- `skills_detail` — Get full content of a specific skill by name or ID (install instructions, code examples, methodology)
- `skills_for_task` — Find agent skills that can automate a given task statement. The key bridge between automation assessment and real agent capabilities. Returns ranked matches with descriptions

### Data Connectors (lower-level)
- `lightcast_search_skills`, `lightcast_extract_skills`, `lightcast_trending_skills`, `lightcast_demand_forecast`
- `onet_search_occupations`, `onet_get_occupation`, `onet_get_occupation_details`, `onet_career_changers`, `onet_career_path`, `onet_browse_occupations`
- `bls_occupation_wages`, `bls_wage_comparison`, `bls_employment_trend`
- `workbank_occupation_automation`, `workbank_gap_analysis`, `workbank_human_edge`
- `adzuna_search_jobs`, `adzuna_salary_data`
- `eurostat_employment_data`, `eurostat_wages`, `eurostat_compare_countries`
- `esco_search_occupations`, `esco_get_occupation`, `esco_search_skills`, `esco_skill_to_occupation`
- `aioe_occupation_exposure`, `aioe_industry_exposure`, `aioe_geographic_exposure`
- `aei_task_penetration`, `aei_job_exposure`, `aei_task_collaboration`, `aei_task_autonomy`, `aei_geographic_usage`
- `fred_get_series`, `fred_search_series`, `fred_labor_dashboard`
- `ilostat_get_indicator`, `ilostat_search_indicators`, `ilostat_country_comparison`
- `indeed_job_postings_trend`, `indeed_wage_tracker`, `indeed_remote_work_trend`
- `labor_market_job_postings`, `labor_market_wages`, `labor_market_ai_demand`, `labor_market_remote`, `labor_market_pay_transparency`, `labor_market_academic`
- `research_index_search`, `research_index_ingest`, `research_index_institutions`, `research_index_stats`
- `jobhop_transition_probability`, `jobhop_career_paths`, `jobhop_occupation_tenure`
- `nlrb_election_search`, `nlrb_industry_trends`, `nlrb_union_density`
- `onet_green_occupations`, `onet_green_skills`
- `revelio_labor_stats`, `revelio_hiring_trends`
- `uk_paygap_search`, `uk_paygap_get_employer`, `uk_paygap_sector_analysis`

### Anthropic Economic Index (AEI)
- `aei_task_penetration` — AI penetration rate per O*NET task (actual Claude usage data)
- `aei_job_exposure` — AI exposure per occupation (empirical, complements Felten AIOE)
- `aei_task_collaboration` — Human-AI collaboration patterns per task
- `aei_task_autonomy` — AI autonomy level and time savings per task
- `aei_geographic_usage` — AI usage patterns by country/region

### Talent Sourcer Agent
- `talent_search_profiles` — Search for real people profiles via Apollo.io + People Data Labs. Returns verified profiles with LinkedIn URLs
- `talent_enrich_profile` — Enrich a candidate with email, phone, full career history. 1 API credit per call — use for top candidates only
- `talent_search_similar` — Find people similar to a reference profile to expand candidate lists

### Talent Researcher Agent
- `talent_batch_create` — Create research batch from inline roles (preferred) or CSV path. Accepts optional `email_to` and `recipient_name` for email delivery on completion (returns batch_id). Pass `roles` as a JSON array — no file creation needed.
- `talent_batch_status` — Show formatted CLI progress table with status, candidate counts, and progress bars
- `talent_role_next` — Get next unresearched role with 3 tailored research prompts AND structured `search_params` for API-driven sourcing
- `talent_role_submit` — Submit structured research results (candidates, market data, certs, approach strategies). EVERY candidate MUST have a `source_url`
- `talent_role_export` — Generate professional 4-tab xlsx workbook for a role (includes Profile Link hyperlink column)
- `talent_batch_export` — Generate summary dashboard xlsx with batch overview, candidate overlap, and quality scores
- `talent_batch_deliver` — Build email template variables from completed batch data. Returns TalentResearchVars ready for `send_templated_email`

**Talent Research Workflow — YOU MUST DRIVE EVERY STEP (do not stop after batch creation):**

**Step 0 — Source choice (ALWAYS ASK FIRST, before any tool call):** Ask the user inline:
> "Use **PDL** (fast, flat profiles via people-search APIs) or **web search** (slower, full bios + recruiter notes via deep-research / multi-search)?"
Wait for the answer. Do NOT check API keys, do NOT scan the codebase, do NOT propose alternatives — just ask. Two branches follow:

---
**PDL branch** (existing path — fast, structured):
1. Call `talent_batch_create` with `roles` array (inline JSON — do NOT create CSV files, do NOT use Google Drive, do NOT use `run_command` to write files). Include `email_to` + `recipient_name` if user wants email delivery. Only use `csv_path` if the user explicitly provides a CSV file path.
2. Call `talent_role_next` → returns `role_id`, `search_params` (primary + secondary), and `research_prompts`.
3. Call `talent_search_profiles` with `search_params.primary` parameters (job_titles, locations, seniority_levels, industries, company_sizes, max_results).
4. If fewer than 15 profiles returned, call `talent_search_profiles` again with `search_params.secondary` (broader titles/seniority).
5. (Optional) For top 3–5 candidates, call `talent_enrich_profile` with their LinkedIn URLs for deeper data.
6. (Optional) Run ONE `research_start` with the `certifications` research prompt for regulatory/cert web research that APIs don't cover.
7. Compile API results + enrichment + optional web research into structured format. Call `talent_role_submit` with the `role_id`. EVERY candidate MUST have a `source_url` — candidates without verified source URLs will be REJECTED.
8. Call `talent_role_export` to generate the xlsx workbook for this role.
9. Call `talent_batch_status` to check progress. If roles remain, go back to step 2.
10. When all roles complete: `talent_batch_export` for summary dashboard.
11. If `email_to` was set: call `talent_batch_deliver` → pass returned `variables` to `send_templated_email` with `template: "talent-research"`, `to: result.email_to`, and `attachment_paths: result.output_files` (the xlsx workbook paths from the batch).

---
**Web search branch** (deeper bios + recruiter-notes synthesis, no people-search API):
1. Call `talent_batch_create` with `roles` array (same as PDL branch — provides the brief structure and xlsx scaffolding).
2. Call `talent_role_next` → returns `role_id`, `search_params`, and `research_prompts`.
3. **Skip `talent_search_profiles`.** Instead, drive web research directly:
   a. Call `multi_search(query, source_group: "talent")` keyed off `search_params.primary` (titles + industries + location). Execute the returned actions in PARALLEL. Feed results back via `multi_search_merge` for ranking.
   b. Run several parallel `WebSearch` calls covering: top employers in the brief's industry by market cap, recent transitions/successions/retirements (last 18 months), GC/leader powerlists relevant to the role, per-company current-incumbent lookups, specialty/regulatory/litigation specifics, education + bar admissions, openness signals.
   c. Aggregate ~30-50 candidate names with corroborating public source URLs. Every candidate MUST have a `source_url` (press release, leadership page, news article, SEC filing, conference bio, or powerlist coverage).
4. LLM-synthesize the aggregated findings into the talent_role_submit schema: rank by openness + fit, write Recruiter Notes per candidate, fill in Regulatory/Specialty Experience / Key Previous Roles / Education / Thought Leadership / Openness (1-5) / Openness Signals from the public info gathered. Flag candidates with thin public info as DILIGENCE-REQUIRED in Recruiter Notes rather than fabricating.
5. Call `talent_role_submit` with the synthesized payload.
6. Call `talent_role_export` to generate the xlsx workbook (same 4-tab format).
7. Continue with steps 9-11 from the PDL branch (status, batch_export, deliver/email).

**Reference run:** the May 2026 Pharma General Counsel + Litigation Experience batch was produced via the web-search branch — full output at `outputs/talent-research/20260509_general_counsel_pharma_DEEPRESEARCH/` with rendered pipeline diagram. Use as a quality bar.

---
**CRITICAL: Do not stop after creating the batch. You must execute the remaining steps yourself. Do not describe what "will happen" — make it happen. Do not narrate your process — just do the work.**

### Tool Forge (Self-Evolving Agent)
- `forge_create` — Generate a new MCP server from a spec (name, tools with params + implementation), write to disk, install deps, register as draft
- `forge_test` — Spawn forged server in sandbox, discover tools via MCP protocol, run test cases (15s startup, 30s/test, 60s suite)
- `forge_register` — Hot-load a tested forged server into the gateway. Tools available on next message
- `forge_list` — List all forged servers with status, tools, and test results
- `forge_disable` — Disconnect an active forged server from the gateway
- `forge_enable` — Reconnect a disabled forged server

**Forge Workflow:**
1. `forge_create` with server spec → generates code + installs deps → status: draft
2. `forge_test` with test cases → sandbox validation → status: draft (if passed) or failed
3. `forge_register` → hot-loads into gateway → status: active → tools available immediately
4. Forged servers persist across gateway restarts (auto-loaded from SQLite registry)

### Swarm Orchestration
- `swarm_create` — Create a multi-agent swarm with objective and auto-decomposed sub-tasks
- `swarm_status` — Get swarm progress, task states, and dependency graph
- `swarm_delegate` — Assign a specific task to an agent
- `swarm_synthesize` — Synthesize results from all completed sub-tasks into unified output
- `swarm_cancel` — Cancel a swarm and all pending tasks

### Market Monitoring
- `monitor_create` — Create a market monitor (salary, demand, skills, jobs) with thresholds
- `monitor_list` — List all active monitors with latest snapshot data
- `monitor_check` — Run an immediate check on a monitor, capture snapshot, generate alerts
- `monitor_history` — Get historical snapshots and delta trends for a monitor
- `monitor_delete` — Delete a monitor and its history

### Knowledge Graph
- `kg_entity_create` — Create an entity node (person, role, skill, department, org)
- `kg_entity_search` — Search entities by name pattern, type, or properties
- `kg_relation_create` — Create a typed relation between two entities
- `kg_query` — Traverse the graph with BFS/DFS from a starting entity
- `kg_visualize` — Get D3.js-compatible graph data (nodes + edges) for visualization
- `kg_merge` — Merge duplicate entities, redirecting all relations

### External Connectors
- `connector_register` — Register an external system (HRIS, ATS, LMS, ERP) with auth config
- `connector_list` — List all registered connectors with status and sync info
- `connector_test` — Test connectivity to an external system
- `connector_sync` — Trigger data pull from an external system
- `connector_query` — Query previously synced data with filters
- `connector_list_profiles` — List pre-built connector profiles for ATS (Greenhouse, Lever, Ashby, iCIMS, SmartRecruiters, Bullhorn), HRIS (BambooHR, HiBob, Workday, Personio), and CRM (Salesforce, HubSpot, Zoho)
- `connector_create_from_profile` — Create a connector from a pre-built profile by providing platform credentials

### Transcription Agent
- `transcribe` — Transcribe audio/video file offline using whisper.cpp (supports .wav, .mp3, .mp4, .mkv, .webm, .mov, .avi)
- `transcribe_summary` — Transcribe + generate extractive text summary (no external API calls)
- `transcript_list` — List stored transcriptions with pagination
- `transcript_get` — Retrieve stored transcript by ID

### Universal Export
- `export_artifact` — Export an artifact to PDF, PPTX, or XLSX format
- `export_batch` — Batch export multiple artifacts
- `export_embed_code` — Generate embeddable HTML iframe code for an artifact
- `export_list` — List all generated exports with download links

### Google Drive
- `createTextFile` — Create text/markdown files on Google Drive
- `createFolder` — Create folders on Google Drive
- `search` — Search files across Google Drive
- `listFolder` — List contents of a Drive folder
- `copyFile` — Copy/upload files to Google Drive
- `moveItem` — Move files between folders
- `deleteItem` — Trash files (reversible)
- `shareFile` — Share files with users
- `addPermission` / `updatePermission` / `removePermission` — Manage access

### Predictive Analytics
- `predict_attrition` — Predict attrition risk using multi-factor model
- `predict_salary_trend` — Forecast salary trends using linear regression and exponential smoothing
- `predict_skills_demand` — Project future skills demand based on historical trends
- `predict_headcount` — Forecast headcount needs based on growth, attrition, and hiring rates
- `scenario_simulate` — Run Monte Carlo simulation on workforce scenarios (1000+ iterations)

### Talent Marketplace
- `talent_match_internal` — Match internal candidates to open roles using weighted cosine similarity
- `talent_mobility_score` — Calculate mobility score (skill overlap 40%, growth 20%, performance 20%, aspiration 20%)
- `talent_development_plan` — Generate phased development plan for role transitions
- `talent_bench_strength` — Analyze succession pipeline: ready now, 6mo, 12mo categories

### Notifications
- `notify_send` — Send immediate notification via email, Slack, or Teams
- `notify_schedule` — Schedule recurring notifications with cron expression
- `notify_list` — List sent/scheduled notifications with status
- `notify_preferences` — Get or set user notification channel preferences

