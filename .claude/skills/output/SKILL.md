---
name: output
description: Unified output routing for all document generation — reports (HTML/DOCX), exports (PDF/PPTX/XLSX), presentations, spreadsheets, report cloning, artifact-to-HTML conversion, and embed code. Single decision tree replaces executive-report, agent-export, report-cloner, and doc-generator routing.
---

# Output Skill — Unified Document & Export Routing

Single entry point for all output requests: reports, exports, presentations, documents, spreadsheets, clones, and embeds.

## §1 — Decision Tree (MANDATORY — follow this first)

**First question: Do we already have an artifact?**

### Branch A — Artifact exists

Route by the user's requested output format:

| User intent | Route |
|---|---|
| HTML report / "print this" / "write this up" / "convert to report" | → **Sub-flow C** (Artifact-to-HTML Conversion) |
| PDF / PPTX / XLSX export | → `export_artifact` (agent-export) |
| Embed link / embed code | → `export_embed_code` (agent-export) |

### Branch B — No artifact (creating new output)

**Is this a clone from an existing report template?**
- Yes (PDF + data files, "clone this report", "replicate", "update this report") → `load_skill("report-cloner")` — follow the report-cloner skill's 4-stage pipeline

**What format does the user want?**

| User intent | Route |
|---|---|
| Report / briefing / white paper / analysis document | → Ask **HTML or DOCX** (mandatory unless user already stated preference) |
| → HTML | → **Sub-flow A** (New HTML Report) |
| → DOCX | → **Sub-flow B** (New DOCX Report) |
| Presentation / slides / slide deck | → **Sub-flow D** (Presentations) |
| Spreadsheet / Excel | → **Sub-flow E** — `create_spreadsheet` |
| Word document | → **Sub-flow E** — `create_document` |
| PDF document | → **Sub-flow E** — `create_pdf` |

---

## §2 — Sub-flow A: New HTML Report

Produce a richly formatted, self-contained HTML report at executive quality.

### Research Protocol — MANDATORY BEFORE WRITING

Executive reports require substantive, cited content. Before writing any HTML:

1. **Scope the research** — Identify 4-8 research questions that the report must answer
2. **Run parallel web searches** — Use `quick_research` or `research_start` for each question. Run searches in parallel where possible. Aim for 8-15 distinct searches covering different angles
3. **Cross-reference sources** — For key claims, verify across at least 2 independent sources
4. **Extract specific data** — Numbers, percentages, dates, company names, dollar amounts. Generic statements ("many companies are...") are unacceptable
5. **Build a source list** — Track every source with title, publisher, and date. Minimum 15 sources for a full report
6. **Use MCP data tools** — Where relevant, supplement web research with MCP tools (BLS wages, Lightcast skills, O*NET occupations, etc.)

**Research depth must match the topic complexity.** A compensation benchmarking report needs proxy statement data from 10+ companies. An AI impact report needs academic papers, vendor announcements, and market sizing data.

7. **Apply Fact Integrity Protocol** — Every statistic must be classified as EMPIRICAL (observed), PRESCRIPTIVE (recommended), EXPECTATION (intended), or PROJECTION (forecast). Never present prescriptive or expectation data as empirical. Specify geography, population, and time period for every figure. Seek independent corroboration for headline claims. Check for superseded statistics. Flag say-do gaps for covered entities. See the full protocol in the deep-research skill.

#### Adversarial Verification (post-Perplexity)

After the standard Perplexity verification pass, run the adversarial checks:

**Step A — Internal Consistency Check:**
1. Extract all claims from the report with structured metadata:
   - `id`: sequential identifier
   - `text`: the claim as written
   - `metric_value`: the numeric value (if any)
   - `metric_subject`: what is being measured
   - `direction`: "has" (population possesses/does X) or "lacks" (population does not) or "neutral"
   - `population`: who is being measured
   - `source`: source attribution
2. Call `check_internal_consistency` with all claims
3. For any contradictions with severity "critical": resolve before publication — either reconcile with qualifying language or remove one claim
4. For "warning" contradictions: add contextual notes explaining the apparent discrepancy

**Step B — Deep Adversarial Review (headline claims only):**
For each headline statistic (typically 4-8 per report) plus any claim flagged `nuance_needed` by Perplexity:
1. Call `perplexity_adversarial_review` with relevant checks:
   - `directional_framing`: for any claim citing a percentage or proportion
   - `source_primacy`: for claims citing unfamiliar or non-institutional sources
   - `attribution`: for any direct quotes attributed to named individuals
   - `scope_match`: for claims where the source may measure something different from how it's used
