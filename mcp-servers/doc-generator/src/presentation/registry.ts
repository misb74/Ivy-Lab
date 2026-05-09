/**
 * Template Registry + Synthesis Prompt Builder
 *
 * Ported from Auxia's presentation_templates/registry.py and
 * presentation_agent.py build_synthesis_prompt().
 */

import type { PresentationTemplate, TemplateSummary, TemplateDetails } from './types.js';
import {
  apex, prism, folio, volt, nexus,
  atlas, forge, terrain, helix, cedar,
  nimbus, solstice, graphite, auroraBorealis, sandstone,
  cobalt, mosaic, circuit, dusk, silk,
} from './templates/index.js';

// ---------------------------------------------------------------------------
// Template registry map
// ---------------------------------------------------------------------------

const TEMPLATES: Record<string, PresentationTemplate> = {
  apex, prism, folio, volt, nexus,
  atlas, forge, terrain, helix, cedar,
  nimbus, solstice, graphite,
  'aurora-borealis': auroraBorealis,
  sandstone, cobalt, mosaic, circuit, dusk, silk,
};

// ---------------------------------------------------------------------------
// Backward-compatibility aliases (old 10 → new 20)
// ---------------------------------------------------------------------------

const TEMPLATE_ALIASES: Record<string, string> = {
  obsidian: 'apex',
  ivory: 'silk',
  slate: 'helix',
  ember: 'volt',
  aurora: 'aurora-borealis',
  copper: 'sandstone',
  onyx: 'graphite',
  meridian: 'nimbus',
  rosewood: 'solstice',
  carbon: 'folio',
};

// ---------------------------------------------------------------------------
// Icon rendering snippet (conditional — only included when template uses icons)
// ---------------------------------------------------------------------------

const ICON_RENDERING_SNIPPET = `### Icon Rendering (use sparingly — adds to execution time)
\`\`\`javascript
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const FA = require("react-icons/fa");
const ICON_MAP = { "rocket": FA.FaRocket, "brain": FA.FaBrain, "star": FA.FaStar, "check": FA.FaCheckCircle, "globe": FA.FaGlobe, "users": FA.FaUsers, "lightbulb": FA.FaLightbulb, "shield": FA.FaShieldAlt, "chart-line": FA.FaChartLine, "trophy": FA.FaTrophy, "building": FA.FaBuilding, "database": FA.FaDatabase, "cogs": FA.FaCogs, "heart": FA.FaHeart, "bolt": FA.FaBolt, "target": FA.FaBullseye, "tools": FA.FaTools };
async function renderIcon(name, color, size = 256) {
  const Comp = ICON_MAP[name] || ICON_MAP["star"];
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color, size: String(size) }));
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}
\`\`\``;

// ---------------------------------------------------------------------------
// Shadow factory snippet (conditional — skipped for flat-design templates)
// ---------------------------------------------------------------------------

const SHADOW_FACTORY_SNIPPET = `const makeShadow = () => ({
  type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.10,
});`;

// ---------------------------------------------------------------------------
// Combo chart guidance (conditional — only for templates needing BAR+LINE overlay)
// ---------------------------------------------------------------------------

const COMBO_CHART_GUIDANCE = `### Combo Chart (BAR + LINE overlay)
To overlay a bar chart with a line chart, use two separate addChart() calls with the SAME position box:
\`\`\`javascript
// Step 1: Bar chart
s.addChart(pres.charts.BAR,
  [{ name: "Volume", labels: ["Jan","Feb","Mar","Apr"], values: [120,150,180,210] }],
  { x: 0.5, y: 1.2, w: 9, h: 3.8, chartColors: [D.primary], showLegend: false }
);
// Step 2: Line chart overlay — SAME x, y, w, h
s.addChart(pres.charts.LINE,
  [{ name: "Cumulative %", labels: ["Jan","Feb","Mar","Apr"], values: [20,45,75,100] }],
  { x: 0.5, y: 1.2, w: 9, h: 3.8, chartColors: [D.accent], lineSmooth: true, showLegend: false }
);
\`\`\``;

