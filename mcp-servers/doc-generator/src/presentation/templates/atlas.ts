import type { PresentationTemplate } from '../types.js';

export const atlas: PresentationTemplate = {
  name: "atlas",
  displayName: "Atlas",
  description: "Global market atlas with navy and silver, scatter charts, comparison tables, geographic tier cards, and dual-panel executive layouts.",
  tags: ["light", "consulting", "blue", "competitive", "financial"],
  designTokens: `const D = {
  bg: "F8FAFC", surface: "FFFFFF", card: "EEF2FF", elevated: "DBEAFE",
  primary: "1E3A5F", secondary: "3B82F6", accent: "10B981", warn: "EF4444",
  text: "1E293B", textMuted: "64748B", textLight: "94A3B8",
  divider: "CBD5E1",
  headerFont: "Georgia", bodyFont: "Calibri",
};`,
  layoutDna:
    "Cool silver-blue background (#F8FAFC) with deep navy (#1E3A5F) as primary and blue (#3B82F6) as secondary. " +
    "Navy header band (h: 0.6) spans the full width on every content slide, housing the slide title in white Georgia. " +
    "Scatter charts for market positioning analysis. Geographic tier cards arranged in 3-column layouts with coloured top bars acting as flag-like identifiers. " +
    "Dual-panel 50/50 executive summary layout for side-by-side strategic commentary. " +
    "Comparison data tables with alternating row shading for financial readability. Line charts for trend analysis across markets. " +
    "Georgia for authoritative headers, Calibri for crisp body text.",
  codePatterns: `// --- Title Slide: navy band + global atlas title ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 10, h: 2.8, fill: { color: D.primary } });
s.addShape("rect", { x: 0, y: 2.8, w: 10, h: 0.06, fill: { color: D.secondary } });
s.addText("Global Market\\nIntelligence", {
  x: 0.8, y: 0.6, w: 8.4, h: 2.0,
  fontSize: 46, fontFace: D.headerFont, color: "FFFFFF", bold: true, lineSpacingMultiple: 1.05,
});
s.addText("Q1 2026  |  Competitive Landscape Analysis", {
  x: 0.8, y: 3.2, w: 6, h: 0.4,
  fontSize: 13, fontFace: D.bodyFont, color: D.textMuted, charSpacing: 1,
});
// Decorative dots — subtle geographic motif
[{x:7.8,y:3.6},{x:8.2,y:3.3},{x:8.6,y:3.7},{x:8.0,y:4.0},{x:8.5,y:4.1}].forEach(p => {
  s.addShape("ellipse", { x: p.x, y: p.y, w: 0.12, h: 0.12, fill: { color: D.elevated } });
});

// --- Content Slide: navy header band + scatter chart ---
s.background = { fill: D.bg };
// Navy header band on every content slide
s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.6, fill: { color: D.primary } });
s.addText("Market Position Analysis", {
  x: 0.6, y: 0, w: 8.8, h: 0.6,
  fontSize: 16, fontFace: D.headerFont, color: "FFFFFF", bold: true, valign: "middle",
});
// Native scatter chart for market positioning
s.addChart(pres.charts.SCATTER, [
  { name: "EMEA Markets", values: [[2.1,4.3],[3.5,3.8],[4.2,5.1],[5.0,4.6]] },
  { name: "APAC Markets", values: [[1.8,2.9],[3.0,3.2],[4.5,2.7],[5.5,3.5]] },
  { name: "Americas", values: [[2.5,5.5],[3.8,5.0],[4.8,5.8],[6.0,5.2]] },
], {
  x: 0.5, y: 0.9, w: 9, h: 4.0,
  chartColors: [D.primary, D.secondary, D.accent],
  showLegend: true, legendPos: "b",
  valAxisTitle: "Market Attractiveness", catAxisTitle: "Competitive Strength",
  showValAxisTitle: true, showCatAxisTitle: true,
});

// --- Geographic Tier Cards (3-column) ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.6, fill: { color: D.primary } });
s.addText("Geographic Market Tiers", {
  x: 0.6, y: 0, w: 8.8, h: 0.6,
  fontSize: 16, fontFace: D.headerFont, color: "FFFFFF", bold: true, valign: "middle",
});
const tiers = [
  { title: "Tier 1 — Core Markets", markets: "US, UK, Germany, Japan", revenue: "$2.4B", growth: "+8.2%", color: D.primary },
  { title: "Tier 2 — Growth Markets", markets: "India, Brazil, UAE, Singapore", revenue: "$890M", growth: "+14.5%", color: D.secondary },
  { title: "Tier 3 — Emerging Markets", markets: "Vietnam, Nigeria, Poland, Chile", revenue: "$210M", growth: "+22.1%", color: D.accent },
];
tiers.forEach((t, i) => {
  const x = 0.4 + i * 3.15;
  // Card body
  s.addShape("rect", { x, y: 1.0, w: 2.95, h: 3.8, fill: { color: D.surface }, rectRadius: 0.06 });
  // Flag-like coloured top bar
  s.addShape("rect", { x, y: 1.0, w: 2.95, h: 0.12, fill: { color: t.color }, rectRadius: 0.04 });
  s.addText(t.title, { x: x+0.2, y: 1.3, w: 2.55, h: 0.4, fontSize: 12, fontFace: D.headerFont, color: D.text, bold: true });
  s.addText(t.markets, { x: x+0.2, y: 1.75, w: 2.55, h: 0.5, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted });
  // Revenue metric
  s.addText(t.revenue, { x: x+0.2, y: 2.5, w: 2.55, h: 0.5, fontSize: 28, fontFace: D.headerFont, color: t.color, bold: true });
  s.addText("Revenue", { x: x+0.2, y: 2.95, w: 1.2, h: 0.3, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted });
  s.addText(t.growth, { x: x+1.5, y: 2.95, w: 1.2, h: 0.3, fontSize: 10, fontFace: D.bodyFont, color: D.accent, bold: true, align: "right" });
  // Divider
  s.addShape("rect", { x: x+0.2, y: 3.4, w: 2.55, h: 0.01, fill: { color: D.divider } });
});

// --- Dual-Panel Executive Summary (50/50 layout) ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.6, fill: { color: D.primary } });
s.addText("Executive Summary", {
  x: 0.6, y: 0, w: 8.8, h: 0.6,
  fontSize: 16, fontFace: D.headerFont, color: "FFFFFF", bold: true, valign: "middle",
});
// Left panel: key findings
s.addShape("rect", { x: 0.4, y: 0.9, w: 4.45, h: 4.2, fill: { color: D.surface }, rectRadius: 0.06 });
s.addShape("rect", { x: 0.4, y: 0.9, w: 4.45, h: 0.45, fill: { color: D.primary }, rectRadius: 0.04 });
s.addText("KEY FINDINGS", { x: 0.6, y: 0.9, w: 4.0, h: 0.45, fontSize: 11, fontFace: D.bodyFont, color: "FFFFFF", bold: true, valign: "middle", charSpacing: 2 });
const findings = ["EMEA talent supply tightening 12% YoY", "APAC cost arbitrage narrowing", "Americas AI roles +34% demand"];
findings.forEach((f, i) => {
  s.addShape("ellipse", { x: 0.7, y: 1.6 + i * 0.7, w: 0.12, h: 0.12, fill: { color: D.secondary } });
  s.addText(f, { x: 0.95, y: 1.5 + i * 0.7, w: 3.7, h: 0.4, fontSize: 10, fontFace: D.bodyFont, color: D.text });
});
// Right panel: strategic recommendations
s.addShape("rect", { x: 5.15, y: 0.9, w: 4.45, h: 4.2, fill: { color: D.surface }, rectRadius: 0.06 });
s.addShape("rect", { x: 5.15, y: 0.9, w: 4.45, h: 0.45, fill: { color: D.accent }, rectRadius: 0.04 });
s.addText("RECOMMENDATIONS", { x: 5.35, y: 0.9, w: 4.0, h: 0.45, fontSize: 11, fontFace: D.bodyFont, color: "FFFFFF", bold: true, valign: "middle", charSpacing: 2 });`,
  footerPattern: `function addFooter(s, num) {
  s.addShape("rect", { x: 0, y: 5.35, w: 10, h: 0.01, fill: { color: D.divider } });
  s.addText("ATLAS  |  MARKET INTELLIGENCE", { x: 0.6, y: 5.33, w: 4, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textLight, charSpacing: 2 });
  s.addText(num.toString().padStart(2, "0"), { x: 8.5, y: 5.33, w: 1.0, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textLight, align: "right" });
}`,
  qualityChecklist: `- Background: silver-blue D.bg ("F8FAFC"), cards on D.surface ("FFFFFF")
- Navy header band (h: 0.6, full width) on EVERY content slide with white Georgia title
- Navy (#1E3A5F) primary, blue (#3B82F6) secondary, green (#10B981) accent
- Scatter charts for market positioning (native pres.charts.SCATTER)
- Geographic tier cards: 3-column layout with flag-like coloured top bars
- Dual-panel 50/50 executive summary with coloured panel headers
- Comparison tables with alternating row shading
- Line charts for trend analysis across markets
- Georgia for headers, Calibri for body
- Data-rich executive feel with geographic/financial focus
- 8-12 slides, consulting-grade market intelligence tone`,
};