2. For `inverted` framing (passed=false, note mentions "invert"): fix immediately — this is a factual error
3. For `derivative_commentary` sources (passed=false, note mentions "derivative"): add hedging language ("approximately", "estimated", "aggregated from")
4. For departed attributions (passed=false): change title to "Former [Title]"
5. For scope mismatches (passed=false, note mentions "broader" or "different"): add qualifying language about what the source actually measures

**Estimated additional cost:** ~$0.03–$0.05 per report (4-8 additional Sonar calls)

### Ivy Design System (v4)

Every executive HTML report uses the **Ivy v4 design system** — the production CSS/JS from `gateway/src/v4-html/`. This is non-negotiable.

**Reference report:** `outputs/deep-research/agent-factory-work-transformation.html` — match this format exactly.

#### Source Files

| File | What | Size |
|------|------|------|
| `gateway/src/v4-html/css.ts` | Full CSS (design tokens, animations, all components) | ~1,666 lines |
| `gateway/src/v4-html/js.ts` | IntersectionObserver reveal, count-up, sticky mini-TOC, print handler | ~140 lines |

Copy the **entire** `V4_CSS` export into `<style>` and the **entire** `V4_JS` export into `<script>` before `</body>`. Also add to `<style>`:

```css
/* Rose scale for chart segments */
.seg.rose1  { background: linear-gradient(90deg, #be123c, #e11d48); }
.seg.rose2  { background: linear-gradient(90deg, #e11d48, #f43f5e); }
.seg.rose3  { background: linear-gradient(90deg, #f43f5e, #fb7185); }
.seg.rose4  { background: linear-gradient(90deg, #fb7185, #fda4af); }
.seg.rose5  { background: linear-gradient(90deg, #fda4af, #fecdd3); }
.seg.slate1 { background: linear-gradient(90deg, #334155, #475569); }
.seg.slate2 { background: linear-gradient(90deg, #475569, #64748b); }
.seg.slate3 { background: linear-gradient(90deg, #64748b, #94a3b8); }
```

#### Ivy Logo SVG

Use this in `.cover-logo` (28x28) and `.footer-logo` (14x14, stroke-width 5):

```html
<svg viewBox="0 0 64 64" fill="none" width="28" height="28"><g stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 44C8 48 8 54 12 58C18 62 30 62 40 60C48 58 54 50 54 42L54 28"/><ellipse cx="20" cy="36" rx="8" ry="9"/><path d="M32 28C31 20 31 14 32 8"/><path d="M40 25C40 17 40 11 41 6"/><path d="M48 28C48 20 49 14 50 10"/></g></svg>
```

#### Document Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>[Report Title]</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
/* === PASTE FULL V4_CSS FROM css.ts + rose/slate seg classes above === */
</style>
</head>
<body>

<!-- Sticky Mini-TOC -->
<nav class="mini-toc" id="miniToc">
  <a data-section="s01"><span class="toc-pip"></span><span class="toc-label">Executive Summary</span></a>
  <!-- repeat for each section -->
</nav>

<!-- Cover -->
<section class="cover" id="cover">
  <div class="cover-glow"></div>
  <div class="cover-header">
    <div class="cover-logo">[Ivy leaf SVG 28x28]</div>
    <div class="cover-badge">EXECUTIVE REPORT</div>
  </div>
  <h1>[Title]: <em>[Emphasis clause]</em> Rest of Title</h1>
  <h2>[Subtitle / Audience]</h2>
  <div class="cover-line"></div>
  <div class="cover-meta">[Month Year] &middot; Prepared by Ivy Intelligence</div>
  <div class="cover-sources">Sources: [Key source names separated by &middot;]</div>
</section>

<!-- Metrics Strip (auto-coloured: 1st=rose, 2nd=slate, 3rd=green, 4th=gold) -->
<div class="metrics-strip">
  <div class="metric-card io-child d1">
    <div class="metric-label">[Label]</div>
    <div class="metric-value-row">
      <div class="metric-val"><span class="count-up" data-target="87">0</span>%</div>
      <span class="metric-delta up">[+delta]</span>
    </div>
    <div class="metric-sub">[Source attribution]</div>
  </div>
  <!-- repeat 4 cards total -->
</div>

<!-- Body Sections (wrap each in io-section for scroll reveal) -->
<div class="page">
  <section class="io-section" id="s01">
    <div class="section-header io-child d1">
      <div class="section-number">Section 01</div>
      <h2>[Section Title]</h2>
      <p>[Section subtitle]</p>
    </div>
    <div class="io-child d2">
      <p>[Prose content]</p>
    </div>
    <!-- Components: callouts, tables, charts, styled-lists, rec-cards -->
  </section>
  <div class="gradient-divider"></div>
  <!-- Next section... -->
