import type { PresentationTemplate } from '../types.js';

export const forge: PresentationTemplate = {
  name: "forge",
  displayName: "Forge",
  description: "Industrial forge aesthetic with steel grey and amber, process flow diagrams, stacked bars, maturity scorecards, and numbered recommendation cards.",
  tags: ["warm", "industrial", "framework", "process", "bold"],
  designTokens: `const D = {
  bg: "F5F5F4", surface: "FFFFFF", card: "E7E5E4", elevated: "D6D3D1",
  primary: "44403C", secondary: "78716C", accent: "D97706", accentLight: "FDE68A",
  text: "1C1917", textMuted: "78716C", textLight: "A8A29E",
  divider: "D6D3D1",
  headerFont: "Calibri", bodyFont: "Calibri",
};`,
  layoutDna:
    "Warm stone background (#F5F5F4) with steel grey (#44403C) as primary and amber (#D97706) as the bold accent. " +
    "Amber accent bar (h: 0.08) at the bottom of every content slide anchors the industrial weight. " +
    "Stacked bar charts for multi-category operational comparisons. Maturity scorecards with progress bars and delta arrows. " +
    "Process step diagrams with numbered badges and connector arrows. " +
    "Three-column numbered recommendation cards with amber numbering. Heavy horizontal dividers (h: 0.06) between sections. " +
    "All Calibri for industrial clarity and bold operational weight.",
  codePatterns: `// --- Title Slide: steel + amber industrial opener ---
s.background = { fill: D.primary };
s.addShape("rect", { x: 0, y: 5.15, w: 10, h: 0.48, fill: { color: D.accent } });
// Forged metal texture: overlapping dark rectangles
s.addShape("rect", { x: -1, y: -0.5, w: 5, h: 3.5, fill: { color: "3A3733" } });
s.addShape("rect", { x: 3.5, y: 2.0, w: 7, h: 2.5, fill: { color: "504B46" } });
s.addText("Operations\\nExcellence Report", {
  x: 0.8, y: 1.0, w: 8.4, h: 2.2,
  fontSize: 46, fontFace: D.headerFont, color: "FFFFFF", bold: true, lineSpacingMultiple: 1.05,
});
s.addShape("rect", { x: 0.8, y: 3.4, w: 2.0, h: 0.06, fill: { color: D.accent } });
s.addText("Manufacturing & Supply Chain  |  Q1 2026", {
  x: 0.8, y: 3.65, w: 6, h: 0.35,
  fontSize: 12, fontFace: D.bodyFont, color: D.elevated, charSpacing: 1,
});

// --- Stacked Bar Chart: multi-category comparison ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 5.55, w: 10, h: 0.08, fill: { color: D.accent } });
// Heavy section divider
s.addShape("rect", { x: 0.6, y: 0.8, w: 8.8, h: 0.06, fill: { color: D.primary } });
s.addText("Production Output by Category", {
  x: 0.6, y: 0.15, w: 8.8, h: 0.55,
  fontSize: 18, fontFace: D.headerFont, color: D.text, bold: true,
});
s.addChart(pres.charts.BAR_STACKED, [
  { name: "Assembly", labels: ["Plant A","Plant B","Plant C","Plant D"], values: [420,380,510,290] },
  { name: "Finishing", labels: ["Plant A","Plant B","Plant C","Plant D"], values: [180,220,150,310] },
  { name: "QA Rework", labels: ["Plant A","Plant B","Plant C","Plant D"], values: [45,62,28,55] },
], {
  x: 0.5, y: 1.1, w: 9, h: 3.8,
  chartColors: [D.primary, D.secondary, D.accent],
  showLegend: true, legendPos: "b",
  catAxisOrientation: "minMax",
  valAxisLabelFontSize: 9, catAxisLabelFontSize: 9,
});

// --- Maturity Scorecard with progress bars + delta arrows ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 5.55, w: 10, h: 0.08, fill: { color: D.accent } });
s.addShape("rect", { x: 0.6, y: 0.8, w: 8.8, h: 0.06, fill: { color: D.primary } });
s.addText("Operational Maturity Assessment", {
  x: 0.6, y: 0.15, w: 8.8, h: 0.55,
  fontSize: 18, fontFace: D.headerFont, color: D.text, bold: true,
});
const maturity = [
  { area: "Lean Manufacturing", score: 4.1, max: 5, delta: "+0.4", trend: "up" },
  { area: "Supply Chain Resilience", score: 3.2, max: 5, delta: "-0.2", trend: "down" },
  { area: "Quality Systems (ISO)", score: 4.6, max: 5, delta: "+0.1", trend: "up" },
  { area: "Workforce Safety", score: 3.8, max: 5, delta: "+0.6", trend: "up" },
  { area: "Digital Integration", score: 2.5, max: 5, delta: "+0.3", trend: "up" },
];
maturity.forEach((m, i) => {
  const y = 1.1 + i * 0.78;
  s.addText(m.area, { x: 0.6, y, w: 2.8, h: 0.4, fontSize: 11, fontFace: D.bodyFont, color: D.text, bold: true, valign: "middle" });
  // Progress bar track
  const barW = 4.0;
  s.addShape("rect", { x: 3.6, y: y + 0.12, w: barW, h: 0.2, fill: { color: D.card } });
  // Progress bar fill
  const fillW = barW * (m.score / m.max);
  const barColor = m.score >= 4 ? D.accent : m.score >= 3 ? D.secondary : D.primary;
  s.addShape("rect", { x: 3.6, y: y + 0.12, w: fillW, h: 0.2, fill: { color: barColor } });
  // Score
  s.addText(m.score.toFixed(1), { x: 7.85, y, w: 0.6, h: 0.4, fontSize: 14, fontFace: D.headerFont, color: barColor, bold: true, align: "center", valign: "middle" });
  // Delta arrow
  const arrowColor = m.trend === "up" ? "16A34A" : "EF4444";
  const arrow = m.trend === "up" ? "▲" : "▼";
  s.addText(arrow + " " + m.delta, { x: 8.5, y, w: 1.0, h: 0.4, fontSize: 10, fontFace: D.bodyFont, color: arrowColor, bold: true, align: "right", valign: "middle" });
  // Divider between rows
  if (i < maturity.length - 1) {
    s.addShape("rect", { x: 0.6, y: y + 0.65, w: 8.8, h: 0.005, fill: { color: D.divider } });
  }
});

// --- Numbered Recommendation Cards (3-column) ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 5.55, w: 10, h: 0.08, fill: { color: D.accent } });
s.addShape("rect", { x: 0.6, y: 0.8, w: 8.8, h: 0.06, fill: { color: D.primary } });
s.addText("Key Recommendations", {
  x: 0.6, y: 0.15, w: 8.8, h: 0.55,
  fontSize: 18, fontFace: D.headerFont, color: D.text, bold: true,
});
const recs = [
  { num: "01", title: "Automate QA Inspection", desc: "Deploy vision-based inspection at Plants B and D to reduce rework by 40%.", impact: "$1.2M savings" },
  { num: "02", title: "Supplier Diversification", desc: "Onboard 3 alternate suppliers for critical components within 90 days.", impact: "Risk reduction" },
  { num: "03", title: "Upskill Digital Teams", desc: "Certify 45 operators in PLC programming and IoT sensor maintenance.", impact: "18% efficiency" },
];
recs.forEach((r, i) => {
  const x = 0.4 + i * 3.15;
  s.addShape("rect", { x, y: 1.1, w: 2.95, h: 3.6, fill: { color: D.surface }, rectRadius: 0.06 });
  // Amber number badge
  s.addShape("rect", { x, y: 1.1, w: 2.95, h: 0.6, fill: { color: D.primary }, rectRadius: 0.04 });
  s.addText(r.num, { x, y: 1.1, w: 2.95, h: 0.6, fontSize: 22, fontFace: D.headerFont, color: D.accent, bold: true, align: "center", valign: "middle" });
  s.addText(r.title, { x: x+0.2, y: 1.9, w: 2.55, h: 0.45, fontSize: 12, fontFace: D.headerFont, color: D.text, bold: true });
  s.addText(r.desc, { x: x+0.2, y: 2.4, w: 2.55, h: 1.2, fontSize: 9.5, fontFace: D.bodyFont, color: D.textMuted });
  // Impact badge
  s.addShape("rect", { x: x+0.2, y: 3.8, w: 2.55, h: 0.35, fill: { color: D.accentLight }, rectRadius: 0.04 });
  s.addText(r.impact, { x: x+0.2, y: 3.8, w: 2.55, h: 0.35, fontSize: 10, fontFace: D.bodyFont, color: D.accent, bold: true, align: "center", valign: "middle" });
});`,
  footerPattern: `function addFooter(s, num) {
  // Amber accent bar at bottom is part of every content slide (see codePatterns)
  s.addText("FORGE  |  OPERATIONS REPORT", { x: 0.6, y: 5.33, w: 4, h: 0.2, fontSize: 7, fontFace: D.bodyFont, color: D.textLight, charSpacing: 2 });
  s.addText(num.toString().padStart(2, "0"), { x: 8.5, y: 5.33, w: 1.0, h: 0.2, fontSize: 7, fontFace: D.bodyFont, color: D.textLight, align: "right" });
}`,
  qualityChecklist: `- Background: warm stone D.bg ("F5F5F4"), cards on D.surface ("FFFFFF")
- Amber accent bar (h: 0.08) at the bottom of EVERY content slide
- Steel grey (#44403C) primary, stone (#78716C) secondary, amber (#D97706) accent
- Heavy horizontal dividers (h: 0.06) between sections
- Stacked bar charts for multi-category operational comparisons
- Maturity scorecards with progress bars and coloured delta arrows (green up, red down)
- Three-column numbered recommendation cards with amber numbering and impact badges
- Process steps with numbered badges and connector arrows
- All Calibri for both headlines and body (industrial clarity)
- 8-12 slides, industrial weight, operations-focused tone`,
};
