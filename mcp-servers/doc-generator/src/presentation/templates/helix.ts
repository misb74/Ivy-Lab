import type { PresentationTemplate } from '../types.js';

export const helix: PresentationTemplate = {
  name: "helix",
  displayName: "Helix",
  description: "Dark tech helix with cyan and purple, butterfly comparison charts, Sankey flow diagrams, KPI dashboard grids, and terminal aesthetics.",
  tags: ["dark", "tech", "dashboard", "data-rich", "modern"],
  designTokens: `const D = {
  bg: "0F172A", surface: "1E293B", card: "334155", elevated: "475569",
  primary: "38BDF8", secondary: "818CF8", accent: "34D399", warn: "FB923C",
  text: "F1F5F9", textMuted: "94A3B8", textLight: "64748B",
  divider: "334155",
  headerFont: "Calibri", bodyFont: "Calibri",
};`,
  layoutDna:
    "Deep dark background (#0F172A) with cyan (#38BDF8) as primary and purple (#818CF8) as secondary. " +
    "Top cyan accent bar (h: 0.05) on every content slide for consistent data-dashboard framing. " +
    "Butterfly comparison charts built from mirrored horizontal bar pairs. " +
    "Sankey flow diagrams with 3-stage trapezoid connectors for process visualization. " +
    "KPI dashboard 2x3 metric cards with delta badges showing up/down trends. " +
    "Radar charts for multi-dimensional competency comparison. Dot grid decorative backgrounds. " +
    "All Calibri for clean tech/terminal aesthetics.",
  codePatterns: `// --- Title Slide: dark tech with dot grid + helix motif ---
s.background = { fill: D.bg };
// Dot grid decoration
for (let row = 0; row < 8; row++) {
  for (let col = 0; col < 12; col++) {
    if ((row + col) % 3 === 0) {
      s.addShape("ellipse", { x: 0.5 + col * 0.8, y: 0.3 + row * 0.7, w: 0.04, h: 0.04, fill: { color: D.card } });
    }
  }
}
s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.05, fill: { color: D.primary } });
s.addText("Data\\nIntelligence", {
  x: 0.8, y: 1.2, w: 8.4, h: 2.4,
  fontSize: 52, fontFace: D.headerFont, color: D.text, bold: true, lineSpacingMultiple: 1.0,
});
s.addShape("rect", { x: 0.8, y: 3.8, w: 2.5, h: 0.04, fill: { color: D.primary } });
s.addText("Analytics Dashboard  |  Real-Time Insights", {
  x: 0.8, y: 4.05, w: 6, h: 0.35,
  fontSize: 12, fontFace: D.bodyFont, color: D.textMuted, charSpacing: 1,
});

// --- KPI Dashboard: 2x3 metric cards with delta badges ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.05, fill: { color: D.primary } });
s.addText("Key Performance Indicators", {
  x: 0.6, y: 0.25, w: 8.8, h: 0.5,
  fontSize: 16, fontFace: D.headerFont, color: D.text, bold: true,
});
const kpis = [
  { label: "Revenue", value: "$4.2M", delta: "+12.3%", trend: "up" },
  { label: "Active Users", value: "128K", delta: "+8.7%", trend: "up" },
  { label: "Churn Rate", value: "3.2%", delta: "-0.5%", trend: "down" },
  { label: "NPS Score", value: "72", delta: "+4pts", trend: "up" },
  { label: "Avg Response", value: "1.2s", delta: "-18%", trend: "down" },
  { label: "Uptime", value: "99.97%", delta: "+0.02%", trend: "up" },
];
kpis.forEach((k, i) => {
  const col = i % 3, row = Math.floor(i / 3);
  const x = 0.4 + col * 3.15, y = 0.95 + row * 2.15;
  s.addShape("rect", { x, y, w: 2.95, h: 1.9, fill: { color: D.surface }, rectRadius: 0.06 });
  s.addText(k.label.toUpperCase(), { x: x + 0.2, y: y + 0.15, w: 2.55, h: 0.3, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted, charSpacing: 2 });
  s.addText(k.value, { x: x + 0.2, y: y + 0.5, w: 2.55, h: 0.7, fontSize: 32, fontFace: D.headerFont, color: D.text, bold: true });
  // Delta badge
  const isPositive = k.trend === "up" ? !k.label.match(/Churn|Response/) : k.label.match(/Churn|Response/);
  const badgeColor = isPositive ? D.accent : D.warn;
  const bgBadge = isPositive ? "064E3B" : "7C2D12";
  s.addShape("rect", { x: x + 0.2, y: y + 1.35, w: 1.4, h: 0.32, fill: { color: bgBadge }, rectRadius: 0.16 });
  const arrow = k.trend === "up" ? "▲" : "▼";
  s.addText(arrow + " " + k.delta, { x: x + 0.2, y: y + 1.35, w: 1.4, h: 0.32, fontSize: 10, fontFace: D.bodyFont, color: badgeColor, bold: true, align: "center", valign: "middle" });
});

// --- SHAPE-BUILT Butterfly Chart: mirrored horizontal bar pairs ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.05, fill: { color: D.primary } });
s.addText("Skill Supply vs Demand", {
  x: 0.6, y: 0.25, w: 8.8, h: 0.5,
  fontSize: 16, fontFace: D.headerFont, color: D.text, bold: true,
});
// Center axis
s.addShape("rect", { x: 4.95, y: 0.9, w: 0.1, h: 4.2, fill: { color: D.divider } });
// Headers
s.addText("SUPPLY", { x: 1.0, y: 0.9, w: 3.8, h: 0.35, fontSize: 10, fontFace: D.bodyFont, color: D.primary, bold: true, align: "right", charSpacing: 2 });
s.addText("DEMAND", { x: 5.2, y: 0.9, w: 3.8, h: 0.35, fontSize: 10, fontFace: D.bodyFont, color: D.secondary, bold: true, charSpacing: 2 });
const butterfly = [
  { skill: "Python", supply: 82, demand: 95 },
  { skill: "Cloud/AWS", supply: 55, demand: 88 },
  { skill: "ML/AI", supply: 35, demand: 78 },
  { skill: "Data Eng", supply: 62, demand: 70 },
  { skill: "DevOps", supply: 70, demand: 65 },
  { skill: "Security", supply: 40, demand: 72 },
];
const maxVal = 100, maxBarW = 3.6;
butterfly.forEach((b, i) => {
  const y = 1.4 + i * 0.65;
  // Skill label (centred)
  s.addText(b.skill, { x: 3.8, y, w: 2.4, h: 0.45, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted, align: "center", valign: "middle" });
  // Supply bar (grows left from centre)
  const supW = maxBarW * (b.supply / maxVal);
  s.addShape("rect", { x: 4.85 - supW, y: y + 0.08, w: supW, h: 0.28, fill: { color: D.primary }, rectRadius: 0.03 });
  s.addText(b.supply.toString(), { x: 4.85 - supW - 0.5, y, w: 0.45, h: 0.45, fontSize: 9, fontFace: D.bodyFont, color: D.primary, bold: true, align: "right", valign: "middle" });
  // Demand bar (grows right from centre)
  const demW = maxBarW * (b.demand / maxVal);
  s.addShape("rect", { x: 5.15, y: y + 0.08, w: demW, h: 0.28, fill: { color: D.secondary }, rectRadius: 0.03 });
  s.addText(b.demand.toString(), { x: 5.15 + demW + 0.05, y, w: 0.45, h: 0.45, fontSize: 9, fontFace: D.bodyFont, color: D.secondary, bold: true, valign: "middle" });
});

// --- SHAPE-BUILT Sankey Flow Diagram: 3-stage with trapezoid connectors ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.05, fill: { color: D.primary } });
s.addText("Talent Pipeline Flow", {
  x: 0.6, y: 0.25, w: 8.8, h: 0.5,
  fontSize: 16, fontFace: D.headerFont, color: D.text, bold: true,
});
// Stage labels
const stages = [
  { label: "SOURCE", x: 0.4, w: 2.4 },
  { label: "ASSESS", x: 3.8, w: 2.4 },
  { label: "DEPLOY", x: 7.2, w: 2.4 },
];
stages.forEach(st => {
  s.addText(st.label, { x: st.x, y: 0.85, w: st.w, h: 0.3, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted, align: "center", charSpacing: 3 });
});
// Stage 1 nodes (Source)
const sourceNodes = [
  { label: "University", count: "420", y: 1.3, h: 1.2, color: D.primary },
  { label: "Referrals", count: "280", y: 2.65, h: 0.9, color: D.primary },
  { label: "Direct Apply", count: "650", y: 3.7, h: 1.5, color: D.primary },
];
sourceNodes.forEach(n => {
  s.addShape("rect", { x: 0.5, y: n.y, w: 2.2, h: n.h, fill: { color: D.surface }, rectRadius: 0.06 });
  s.addShape("rect", { x: 0.5, y: n.y, w: 0.08, h: n.h, fill: { color: n.color } });
  s.addText(n.label, { x: 0.75, y: n.y + 0.1, w: 1.8, h: 0.3, fontSize: 9, fontFace: D.bodyFont, color: D.text, bold: true });
  s.addText(n.count, { x: 0.75, y: n.y + 0.35, w: 1.8, h: 0.35, fontSize: 18, fontFace: D.headerFont, color: D.primary, bold: true });
});
// Stage 2 nodes (Assess)
const assessNodes = [
  { label: "Phone Screen", count: "540", y: 1.3, h: 1.4, color: D.secondary },
  { label: "Technical", count: "310", y: 2.85, h: 1.1, color: D.secondary },
  { label: "Culture Fit", count: "180", y: 4.1, h: 0.7, color: D.secondary },
];
assessNodes.forEach(n => {
  s.addShape("rect", { x: 3.9, y: n.y, w: 2.2, h: n.h, fill: { color: D.surface }, rectRadius: 0.06 });
  s.addShape("rect", { x: 3.9, y: n.y, w: 0.08, h: n.h, fill: { color: n.color } });
  s.addText(n.label, { x: 4.15, y: n.y + 0.1, w: 1.8, h: 0.3, fontSize: 9, fontFace: D.bodyFont, color: D.text, bold: true });
  s.addText(n.count, { x: 4.15, y: n.y + 0.35, w: 1.8, h: 0.35, fontSize: 18, fontFace: D.headerFont, color: D.secondary, bold: true });
});
// Stage 3 nodes (Deploy)
const deployNodes = [
  { label: "Hired", count: "145", y: 1.5, h: 1.8, color: D.accent },
  { label: "Pipeline", count: "85", y: 3.5, h: 1.0, color: D.accent },
];
deployNodes.forEach(n => {
  s.addShape("rect", { x: 7.3, y: n.y, w: 2.2, h: n.h, fill: { color: D.surface }, rectRadius: 0.06 });
  s.addShape("rect", { x: 7.3, y: n.y, w: 0.08, h: n.h, fill: { color: n.color } });
  s.addText(n.label, { x: 7.55, y: n.y + 0.1, w: 1.8, h: 0.3, fontSize: 9, fontFace: D.bodyFont, color: D.text, bold: true });
  s.addText(n.count, { x: 7.55, y: n.y + 0.35, w: 1.8, h: 0.35, fontSize: 18, fontFace: D.headerFont, color: D.accent, bold: true });
});
// Connector lines between stages (simplified flow indicators)
[[2.7, 1.9, 3.9, 1.9],[2.7, 3.1, 3.9, 3.3],[2.7, 4.3, 3.9, 4.3],[6.1, 2.0, 7.3, 2.2],[6.1, 3.4, 7.3, 3.9]].forEach(c => {
  s.addShape("rect", { x: c[0], y: c[1], w: c[2] - c[0], h: 0.03, fill: { color: D.divider } });
});`,
  footerPattern: `function addFooter(s, num) {
  s.addShape("rect", { x: 0, y: 5.4, w: 10, h: 0.01, fill: { color: D.divider } });
  s.addText("HELIX  |  DATA INTELLIGENCE", { x: 0.6, y: 5.33, w: 4, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textLight, charSpacing: 2 });
  s.addText(num.toString().padStart(2, "0"), { x: 8.5, y: 5.33, w: 1.0, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textLight, align: "right" });
}`,
  qualityChecklist: `- Background: deep dark D.bg ("0F172A"), cards on D.surface ("1E293B")
- Cyan top accent bar (h: 0.05, full width) on EVERY content slide
- Cyan (#38BDF8) primary, purple (#818CF8) secondary, green (#34D399) accent
- KPI dashboard: 2x3 metric cards with coloured delta badges (green positive, amber negative)
- SHAPE-BUILT butterfly chart: mirrored horizontal bar pairs with centre axis
- SHAPE-BUILT Sankey flow: 3-stage node columns with connector lines
- Radar charts for multi-dimensional comparison (native pres.charts.RADAR)
- Dot grid decorative background on title slide
- All Calibri for both headlines and body (tech/terminal feel)
- Data-dense layouts, dashboard aesthetic throughout
- 8-12 slides, dark tech intelligence tone`,
};
