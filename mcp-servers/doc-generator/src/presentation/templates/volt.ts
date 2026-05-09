import type { PresentationTemplate } from '../types.js';

export const volt: PresentationTemplate = {
  name: "volt",
  displayName: "Volt",
  description: "High-voltage keynote with electric red and navy, massive hero numbers, full-bleed colour blocks, before/after comparisons, no shadows, no icons.",
  tags: ["bold", "keynote", "red", "dramatic", "impact"],
  designTokens: `const D = {
  bg: "FFFFFF", surface: "F7F7F7", card: "EFEFEF",
  primary: "E63946", secondary: "1D3557", accent: "457B9D", accentLight: "A8DADC",
  text: "1D3557", textMuted: "6C757D", textLight: "ADB5BD",
  divider: "DEE2E6",
  headerFont: "Calibri", bodyFont: "Calibri",
};`,
  layoutDna:
    "White background with red (#E63946) and navy (#1D3557) as a punchy dual-accent system. " +
    "Title slide: 70/30 vertical split — navy left (70%) with massive white title, white right with ghosted year number. " +
    "Hero stat slides use FULL RED BACKGROUND with a single number at 120-160pt — one idea per slide. " +
    "Before/After comparison slides with paired cards, grey header for BEFORE and red header for AFTER. " +
    "Stacked horizontal bars with category labels. No shadows, no icons — flat keynote design only. " +
    "No footer — slides are meant to be projected, not printed. All Calibri for bold, modern impact.",
  codePatterns: `// --- Title Slide: 70/30 split (navy left, white right) ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 7.0, h: 5.63, fill: { color: D.secondary } });
s.addText("The Future\\nof Talent", {
  x: 0.9, y: 0.9, w: 5.5, h: 2.8,
  fontSize: 58, fontFace: D.headerFont, color: "FFFFFF", bold: true, lineSpacingMultiple: 0.9, valign: "bottom",
});
s.addShape("rect", { x: 0.9, y: 3.85, w: 1.8, h: 0.06, fill: { color: D.primary } });
s.addText("Executive Briefing  |  2026", {
  x: 0.9, y: 4.15, w: 5, h: 0.35,
  fontSize: 13, fontFace: D.bodyFont, color: D.accentLight, charSpacing: 1,
});
// Ghosted year on white right panel
s.addText("26", {
  x: 7.0, y: 1.0, w: 3.0, h: 3.5,
  fontSize: 120, fontFace: D.headerFont, color: D.divider, bold: true, align: "center", valign: "middle",
});

// --- Hero Stat: FULL RED BACKGROUND, single giant number ---
s.background = { fill: D.primary };
s.addText("TOTAL ADDRESSABLE MARKET", {
  x: 0, y: 0.6, w: 10, h: 0.4,
  fontSize: 12, fontFace: D.headerFont, color: "FFFFFF", bold: true, align: "center", charSpacing: 5, transparency: 30,
});
s.addText("$4.2B", {
  x: 0, y: 0.8, w: 10, h: 3.2,
  fontSize: 160, fontFace: D.headerFont, color: "FFFFFF", bold: true, align: "center", valign: "middle",
});
s.addShape("rect", { x: 3.2, y: 4.0, w: 3.6, h: 0.04, fill: { color: "FFFFFF" } });
s.addText("Projected market size by 2028", {
  x: 0, y: 4.2, w: 10, h: 0.4,
  fontSize: 14, fontFace: D.bodyFont, color: "FFFFFF", align: "center", transparency: 40,
});

// --- Before/After Comparison Cards ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.06, fill: { color: D.primary } });
s.addText("Transformation Impact", {
  x: 0, y: 0.25, w: 10, h: 0.6,
  fontSize: 28, fontFace: D.headerFont, color: D.text, bold: true, align: "center",
});
// BEFORE card (grey header)
s.addShape("rect", { x: 0.6, y: 1.25, w: 4.0, h: 4.15, fill: { color: D.surface }, rectRadius: 0.1 });
s.addShape("rect", { x: 0.6, y: 1.25, w: 4.0, h: 0.55, fill: { color: D.textMuted }, rectRadius: 0.1 });
s.addText("BEFORE", { x: 0.6, y: 1.25, w: 4.0, h: 0.55, fontSize: 15, fontFace: D.headerFont, color: "FFFFFF", bold: true, align: "center", valign: "middle" });
const beforeItems = [
  { metric: "Time-to-Fill", value: "67 days" },
  { metric: "Cost-per-Hire", value: "$8,400" },
  { metric: "Quality Score", value: "62%" },
  { metric: "Retention (1yr)", value: "71%" },
];
beforeItems.forEach((item, i) => {
  const y = 2.05 + i * 0.85;
  s.addText(item.metric, { x: 1.0, y, w: 3.2, h: 0.3, fontSize: 11, fontFace: D.bodyFont, color: D.textMuted });
  s.addText(item.value, { x: 1.0, y: y + 0.3, w: 3.2, h: 0.4, fontSize: 24, fontFace: D.headerFont, color: D.text, bold: true });
});
// AFTER card (red header)
s.addShape("rect", { x: 5.4, y: 1.25, w: 4.0, h: 4.15, fill: { color: D.surface }, rectRadius: 0.1 });
s.addShape("rect", { x: 5.4, y: 1.25, w: 4.0, h: 0.55, fill: { color: D.primary }, rectRadius: 0.1 });
s.addText("AFTER", { x: 5.4, y: 1.25, w: 4.0, h: 0.55, fontSize: 15, fontFace: D.headerFont, color: "FFFFFF", bold: true, align: "center", valign: "middle" });
const afterItems = [
  { metric: "Time-to-Fill", value: "34 days" },
  { metric: "Cost-per-Hire", value: "$4,200" },
  { metric: "Quality Score", value: "89%" },
  { metric: "Retention (1yr)", value: "93%" },
];
afterItems.forEach((item, i) => {
  const y = 2.05 + i * 0.85;
  s.addText(item.metric, { x: 5.8, y, w: 3.2, h: 0.3, fontSize: 11, fontFace: D.bodyFont, color: D.textMuted });
  s.addText(item.value, { x: 5.8, y: y + 0.3, w: 3.2, h: 0.4, fontSize: 24, fontFace: D.headerFont, color: D.primary, bold: true });
});

// --- Stacked Horizontal Bars (flat, no shadows) ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.06, fill: { color: D.primary } });
s.addText("Capability Distribution", {
  x: 0.8, y: 0.3, w: 8, h: 0.6,
  fontSize: 28, fontFace: D.headerFont, color: D.text, bold: true,
});
const categories = [
  { name: "Engineering", current: 72, target: 90 },
  { name: "Data Science", current: 45, target: 85 },
  { name: "Product", current: 68, target: 80 },
  { name: "Design", current: 55, target: 75 },
  { name: "Operations", current: 80, target: 85 },
];
const barMaxW = 5.5, barH = 0.4, barX = 3.5;
categories.forEach((cat, i) => {
  const y = 1.2 + i * 0.82;
  s.addText(cat.name, { x: 0.8, y, w: 2.5, h: barH + 0.1, fontSize: 11, fontFace: D.bodyFont, color: D.text, valign: "middle" });
  // Target bar (light)
  s.addShape("rect", { x: barX, y: y + 0.05, w: barMaxW * (cat.target / 100), h: barH, fill: { color: D.accentLight } });
  // Current bar (overlaid)
  const currentW = barMaxW * (cat.current / 100);
  const barColor = cat.current < cat.target * 0.7 ? D.primary : D.secondary;
  s.addShape("rect", { x: barX, y: y + 0.05, w: currentW, h: barH, fill: { color: barColor } });
  s.addText(cat.current + "%", { x: barX + currentW + 0.1, y, w: 0.8, h: barH + 0.1, fontSize: 10, fontFace: D.bodyFont, color: barColor, bold: true, valign: "middle" });
});
// Legend
s.addShape("rect", { x: 3.5, y: 5.0, w: 0.5, h: 0.15, fill: { color: D.secondary } });
s.addText("Current", { x: 4.1, y: 4.95, w: 1.0, h: 0.25, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted });
s.addShape("rect", { x: 5.3, y: 5.0, w: 0.5, h: 0.15, fill: { color: D.accentLight } });
s.addText("Target", { x: 5.9, y: 4.95, w: 1.0, h: 0.25, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted });`,
  footerPattern: `// Volt uses no footer — slides are designed for keynote projection.`,
  qualityChecklist: `- Title slide: 70/30 navy/white split, red accent bar separator, ghosted year on white panel
- Hero stat slides: FULL colour background (D.primary red or D.secondary navy) with giant numbers at 120-160pt
- One key idea per slide — minimal text, maximum impact
- Before/After comparison cards with coloured headers (grey vs red)
- Stacked horizontal bars: current overlaid on target, no shadows, flat design
- No shadows anywhere, no icons — flat keynote design only
- No footer on slides (keynote projection style)
- All Calibri for both headlines and body
- Red (#E63946) accent bars (h: 0.06) at slide tops as section markers
- 8-12 slides, large font sizes throughout, dramatic layouts`,
};
