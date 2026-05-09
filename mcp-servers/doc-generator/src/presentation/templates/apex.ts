import type { PresentationTemplate } from '../types.js';

export const apex: PresentationTemplate = {
  name: "apex",
  displayName: "Apex",
  description: "Dark luxury executive with gold accents, 5x5 risk heatmaps, scatter charts, financial waterfalls, and layered geometric decorations.",
  tags: ["dark", "luxury", "editorial", "executive", "risk"],
  designTokens: `const D = {
  bg: "0D0D0D", surface: "1A1A1A", card: "242424", elevated: "2E2E2E",
  primary: "E8C547", secondary: "A89260", accent: "F5E6B8",
  text: "F2F2F2", textMuted: "999999", textDim: "666666",
  divider: "333333",
  headerFont: "Georgia", bodyFont: "Calibri",
};`,
  layoutDna:
    "Deep black backgrounds with gold (#E8C547) as the dominant accent throughout all decorations, charts, and hero numbers. " +
    "Asymmetric 60/40 splits for hero stat slides — giant number on the wider panel, stacked metric cards on the narrow side. " +
    "Layered geometric decorations: gold corner brackets (two perpendicular thin rects), rotated diamond shapes, and 3x3 dot grids of tiny ellipses. " +
    "5x5 risk heatmaps built from coloured rectangles, financial waterfall charts from stacked rects with connectors, and native scatter/doughnut charts. " +
    "Georgia for headlines, Calibri for body. Cards use left-border gold accent strips and subtle outer shadows.",
  codePatterns: `// --- Title Slide: centred with gold rules + corner brackets + diamond ---
s.background = { fill: D.bg };
// Gold corner brackets (top-left)
s.addShape("rect", { x: 0.3, y: 0.3, w: 0.6, h: 0.02, fill: { color: D.primary } });
s.addShape("rect", { x: 0.3, y: 0.3, w: 0.02, h: 0.6, fill: { color: D.primary } });
// Gold corner brackets (bottom-right)
s.addShape("rect", { x: 9.1, y: 5.13, w: 0.6, h: 0.02, fill: { color: D.primary } });
s.addShape("rect", { x: 9.68, y: 4.53, w: 0.02, h: 0.6, fill: { color: D.primary } });
// Rotated diamond decoration
s.addShape("rect", { x: 0.6, y: 0.6, w: 0.4, h: 0.4, fill: { color: D.card }, rotate: 45 });
// Gold horizontal rules framing the title
s.addShape("rect", { x: 2.5, y: 1.92, w: 5.0, h: 0.03, fill: { color: D.primary } });
s.addText("Strategic Risk\\nAssessment", {
  x: 0, y: 2.1, w: 10, h: 1.6,
  fontSize: 48, fontFace: D.headerFont, color: D.text, bold: true, align: "center",
});
s.addShape("rect", { x: 2.5, y: 3.85, w: 5.0, h: 0.03, fill: { color: D.primary } });
s.addText("Q4 2026  |  Executive Briefing", {
  x: 0, y: 4.1, w: 10, h: 0.4, fontSize: 12, fontFace: D.bodyFont, color: D.textMuted, align: "center", charSpacing: 2,
});

// --- 5x5 Risk Heatmap (SHAPE-BUILT: grid of coloured rects) ---
s.background = { fill: D.bg };
s.addText("Risk Heatmap", { x: 0.8, y: 0.4, w: 8, h: 0.5, fontSize: 24, fontFace: D.headerFont, color: D.text, bold: true });
s.addText("Likelihood vs Impact", { x: 0.8, y: 0.9, w: 8, h: 0.3, fontSize: 11, fontFace: D.bodyFont, color: D.textMuted });
const heatColors = [
  ["2D7D46","2D7D46","D4A843","D4A843","C0392B"],
  ["2D7D46","D4A843","D4A843","C0392B","C0392B"],
  ["D4A843","D4A843","C0392B","C0392B","8B1A1A"],
  ["D4A843","C0392B","C0392B","8B1A1A","8B1A1A"],
  ["C0392B","C0392B","8B1A1A","8B1A1A","8B1A1A"],
];
const cellW = 0.88, cellH = 0.68, gx = 2.2, gy = 1.4;
s.addText("LIKELIHOOD \\u2192", { x: 2.2, y: 5.0, w: 4.4, h: 0.3, fontSize: 8, fontFace: D.bodyFont, color: D.textDim, align: "center", charSpacing: 2 });
s.addText("IMPACT \\u2191", { x: 1.4, y: 2.5, w: 0.3, h: 2.0, fontSize: 8, fontFace: D.bodyFont, color: D.textDim, rotate: 270, charSpacing: 2 });
for (let r = 0; r < 5; r++) {
  for (let c = 0; c < 5; c++) {
    s.addShape("rect", {
      x: gx + c * (cellW + 0.06), y: gy + r * (cellH + 0.06),
      w: cellW, h: cellH,
      fill: { color: heatColors[r][c] }, rectRadius: 0.04,
    });
  }
}
// Legend labels
["Very Low","Low","Medium","High","Critical"].forEach((lbl, i) => {
  s.addText(lbl, { x: gx + i * (cellW + 0.06), y: gy - 0.28, w: cellW, h: 0.22, fontSize: 7, fontFace: D.bodyFont, color: D.textMuted, align: "center" });
});

// --- Hero Stat: 60/40 asymmetric split + stacked cards ---
s.background = { fill: D.bg };
s.addShape("rect", { x: 0, y: 0, w: 6, h: 5.63, fill: { color: D.surface } });
s.addText("$4.2B", {
  x: 0.8, y: 1.3, w: 4.5, h: 2.5,
  fontSize: 120, fontFace: D.headerFont, color: D.primary, bold: true,
});
s.addText("Total Exposure Value", { x: 0.8, y: 3.5, w: 4.5, h: 0.4, fontSize: 13, fontFace: D.bodyFont, color: D.textMuted });
// Right stat cards with gold left-border
const rightStats = [
  { value: "73%", label: "Mitigated risks" },
  { value: "142", label: "Active controls" },
  { value: "4.1x", label: "Coverage ratio" },
];
rightStats.forEach((m, i) => {
  const y = 0.6 + i * 1.55;
  s.addShape("rect", { x: 6.4, y, w: 3.1, h: 1.3, fill: { color: D.card }, rectRadius: 0.06, shadow: { type: "outer", blur: 6, offset: 2, color: "000000", opacity: 0.3 } });
  s.addShape("rect", { x: 6.4, y, w: 0.06, h: 1.3, fill: { color: D.primary } });
  s.addText(m.value, { x: 6.7, y: y + 0.15, w: 2.5, h: 0.55, fontSize: 30, fontFace: D.headerFont, color: D.primary, bold: true });
  s.addText(m.label, { x: 6.7, y: y + 0.7, w: 2.5, h: 0.35, fontSize: 10, fontFace: D.bodyFont, color: D.textMuted });
});

// --- Doughnut Chart + Centre Label + Scatter Chart ---
// Doughnut
s.addChart(pres.charts.DOUGHNUT,
  [{ name: "Risk Categories", labels: ["Market","Operational","Credit","Liquidity"], values: [35, 28, 22, 15] }],
  { x: 0.3, y: 1.2, w: 4.5, h: 3.5, chartColors: [D.primary, D.secondary, D.accent, D.elevated], showPercent: true, showLegend: false, holeSize: 55 }
);
s.addText("$4.2B", { x: 1.65, y: 2.65, w: 1.8, h: 0.5, fontSize: 22, fontFace: D.headerFont, color: D.primary, bold: true, align: "center" });
s.addText("Total Exposure", { x: 1.55, y: 3.1, w: 2.0, h: 0.3, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted, align: "center" });
// Scatter chart on the right half
s.addChart(pres.charts.SCATTER,
  [{ name: "Risk Events", values: [[1,2],[2,4],[3,1],[4,5],[5,3],[6,4],[7,2]] }],
  { x: 5.2, y: 1.2, w: 4.3, h: 3.5, chartColors: [D.primary], showLegend: false, catAxisLabelColor: D.textDim, valAxisLabelColor: D.textDim, plotArea: { fill: { color: D.surface } } }
);`,
  footerPattern: `function addFooter(s, num) {
  s.addShape("rect", { x: 0, y: 5.45, w: 10, h: 0.01, fill: { color: D.divider } });
  s.addText("APEX  |  CONFIDENTIAL", { x: 0.8, y: 5.25, w: 3, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textDim, charSpacing: 2 });
  s.addText(num.toString().padStart(2, "0"), { x: 8.5, y: 5.25, w: 0.8, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textDim, align: "right" });
}`,
  qualityChecklist: `- All backgrounds: D.bg ("0D0D0D") for slides, D.surface ("1A1A1A") for content panels
- Gold accent (#E8C547) on rules, left-border strips, corner brackets, hero numbers, and chart highlights
- Title slide: centred with horizontal gold rules above and below, corner brackets, diamond decoration
- Risk heatmap: 5x5 grid with green-yellow-orange-red colour progression, axis labels
- Asymmetric 60/40 hero stat splits with giant Georgia number left, stacked cards right
- Doughnut charts include centre label overlay; scatter charts use native pres.charts.SCATTER
- Cards: dark fill (D.card), gold left-border accent (w: 0.06), subtle shadow
- Headlines: Georgia; Body: Calibri
- Stat numbers: fontSize 44+ Georgia bold in gold
- 8-12 slides, no consecutive identical layouts`,
};