</div>

<!-- Verification Note (before sources) -->
<div style="margin-top:32px;padding:20px 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;border-left:3px solid #059669">
  <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#059669;margin-bottom:8px">Verification Note</div>
  <div style="font-size:12px;color:#475569;line-height:1.7">All statistics verified via Perplexity Sonar API against primary sources.</div>
</div>

<!-- Footer -->
<div class="ivy-footer">
  <div class="footer-brand">
    <div class="footer-logo">[Ivy leaf SVG 14x14, stroke-width 5]</div>
    <div class="footer-text"><strong>Powered by Ivy</strong> &middot; WorkVine.ai</div>
  </div>
  <div class="footer-page">Confidential</div>
</div>

<script>/* === PASTE FULL V4_JS FROM js.ts === */</script>
</body>
</html>
```

#### Key Component Patterns

| Component | v4 Class | Notes |
|-----------|----------|-------|
| **Sections** | `<section class="io-section" id="sNN">` | Scroll reveal via IntersectionObserver |
| **Section dividers** | `<div class="gradient-divider"></div>` | NOT page-break |
| **Metrics** | `.metrics-strip > .metric-card` | Auto-coloured via nth-child (rose/slate/green/gold) |
| **Metric values** | `.metric-val` with `<span class="count-up" data-target="N">0</span>` | Animated count-up |
| **Callouts** | `.callout.insight` / `.warning` / `.success` / `.neutral` | Label: `.callout-label` (NOT callout-title) |
| **Charts** | `.chart-box` with `.chart-row > .chart-lbl + .stacked-bar > .seg.rose2` | Rose gradients for bars, animated scaleX reveal |
| **Tables** | `.data-table` | 12px border-radius, rose hover, navy headers |
| **Recommendations** | `.rec-list > .rec-card` with `.rec-accent.critical` + `.rec-body` | Hover-expandable with `.rec-deep` |
| **Lists** | `.styled-list` | Rose bullet points |
| **Sources** | `.sources-list` | 2-column ordered list |

#### Chart Colour Rules

- Primary bars: `.seg.rose2` (Ivy rose gradient)
- Comparison bars: `.seg.slate1` (slate gradient)
- Use `.seg.rose1` through `.seg.rose5` for intensity scales (dark → light rose)
- Legend dots match segment colours
- Chart hover: `rgba(244,63,94,0.04)` (rose tint)

### Report Structure Rules

1. **Cover** — `<section class="cover" id="cover">` with Ivy logo, "EXECUTIVE REPORT" badge, title, subtitle, rose cover-line, "Prepared by Ivy Intelligence", sources
2. **Metrics strip** — 4 metric cards with count-up animation, auto-coloured (rose/slate/green/gold)
3. **Executive Summary** — Section 01. Key findings (`.styled-list`), insight callout
4. **Body sections** — 4-8 sections, each wrapped in `.io-section`. Mix: prose, tables, charts, callouts
5. **Recommendations** — `.rec-list` with `.rec-card` components. Priority badges (critical/high/medium/low)
6. **Verification note** — Green-bordered block before sources
7. **Sources** — Numbered `.sources-list` (2-column)
8. **Footer** — `.ivy-footer` with Ivy logo, "Powered by Ivy · WorkVine.ai", "Confidential"

### Content Quality Rules

- **Every claim needs a citation.** Reference source numbers in parentheses, e.g., "(Source 3)"
- **Every metric card needs context.** A delta (YoY change, vs benchmark) and a source in `.metric-sub`
- **Tables must have real data.** Minimum 5 rows for comparison tables
- **Charts use rose gradients.** Bar segments use `.seg.rose2` (primary) and `.seg.slate1` (secondary)
- **Callouts are for emphasis, not decoration.** Use insight (rose) for key findings, warning (red) for risks, success (green) for positive outcomes, neutral (gold) for caveats
- **Write for executives.** Lead with implications, not methodology. "So what?" before "how?"

### Artifact Wrapping

Wrap the complete HTML document in `<artifact>` tags:

```
<artifact>
<!DOCTYPE html>
<html lang="en">
...entire document...
</html>
</artifact>
```

The gateway will automatically write it to disk and create a download card. The frontend renders it live in an iframe.

---

## §3 — Sub-flow B: New DOCX Report

If DOCX is chosen, use the `create_executive_report` tool from the doc-generator MCP server. Follow standard routing skill patterns for document generation. The HTML design system and research protocol above do not apply to DOCX output.

For simpler Word documents (not executive-grade), use `create_document` instead.

---

## §4 — Sub-flow C: Artifact-to-HTML Conversion

Any Ivy `insight` artifact (deep research, SWP analysis, ad-hoc insight cards, etc.) can be converted to a full HTML executive report using the design system from §2. This is a Claude-driven conversion — read the artifact JSON and produce HTML using the mapping table and CSS templates.

### Deep Research Output Routing

When a deep research artifact exists:
- **HTML report** → convert artifact to HTML using the mapping below, save to `outputs/deep-research/{slug}.html`
- **PDF / PPTX / XLSX** → route artifact to `export_artifact` (agent-export)
- **Embed link** → `export_embed_code` (agent-export)

### Section Mapping

| Artifact `kind` | HTML component |
|-----------------|---------------|
| `metrics` | `<div class="metrics-grid">` — each item becomes a `<div class="metric-card [color]">` with `.metric-label`, `.metric-value`, and `.metric-delta` |
| `callout` | `<div class="callout insight">` (or `warning`/`success`/`neutral` based on variant) — with `.callout-title` and `<p>` body |
| `table` | `<div class="table-wrapper">` with `.table-title` and `<table class="data-table">` — `<thead>` with navy headers, zebra-striped `<tbody>` rows. If `highlightColumn` is set, apply accent background to that column |
| `chart` | `<div class="chart-container">` — render as CSS bar chart using `.chart-row`, `.chart-label`, `.chart-bar-wrap`, `.chart-bar.primary`, `.chart-val`. Calculate bar widths as percentage of the maximum value. No JavaScript dependencies |
| `list` | `<ul class="findings-list">` — each item gets colored bullet based on priority: critical → navy, high → blue, medium → gold. Include priority in parentheses |
| `recommendations` | `<div class="rec-grid">` — each item becomes a `.rec-card` with `.rec-priority` badge (critical/high/medium/low) and `.rec-content` with `<h4>` title and `<p>` description |
| `prose` | `<div class="section-content">` — heading becomes `<h3>`, body becomes `<p>` tags. Preserve inline HTML (`<strong>`, `<br>`, etc.) |

### Conversion Rules

1. **Cover page:** Artifact `title` → report `<h1>`, artifact `subtitle` → `<h2>`, artifact `pillLabel` → `.cover-badge`, current date → `.cover-date`
2. **Table of Contents:** Auto-generate from section headings (use each section's `title`, `heading`, or `kind` as fallback)
3. **Sections:** Each `sections[]` entry → one numbered report section (`SECTION 01`, `SECTION 02`, etc.) with a `.section-header`, in order
4. **Footer:** Artifact `dataSources` → data attribution in `.page-footer`
5. **Sources page:** List all data sources mentioned in `dataSources` field and within section content
6. **CSS:** Use the SAME design system defined in §2 (navy/blue/gold, Georgia headings, A4 print-ready). Include the full CSS in a `<style>` tag — reports must be self-contained
7. **Wrap in `<artifact>` tags** so the gateway writes it to disk and the frontend renders it

### Example Workflow

```
1. Get artifact JSON (from deep_research_to_artifact, fixture file, or inline)
2. For each sections[] entry, apply the mapping table above
3. Assemble the full HTML document: cover → TOC → sections → sources → footer
4. Wrap in <artifact> tags
5. Save to outputs/deep-research/{slug}.html (or appropriate output directory)
```

---

## §5 — Sub-flow D: Presentations

Use doc-generator presentation tools:

1. `list_presentation_templates` — browse available themes
2. `get_presentation_template` — get theme details (colors, fonts, layouts)
3. `generate_themed_presentation` — create PPTX with chosen theme

For basic presentations without theming, use `create_presentation`.

---

## §6 — Sub-flow E: Export/Download/Embed + Doc/Spreadsheet/PDF

### Export existing artifacts

| User intent | Tool |
|---|---|
| Export artifact to PDF / PPTX / XLSX | `export_artifact` (agent-export) |
| Batch export multiple artifacts | `export_batch` (agent-export) |
| Generate embeddable HTML iframe code | `export_embed_code` (agent-export) |
| List all generated exports | `export_list` (agent-export) |

### Create new documents

| User intent | Tool |
|---|---|
| Word document (.docx) | `create_document` (doc-generator) |
| Spreadsheet (.xlsx) | `create_spreadsheet` (doc-generator) |
| PDF document (.pdf) | `create_pdf` (doc-generator) |
