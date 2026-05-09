import type { PresentationTemplate } from '../types.js';

export const cobalt: PresentationTemplate = {
  name: "cobalt",
  displayName: "Cobalt",
  description: "Deep cobalt analytical with navy and electric blue, financial waterfall charts, combo bar+line overlays, tiered data tables, and dashboard metric grids.",
  tags: ["dark", "financial", "bold", "tech", "data-rich"],
  designTokens: `const D = {
  bg: "0C1929", surface: "132640", card: "1B3A5C", elevated: "245080",
  primary: "3B82F6", secondary: "60A5FA", accent: "22D3EE",
  warn: "F97316",
  text: "F0F6FF", textMuted: "94A3C8", textDim: "5B7AA2",
  divider: "1E3A5F",
  headerFont: "Calibri", bodyFont: "Calibri",
};`,
  layoutDna:
    "Deep navy-to-cobalt backgrounds with electric blue (#3B82F6) as primary accent and cyan (#22D3EE) for highlights. " +
    "Financial rigor: waterfall charts built from stacked rects with connector lines, bar+line combo overlays using dual addChart calls positioned identically. " +
    "KPI metric cards use large hero numbers with delta indicators (green up / red down arrows). " +
    "Tiered data tables with blue header bands and alternating dark rows. " +
    "Electric blue top accent bar (h: 0.04) on every content slide. " +
    "Title slide features a hexagonal dot grid decoration. All Calibri for a technical, data-dense feel.",
  codePatterns: `// --- Title Slide: hexagonal dot grid + electric blue accent ---
s.background = { fill: D.bg };
// Electric blue top accent bar
s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.04, fill: { color: D.primary } });
// Hexagonal dot grid decoration (6x4 offset grid)
for (let row = 0; row < 4; row++) {
  for (let col = 0; col < 6; col++) {
    const offsetX = row % 2 === 0 ? 0 : 0.18;
    s.addShape("ellipse", {
      x: 7.0 + col * 0.36 + offsetX, y: 0.6 + row * 0.32,
      w: 0.06, h: 0.06,
      fill: { color: D.primary, transparency: 60 },
    });
  }
}
s.addText("Financial\\nAnalytics\\nReport", {
  x: 0.8, y: 1.2, w: 6, h: 2.8,
  fontSize: 52, fontFace: D.headerFont, color: D.text, bold: true, lineSpacingMultiple: 0.95,
});
s.addShape("rect", { x: 0.8, y: 4.2, w: 4.0, h: 0.015, fill: { color: D.primary } });
s.addText("Q4 2026  |  Financial Analytics Division", {
  x: 0.8, y: 4.4, w: 6, h: 0.35,
  fontSize: 12, fontFace: D.bodyFont, color: D.textMuted, charSpacing: 1,
});

// --- Financial Waterfall Chart (SHAPE-BUILT: stacked rects with connectors) ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.04, fill: { color: D.primary } });
s.addText("Revenue Bridge — FY25 to FY26", {
  x: 0.8, y: 0.3, w: 8, h: 0.5,
  fontSize: 22, fontFace: D.headerFont, color: D.text, bold: true,
});
s.addText("Waterfall analysis showing key drivers of revenue change ($M)", {
  x: 0.8, y: 0.8, w: 8, h: 0.3, fontSize: 10, fontFace: D.bodyFont, color: D.textMuted,
});
// Waterfall bars: [label, base, height, isPositive]
const waterfallData = [
  { label: "FY25", base: 0, height: 420, positive: true, isTotal: true },
  { label: "Volume", base: 420, height: 85, positive: true, isTotal: false },
  { label: "Price", base: 505, height: 42, positive: true, isTotal: false },
  { label: "FX", base: 547, height: -38, positive: false, isTotal: false },
  { label: "Cost", base: 509, height: -65, positive: false, isTotal: false },
  { label: "FY26", base: 0, height: 444, positive: true, isTotal: true },
];
const wfMaxVal = 560, wfChartH = 3.2, wfChartY = 1.5, wfBarW = 1.1, wfStartX = 0.9;
waterfallData.forEach((d, i) => {
  const x = wfStartX + i * 1.42;
  const barTop = wfChartY + wfChartH * (1 - (d.base + Math.max(0, d.height)) / wfMaxVal);
  const barH = wfChartH * (Math.abs(d.height) / wfMaxVal);
  const color = d.isTotal ? D.primary : d.positive ? "22C55E" : "EF4444";
  s.addShape("rect", { x, y: barTop, w: wfBarW, h: barH, fill: { color }, rectRadius: 0.03 });
  // Value label above/below bar
  const valY = d.positive ? barTop - 0.28 : barTop + barH + 0.04;
  s.addText((d.positive ? "+" : "") + d.height, {
    x, y: valY, w: wfBarW, h: 0.24,
    fontSize: 9, fontFace: D.bodyFont, color: D.text, bold: true, align: "center",
  });
  // Category label below chart
  s.addText(d.label, {
    x, y: wfChartY + wfChartH + 0.12, w: wfBarW, h: 0.22,
    fontSize: 8, fontFace: D.bodyFont, color: D.textMuted, align: "center",
  });
  // Connector line to next bar
  if (i < waterfallData.length - 1 && !d.isTotal) {
    const connectorY = d.positive ? barTop : barTop + barH;
    s.addShape("rect", {
      x: x + wfBarW, y: connectorY, w: 1.42 - wfBarW, h: 0.01,
      fill: { color: D.textDim }, line: { dashType: "dash", color: D.textDim, width: 0.5 },
    });
  }
});

// --- Bar + Line Combo Chart Overlay ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.04, fill: { color: D.primary } });
s.addText("Revenue vs Margin Trend", {
  x: 0.8, y: 0.3, w: 8, h: 0.5,
  fontSize: 22, fontFace: D.headerFont, color: D.text, bold: true,
});
// Bar chart (revenue)
s.addChart(pres.charts.BAR, [
  { name: "Revenue ($M)", labels: ["Q1","Q2","Q3","Q4","Q1","Q2"], values: [105,112,98,125,118,132] },
], {
  x: 0.8, y: 1.2, w: 8.2, h: 3.6,
  chartColors: [D.primary],
  showLegend: true, legendPos: "t", legendFontSize: 8, legendColor: D.textMuted,
  catAxisLabelColor: D.textMuted, valAxisLabelColor: D.textMuted,
  catAxisLabelFontSize: 8, valAxisLabelFontSize: 8,
  plotArea: { fill: { color: D.surface } },
});
// Line chart overlay (margin %) — same position box
s.addChart(pres.charts.LINE, [
  { name: "Margin %", labels: ["Q1","Q2","Q3","Q4","Q1","Q2"], values: [22,24,19,27,25,29] },
], {
  x: 0.8, y: 1.2, w: 8.2, h: 3.6,
  chartColors: [D.accent],
  showLegend: true, legendPos: "t", legendFontSize: 8, legendColor: D.textMuted,
  lineSize: 2.5, lineSmooth: true,
  catAxisHidden: true, valAxisHidden: true,
  plotArea: { fill: { transparency: 100 } },
});

// --- KPI Dashboard: metric cards with delta indicators ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.04, fill: { color: D.primary } });
s.addText("Financial Dashboard", {
  x: 0.8, y: 0.3, w: 8, h: 0.5,
  fontSize: 22, fontFace: D.headerFont, color: D.text, bold: true,
});
const kpis = [
  { value: "$12.4M", label: "Revenue", delta: "+8.2%", up: true },
  { value: "24.1%", label: "Gross Margin", delta: "+1.4pp", up: true },
  { value: "$2.8M", label: "EBITDA", delta: "-3.1%", up: false },
  { value: "1.42x", label: "Debt/Equity", delta: "-0.08", up: true },
];
kpis.forEach((kpi, i) => {
  const x = 0.5 + i * 2.35;
  const y = 1.2;
  s.addShape("rect", { x, y, w: 2.1, h: 1.6, fill: { color: D.card }, rectRadius: 0.06 });
  s.addShape("rect", { x, y, w: 2.1, h: 0.05, fill: { color: D.primary }, rectRadius: 0.06 });
  s.addText(kpi.value, {
    x: x + 0.15, y: y + 0.25, w: 1.8, h: 0.6,
    fontSize: 28, fontFace: D.headerFont, color: D.text, bold: true,
  });
  s.addText(kpi.label, {
    x: x + 0.15, y: y + 0.85, w: 1.8, h: 0.25,
    fontSize: 9, fontFace: D.bodyFont, color: D.textMuted,
  });
  const deltaColor = kpi.up ? "22C55E" : "EF4444";
  const arrow = kpi.up ? "\\u25B2" : "\\u25BC";
  s.addText(arrow + " " + kpi.delta, {
    x: x + 0.15, y: y + 1.15, w: 1.8, h: 0.25,
    fontSize: 10, fontFace: D.bodyFont, color: deltaColor, bold: true,
  });
});
// Tiered data table below KPI cards
s.addShape("rect", { x: 0.5, y: 3.2, w: 9.0, h: 0.38, fill: { color: D.card } });
s.addText("Metric", { x: 0.6, y: 3.2, w: 2.0, h: 0.38, fontSize: 9, fontFace: D.bodyFont, color: D.accent, bold: true, valign: "middle" });
s.addText("Q1", { x: 2.8, y: 3.2, w: 1.4, h: 0.38, fontSize: 9, fontFace: D.bodyFont, color: D.accent, bold: true, align: "center", valign: "middle" });
s.addText("Q2", { x: 4.2, y: 3.2, w: 1.4, h: 0.38, fontSize: 9, fontFace: D.bodyFont, color: D.accent, bold: true, align: "center", valign: "middle" });
s.addText("Q3", { x: 5.6, y: 3.2, w: 1.4, h: 0.38, fontSize: 9, fontFace: D.bodyFont, color: D.accent, bold: true, align: "center", valign: "middle" });
s.addText("YTD", { x: 7.6, y: 3.2, w: 1.8, h: 0.38, fontSize: 9, fontFace: D.bodyFont, color: D.accent, bold: true, align: "center", valign: "middle" });
const tableRows = [
  ["Revenue ($M)", "3.8", "4.1", "4.5", "12.4"],
  ["COGS ($M)", "2.9", "3.1", "3.4", "9.4"],
  ["Gross Profit ($M)", "0.9", "1.0", "1.1", "3.0"],
];
tableRows.forEach((row, ri) => {
  const y = 3.62 + ri * 0.36;
  const rowBg = ri % 2 === 0 ? D.surface : D.bg;
  s.addShape("rect", { x: 0.5, y, w: 9.0, h: 0.36, fill: { color: rowBg } });
  s.addText(row[0], { x: 0.6, y, w: 2.0, h: 0.36, fontSize: 9, fontFace: D.bodyFont, color: D.text, valign: "middle" });
  s.addText(row[1], { x: 2.8, y, w: 1.4, h: 0.36, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted, align: "center", valign: "middle" });
  s.addText(row[2], { x: 4.2, y, w: 1.4, h: 0.36, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted, align: "center", valign: "middle" });
  s.addText(row[3], { x: 5.6, y, w: 1.4, h: 0.36, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted, align: "center", valign: "middle" });
  s.addText(row[4], { x: 7.6, y, w: 1.8, h: 0.36, fontSize: 9, fontFace: D.bodyFont, color: D.text, bold: true, align: "center", valign: "middle" });
});`,
  footerPattern: `function addFooter(s, num) {
  s.addShape("rect", { x: 0, y: 5.42, w: 10, h: 0.01, fill: { color: D.divider } });
  s.addText("COBALT  |  FINANCIAL ANALYTICS", { x: 0.8, y: 5.25, w: 4, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textDim, charSpacing: 2 });
  s.addText(num.toString().padStart(2, "0"), { x: 8.5, y: 5.25, w: 0.8, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textDim, align: "right" });
}`,
  qualityChecklist: `- All backgrounds: D.bg ("0C1929") deep navy, D.surface ("132640") for content areas
- Electric blue (#3B82F6) as primary on accent bars, chart fills, KPI card top borders, and hex dot grid
- Cyan (#22D3EE) for highlights, table headers, and line chart overlays
- Electric blue top accent bar (h: 0.04) on EVERY content slide
- Hexagonal dot grid on title slide (6x4 offset dots with transparency)
- Financial waterfall: stacked rects with dashed connector lines, green for positive, red for negative
- Bar + Line combo: two addChart calls at identical position, second chart has transparent plotArea
- KPI cards: card fill + blue top border, hero number, label, delta with coloured arrow
- Tiered tables: blue header band, alternating dark row fills
- All Calibri for technical clarity
- 8-12 slides, data-dense financial layouts`,
};
