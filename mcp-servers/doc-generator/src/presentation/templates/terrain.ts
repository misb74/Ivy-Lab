import type { PresentationTemplate } from '../types.js';

export const terrain: PresentationTemplate = {
  name: "terrain",
  displayName: "Terrain",
  description: "Organic terrain design with earthy greens and warm browns, treemap visualizations, layered ecosystem cards, and natural hierarchy layouts.",
  tags: ["light", "organic", "vibrant", "people", "editorial"],
  designTokens: `const D = {
  bg: "FAFDF7", surface: "FFFFFF", card: "F0F9E8", elevated: "DCFCE7",
  primary: "166534", secondary: "65A30D", accent: "CA8A04", warm: "92400E",
  text: "1A2E05", textMuted: "4D7C0F", textLight: "84CC16",
  divider: "D9F99D",
  headerFont: "Georgia", bodyFont: "Calibri",
};`,
  layoutDna:
    "Soft botanical background (#FAFDF7) with forest green (#166534) as primary and gold (#CA8A04) as accent. " +
    "Title slide features leaf-like decorative ellipses in layered greens. " +
    "Treemap visualizations built from nested rectangles with 3-level hierarchy and green spectrum colour coding. " +
    "Layered ecosystem cards with organic rounded corners and soft green fills. " +
    "Horizontal bar charts for skill gap analysis with green-to-amber gradient coding. " +
    "Initiative tracking cards with progress indicators and timeline badges. " +
    "Georgia for editorial headers, Calibri for crisp body text.",
  codePatterns: `// --- Title Slide: leaf-like ellipses + organic opener ---
s.background = { fill: D.bg };
// Layered decorative ellipses — leaf/terrain motif
s.addShape("ellipse", { x: 5.5, y: -1.0, w: 7, h: 5, fill: { color: D.card } });
s.addShape("ellipse", { x: 6.5, y: 1.5, w: 5, h: 4.5, fill: { color: D.elevated } });
s.addShape("ellipse", { x: 7.5, y: 0.5, w: 4, h: 3, fill: { color: D.card } });
s.addShape("ellipse", { x: -2, y: 3.5, w: 6, h: 3, fill: { color: D.elevated } });
s.addText("Talent\\nEcosystem", {
  x: 0.8, y: 1.0, w: 5.5, h: 2.4,
  fontSize: 48, fontFace: D.headerFont, color: D.primary, bold: true, lineSpacingMultiple: 1.05,
});
s.addShape("rect", { x: 0.8, y: 3.6, w: 2.0, h: 0.05, fill: { color: D.accent } });
s.addText("Workforce Landscape Assessment  |  2026", {
  x: 0.8, y: 3.85, w: 5, h: 0.35,
  fontSize: 12, fontFace: D.bodyFont, color: D.textMuted, charSpacing: 1,
});

// --- SHAPE-BUILT Treemap: nested rectangles, 3-level, 12 cells ---
s.background = { fill: D.bg };
s.addText("Skill Distribution Treemap", {
  x: 0.6, y: 0.2, w: 8.8, h: 0.55,
  fontSize: 18, fontFace: D.headerFont, color: D.primary, bold: true,
});
s.addShape("rect", { x: 0.6, y: 0.8, w: 8.8, h: 0.03, fill: { color: D.primary } });
// Level 1 containers (3 major categories)
const treemap = [
  { label: "Engineering", color: D.primary, x: 0.5, y: 1.05, w: 4.3, h: 4.15,
    children: [
      { label: "Backend", pct: "28%", x: 0.5, y: 1.05, w: 2.15, h: 2.6, color: "15803D" },
      { label: "Frontend", pct: "14%", x: 2.65, y: 1.05, w: 2.15, h: 2.6, color: "22C55E" },
      { label: "DevOps", pct: "8%", x: 0.5, y: 3.65, w: 2.15, h: 1.55, color: "4ADE80" },
      { label: "QA", pct: "5%", x: 2.65, y: 3.65, w: 2.15, h: 1.55, color: "86EFAC" },
    ]},
  { label: "Data & AI", color: D.secondary, x: 4.8, y: 1.05, w: 4.5, h: 2.5,
    children: [
      { label: "Data Eng", pct: "12%", x: 4.8, y: 1.05, w: 2.25, h: 2.5, color: "65A30D" },
      { label: "ML/AI", pct: "10%", x: 7.05, y: 1.05, w: 2.25, h: 2.5, color: "84CC16" },
    ]},
  { label: "Product & Design", color: D.accent, x: 4.8, y: 3.55, w: 4.5, h: 1.65,
    children: [
      { label: "Product", pct: "9%", x: 4.8, y: 3.55, w: 1.5, h: 1.65, color: "CA8A04" },
      { label: "UX", pct: "7%", x: 6.3, y: 3.55, w: 1.5, h: 1.65, color: "EAB308" },
      { label: "Research", pct: "4%", x: 7.8, y: 3.55, w: 1.5, h: 1.65, color: "FACC15" },
    ]},
];
treemap.forEach(cat => {
  cat.children.forEach(cell => {
    s.addShape("rect", { x: cell.x, y: cell.y, w: cell.w, h: cell.h, fill: { color: cell.color }, rectRadius: 0.04 });
    s.addText(cell.label, { x: cell.x + 0.1, y: cell.y + 0.08, w: cell.w - 0.2, h: 0.3, fontSize: 10, fontFace: D.bodyFont, color: "FFFFFF", bold: true });
    s.addText(cell.pct, { x: cell.x + 0.1, y: cell.y + 0.35, w: cell.w - 0.2, h: 0.3, fontSize: 16, fontFace: D.headerFont, color: "FFFFFF", bold: true });
  });
});

// --- Horizontal Bar Chart: skill gap analysis ---
s.background = { fill: D.bg };
s.addText("Skill Gap Analysis", {
  x: 0.6, y: 0.2, w: 8.8, h: 0.55,
  fontSize: 18, fontFace: D.headerFont, color: D.primary, bold: true,
});
s.addShape("rect", { x: 0.6, y: 0.8, w: 8.8, h: 0.03, fill: { color: D.primary } });
const gaps = [
  { skill: "Cloud Architecture", gap: 42, status: "critical" },
  { skill: "ML Ops", gap: 38, status: "critical" },
  { skill: "Data Governance", gap: 28, status: "moderate" },
  { skill: "Product Analytics", gap: 22, status: "moderate" },
  { skill: "Agile Coaching", gap: 15, status: "healthy" },
  { skill: "UX Research", gap: 10, status: "healthy" },
];
const maxGap = 50, maxBarW = 5.2;
gaps.forEach((g, i) => {
  const y = 1.1 + i * 0.7;
  s.addText(g.skill, { x: 0.6, y, w: 2.6, h: 0.45, fontSize: 10, fontFace: D.bodyFont, color: D.text, bold: true, valign: "middle" });
  const barW = maxBarW * (g.gap / maxGap);
  // Green spectrum: dark = critical, medium = moderate, light = healthy
  const barColor = g.status === "critical" ? D.primary : g.status === "moderate" ? D.secondary : D.textLight;
  s.addShape("rect", { x: 3.4, y: y + 0.1, w: maxBarW, h: 0.25, fill: { color: D.divider } });
  s.addShape("rect", { x: 3.4, y: y + 0.1, w: barW, h: 0.25, fill: { color: barColor }, rectRadius: 0.03 });
  s.addText(g.gap + " pts", { x: 3.4 + barW + 0.15, y, w: 1.0, h: 0.45, fontSize: 10, fontFace: D.bodyFont, color: barColor, bold: true, valign: "middle" });
});

// --- Initiative Tracking Cards with progress indicators ---
s.background = { fill: D.bg };
s.addText("Ecosystem Initiatives", {
  x: 0.6, y: 0.2, w: 8.8, h: 0.55,
  fontSize: 18, fontFace: D.headerFont, color: D.primary, bold: true,
});
s.addShape("rect", { x: 0.6, y: 0.8, w: 8.8, h: 0.03, fill: { color: D.primary } });
const initiatives = [
  { title: "Cloud Academy Launch", owner: "L&D Team", progress: 0.72, target: "Q2 2026", status: "On Track" },
  { title: "ML Bootcamp Series", owner: "Data CoE", progress: 0.45, target: "Q3 2026", status: "At Risk" },
  { title: "Agile Transformation", owner: "PMO", progress: 0.88, target: "Q1 2026", status: "Complete" },
];
initiatives.forEach((init, i) => {
  const y = 1.1 + i * 1.35;
  s.addShape("rect", { x: 0.5, y, w: 9.0, h: 1.1, fill: { color: D.surface }, rectRadius: 0.08 });
  s.addText(init.title, { x: 0.8, y: y + 0.05, w: 4.0, h: 0.4, fontSize: 13, fontFace: D.headerFont, color: D.primary, bold: true });
  s.addText("Owner: " + init.owner, { x: 0.8, y: y + 0.45, w: 2.5, h: 0.3, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted });
  // Timeline badge
  const badgeColor = init.status === "Complete" ? D.primary : init.status === "On Track" ? D.secondary : D.accent;
  s.addShape("rect", { x: 5.2, y: y + 0.15, w: 1.4, h: 0.3, fill: { color: badgeColor }, rectRadius: 0.15 });
  s.addText(init.status, { x: 5.2, y: y + 0.15, w: 1.4, h: 0.3, fontSize: 8, fontFace: D.bodyFont, color: "FFFFFF", bold: true, align: "center", valign: "middle" });
  // Target date
  s.addText("Target: " + init.target, { x: 5.2, y: y + 0.55, w: 1.4, h: 0.25, fontSize: 8, fontFace: D.bodyFont, color: D.textMuted, align: "center" });
  // Progress bar
  s.addShape("rect", { x: 7.0, y: y + 0.25, w: 2.2, h: 0.18, fill: { color: D.divider }, rectRadius: 0.09 });
  s.addShape("rect", { x: 7.0, y: y + 0.25, w: 2.2 * init.progress, h: 0.18, fill: { color: badgeColor }, rectRadius: 0.09 });
  s.addText(Math.round(init.progress * 100) + "%", { x: 7.0, y: y + 0.5, w: 2.2, h: 0.25, fontSize: 9, fontFace: D.bodyFont, color: badgeColor, bold: true, align: "center" });
});`,
  footerPattern: `function addFooter(s, num) {
  s.addShape("rect", { x: 0, y: 5.35, w: 10, h: 0.01, fill: { color: D.divider } });
  s.addText("TERRAIN  |  TALENT ECOSYSTEM", { x: 0.6, y: 5.33, w: 4, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textMuted, charSpacing: 2 });
  s.addText(num.toString().padStart(2, "0"), { x: 8.5, y: 5.33, w: 1.0, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textMuted, align: "right" });
}`,
  qualityChecklist: `- Background: soft botanical D.bg ("FAFDF7"), cards on D.surface ("FFFFFF")
- Forest green (#166534) primary, lime (#65A30D) secondary, gold (#CA8A04) accent
- Title slide: layered leaf-like decorative ellipses in green spectrum
- SHAPE-BUILT treemap: nested rectangles, 3-level hierarchy, up to 12 cells
- Green spectrum colour coding: dark green = critical/large, light green = healthy/small
- Horizontal bar charts for skill gap analysis with green gradient coding
- Initiative tracking cards with progress bars, status badges, and target dates
- Organic rounded corners (rectRadius: 0.06-0.08) on all cards
- Georgia for headers, Calibri for body — editorial nature-inspired feel
- 8-12 slides, organic and ecosystem-focused tone`,
};