// ---------------------------------------------------------------------------
// Chart styling guidance (conditional — only for templates with charts)
// ---------------------------------------------------------------------------

const CHART_STYLING_GUIDANCE = `### Chart Styling Defaults
For clean, modern chart styling defaults (especially BAR/LINE/AREA), start with:
\`\`\`javascript
{
  catGridLine: { style: "none" },
  valGridLine: { style: "dash", color: "D9D9D9", size: 0.5 },
  dataLabelPosition: "outEnd",
}
\`\`\``;

// ---------------------------------------------------------------------------
// Image sizing guidance (conditional — only for templates using icons/images)
// ---------------------------------------------------------------------------

const IMAGE_SIZING_GUIDANCE = `### Image Sizing Modes
Use \`sizing\` on \`addImage\` for predictable placement:
- \`contain\`: fit whole image inside box (may letterbox)
- \`cover\`: fill entire box (may crop edges)
- \`crop\`: explicit crop using \`x\`, \`y\`, \`w\`, \`h\`
\`\`\`javascript
s.addImage({
  data: iconPng,
  x: 1.0, y: 1.0, w: 1.0, h: 1.0,
  sizing: { type: "contain", w: 1.0, h: 1.0 },
});
\`\`\``;

// ---------------------------------------------------------------------------
// Critical pptxgenjs rules shared across all templates
// ---------------------------------------------------------------------------

const PPTXGENJS_RULES = `## Critical pptxgenjs Rules
1. Colors WITHOUT # prefix — "830051" not "#830051"
2. Shadow factory functions — call makeShadow() fresh each time, NEVER reuse objects
3. Script accepts process.argv[2] as output path
4. Script prints DONE:<path> on success, ERROR:<msg> on failure
5. Only use: pptxgenjs, react, react-dom, react-icons, sharp
6. pres.writeFile({ fileName: path }) is async — always await
7. Use pres.charts.DOUGHNUT not pres.charts.DONUT
8. Use charSpacing not letterSpacing — letterSpacing is silently ignored
9. Never use 8-char hex colors (e.g. "830051FF" or "00000000"); for fills use transparency, for shadows use opacity
10. Shadow offset must be non-negative; for upward shadows use angle: 270
11. Never use unicode bullet characters ("•") — use bullet: { code: "2022" } or a dash prefix
12. Never use bullet: true on text 36pt+ — reserve bullets for body text (~14-16pt)
13. Do not pair ROUNDED_RECTANGLE with rectangular accent overlays that must fully cover corners
14. Use breakLine: true between text array runs when line breaks are required
15. Avoid lineSpacing when using bullets — prefer paraSpaceAfter
16. Wrap icon + background-circle rendering in try/catch and skip BOTH if icon render fails
17. Use margin: 0 on text boxes when precise shape/icon alignment is required
18. Never reuse a pptxgen() instance across separate presentation generations
19. Use pres.layout = "LAYOUT_16x9" (10" x 5.625"); do not use LAYOUT_WIDE unless all coordinates are recalibrated`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List all templates, optionally filtered by tag.
 */
export function listTemplates(tag?: string): TemplateSummary[] {
  let templates = Object.values(TEMPLATES);
  if (tag) {
    const lowerTag = tag.toLowerCase();
    templates = templates.filter(t => t.tags.some(tt => tt.toLowerCase() === lowerTag));
  }
  return templates.map(t => ({
    name: t.name,
    displayName: t.displayName,
    description: t.description,
    tags: t.tags,
  }));
}

/**
 * Get full template details including a pre-built synthesis prompt.
 */
