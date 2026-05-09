---
name: report-cloner
description: Report Cloner — Orchestration Skill. Use when the user wants to clone, replicate, or update an existing board/executive report, ingest a PDF report as a template, generate a new version of a report from fresh data, or reference report-cloner tools (clone_create, ingest_pdf, clone_status).
---

# Report Cloner — Orchestration Skill

Clone an existing board report by ingesting the original PDF, mapping fresh HRIS data, analyzing metrics, and generating an updated report that is structurally and stylistically indistinguishable from the original.

## Detection Triggers

Activate this skill when the user:
- Says "clone a report", "replicate this board report", "generate a report from this template"
- Uploads or references a PDF report together with Excel/CSV data files
- Asks to "update this report with new data" or "create the next version of this report"
- References the report-cloner tools by name

## Architecture

**4-stage pipeline** — Reader → Plumber → Analyst → Writer

Claude IS the intelligence layer. MCP tools handle PDF parsing, Excel profiling, metric computation, and DOCX generation. Claude does blueprint extraction (voice + structure analysis), data mapping decisions, analytical interpretation, and prose generation.

**Tools used:**
- `report-cloner` server: `clone_create`, `clone_status`, `ingest_pdf`, `profile_excel`, `compute_metrics`, `save_blueprint`, `save_dataplan`
- `doc-generator` server: `create_cloned_report`

## Stage 1 — Reader (Blueprint Extraction)

### Steps
1. Call `clone_create` with the job name, PDF path, Excel paths, and reporting period
2. Call `ingest_pdf` with the job_id and PDF path
3. Perform 3-pass analysis on the extraction output:
   - **Pass 1 — Structure**: Identify sections, heading hierarchy, page ranges, content types (narrative vs data-heavy vs mixed)
   - **Pass 2 — Voice**: Profile tone, register, hedging patterns, number formatting, characteristic phrases, sentence structure, attribution style, tense preference
   - **Pass 3 — Data Requirements**: For each section, identify every metric, table, trend, and breakdown that needs to be populated with fresh data
4. Assemble the `ReportBlueprint` JSON (source_document, document_profile, voice_profile, sections[], editorial_conventions, visual_grammar)
5. **CHECKPOINT 1** — Present to user:
   - Section structure table (section title, page range, content type, data requirement count)
   - Voice profile highlights (tone, hedging style, characteristic phrases)
   - Total data requirements count
   - Ask: "Does this blueprint accurately capture the original report's structure and voice?"
6. After user validates, call `save_blueprint`

## Stage 2 — Plumber (Data Mapping)

### Steps
1. Call `profile_excel` for each data source file
2. Map each blueprint data requirement to Excel columns using 3-tier matching:
   - **Tier 1 — Exact**: Column name matches requirement label exactly or closely
   - **Tier 2 — Semantic**: Column meaning matches (e.g. "Termination Date" maps to "Attrition" metric)
   - **Tier 3 — Derived**: Metric can be computed from multiple columns (e.g. attrition rate = leavers / headcount)
3. Identify gaps — requirements that cannot be mapped to any available data
4. Assemble the `DataPlan` JSON (reporting_period, comparator_periods, sources[], mappings[], derivations[], gaps[])
5. **CHECKPOINT 2** — Present to user:
   - Mapping table (requirement → source column → confidence tier)
   - Gaps with resolution options (user provides value, derive from other data, omit from report)
   - Data quality warnings from profiling
   - Ask: "Please review the mappings and resolve any gaps."
6. After user resolves gaps, call `save_dataplan`

## Stage 3 — Analyst (Data Interpretation)

### Steps
1. Build computation specs from the DataPlan mappings and derivations
2. Call `compute_metrics` with all computation specs (batch them by source file)
3. For each section in the blueprint, produce an `AnalyticalBrief`:
   - Compute headline metric with direction and vs-prior comparison
   - Format all metrics per editorial conventions (rounding rules, number formatting)
   - Build any tables required by the section
   - Identify key findings, risk flags, and positive signals
   - Generate narrative guidance (key story, callouts, recommended emphasis, comparisons to make)
   - Note any data quality issues
4. **CHECKPOINT 3** — Present to user:
   - Per-section summary: headline metric, direction, key story framing
   - Callout plan (what gets flagged as positive/negative/neutral)
   - Any data quality warnings that affect interpretation
   - Ask: "Does this analytical framing look right? Any metrics to reinterpret?"

## Stage 4 — Writer (Report Generation)

### Steps
1. For each section (in document order, exec summary LAST):
   - Apply the voice profile: match tone, hedging style, characteristic phrases, sentence structure
   - Write narrative prose using the AnalyticalBrief's narrative guidance
   - Format metrics per editorial conventions
   - Build rich paragraphs with inline formatting (bold key numbers, use accent colors for callouts)
   - Build styled tables matching the original's visual grammar
2. Write the executive summary last — it synthesizes all sections
3. Perform consistency check:
   - Numbers cited in narrative match table values
   - Comparisons are directionally consistent
   - Characteristic phrases from voice profile are used naturally (not forced)
4. Call `create_cloned_report` with:
   - `title`, `subtitle`, `audience` from the blueprint
   - `style_profile` from the blueprint's visual_grammar
   - `include_toc: true` for a Table of Contents with page break
   - `header_text` and `footer_text` for page headers/footers (footer auto-includes "Page X of Y")
   - `sections[]` with rich_content, styled_tables, and:
     - `page_break_before: true` on each major section for proper pagination
     - `callout` boxes for key findings (accent bar + background shading)
     - Styled tables with `alternate_row_shading`, `border_style`, `row_type` (subtotal/total), cell `merge_right`/`merge_down`, and per-cell `alignment`
   - `output_dir` for the job's output location
5. **CHECKPOINT 4** — Present to user:
   - Output file path
   - Fidelity notes (any sections where data was sparse, voice approximations, omitted requirements)
   - Ask: "Here's the generated report. Would you like me to revise any sections?"

## Key Rules

- **Never fabricate data.** Every number in the report must come from `compute_metrics` results or user-provided values.
- **Voice fidelity over content fidelity.** If data is missing, note the gap in Ivy's natural voice rather than inventing numbers.
- **All 4 checkpoints are mandatory.** Never skip user validation between stages.
- **Exec summary always last.** It depends on all other sections being finalized.
- **Respect editorial conventions.** Use the blueprint's callout thresholds, rounding rules, and comparison styles consistently.
- **Section ordering must match the original.** The cloned report's sections appear in the same order as the blueprint.

## Error Handling

- If PDF extraction quality is "poor": warn user, suggest they provide a higher-quality PDF or a text version
- If Excel profiling finds >50% nulls in a key column: flag as data quality concern in checkpoint 2
- If compute_metrics returns errors: show the specific computation that failed, suggest alternative approaches
- If a section has zero mapped data requirements: produce it as narrative-only, note the gap
