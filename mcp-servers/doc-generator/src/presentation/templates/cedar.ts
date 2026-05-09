import type { PresentationTemplate } from '../types.js';

export const cedar: PresentationTemplate = {
  name: "cedar",
  displayName: "Cedar",
  description: "Warm cedar design with terracotta and sage, engagement scorecards, doughnut charts with legend cards, initiative timeline tracking, and employee experience layouts.",
  tags: ["light", "organic", "warm", "people", "initiative"],
  designTokens: `const D = {
  bg: "FBF7F4", surface: "FFFFFF", card: "F5EDE4", elevated: "EDE0D4",
  primary: "9A3412", secondary: "7C2D12", accent: "4D7C0F", accentLight: "D4E7BE",
  text: "1C1917", textMuted: "78716C", textLight: "A8A29E",
  divider: "E7E5E4",
  headerFont: "Georgia", bodyFont: "Calibri",
};`,
  layoutDna:
    "Warm parchment background (#FBF7F4) with terracotta (#9A3412) as primary and sage green (#4D7C0F) as accent. " +
    "Title slide features warm overlapping circle decorations in terracotta and sand tones. " +
    "Doughnut charts paired with legend sidebar cards for composition breakdowns. " +
    "Engagement scorecards with coloured progress bars and percentage callouts. " +
    "Initiative cards with timeline badges, target dates, and terracotta left-border accent strips. " +
    "Before/after comparison strips for transformation impact. " +
    "Georgia for warm editorial headers, Calibri for readable body text.",
  codePatterns: `// --- Title Slide: warm circles + cedar opener ---
s.background = { fill: D.bg };
// Warm overlapping circle decorations
s.addShape("ellipse", { x: 5.5, y: -0.5, w: 6, h: 6, fill: { color: D.card } });
s.addShape("ellipse", { x: 7.0, y: 1.5, w: 4, h: 4, fill: { color: D.elevated } });
s.addShape("ellipse", { x: 6.0, y: 3.0, w: 3, h: 3, fill: { color: D.card } });
s.addShape("ellipse", { x: -1.5, y: 3.5, w: 4, h: 4, fill: { color: D.elevated } });
s.addText("People &\\nCulture", {
  x: 0.8, y: 1.0, w: 5.5, h: 2.4,
  fontSize: 48, fontFace: D.headerFont, color: D.primary, bold: true, lineSpacingMultiple: 1.05,
});
s.addShape("rect", { x: 0.8, y: 3.6, w: 2.0, h: 0.05, fill: { color: D.primary } });
s.addText("Employee Experience Report  |  2026", {
  x: 0.8, y: 3.85, w: 5, h: 0.35,
  fontSize: 12, fontFace: D.bodyFont, color: D.textMuted, charSpacing: 1,
});

// --- Engagement Scorecards with coloured progress bars ---
s.background = { fill: D.bg };
s.addText("Engagement Scorecard", {
  x: 0.6, y: 0.2, w: 8.8, h: 0.55,
  fontSize: 18, fontFace: D.headerFont, color: D.primary, bold: true,
});
s.addShape("rect", { x: 0.6, y: 0.8, w: 8.8, h: 0.03, fill: { color: D.primary } });
const scores = [
  { category: "Overall Engagement", score: 78, prev: 72, benchmark: 75 },
  { category: "Manager Effectiveness", score: 82, prev: 79, benchmark: 77 },
  { category: "Career Development", score: 64, prev: 60, benchmark: 70 },
  { category: "Work-Life Balance", score: 71, prev: 74, benchmark: 72 },
  { category: "DEI & Belonging", score: 69, prev: 65, benchmark: 68 },
];
scores.forEach((sc, i) => {
  const y = 1.05 + i * 0.82;
  // Terracotta left-border accent strip
  s.addShape("rect", { x: 0.5, y, w: 9.0, h: 0.68, fill: { color: D.surface }, rectRadius: 0.04 });
  s.addShape("rect", { x: 0.5, y, w: 0.08, h: 0.68, fill: { color: D.primary } });
  s.addText(sc.category, { x: 0.8, y, w: 2.6, h: 0.35, fontSize: 11, fontFace: D.bodyFont, color: D.text, bold: true, valign: "middle" });
  // Progress bar
  const barW = 3.5;
  const fillColor = sc.score >= sc.benchmark ? D.accent : sc.score >= sc.benchmark - 5 ? D.primary : D.secondary;
  s.addShape("rect", { x: 3.6, y: y + 0.22, w: barW, h: 0.2, fill: { color: D.divider } });
  s.addShape("rect", { x: 3.6, y: y + 0.22, w: barW * (sc.score / 100), h: 0.2, fill: { color: fillColor }, rectRadius: 0.03 });
  // Benchmark marker
  const bmX = 3.6 + barW * (sc.benchmark / 100);
  s.addShape("rect", { x: bmX, y: y + 0.17, w: 0.02, h: 0.3, fill: { color: D.text } });
  // Score callout
  s.addText(sc.score + "%", { x: 7.4, y, w: 0.7, h: 0.68, fontSize: 18, fontFace: D.headerFont, color: fillColor, bold: true, align: "center", valign: "middle" });
  // Delta from previous
  const delta = sc.score - sc.prev;
  const arrowColor = delta >= 0 ? "16A34A" : "EF4444";
  const arrow = delta >= 0 ? "▲" : "▼";
  s.addText(arrow + " " + Math.abs(delta) + "pts", { x: 8.2, y, w: 1.2, h: 0.68, fontSize: 10, fontFace: D.bodyFont, color: arrowColor, bold: true, align: "right", valign: "middle" });
});

// --- Doughnut Chart with Legend Sidebar Cards ---
s.background = { fill: D.bg };
s.addText("Workforce Composition", {
  x: 0.6, y: 0.2, w: 8.8, h: 0.55,
  fontSize: 18, fontFace: D.headerFont, color: D.primary, bold: true,
});
s.addShape("rect", { x: 0.6, y: 0.8, w: 8.8, h: 0.03, fill: { color: D.primary } });
// Doughnut chart (left side)
s.addChart(pres.charts.DOUGHNUT, [
  { name: "Composition", labels: ["Engineering","Product","Operations","Sales","People"], values: [35,18,22,15,10] },
], {
  x: 0.3, y: 1.0, w: 5.0, h: 4.2,
  chartColors: [D.primary, D.secondary, D.accent, "B45309", "A16207"],
  showLegend: false, holeSize: 55,
  dataLabelPosition: "outEnd", showPercent: true, dataLabelFontSize: 10,
});
// Legend sidebar cards (right side)
const segments = [
  { label: "Engineering", pct: "35%", count: "420", color: D.primary },
  { label: "Product", pct: "18%", count: "216", color: D.secondary },
  { label: "Operations", pct: "22%", count: "264", color: D.accent },
  { label: "Sales", pct: "15%", count: "180", color: "B45309" },
  { label: "People", pct: "10%", count: "120", color: "A16207" },
];
segments.forEach((seg, i) => {
  const y = 1.1 + i * 0.78;
  s.addShape("rect", { x: 5.6, y, w: 4.0, h: 0.65, fill: { color: D.surface }, rectRadius: 0.04 });
  // Colour dot
  s.addShape("ellipse", { x: 5.8, y: y + 0.2, w: 0.2, h: 0.2, fill: { color: seg.color } });
  s.addText(seg.label, { x: 6.15, y, w: 1.8, h: 0.65, fontSize: 10, fontFace: D.bodyFont, color: D.text, bold: true, valign: "middle" });
  s.addText(seg.pct, { x: 8.0, y, w: 0.6, h: 0.65, fontSize: 14, fontFace: D.headerFont, color: seg.color, bold: true, align: "center", valign: "middle" });
  s.addText(seg.count, { x: 8.6, y, w: 0.8, h: 0.65, fontSize: 10, fontFace: D.bodyFont, color: D.textMuted, align: "right", valign: "middle" });
});

// --- Before/After Comparison Strips ---
s.background = { fill: D.bg };
s.addText("Transformation Impact", {
  x: 0.6, y: 0.2, w: 8.8, h: 0.55,
  fontSize: 18, fontFace: D.headerFont, color: D.primary, bold: true,
});
s.addShape("rect", { x: 0.6, y: 0.8, w: 8.8, h: 0.03, fill: { color: D.primary } });
// Column headers
s.addText("METRIC", { x: 0.6, y: 0.95, w: 2.5, h: 0.35, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted, bold: true, charSpacing: 2 });
s.addText("BEFORE", { x: 3.5, y: 0.95, w: 2.5, h: 0.35, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted, bold: true, align: "center", charSpacing: 2 });
s.addText("AFTER", { x: 6.2, y: 0.95, w: 2.5, h: 0.35, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted, bold: true, align: "center", charSpacing: 2 });
const comparisons = [
  { metric: "Engagement Score", before: "62%", after: "78%", improved: true },
  { metric: "Voluntary Attrition", before: "18%", after: "11%", improved: true },
  { metric: "Time to Fill (days)", before: "58", after: "34", improved: true },
  { metric: "Internal Mobility", before: "8%", after: "15%", improved: true },
  { metric: "Training Hours/FTE", before: "12", after: "28", improved: true },
  { metric: "eNPS", before: "+14", after: "+42", improved: true },
];
comparisons.forEach((c, i) => {
  const y = 1.4 + i * 0.65;
  const rowBg = i % 2 === 0 ? D.surface : D.bg;
  s.addShape("rect", { x: 0.5, y, w: 9.0, h: 0.55, fill: { color: rowBg } });
  // Terracotta left accent
  s.addShape("rect", { x: 0.5, y, w: 0.06, h: 0.55, fill: { color: D.primary } });
  s.addText(c.metric, { x: 0.8, y, w: 2.5, h: 0.55, fontSize: 11, fontFace: D.bodyFont, color: D.text, bold: true, valign: "middle" });
  s.addText(c.before, { x: 3.5, y, w: 2.5, h: 0.55, fontSize: 14, fontFace: D.headerFont, color: D.textMuted, align: "center", valign: "middle" });
  s.addText(c.after, { x: 6.2, y, w: 2.5, h: 0.55, fontSize: 14, fontFace: D.headerFont, color: c.improved ? D.accent : D.primary, bold: true, align: "center", valign: "middle" });
  // Arrow indicator
  s.addText("→", { x: 5.7, y, w: 0.5, h: 0.55, fontSize: 14, fontFace: D.bodyFont, color: D.textLight, align: "center", valign: "middle" });
});`,
  footerPattern: `function addFooter(s, num) {
  s.addShape("rect", { x: 0, y: 5.35, w: 10, h: 0.01, fill: { color: D.divider } });
  s.addText("CEDAR  |  PEOPLE & CULTURE", { x: 0.6, y: 5.33, w: 4, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textLight, charSpacing: 2 });
  s.addText(num.toString().padStart(2, "0"), { x: 8.5, y: 5.33, w: 1.0, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textLight, align: "right" });
}`,
  qualityChecklist: `- Background: warm parchment D.bg ("FBF7F4"), cards on D.surface ("FFFFFF")
- Terracotta (#9A3412) primary, dark terracotta (#7C2D12) secondary, sage green (#4D7C0F) accent
- Title slide: warm overlapping circle decorations in terracotta and sand tones
- Terracotta left-border accent strips (w: 0.06-0.08) on cards and rows
- Doughnut chart with legend sidebar cards showing composition breakdowns
- Engagement scorecards with coloured progress bars, benchmark markers, and delta arrows
- Before/after comparison strips with alternating row shading
- Initiative cards with timeline badges and target dates
- Organic circular decorations on title slide
- Georgia for headers, Calibri for body — warm editorial people-focused feel
- 8-12 slides, warm tones, employee experience tone`,
};
