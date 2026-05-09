import type { PresentationTemplate } from '../types.js';

export const silk: PresentationTemplate = {
  name: "silk",
  displayName: "Silk",
  description: "Refined silk elegance with warm cream and navy, gold-accented sidebar navigation, structured consulting data tables, executive summary cards, and polished client-ready layouts.",
  tags: ["light", "luxury", "consulting", "warm", "elegant"],
  designTokens: `const D = {
  bg: "FAFAF8", surface: "FFFFFF", card: "F5F3EF", elevated: "EDEAE4",
  primary: "1B2A4A", secondary: "3D5A80", accent: "C9A96E",
  accentLight: "E8D5B0",
  text: "1B2A4A", textMuted: "6B7B94", textDim: "9CAABE",
  divider: "DDD8D0",
  headerFont: "Georgia", bodyFont: "Calibri",
};`,
  layoutDna:
    "Warm cream background (#FAFAF8) with navy (#1B2A4A) as the primary text and heading colour and gold (#C9A96E) as the refined accent. " +
    "Thin gold sidebar navigation strip (w: 0.04) on every content slide with section indicators. " +
    "50/50 vertical split title slide: navy left panel, cream right panel with gold accents. " +
    "Executive summary cards with gold top accent bars. Three-column takeaway cards for key findings. " +
    "Gold corner brackets (L-shaped thin rects) and fine pinstripe line decorations. " +
    "Agenda slide layouts with numbered items and gold left-border indicators. " +
    "Bar chart for consulting metrics. Georgia for headers (editorial warmth), Calibri for body (professional clarity).",
  codePatterns: `// --- Title Slide: 50/50 vertical split (navy left, cream right) ---
s.background = { fill: D.bg };
// Navy left panel
s.addShape("rect", { x: 0, y: 0, w: 5.0, h: 5.63, fill: { color: D.primary } });
// Gold accent line at split boundary
s.addShape("rect", { x: 5.0, y: 0, w: 0.04, h: 5.63, fill: { color: D.accent } });
// Title on navy panel
s.addText("Strategic\\nAdvisory\\nReport", {
  x: 0.8, y: 1.2, w: 3.8, h: 2.6,
  fontSize: 44, fontFace: D.headerFont, color: "FFFFFF", bold: true, lineSpacingMultiple: 1.0,
});
s.addShape("rect", { x: 0.8, y: 4.0, w: 2.5, h: 0.015, fill: { color: D.accent } });
s.addText("Prepared for ClientCo", {
  x: 0.8, y: 4.15, w: 3.5, h: 0.3,
  fontSize: 11, fontFace: D.bodyFont, color: D.accentLight,
});
// Right panel content
s.addText("CONFIDENTIAL", {
  x: 5.6, y: 0.5, w: 3.5, h: 0.25,
  fontSize: 8, fontFace: D.bodyFont, color: D.accent, charSpacing: 3,
});
// Gold corner brackets (top-right)
s.addShape("rect", { x: 8.8, y: 0.8, w: 0.6, h: 0.02, fill: { color: D.accent } });
s.addShape("rect", { x: 9.38, y: 0.8, w: 0.02, h: 0.6, fill: { color: D.accent } });
// Date and context on right panel
s.addText("February 2026", {
  x: 5.6, y: 2.0, w: 3.8, h: 0.4,
  fontSize: 18, fontFace: D.headerFont, color: D.primary, bold: true,
});
s.addText("Engagement Lead: J. Harrison\\nPartner: S. Mitchell\\nRef: ADV-2026-0142", {
  x: 5.6, y: 2.6, w: 3.8, h: 1.2,
  fontSize: 10, fontFace: D.bodyFont, color: D.textMuted, lineSpacingMultiple: 1.6,
});
// Gold corner brackets (bottom-right)
s.addShape("rect", { x: 8.8, y: 4.83, w: 0.6, h: 0.02, fill: { color: D.accent } });
s.addShape("rect", { x: 8.8, y: 4.23, w: 0.02, h: 0.6, fill: { color: D.accent } });

// --- Agenda Slide: numbered items with gold sidebar ---
s.background = { fill: D.bg };
// Gold sidebar navigation strip
s.addShape("rect", { x: 0.3, y: 0, w: 0.04, h: 5.63, fill: { color: D.accent } });
s.addText("Agenda", {
  x: 0.8, y: 0.4, w: 8, h: 0.6,
  fontSize: 28, fontFace: D.headerFont, color: D.primary, bold: true,
});
s.addShape("rect", { x: 0.8, y: 1.05, w: 4.0, h: 0.01, fill: { color: D.divider } });
const agendaItems = [
  { num: "01", title: "Executive Summary", desc: "Key findings and strategic recommendations overview" },
  { num: "02", title: "Market Analysis", desc: "Competitive landscape and positioning assessment" },
  { num: "03", title: "Financial Review", desc: "Revenue drivers, cost structure, and margin analysis" },
  { num: "04", title: "Strategic Options", desc: "Three growth scenarios with risk-adjusted returns" },
  { num: "05", title: "Implementation Roadmap", desc: "Phased execution plan with milestones and governance" },
];
agendaItems.forEach((item, i) => {
  const y = 1.4 + i * 0.78;
  // Gold left-border indicator
  s.addShape("rect", { x: 0.8, y, w: 0.05, h: 0.58, fill: { color: D.accent } });
  // Number
  s.addText(item.num, {
    x: 1.1, y, w: 0.6, h: 0.58,
    fontSize: 18, fontFace: D.headerFont, color: D.accent, valign: "middle",
  });
  // Title and description
  s.addText(item.title, {
    x: 1.8, y, w: 5, h: 0.3,
    fontSize: 14, fontFace: D.headerFont, color: D.primary, bold: true,
  });
  s.addText(item.desc, {
    x: 1.8, y: y + 0.3, w: 5, h: 0.25,
    fontSize: 9.5, fontFace: D.bodyFont, color: D.textMuted,
  });
  // Subtle divider
  if (i < agendaItems.length - 1) {
    s.addShape("rect", { x: 1.1, y: y + 0.68, w: 7.5, h: 0.005, fill: { color: D.divider } });
  }
});

// --- Executive Summary Cards with gold top accent ---
s.background = { fill: D.bg };
// Gold sidebar navigation strip
s.addShape("rect", { x: 0.3, y: 0, w: 0.04, h: 5.63, fill: { color: D.accent } });
// Active section indicator
s.addShape("rect", { x: 0.22, y: 0.3, w: 0.2, h: 0.4, fill: { color: D.accent }, rectRadius: 0.04 });
s.addText("Executive Summary", {
  x: 0.8, y: 0.4, w: 8, h: 0.5,
  fontSize: 24, fontFace: D.headerFont, color: D.primary, bold: true,
});
s.addShape("rect", { x: 0.8, y: 0.95, w: 3.0, h: 0.01, fill: { color: D.divider } });
// Three takeaway cards
const takeaways = [
  { title: "Revenue Opportunity", value: "$24M", detail: "Addressable market expansion through digital channels represents a 35% uplift over current run rate." },
  { title: "Cost Optimisation", value: "$8.2M", detail: "Operational restructuring and procurement consolidation yield annualised savings within 18 months." },
  { title: "Risk Exposure", value: "Medium", detail: "Regulatory changes in three jurisdictions require compliance investment of $2.1M by Q3 2027." },
];
takeaways.forEach((card, i) => {
  const x = 0.6 + i * 3.05;
  const y = 1.3;
  s.addShape("rect", { x, y, w: 2.8, h: 2.8, fill: { color: D.surface }, rectRadius: 0.06, shadow: { type: "outer", blur: 4, offset: 1, color: "000000", opacity: 0.06 } });
  // Gold top accent
  s.addShape("rect", { x, y, w: 2.8, h: 0.05, fill: { color: D.accent }, rectRadius: 0.06 });
  s.addText(card.title, {
    x: x + 0.2, y: y + 0.25, w: 2.4, h: 0.3,
    fontSize: 10, fontFace: D.bodyFont, color: D.textMuted,
  });
  s.addText(card.value, {
    x: x + 0.2, y: y + 0.6, w: 2.4, h: 0.55,
    fontSize: 32, fontFace: D.headerFont, color: D.primary, bold: true,
  });
  s.addShape("rect", { x: x + 0.2, y: y + 1.25, w: 1.2, h: 0.01, fill: { color: D.accent } });
  s.addText(card.detail, {
    x: x + 0.2, y: y + 1.45, w: 2.4, h: 1.1,
    fontSize: 9, fontFace: D.bodyFont, color: D.textMuted, lineSpacingMultiple: 1.35,
  });
});
// Fine pinstripe decoration
for (let i = 0; i < 6; i++) {
  s.addShape("rect", { x: 0.6 + i * 1.82, y: 4.4, w: 1.5, h: 0.003, fill: { color: D.divider } });
}

// --- Consulting Data Table + Bar Chart ---
s.background = { fill: D.bg };
// Gold sidebar navigation strip
s.addShape("rect", { x: 0.3, y: 0, w: 0.04, h: 5.63, fill: { color: D.accent } });
s.addText("Financial Performance", {
  x: 0.8, y: 0.4, w: 8, h: 0.5,
  fontSize: 24, fontFace: D.headerFont, color: D.primary, bold: true,
});
// Structured data table
s.addShape("rect", { x: 0.6, y: 1.1, w: 8.8, h: 0.4, fill: { color: D.primary } });
const tHeaders = ["Business Unit", "Revenue", "EBITDA", "Margin", "YoY Growth"];
const tColW = [2.4, 1.5, 1.5, 1.2, 2.2];
let tx = 0.7;
tHeaders.forEach((h, i) => {
  s.addText(h, { x: tx, y: 1.1, w: tColW[i], h: 0.4, fontSize: 9, fontFace: D.bodyFont, color: "FFFFFF", bold: true, valign: "middle" });
  tx += tColW[i];
});
const tRows = [
  ["Advisory Services", "$42.8M", "$14.6M", "34.1%", "+12.3%"],
  ["Technology Practice", "$28.4M", "$8.5M", "29.9%", "+18.7%"],
  ["Operations Consulting", "$19.2M", "$5.0M", "26.0%", "+6.1%"],
  ["Risk & Compliance", "$15.8M", "$4.9M", "31.0%", "+9.4%"],
];
tRows.forEach((row, ri) => {
  const y = 1.54 + ri * 0.42;
  const rowBg = ri % 2 === 0 ? D.card : D.bg;
  s.addShape("rect", { x: 0.6, y, w: 8.8, h: 0.42, fill: { color: rowBg } });
  let rx = 0.7;
  row.forEach((cell, ci) => {
    const isGrowth = ci === 4;
    const color = isGrowth ? "22854A" : D.text;
    s.addText(cell, { x: rx, y, w: tColW[ci], h: 0.42, fontSize: 9, fontFace: D.bodyFont, color, valign: "middle", bold: ci === 0 });
    rx += tColW[ci];
  });
});
// Bottom border
s.addShape("rect", { x: 0.6, y: 3.22, w: 8.8, h: 0.01, fill: { color: D.primary } });
// Bar chart for revenue by unit
s.addChart(pres.charts.BAR, [
  { name: "Revenue ($M)", labels: ["Advisory","Technology","Operations","Risk & Comp."], values: [42.8, 28.4, 19.2, 15.8] },
], {
  x: 0.6, y: 3.5, w: 8.8, h: 1.7,
  chartColors: [D.primary],
  showLegend: false,
  catAxisLabelColor: D.textMuted, valAxisLabelColor: D.textMuted,
  catAxisLabelFontSize: 8, valAxisLabelFontSize: 8,
  plotArea: { fill: { color: D.surface } },
});`,
  footerPattern: `function addFooter(s, num) {
  s.addShape("rect", { x: 0, y: 5.42, w: 10, h: 0.01, fill: { color: D.divider } });
  s.addText("SILK  |  CONFIDENTIAL", { x: 0.8, y: 5.25, w: 3, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textDim, charSpacing: 2 });
  s.addText(num.toString().padStart(2, "0"), { x: 8.5, y: 5.25, w: 0.8, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textDim, align: "right" });
}`,
  qualityChecklist: `- Background: warm cream D.bg ("FAFAF8") — not pure white
- Navy (#1B2A4A) as primary for headings, table headers, and text — NOT as background
- Gold (#C9A96E) as accent on sidebar strip, top card borders, corner brackets, dividers, and agenda numbers
- Gold sidebar navigation strip (w: 0.04) on EVERY content slide, with active section indicator
- Title slide: 50/50 vertical split — navy left panel, cream right panel, gold boundary line
- Executive summary: three cards with gold top accent, hero values, and descriptive text
- Agenda slide: numbered items with gold left-border indicators and subtle dividers
- Gold corner brackets (L-shaped perpendicular thin rects) on title slide
- Fine pinstripe decorations (h: 0.003) for subtle texture
- Data tables: navy header row, alternating cream/bg row fills, bottom border
- Georgia for headers (editorial warmth), Calibri for body (professional clarity)
- 8-12 slides, consulting polish, sidebar nav throughout`,
};
