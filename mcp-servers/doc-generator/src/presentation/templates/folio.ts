import type { PresentationTemplate } from '../types.js';

export const folio: PresentationTemplate = {
  name: "folio",
  displayName: "Folio",
  description: "Ultra-minimal Swiss typographic portfolio with pure black and single teal accent, maximum whitespace, and editorial precision.",
  tags: ["minimal", "consulting", "clean", "typographic", "academic"],
  designTokens: `const D = {
  bg: "FFFFFF", surface: "FAFAFA", card: "F4F4F5",
  primary: "18181B", secondary: "3F3F46", accent: "0D9488",
  text: "18181B", textMuted: "71717A", textLight: "A1A1AA",
  divider: "E4E4E7",
  headerFont: "Calibri", bodyFont: "Calibri",
};`,
  layoutDna:
    "Pure white background with black (#18181B) as primary and a single teal (#0D9488) accent — the only colour. " +
    "Swiss International Typographic Style: maximum whitespace, pure typography, every pixel justified. " +
    "Title slide: 56pt bold title, a tiny teal square (0.08x0.08) as the sole decoration, thin grey divider. " +
    "Numbered items use teal accent for '01'/'02' numbering. Hair-thin dividers (h: 0.003 to 0.01) separate items. " +
    "Quote blocks feature a vertical teal bar. Pie charts in teal-grey palette. " +
    "Section dividers with large light-weight numbers. No footer — the design speaks for itself. All Calibri for Swiss clarity.",
  codePatterns: `// --- Title Slide: pure white, typographic only ---
s.background = { fill: D.bg };
// Tiny teal square — the sole decoration
s.addShape("rect", { x: 0.8, y: 0.8, w: 0.08, h: 0.08, fill: { color: D.accent } });
s.addText("Workforce\\nStrategy\\nPortfolio", {
  x: 0.8, y: 1.15, w: 8, h: 2.8,
  fontSize: 56, fontFace: D.headerFont, color: D.text, bold: true, lineSpacingMultiple: 0.95,
});
s.addShape("rect", { x: 0.8, y: 4.2, w: 3.0, h: 0.008, fill: { color: D.divider } });
s.addText("2026", { x: 0.8, y: 4.45, w: 1.2, h: 0.35, fontSize: 13, fontFace: D.bodyFont, color: D.textMuted });
s.addText("Confidential", { x: 3.0, y: 4.45, w: 2.0, h: 0.35, fontSize: 13, fontFace: D.bodyFont, color: D.textLight });

// --- Numbered Items with teal accent + hair-thin dividers ---
s.background = { fill: D.bg };
// Section header
s.addText("KEY FINDINGS", { x: 0.8, y: 0.5, w: 8, h: 0.4, fontSize: 10, fontFace: D.bodyFont, color: D.textLight, charSpacing: 3 });
s.addShape("rect", { x: 0.8, y: 1.0, w: 8.4, h: 0.008, fill: { color: D.text } });
const items = [
  { num: "01", title: "Headcount grew 22%", detail: "Largest year of growth driven by AI-adjacent hires across engineering." },
  { num: "02", title: "Attrition dropped to 8.4%", detail: "Below industry benchmark of 12.1%, driven by improved manager quality scores." },
  { num: "03", title: "Skills gap narrowed 31%", detail: "Targeted reskilling programmes closed cloud and ML engineering gaps." },
  { num: "04", title: "Time-to-fill reduced to 38 days", detail: "Internal mobility programme sourced 40% of mid-level placements." },
];
items.forEach((item, i) => {
  const y = 1.25 + i * 0.95;
  s.addText(item.num, { x: 0.8, y, w: 0.65, h: 0.32, fontSize: 18, fontFace: D.headerFont, color: D.accent, bold: true });
  s.addText(item.title, { x: 1.55, y, w: 7.65, h: 0.32, fontSize: 13, fontFace: D.headerFont, color: D.text, bold: true });
  s.addText(item.detail, { x: 1.55, y: y + 0.35, w: 7.65, h: 0.3, fontSize: 9.5, fontFace: D.bodyFont, color: D.textMuted });
  if (i < items.length - 1) s.addShape("rect", { x: 0.8, y: y + 0.82, w: 8.4, h: 0.003, fill: { color: D.divider } });
});

// --- Pie Chart in Teal-Grey Palette + Quote Block ---
s.background = { fill: D.bg };
s.addText("COMPOSITION", { x: 0.8, y: 0.5, w: 8, h: 0.4, fontSize: 10, fontFace: D.bodyFont, color: D.textLight, charSpacing: 3 });
s.addShape("rect", { x: 0.8, y: 1.0, w: 8.4, h: 0.008, fill: { color: D.text } });
// Pie chart — teal + greys only
s.addChart(pres.charts.PIE,
  [{ name: "Workforce", labels: ["Engineering","Operations","Sales","Support"], values: [38, 27, 22, 13] }],
  { x: 0.5, y: 1.3, w: 4.5, h: 3.8, chartColors: [D.accent, D.primary, D.secondary, D.textLight], showPercent: true, showLegend: true, legendPos: "b", legendColor: D.textMuted }
);
// Quote block with vertical teal bar (right side)
s.addShape("rect", { x: 5.8, y: 1.8, w: 0.06, h: 2.0, fill: { color: D.accent } });
s.addText("The organisations that\\nwin are those that\\ntreat talent as their\\nprimary asset class.", {
  x: 6.2, y: 1.9, w: 3.3, h: 1.8,
  fontSize: 18, fontFace: D.headerFont, color: D.text, lineSpacingMultiple: 1.3,
});
s.addText("— Chief People Officer", { x: 6.2, y: 3.7, w: 3.0, h: 0.3, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted });

// --- Section Divider: large light number + clean title ---
s.background = { fill: D.bg };
s.addText("02", { x: 0.8, y: 1.6, w: 3, h: 1.2, fontSize: 80, fontFace: D.headerFont, color: D.textLight });
s.addShape("rect", { x: 0.8, y: 2.95, w: 4.0, h: 0.008, fill: { color: D.text } });
s.addText("Deep Analysis", { x: 0.8, y: 3.2, w: 5, h: 0.6, fontSize: 28, fontFace: D.headerFont, color: D.text, bold: true });
s.addText("Detailed examination of workforce composition,\\nskill distribution, and strategic gaps.", {
  x: 0.8, y: 3.9, w: 6, h: 0.6, fontSize: 10, fontFace: D.bodyFont, color: D.textMuted, lineSpacingMultiple: 1.4,
});`,
  footerPattern: `// Folio uses no explicit footer — ultra-minimal Swiss design. Slide number is omitted intentionally.`,
  qualityChecklist: `- Background: pure white D.bg ("FFFFFF") — no off-whites or creams
- Only TWO colours: black (#18181B) and teal (#0D9488) — nothing else
- Tiny teal square (0.08x0.08) as the sole decorative element on the title slide
- Section headers: spaced uppercase labels with thin black divider line
- Teal accent ONLY for: numbered items ("01"/"02"), pie chart primary slice, quote vertical bar, tiny square
- Hair-thin dividers (h: 0.003 to 0.01) between items — never thick rules
- Maximum whitespace — resist the urge to fill space
- All Calibri for both headlines and body (Swiss typographic style)
- No footer, no slide numbers — ultra-clean
- 8-12 slides, Swiss typographic precision`,
};
