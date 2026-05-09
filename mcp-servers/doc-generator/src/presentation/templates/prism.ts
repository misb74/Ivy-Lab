import type { PresentationTemplate } from '../types.js';

export const prism: PresentationTemplate = {
  name: "prism",
  displayName: "Prism",
  description: "Prismatic dark theme with rainbow data visualization, bubble charts, Gantt timelines, and multi-dimensional analytics grids.",
  tags: ["dark", "tech", "vibrant", "data-rich", "people"],
  designTokens: `const D = {
  bg: "0C0C1E", surface: "16163A", card: "222255", elevated: "2D2D6B",
  primary: "6366F1", secondary: "EC4899", accent: "14B8A6", highlight: "F59E0B",
  text: "F0F0FF", textMuted: "9CA3C0", textDim: "6B7294",
  divider: "2E3060",
  rainbow: ["6366F1", "EC4899", "14B8A6", "F59E0B", "EF4444", "8B5CF6"],
  headerFont: "Calibri", bodyFont: "Calibri",
};`,
  layoutDna:
    "Deep midnight blue-black background (#0C0C1E) with a prismatic rainbow accent system — indigo, pink, teal, amber, red, purple. " +
    "Never monochrome: every data element uses a different colour from the rainbow palette. " +
    "KPI metric cards feature a thick rainbow left-border (each card a different colour). " +
    "Bubble charts and multi-colour line charts use native pptxgenjs chart types. " +
    "Gantt timelines are shape-built: horizontal bars stacked on rows with labels. " +
    "Dot-matrix decorative backgrounds use tiny ellipses in a grid pattern. " +
    "All Calibri for a modern tech feel. Data-dense slides with multiple visual elements per slide.",
  codePatterns: `// --- Title Slide: prismatic gradient bar + dot-matrix decoration ---
s.background = { fill: D.bg };
// Prismatic gradient bar (6 coloured segments across the top)
D.rainbow.forEach((c, i) => {
  s.addShape("rect", { x: i * (10/6), y: 0, w: 10/6 + 0.01, h: 0.08, fill: { color: c } });
});
// Dot-matrix decoration (4x6 tiny dots, top-right)
for (let r = 0; r < 4; r++) {
  for (let c = 0; c < 6; c++) {
    s.addShape("ellipse", {
      x: 7.8 + c * 0.22, y: 0.5 + r * 0.22, w: 0.06, h: 0.06,
      fill: { color: D.rainbow[c % D.rainbow.length], transparency: 60 },
    });
  }
}
s.addText("Data Intelligence\\nPlatform", {
  x: 0.8, y: 1.6, w: 7, h: 2.2,
  fontSize: 48, fontFace: D.headerFont, color: D.text, bold: true, lineSpacingMultiple: 0.95,
});
s.addText("Analytics Overview  |  2026", {
  x: 0.8, y: 4.0, w: 5, h: 0.35,
  fontSize: 12, fontFace: D.bodyFont, color: D.textMuted, charSpacing: 2,
});
// Bottom prismatic bar
D.rainbow.forEach((c, i) => {
  s.addShape("rect", { x: i * (10/6), y: 5.55, w: 10/6 + 0.01, h: 0.08, fill: { color: c } });
});

// --- KPI Cards with Rainbow Left-Borders ---
s.background = { fill: D.bg };
s.addText("KEY PERFORMANCE INDICATORS", { x: 0.8, y: 0.4, w: 8, h: 0.4, fontSize: 10, fontFace: D.bodyFont, color: D.textDim, charSpacing: 3 });
s.addShape("rect", { x: 0.8, y: 0.9, w: 8.4, h: 0.01, fill: { color: D.divider } });
const kpis = [
  { value: "2.4M", label: "Records Processed", delta: "+18%", color: D.rainbow[0] },
  { value: "99.7%", label: "Uptime SLA", delta: "+0.2%", color: D.rainbow[1] },
  { value: "47ms", label: "Avg Latency", delta: "-12ms", color: D.rainbow[2] },
  { value: "1,842", label: "Active Users", delta: "+340", color: D.rainbow[3] },
];
kpis.forEach((kpi, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 0.8 + col * 4.4, y = 1.2 + row * 2.0;
  s.addShape("rect", { x, y, w: 3.9, h: 1.7, fill: { color: D.card }, rectRadius: 0.08 });
  s.addShape("rect", { x, y, w: 0.08, h: 1.7, fill: { color: kpi.color }, rectRadius: 0.08 });
  s.addText(kpi.value, { x: x + 0.3, y: y + 0.2, w: 3.0, h: 0.7, fontSize: 36, fontFace: D.headerFont, color: kpi.color, bold: true });
  s.addText(kpi.label, { x: x + 0.3, y: y + 0.85, w: 2.0, h: 0.3, fontSize: 10, fontFace: D.bodyFont, color: D.textMuted });
  s.addText(kpi.delta, { x: x + 2.5, y: y + 0.85, w: 1.2, h: 0.3, fontSize: 11, fontFace: D.bodyFont, color: D.accent, bold: true, align: "right" });
});

// --- Gantt Timeline (SHAPE-BUILT: horizontal bars on rows) ---
s.background = { fill: D.bg };
s.addText("Project Timeline", { x: 0.8, y: 0.4, w: 8, h: 0.5, fontSize: 24, fontFace: D.headerFont, color: D.text, bold: true });
// Timeline header months
const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const tlX = 3.0, tlW = 6.6, tlY = 1.2;
months.forEach((m, i) => {
  s.addText(m, { x: tlX + i * (tlW/12), y: tlY, w: tlW/12, h: 0.3, fontSize: 7, fontFace: D.bodyFont, color: D.textDim, align: "center" });
});
s.addShape("rect", { x: tlX, y: tlY + 0.3, w: tlW, h: 0.005, fill: { color: D.divider } });
// Gantt rows
const tasks = [
  { name: "Discovery", start: 0, dur: 2, color: D.rainbow[0] },
  { name: "Data Pipeline", start: 1, dur: 4, color: D.rainbow[1] },
  { name: "ML Models", start: 3, dur: 5, color: D.rainbow[2] },
  { name: "Integration", start: 6, dur: 3, color: D.rainbow[3] },
  { name: "Testing", start: 8, dur: 2, color: D.rainbow[4] },
  { name: "Launch", start: 10, dur: 2, color: D.rainbow[5] },
];
tasks.forEach((t, i) => {
  const rowY = tlY + 0.5 + i * 0.65;
  s.addText(t.name, { x: 0.8, y: rowY, w: 2.0, h: 0.45, fontSize: 10, fontFace: D.bodyFont, color: D.text, valign: "middle" });
  s.addShape("rect", {
    x: tlX + t.start * (tlW/12), y: rowY + 0.08,
    w: t.dur * (tlW/12), h: 0.3,
    fill: { color: t.color }, rectRadius: 0.06,
  });
  // Alternating row background
  if (i % 2 === 0) {
    s.addShape("rect", { x: tlX, y: rowY, w: tlW, h: 0.45, fill: { color: D.surface, transparency: 50 } });
  }
});

// --- Bubble Chart + Multi-Colour Line Chart ---
s.background = { fill: D.bg };
s.addText("Multi-Dimensional Analysis", { x: 0.8, y: 0.4, w: 8, h: 0.5, fontSize: 24, fontFace: D.headerFont, color: D.text, bold: true });
// Bubble chart (left half)
s.addChart(pres.charts.BUBBLE,
  [
    { name: "Engineering", values: [[1,5,10],[2,3,15],[4,7,8]] },
    { name: "Product", values: [[3,6,12],[5,2,9],[6,5,14]] },
  ],
  { x: 0.3, y: 1.2, w: 4.5, h: 3.8, chartColors: [D.primary, D.secondary], showLegend: true, legendPos: "b", legendColor: D.textMuted, plotArea: { fill: { color: D.surface } }, catAxisLabelColor: D.textDim, valAxisLabelColor: D.textDim }
);
// Multi-colour series line chart (right half)
s.addChart(pres.charts.LINE,
  [
    { name: "Revenue", labels: ["Q1","Q2","Q3","Q4"], values: [120,145,160,195] },
    { name: "Costs", labels: ["Q1","Q2","Q3","Q4"], values: [90,95,100,110] },
    { name: "Margin", labels: ["Q1","Q2","Q3","Q4"], values: [30,50,60,85] },
  ],
  { x: 5.2, y: 1.2, w: 4.5, h: 3.8, chartColors: [D.accent, D.secondary, D.highlight], showLegend: true, legendPos: "b", legendColor: D.textMuted, lineSmooth: true, lineSize: 2, plotArea: { fill: { color: D.surface } }, catAxisLabelColor: D.textDim, valAxisLabelColor: D.textDim }
);`,
  footerPattern: `function addFooter(s, num) {
  s.addShape("rect", { x: 0, y: 5.45, w: 10, h: 0.01, fill: { color: D.divider } });
  s.addText("PRISM  |  DATA INTELLIGENCE", { x: 0.8, y: 5.25, w: 3.5, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textDim, charSpacing: 2 });
  s.addText(num.toString().padStart(2, "0"), { x: 8.5, y: 5.25, w: 0.8, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textDim, align: "right" });
}`,
  qualityChecklist: `- All backgrounds: D.bg ("0C0C1E") — deep midnight blue-black, never pure black
- Prismatic rainbow palette: every chart series, KPI border, and Gantt bar uses a DIFFERENT colour from D.rainbow
- NEVER monochrome — if a slide has 3+ data elements, use 3+ distinct colours
- KPI cards: D.card fill, thick rainbow left-border (w: 0.08), each card a different accent
- Gantt timeline: horizontal bars with rounded ends, month headers, alternating row tints
- Bubble charts use native pres.charts.BUBBLE with 2+ series in contrasting colours
- Dot-matrix decorations: tiny ellipses (0.06x0.06) in grid patterns, 60% transparency
- Top and bottom prismatic gradient bars (6 coloured segments) on title/closing slides
- All Calibri for both headlines and body
- 8-12 slides, data-dense layouts with multiple visualizations per slide`,
};