export function getTemplate(name: string): TemplateDetails | null {
  const key = name.toLowerCase().trim();
  // Resolve aliases first
  const resolved = TEMPLATE_ALIASES[key] ?? key;
  const t = TEMPLATES[resolved];
  if (!t) return null;
  return {
    name: t.name,
    displayName: t.displayName,
    description: t.description,
    tags: t.tags,
    designTokens: t.designTokens,
    layoutDna: t.layoutDna,
    codePatterns: t.codePatterns,
    footerPattern: t.footerPattern,
    qualityChecklist: t.qualityChecklist,
    synthesisPrompt: buildSynthesisPrompt(t),
  };
}

/**
 * Return all registered template slug names + aliases (for Zod enum validation).
 */
export function getTemplateNames(): string[] {
  return [...Object.keys(TEMPLATES), ...Object.keys(TEMPLATE_ALIASES)];
}

/**
 * Build the full synthesis prompt for a given template.
 * Conditionally includes icon rendering, image sizing, shadow factory, and chart guidance.
 */
export function buildSynthesisPrompt(template: PresentationTemplate): string {
  const usesIcons = /renderIcon|icon/i.test(template.codePatterns);
  const usesShadow = /shadow/i.test(template.codePatterns);
  const usesCharts = /addChart|pres\.charts/i.test(template.codePatterns + ' ' + template.layoutDna);
  const usesComboChart = /BAR.*LINE|LINE.*BAR|combo|pareto|waterfall/i.test(
    template.codePatterns + ' ' + template.layoutDna
  );

  const parts: string[] = [
    'You are a Presentation Designer. Write a **complete Node.js pptxgenjs script** that generates a PowerPoint presentation from the research data below.',
    '',
    `## Design System — ${template.displayName}`,
    '',
    '### Design Tokens',
    '```javascript',
    template.designTokens,
    '```',
    '',
    '### Layout DNA',
    template.layoutDna,
    '',
    '### Script Skeleton',
    '```javascript',
    'const pptxgen = require("pptxgenjs");',
    '',
    template.designTokens,
    '',
  ];

  // Conditional shadow factory
  if (usesShadow) {
    parts.push(SHADOW_FACTORY_SNIPPET);
    parts.push('');
  }

  // Add footer pattern if the template has one (skip comment-only footers)
  if (template.footerPattern && !template.footerPattern.startsWith('//')) {
    parts.push(template.footerPattern);
    parts.push('');
  }

  parts.push(
    'async function main() {',
    '  const pres = new pptxgen();',
    '  pres.layout = "LAYOUT_16x9";',
    '  pres.author = "Ivy";',
    '  pres.title = "YOUR TITLE HERE";',
    '',
    '  // === TITLE SLIDE ===',
    '  // === CONTENT SLIDES ===',
    '  // === CLOSING SLIDE ===',
    '',
    '  const outPath = process.argv[2] || "presentation.pptx";',
    '  await pres.writeFile({ fileName: outPath });',
    '  console.log("DONE:" + outPath);',
    '}',
    '',
    'main().catch(err => {',
    '  console.error("ERROR:" + err.message);',
    '  process.exit(1);',
    '});',
    '```',
    '',
    '### Code Patterns',
    '```javascript',
    template.codePatterns,
    '```',
    '',
  );

  // Conditional icon rendering snippet
  if (usesIcons) {
    parts.push(ICON_RENDERING_SNIPPET);
    parts.push('');
    parts.push(IMAGE_SIZING_GUIDANCE);
    parts.push('');
  }

  // Conditional combo chart guidance
  if (usesComboChart) {
    parts.push(COMBO_CHART_GUIDANCE);
    parts.push('');
  }

  // Conditional chart styling guidance
  if (usesCharts) {
    parts.push(CHART_STYLING_GUIDANCE);
    parts.push('');
  }

  parts.push(
    PPTXGENJS_RULES,
    '',
    '## Quality Checklist',
    template.qualityChecklist,
    '- Only real statistics from the research — no invented numbers',
    '',
    '## Output',
    '',
    'Respond with ONLY the script inside a single ```javascript code fence. No explanatory text before or after.',
    '',
    'RESEARCH DATA:',
  );

  return parts.join('\n');
}
