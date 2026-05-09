import type { PresentationTemplate } from '../types.js';

export const circuit: PresentationTemplate = {
  name: "circuit",
  displayName: "Circuit",
  description: "Circuit board dark theme with neon green and dark grey, radar charts for capability mapping, architecture flow diagrams, sprint retrospective layouts, and system design grids.",
  tags: ["dark", "tech", "framework", "bold", "retrospective"],
  designTokens: `const D = {
  bg: "111111", surface: "1A1A1A", card: "252525", elevated: "333333",
  primary: "22C55E", secondary: "86EFAC", accent: "A78BFA",
  warn: "F87171",
  text: "E8E8E8", textMuted: "888888", textDim: "555555",
  divider: "2A2A2A",
  headerFont: "Calibri", bodyFont: "Calibri",
};`,
  layoutDna:
    "Pure black background (#111111) with neon green (#22C55E) as the dominant accent and purple (#A78BFA) for secondary highlights. " +
    "Circuit trace line decorations: connected right-angle line segments forming PCB-style paths on title and section slides. " +
    "Radar charts (native pres.charts.RADAR) for capability and maturity assessments. " +
    "Architecture flow diagrams built from rects connected by lines showing component relationships. " +
    "Sprint retrospective three-column layout (What went well / What didn't / Action items) with coloured headers. " +
    "Terminal-style code blocks with green text on dark card backgrounds. System health dashboards with coloured status dots. " +
    "All Calibri for a monospace/technical feel.",
  codePatterns: `// --- Title Slide: circuit trace decoration ---
s.background = { fill: D.bg };
// Circuit trace lines — connected right-angle segments
const traceColor = D.primary;
const traceW = 0.02;
// Horizontal trace segment
s.addShape("rect", { x: 6.5, y: 1.0, w: 2.5, h: traceW, fill: { color: traceColor } });
// Vertical drop
s.addShape("rect", { x: 9.0, y: 1.0, w: traceW, h: 1.2, fill: { color: traceColor } });
// Right-angle turn
s.addShape("rect", { x: 7.5, y: 2.2, w: 1.52, h: traceW, fill: { color: traceColor } });
// Another vertical
s.addShape("rect", { x: 7.5, y: 2.2, w: traceW, h: 1.0, fill: { color: traceColor } });
// Horizontal continuation
s.addShape("rect", { x: 7.5, y: 3.2, w: 1.8, h: traceW, fill: { color: traceColor } });
// Junction dots at turns
[{ x: 9.0, y: 0.96 }, { x: 7.5, y: 2.16 }, { x: 7.5, y: 3.16 }].forEach(p => {
  s.addShape("ellipse", { x: p.x - 0.05, y: p.y, w: 0.12, h: 0.12, fill: { color: traceColor } });
});
// Secondary trace (purple accent)
s.addShape("rect", { x: 8.0, y: 3.8, w: traceW, h: 1.0, fill: { color: D.accent } });
s.addShape("rect", { x: 8.0, y: 4.8, w: 1.5, h: traceW, fill: { color: D.accent } });
s.addShape("ellipse", { x: 7.95, y: 4.76, w: 0.12, h: 0.12, fill: { color: D.accent } });
// Title text
s.addText("Tech Architecture\\nReview", {
  x: 0.8, y: 1.3, w: 5.5, h: 2.2,
  fontSize: 48, fontFace: D.headerFont, color: D.text, bold: true, lineSpacingMultiple: 0.95,
});
s.addShape("rect", { x: 0.8, y: 3.7, w: 2.5, h: 0.015, fill: { color: D.primary } });
s.addText("Sprint 24  |  Engineering", {
  x: 0.8, y: 3.9, w: 4, h: 0.35,
  fontSize: 12, fontFace: D.bodyFont, color: D.textMuted, charSpacing: 1,
});

// --- Radar Chart: capability assessment ---
s.background = { fill: D.bg };
s.addText("Capability Maturity Assessment", {
  x: 0.8, y: 0.3, w: 8, h: 0.5,
  fontSize: 22, fontFace: D.headerFont, color: D.text, bold: true,
});
s.addText("Team capability scores across 6 engineering dimensions", {
  x: 0.8, y: 0.8, w: 8, h: 0.3, fontSize: 10, fontFace: D.bodyFont, color: D.textMuted,
});
s.addChart(pres.charts.RADAR, [
  { name: "Current", labels: ["CI/CD","Observability","Security","Scalability","Testing","Documentation"], values: [85, 62, 70, 78, 55, 40] },
  { name: "Target", labels: ["CI/CD","Observability","Security","Scalability","Testing","Documentation"], values: [90, 85, 85, 90, 80, 75] },
], {
  x: 0.5, y: 1.3, w: 5.0, h: 3.8,
  chartColors: [D.primary, D.accent],
  radarStyle: "filled",
  showLegend: true, legendPos: "b", legendFontSize: 9, legendColor: D.textMuted,
  catAxisLabelColor: D.textMuted, catAxisLabelFontSize: 9,
  plotArea: { fill: { color: D.surface } },
});
// Scoring legend on right
const scores = [
  { dim: "CI/CD", score: "85", status: "green" },
  { dim: "Observability", score: "62", status: "amber" },
  { dim: "Security", score: "70", status: "amber" },
  { dim: "Scalability", score: "78", status: "green" },
  { dim: "Testing", score: "55", status: "red" },
  { dim: "Documentation", score: "40", status: "red" },
];
scores.forEach((sc, i) => {
  const y = 1.5 + i * 0.55;
  const dotColor = sc.status === "green" ? D.primary : sc.status === "amber" ? "F59E0B" : D.warn;
  s.addShape("ellipse", { x: 6.2, y: y + 0.05, w: 0.16, h: 0.16, fill: { color: dotColor } });
  s.addText(sc.dim, { x: 6.5, y, w: 1.8, h: 0.28, fontSize: 10, fontFace: D.bodyFont, color: D.text, valign: "middle" });
  s.addText(sc.score, { x: 8.5, y, w: 0.6, h: 0.28, fontSize: 10, fontFace: D.bodyFont, color: dotColor, bold: true, align: "right", valign: "middle" });
});

// --- Architecture Flow Diagram (rects + connecting lines) ---
s.background = { fill: D.bg };
s.addText("System Architecture", {
  x: 0.8, y: 0.3, w: 8, h: 0.5,
  fontSize: 22, fontFace: D.headerFont, color: D.text, bold: true,
});
// Component boxes
const components = [
  { label: "API Gateway", x: 3.8, y: 1.2, w: 2.2, h: 0.7, color: D.primary },
  { label: "Auth Service", x: 0.8, y: 2.5, w: 2.0, h: 0.7, color: D.accent },
  { label: "Core Engine", x: 3.8, y: 2.5, w: 2.2, h: 0.7, color: D.primary },
  { label: "Cache Layer", x: 7.0, y: 2.5, w: 2.0, h: 0.7, color: D.accent },
  { label: "PostgreSQL", x: 1.8, y: 3.9, w: 2.0, h: 0.7, color: D.elevated },
  { label: "Redis", x: 5.0, y: 3.9, w: 1.8, h: 0.7, color: D.elevated },
  { label: "S3 Storage", x: 7.5, y: 3.9, w: 2.0, h: 0.7, color: D.elevated },
];
components.forEach(c => {
  s.addShape("rect", { x: c.x, y: c.y, w: c.w, h: c.h, fill: { color: D.card }, line: { color: c.color, width: 1.5 }, rectRadius: 0.06 });
  s.addText(c.label, { x: c.x, y: c.y, w: c.w, h: c.h, fontSize: 10, fontFace: D.bodyFont, color: D.text, align: "center", valign: "middle" });
});
// Connecting lines (vertical connectors between tiers)
const connectors = [
  { x1: 4.9, y1: 1.9, x2: 4.9, y2: 2.5 },  // Gateway → Core
  { x1: 1.8, y1: 2.5, x2: 3.8, y2: 2.5 },   // Auth → Core (horizontal)
  { x1: 6.0, y1: 2.5, x2: 7.0, y2: 2.5 },   // Core → Cache (horizontal)
  { x1: 2.8, y1: 3.2, x2: 2.8, y2: 3.9 },   // Auth → PostgreSQL
  { x1: 4.9, y1: 3.2, x2: 5.9, y2: 3.9 },   // Core → Redis
  { x1: 8.0, y1: 3.2, x2: 8.5, y2: 3.9 },   // Cache → S3
];
connectors.forEach(cn => {
  const isHorizontal = cn.y1 === cn.y2;
  if (isHorizontal) {
    s.addShape("rect", { x: cn.x1, y: cn.y1 - 0.01, w: cn.x2 - cn.x1, h: 0.02, fill: { color: D.primary, transparency: 50 } });
  } else {
    s.addShape("rect", { x: cn.x1 - 0.01, y: cn.y1, w: 0.02, h: cn.y2 - cn.y1, fill: { color: D.primary, transparency: 50 } });
  }
});

// --- Sprint Retrospective: 3-column layout ---
s.background = { fill: D.bg };
s.addText("Sprint 24 — Retrospective", {
  x: 0.8, y: 0.3, w: 8, h: 0.5,
  fontSize: 22, fontFace: D.headerFont, color: D.text, bold: true,
});
const retroCols = [
  { title: "What Went Well", color: D.primary, icon: "\\u2713", items: ["CI pipeline now <8 min", "Zero P1 incidents this sprint", "Onboarded 2 new engineers smoothly", "API latency down 35%"] },
  { title: "What Didn't", color: D.warn, icon: "\\u2717", items: ["Flaky integration tests blocked 3 PRs", "Scope creep on auth service refactor", "Documentation still lagging", "Code review turnaround >48h"] },
  { title: "Action Items", color: D.accent, icon: "\\u2192", items: ["Quarantine flaky tests by Friday", "Strict scope lock from sprint planning", "Docs sprint next iteration", "Review SLA: 24h max turnaround"] },
];
retroCols.forEach((col, i) => {
  const x = 0.5 + i * 3.15;
  const y = 1.1;
  // Column container
  s.addShape("rect", { x, y, w: 2.9, h: 4.0, fill: { color: D.card }, rectRadius: 0.08 });
  // Coloured header bar
  s.addShape("rect", { x, y, w: 2.9, h: 0.5, fill: { color: col.color }, rectRadius: 0.08 });
  s.addShape("rect", { x, y: y + 0.42, w: 2.9, h: 0.08, fill: { color: col.color } }); // square off bottom of header
  s.addText(col.icon + "  " + col.title, {
    x: x + 0.15, y, w: 2.6, h: 0.5,
    fontSize: 12, fontFace: D.headerFont, color: D.bg, bold: true, valign: "middle",
  });
  // Items
  col.items.forEach((item, j) => {
    const iy = y + 0.7 + j * 0.75;
    // Terminal-style green text on dark background
    s.addShape("rect", { x: x + 0.12, y: iy, w: 2.66, h: 0.6, fill: { color: D.surface }, rectRadius: 0.04 });
    s.addText(">" + " " + item, {
      x: x + 0.2, y: iy + 0.05, w: 2.5, h: 0.5,
      fontSize: 9, fontFace: D.bodyFont, color: i === 0 ? D.secondary : i === 1 ? D.warn : D.accent,
      lineSpacingMultiple: 1.2,
    });
  });
});`,
  footerPattern: `function addFooter(s, num) {
  s.addShape("rect", { x: 0, y: 5.42, w: 10, h: 0.01, fill: { color: D.divider } });
  s.addText("CIRCUIT  |  TECH ARCHITECTURE", { x: 0.8, y: 5.25, w: 4, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textDim, charSpacing: 2 });
  s.addText(num.toString().padStart(2, "0"), { x: 8.5, y: 5.25, w: 0.8, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textDim, align: "right" });
}`,
  qualityChecklist: `- All backgrounds: D.bg ("111111") pure dark, D.surface ("1A1A1A") for nested panels
- Neon green (#22C55E) as primary on circuit traces, radar fills, status dots, retro "went well" column
- Purple (#A78BFA) as accent on secondary traces, radar target line, action items column
- Circuit trace decoration: connected right-angle rect segments with junction dots at turns
- Radar chart: native pres.charts.RADAR with "filled" style, green for current, purple for target
- Architecture diagram: component boxes (card fill + coloured border) connected by semi-transparent lines
- Sprint retro: 3 columns with coloured headers (green/red/purple), terminal-style items with ">" prefix
- System health: coloured status dots (green/amber/red) next to dimension scores
- All Calibri for monospace/technical feel
- 8-12 slides, engineering-focused layouts`,
};
