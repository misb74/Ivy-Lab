import type { PresentationTemplate } from '../types.js';

export const mosaic: PresentationTemplate = {
  name: "mosaic",
  displayName: "Mosaic",
  description: "Vibrant mosaic with multi-colour tile layouts, stacked comparison columns, pie charts, initiative grids, and inclusive design patterns.",
  tags: ["light", "vibrant", "people", "organic", "pink"],
  designTokens: `const D = {
  bg: "FFFBF5", surface: "FFFFFF", card: "FEF3E2", elevated: "FDE5C3",
  primary: "9333EA", secondary: "EC4899", accent: "14B8A6",
  warm: "EA580C",
  text: "1F1B2D", textMuted: "6B5E7B", textDim: "A093B0",
  divider: "E8DFF0",
  headerFont: "Georgia", bodyFont: "Calibri",
};`,
  layoutDna:
    "Warm cream background (#FFFBF5) with a vibrant multi-colour palette: purple (#9333EA), pink (#EC4899), teal (#14B8A6), and orange (#EA580C). " +
    "Mosaic tile grids of coloured rectangles create visual energy on the title slide and section dividers. " +
    "Pie charts use the full multi-colour palette for celebratory data visualisation. " +
    "Three-column initiative cards use different accent colours per column for diversity and distinction. " +
    "Stacked comparison columns for DEI and inclusion metrics. Coloured category badges (pill-shaped rounded rects). " +
    "Georgia for headers (warm and inclusive), Calibri for body. Overall feel is celebratory, welcoming, and people-focused.",
  codePatterns: `// --- Title Slide: mosaic tile grid decoration ---
s.background = { fill: D.bg };
// Decorative mosaic pattern — small coloured squares arranged in abstract grid
const mosaicColors = [D.primary, D.secondary, D.accent, D.warm, "F59E0B", "6366F1"];
const tiles = [
  { x: 6.8, y: 0.4, w: 0.55, h: 0.55 }, { x: 7.45, y: 0.4, w: 0.35, h: 0.35 },
  { x: 7.9, y: 0.4, w: 0.55, h: 0.55 }, { x: 8.55, y: 0.4, w: 0.35, h: 0.75 },
  { x: 6.8, y: 1.05, w: 0.35, h: 0.35 }, { x: 7.25, y: 0.85, w: 0.55, h: 0.55 },
  { x: 7.9, y: 1.05, w: 0.55, h: 0.35 }, { x: 8.55, y: 1.25, w: 0.35, h: 0.55 },
  { x: 6.8, y: 1.5, w: 0.55, h: 0.35 }, { x: 7.45, y: 1.5, w: 0.35, h: 0.55 },
  { x: 7.9, y: 1.5, w: 0.55, h: 0.55 }, { x: 9.0, y: 0.6, w: 0.55, h: 0.55 },
];
tiles.forEach((t, i) => {
  s.addShape("rect", {
    x: t.x, y: t.y, w: t.w, h: t.h,
    fill: { color: mosaicColors[i % mosaicColors.length] },
    rectRadius: 0.04,
  });
});
s.addText("Inclusion &\\nCulture Report", {
  x: 0.8, y: 1.3, w: 5.5, h: 2.2,
  fontSize: 48, fontFace: D.headerFont, color: D.text, bold: true, lineSpacingMultiple: 1.0,
});
s.addShape("rect", { x: 0.8, y: 3.7, w: 3.0, h: 0.015, fill: { color: D.primary } });
s.addText("2026 Annual Report  |  People & Culture", {
  x: 0.8, y: 3.9, w: 5, h: 0.35,
  fontSize: 12, fontFace: D.bodyFont, color: D.textMuted,
});

// --- Pie Chart: multi-colour workforce representation ---
s.background = { fill: D.bg };
s.addText("Workforce Representation", {
  x: 0.8, y: 0.4, w: 8, h: 0.5,
  fontSize: 24, fontFace: D.headerFont, color: D.text, bold: true,
});
s.addText("Diversity breakdown across all regions", {
  x: 0.8, y: 0.9, w: 8, h: 0.3, fontSize: 11, fontFace: D.bodyFont, color: D.textMuted,
});
s.addChart(pres.charts.PIE, [
  { name: "Representation", labels: ["Women","Men","Non-Binary","Undisclosed"], values: [42, 48, 5, 5] },
], {
  x: 0.5, y: 1.5, w: 4.5, h: 3.5,
  chartColors: [D.secondary, D.primary, D.accent, D.warm],
  showPercent: true, showLegend: false,
  dataLabelColor: D.text, dataLabelFontSize: 10,
});
// Custom legend cards on right side
const legendItems = [
  { label: "Women", value: "42%", color: D.secondary },
  { label: "Men", value: "48%", color: D.primary },
  { label: "Non-Binary", value: "5%", color: D.accent },
  { label: "Undisclosed", value: "5%", color: D.warm },
];
legendItems.forEach((item, i) => {
  const y = 1.7 + i * 0.75;
  s.addShape("rect", { x: 5.6, y, w: 0.25, h: 0.25, fill: { color: item.color }, rectRadius: 0.04 });
  s.addText(item.label, { x: 6.0, y, w: 1.6, h: 0.25, fontSize: 10, fontFace: D.bodyFont, color: D.text, valign: "middle" });
  s.addText(item.value, { x: 7.7, y, w: 0.8, h: 0.25, fontSize: 10, fontFace: D.bodyFont, color: item.color, bold: true, valign: "middle" });
});

// --- Three-Column Initiative Cards with different accent colours ---
s.background = { fill: D.bg };
s.addText("Key Initiatives", {
  x: 0.8, y: 0.4, w: 8, h: 0.5,
  fontSize: 24, fontFace: D.headerFont, color: D.text, bold: true,
});
const initiatives = [
  { title: "Leadership Pipeline", desc: "Accelerate diverse leadership with sponsorship programme targeting 40% representation by 2027.", color: D.primary, badge: "DEVELOP" },
  { title: "Inclusive Hiring", desc: "Blind resume screening and structured interviews across all business units.", color: D.secondary, badge: "RECRUIT" },
  { title: "Belonging Index", desc: "Quarterly pulse surveys measuring psychological safety and inclusion scores.", color: D.accent, badge: "MEASURE" },
];
initiatives.forEach((init, i) => {
  const x = 0.5 + i * 3.1;
  const y = 1.3;
  s.addShape("rect", { x, y, w: 2.85, h: 3.2, fill: { color: D.surface }, rectRadius: 0.08, shadow: { type: "outer", blur: 6, offset: 2, color: "000000", opacity: 0.08 } });
  // Coloured top accent bar
  s.addShape("rect", { x, y, w: 2.85, h: 0.06, fill: { color: init.color }, rectRadius: 0.08 });
  // Badge pill
  s.addShape("rect", { x: x + 0.2, y: y + 0.3, w: 1.1, h: 0.28, fill: { color: init.color, transparency: 85 }, rectRadius: 0.14 });
  s.addText(init.badge, { x: x + 0.2, y: y + 0.3, w: 1.1, h: 0.28, fontSize: 7, fontFace: D.bodyFont, color: init.color, bold: true, align: "center", valign: "middle", charSpacing: 1.5 });
  // Title and description
  s.addText(init.title, { x: x + 0.2, y: y + 0.8, w: 2.45, h: 0.4, fontSize: 14, fontFace: D.headerFont, color: D.text, bold: true });
  s.addText(init.desc, { x: x + 0.2, y: y + 1.3, w: 2.45, h: 1.5, fontSize: 10, fontFace: D.bodyFont, color: D.textMuted, lineSpacingMultiple: 1.3 });
});

// --- Stacked Comparison Columns for DEI metrics ---
s.background = { fill: D.bg };
s.addText("Inclusion Metrics — Year over Year", {
  x: 0.8, y: 0.4, w: 8, h: 0.5,
  fontSize: 24, fontFace: D.headerFont, color: D.text, bold: true,
});
const metrics = [
  { label: "Belonging Score", fy25: 72, fy26: 81, unit: "%" },
  { label: "Diverse Hires", fy25: 34, fy26: 42, unit: "%" },
  { label: "Retention (URM)", fy25: 78, fy26: 85, unit: "%" },
  { label: "Pay Equity Gap", fy25: 6.2, fy26: 3.1, unit: "%" },
];
const maxVal = 100, barMaxH = 2.8;
metrics.forEach((m, i) => {
  const x = 1.2 + i * 2.15;
  const baseY = 4.6;
  // FY25 bar (muted)
  const h25 = barMaxH * (m.fy25 / maxVal);
  s.addShape("rect", { x, y: baseY - h25, w: 0.7, h: h25, fill: { color: D.textDim, transparency: 40 }, rectRadius: 0.04 });
  s.addText(m.fy25 + m.unit, { x, y: baseY - h25 - 0.26, w: 0.7, h: 0.22, fontSize: 8, fontFace: D.bodyFont, color: D.textDim, align: "center" });
  // FY26 bar (coloured)
  const barColor = [D.primary, D.secondary, D.accent, D.warm][i];
  const h26 = barMaxH * (m.fy26 / maxVal);
  s.addShape("rect", { x: x + 0.85, y: baseY - h26, w: 0.7, h: h26, fill: { color: barColor }, rectRadius: 0.04 });
  s.addText(m.fy26 + m.unit, { x: x + 0.85, y: baseY - h26 - 0.26, w: 0.7, h: 0.22, fontSize: 8, fontFace: D.bodyFont, color: barColor, bold: true, align: "center" });
  // Label
  s.addText(m.label, { x, y: baseY + 0.08, w: 1.55, h: 0.3, fontSize: 9, fontFace: D.bodyFont, color: D.text, align: "center" });
});
// Legend
s.addShape("rect", { x: 7.5, y: 1.3, w: 0.25, h: 0.25, fill: { color: D.textDim, transparency: 40 } });
s.addText("FY25", { x: 7.85, y: 1.3, w: 0.8, h: 0.25, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted, valign: "middle" });
s.addShape("rect", { x: 7.5, y: 1.65, w: 0.25, h: 0.25, fill: { color: D.primary } });
s.addText("FY26", { x: 7.85, y: 1.65, w: 0.8, h: 0.25, fontSize: 9, fontFace: D.bodyFont, color: D.text, valign: "middle" });`,
  footerPattern: `function addFooter(s, num) {
  s.addShape("rect", { x: 0, y: 5.42, w: 10, h: 0.01, fill: { color: D.divider } });
  s.addText("MOSAIC  |  INCLUSION & CULTURE", { x: 0.8, y: 5.25, w: 4, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textDim, charSpacing: 2 });
  s.addText(num.toString().padStart(2, "0"), { x: 8.5, y: 5.25, w: 0.8, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textDim, align: "right" });
}`,
  qualityChecklist: `- Background: warm cream D.bg ("FFFBF5") — not pure white
- Multi-colour palette: purple (#9333EA), pink (#EC4899), teal (#14B8A6), orange (#EA580C) — all four used
- Mosaic tile grid on title slide: 10-12 small coloured rectangles in abstract arrangement
- Pie chart uses native pres.charts.PIE with all four palette colours
- Initiative cards: three columns, each with a different accent colour top bar and matching badge pill
- Stacked comparison bars: paired FY25 (muted) + FY26 (coloured) per metric
- Category badges: pill-shaped rounded rects (rectRadius: 0.14) with transparent fill
- Georgia for headlines, Calibri for body — warm and inclusive
- Cards use white fill with subtle shadow (opacity 0.08) for lightness
- 8-12 slides, celebratory and people-focused feel`,
};
