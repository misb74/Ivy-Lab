import type { PresentationTemplate } from '../types.js';

export const nexus: PresentationTemplate = {
  name: "nexus",
  displayName: "Nexus",
  description: "Structured consulting framework with blue and green, fishbone diagrams, radar charts, SWOT grids, process flows, and scored rubrics.",
  tags: ["light", "framework", "consulting", "structured", "process"],
  designTokens: `const D = {
  bg: "F0F4F8", surface: "FFFFFF", card: "E2E8F0",
  primary: "1E40AF", secondary: "7C3AED", accent: "059669", warn: "DC2626",
  text: "1E293B", textMuted: "64748B", textLight: "94A3B8",
  divider: "CBD5E1",
  headerFont: "Calibri", bodyFont: "Calibri",
};`,
  layoutDna:
    "Light blue-grey background (#F0F4F8) with deep blue (#1E40AF) as primary and green (#059669) as positive/accent. " +
    "Every content slide has a left nav band: blue sidebar (w: 0.4) with a green stripe (w: 0.06) on its right edge. " +
    "Structured consulting frameworks: fishbone diagrams, SWOT 2x2 grids, radar charts, process flows with connectors. " +
    "Scored rubric tables use inline progress bars. White surface cards on the light background for content areas. " +
    "Clean section headers with blue underlines. All Calibri for professional consulting clarity.",
  codePatterns: `// --- Title Slide: blue sidebar band + clean title ---
s.background = { fill: D.bg };
// Left nav band (present on ALL slides)
s.addShape("rect", { x: 0, y: 0, w: 0.4, h: 5.63, fill: { color: D.primary } });
s.addShape("rect", { x: 0.4, y: 0, w: 0.06, h: 5.63, fill: { color: D.accent } });
// Title content
s.addText("Strategic\\nFramework\\nAnalysis", {
  x: 1.0, y: 1.0, w: 7.5, h: 2.8,
  fontSize: 48, fontFace: D.headerFont, color: D.text, bold: true, lineSpacingMultiple: 0.95,
});
s.addShape("rect", { x: 1.0, y: 4.0, w: 3.0, h: 0.03, fill: { color: D.primary } });
s.addText("Consulting Framework  |  2026", {
  x: 1.0, y: 4.2, w: 5, h: 0.35,
  fontSize: 12, fontFace: D.bodyFont, color: D.textMuted, charSpacing: 1,
});

// --- Fishbone / Herringbone Diagram (SHAPE-BUILT) ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 0.4, h: 5.63, fill: { color: D.primary } });
s.addShape("rect", { x: 0.4, y: 0, w: 0.06, h: 5.63, fill: { color: D.accent } });
s.addText("Root Cause Analysis", { x: 1.0, y: 0.3, w: 8, h: 0.5, fontSize: 24, fontFace: D.headerFont, color: D.text, bold: true });
s.addShape("rect", { x: 1.0, y: 0.85, w: 3.0, h: 0.02, fill: { color: D.primary } });
// Central spine
const spineY = 3.0, spineX1 = 1.2, spineX2 = 9.2;
s.addShape("rect", { x: spineX1, y: spineY - 0.015, w: spineX2 - spineX1, h: 0.03, fill: { color: D.primary } });
// Effect (arrowhead at right end)
s.addShape("rect", { x: 8.2, y: 2.2, w: 1.4, h: 1.6, fill: { color: D.primary }, rectRadius: 0.08 });
s.addText("High\\nAttrition", { x: 8.2, y: 2.4, w: 1.4, h: 1.2, fontSize: 13, fontFace: D.headerFont, color: "FFFFFF", bold: true, align: "center", valign: "middle" });
// Diagonal branches (3 top, 3 bottom)
const topCauses = [
  { label: "Compensation", detail: "Below market P50", bx: 2.0 },
  { label: "Career Growth", detail: "No visible path", bx: 4.0 },
  { label: "Manager Quality", detail: "Low eNPS scores", bx: 6.0 },
];
const botCauses = [
  { label: "Work-Life Balance", detail: "60hr weeks avg", bx: 2.0 },
  { label: "Culture Fit", detail: "Values misalignment", bx: 4.0 },
  { label: "Tools & Tech", detail: "Legacy stack", bx: 6.0 },
];
topCauses.forEach((c) => {
  // Diagonal line (approximated with thin rotated rect)
  s.addShape("rect", { x: c.bx, y: 1.6, w: 0.02, h: 1.4, fill: { color: D.secondary }, rotate: -25 });
  // Label box
  s.addShape("rect", { x: c.bx - 0.6, y: 1.15, w: 1.8, h: 0.7, fill: { color: D.surface }, rectRadius: 0.06 });
  s.addShape("rect", { x: c.bx - 0.6, y: 1.15, w: 1.8, h: 0.03, fill: { color: D.secondary } });
  s.addText(c.label, { x: c.bx - 0.5, y: 1.2, w: 1.6, h: 0.3, fontSize: 9, fontFace: D.headerFont, color: D.text, bold: true });
  s.addText(c.detail, { x: c.bx - 0.5, y: 1.5, w: 1.6, h: 0.25, fontSize: 8, fontFace: D.bodyFont, color: D.textMuted });
});
botCauses.forEach((c) => {
  s.addShape("rect", { x: c.bx, y: spineY + 0.05, w: 0.02, h: 1.4, fill: { color: D.accent }, rotate: 25 });
  s.addShape("rect", { x: c.bx - 0.6, y: 4.1, w: 1.8, h: 0.7, fill: { color: D.surface }, rectRadius: 0.06 });
  s.addShape("rect", { x: c.bx - 0.6, y: 4.77, w: 1.8, h: 0.03, fill: { color: D.accent } });
  s.addText(c.label, { x: c.bx - 0.5, y: 4.15, w: 1.6, h: 0.3, fontSize: 9, fontFace: D.headerFont, color: D.text, bold: true });
  s.addText(c.detail, { x: c.bx - 0.5, y: 4.45, w: 1.6, h: 0.25, fontSize: 8, fontFace: D.bodyFont, color: D.textMuted });
});

// --- SWOT 2x2 Grid + Radar Chart ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 0.4, h: 5.63, fill: { color: D.primary } });
s.addShape("rect", { x: 0.4, y: 0, w: 0.06, h: 5.63, fill: { color: D.accent } });
s.addText("SWOT Analysis", { x: 1.0, y: 0.3, w: 4, h: 0.5, fontSize: 24, fontFace: D.headerFont, color: D.text, bold: true });
s.addShape("rect", { x: 1.0, y: 0.85, w: 3.0, h: 0.02, fill: { color: D.primary } });
// SWOT quadrants (left half)
const swotData = [
  { label: "STRENGTHS", color: D.accent, x: 1.0, y: 1.2, items: "Strong engineering culture\\nHigh retention in core teams\\nEstablished brand" },
  { label: "WEAKNESSES", color: D.warn, x: 3.6, y: 1.2, items: "Thin management bench\\nLegacy tech debt\\nSlow hiring process" },
  { label: "OPPORTUNITIES", color: D.primary, x: 1.0, y: 3.4, items: "AI talent market growing\\nRemote work expansion\\nM&A talent integration" },
  { label: "THREATS", color: D.secondary, x: 3.6, y: 3.4, items: "FAANG compensation war\\nRegulatory complexity\\nSkill obsolescence" },
];
swotData.forEach((q) => {
  s.addShape("rect", { x: q.x, y: q.y, w: 2.4, h: 1.95, fill: { color: D.surface }, rectRadius: 0.08 });
  s.addShape("rect", { x: q.x, y: q.y, w: 2.4, h: 0.35, fill: { color: q.color }, rectRadius: 0.08 });
  s.addText(q.label, { x: q.x, y: q.y, w: 2.4, h: 0.35, fontSize: 10, fontFace: D.headerFont, color: "FFFFFF", bold: true, align: "center", valign: "middle" });
  s.addText(q.items, { x: q.x + 0.15, y: q.y + 0.45, w: 2.1, h: 1.35, fontSize: 9, fontFace: D.bodyFont, color: D.text, valign: "top", lineSpacingMultiple: 1.3 });
});
// Radar chart (right half)
s.addChart(pres.charts.RADAR,
  [
    { name: "Current", labels: ["Leadership","Technical","Innovation","Execution","Culture","Talent"], values: [65, 80, 55, 75, 70, 60] },
    { name: "Target", labels: ["Leadership","Technical","Innovation","Execution","Culture","Talent"], values: [85, 90, 80, 85, 85, 80] },
  ],
  { x: 6.3, y: 1.0, w: 3.4, h: 3.8, chartColors: [D.primary, D.accent], showLegend: true, legendPos: "b", legendColor: D.textMuted, catAxisLabelColor: D.text, catAxisLabelFontSize: 8 }
);

// --- Process Flow + Scored Rubric Table ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 0.4, h: 5.63, fill: { color: D.primary } });
s.addShape("rect", { x: 0.4, y: 0, w: 0.06, h: 5.63, fill: { color: D.accent } });
s.addText("Implementation Framework", { x: 1.0, y: 0.3, w: 8, h: 0.5, fontSize: 24, fontFace: D.headerFont, color: D.text, bold: true });
s.addShape("rect", { x: 1.0, y: 0.85, w: 3.0, h: 0.02, fill: { color: D.primary } });
// Process flow steps with connectors
const steps = [
  { label: "Assess", desc: "Current state", color: D.primary },
  { label: "Design", desc: "Target model", color: D.secondary },
  { label: "Build", desc: "Capabilities", color: D.accent },
  { label: "Deploy", desc: "At scale", color: D.primary },
  { label: "Measure", desc: "Outcomes", color: D.accent },
];
const flowY = 1.2, stepW = 1.3, stepH = 0.9, gap = 0.38;
steps.forEach((st, i) => {
  const sx = 1.0 + i * (stepW + gap);
  s.addShape("rect", { x: sx, y: flowY, w: stepW, h: stepH, fill: { color: D.surface }, rectRadius: 0.08 });
  s.addShape("rect", { x: sx, y: flowY, w: stepW, h: 0.06, fill: { color: st.color }, rectRadius: 0.08 });
  s.addText(st.label, { x: sx, y: flowY + 0.15, w: stepW, h: 0.4, fontSize: 12, fontFace: D.headerFont, color: D.text, bold: true, align: "center" });
  s.addText(st.desc, { x: sx, y: flowY + 0.5, w: stepW, h: 0.3, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted, align: "center" });
  // Connector arrow between steps
  if (i < steps.length - 1) {
    s.addShape("rect", { x: sx + stepW, y: flowY + stepH/2 - 0.01, w: gap, h: 0.02, fill: { color: D.divider } });
    s.addShape("rect", { x: sx + stepW + gap - 0.12, y: flowY + stepH/2 - 0.06, w: 0.12, h: 0.12, fill: { color: D.primary }, rotate: 45 });
  }
});
// Scored rubric table with inline progress bars
s.addText("Readiness Scorecard", { x: 1.0, y: 2.5, w: 8, h: 0.4, fontSize: 16, fontFace: D.headerFont, color: D.text, bold: true });
s.addShape("rect", { x: 1.0, y: 2.95, w: 8.5, h: 0.02, fill: { color: D.primary } });
// Table header
s.addShape("rect", { x: 1.0, y: 3.1, w: 8.5, h: 0.4, fill: { color: D.primary } });
["Dimension", "Score", "Progress", "Status"].forEach((h, i) => {
  const colX = [1.0, 3.5, 4.8, 8.2];
  const colW = [2.5, 1.3, 3.4, 1.3];
  s.addText(h, { x: colX[i], y: 3.1, w: colW[i], h: 0.4, fontSize: 9, fontFace: D.headerFont, color: "FFFFFF", bold: true, valign: "middle" });
});
// Table rows with progress bars
const rubric = [
  { dim: "Leadership Readiness", score: 78, status: "On Track", statusColor: D.accent },
  { dim: "Technical Infrastructure", score: 92, status: "Strong", statusColor: D.accent },
  { dim: "Change Management", score: 45, status: "At Risk", statusColor: D.warn },
  { dim: "Talent Pipeline", score: 63, status: "Building", statusColor: D.secondary },
];
rubric.forEach((row, i) => {
  const ry = 3.55 + i * 0.48;
  const rowFill = i % 2 === 0 ? D.surface : D.bg;
  s.addShape("rect", { x: 1.0, y: ry, w: 8.5, h: 0.45, fill: { color: rowFill } });
  s.addText(row.dim, { x: 1.1, y: ry, w: 2.4, h: 0.45, fontSize: 9, fontFace: D.bodyFont, color: D.text, valign: "middle" });
  s.addText(row.score + "%", { x: 3.5, y: ry, w: 1.3, h: 0.45, fontSize: 10, fontFace: D.headerFont, color: D.text, bold: true, valign: "middle" });
  // Progress bar
  s.addShape("rect", { x: 4.8, y: ry + 0.14, w: 3.2, h: 0.17, fill: { color: D.card }, rectRadius: 0.04 });
  const barColor = row.score >= 70 ? D.accent : row.score >= 50 ? D.secondary : D.warn;
  s.addShape("rect", { x: 4.8, y: ry + 0.14, w: 3.2 * (row.score / 100), h: 0.17, fill: { color: barColor }, rectRadius: 0.04 });
  s.addText(row.status, { x: 8.2, y: ry, w: 1.3, h: 0.45, fontSize: 8, fontFace: D.bodyFont, color: row.statusColor, bold: true, valign: "middle", align: "center" });
});`,
  footerPattern: `function addFooter(s, num) {
  s.addShape("rect", { x: 0.46, y: 5.45, w: 9.54, h: 0.01, fill: { color: D.divider } });
  s.addText("NEXUS  |  STRATEGIC FRAMEWORK", { x: 1.0, y: 5.25, w: 3.5, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textLight, charSpacing: 2 });
  s.addText(num.toString().padStart(2, "0"), { x: 8.5, y: 5.25, w: 0.8, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textLight, align: "right" });
}`,
  qualityChecklist: `- Blue sidebar band (w: 0.4) + green stripe (w: 0.06) on the LEFT of EVERY content slide
- Background: D.bg ("F0F4F8") light blue-grey, content areas: D.surface ("FFFFFF") white cards
- Blue (#1E40AF) for primary structure: headers, table headers, process step tops, sidebar
- Green (#059669) for positive indicators: strengths, on-track status, progress bars above 70%
- Red (#DC2626) ONLY for warnings and at-risk status — never as decoration
- Fishbone diagrams: central horizontal spine, diagonal branches, labelled cause boxes
- SWOT grids: 2x2 with colour-coded quadrant headers (green/red/blue/purple)
- Radar charts use native pres.charts.RADAR with current vs target series
- Scored rubric tables: alternating row fills, inline progress bars, colour-coded status text
- Process flows: horizontal step boxes with connector lines and diamond arrowheads
- All Calibri for both headlines and body
- 8-12 slides, structured framework layouts, consulting precision`,
};
