import type { PresentationTemplate } from '../types.js';

export const dusk: PresentationTemplate = {
  name: "dusk",
  displayName: "Dusk",
  description: "Deep dusk twilight with indigo and amber, KRI gauge semicircles, compliance scorecards, risk matrices, alert status tables, and audit-ready layouts.",
  tags: ["dark", "risk", "blue", "structured", "framework"],
  designTokens: `const D = {
  bg: "1E1B4B", surface: "27245C", card: "312E81", elevated: "3730A3",
  primary: "6366F1", secondary: "818CF8", accent: "F59E0B",
  warn: "EF4444",
  text: "EEF0FF", textMuted: "A5A8D4", textDim: "6E71A8",
  divider: "3D3B8A",
  headerFont: "Calibri", bodyFont: "Calibri",
};`,
  layoutDna:
    "Deep indigo backgrounds (#1E1B4B) evoking a twilight sky with amber (#F59E0B) as the alert/accent colour. " +
    "KRI gauges built from semi-circle arc shapes with needle indicators for key risk metrics. " +
    "5x5 risk matrices with traffic-light colouring (green/yellow/orange/red/dark-red). " +
    "Compliance scorecards with pass/fail/warning status indicators and structured grid layouts. " +
    "Alert status tables with coloured severity badges. Bar charts for risk category comparisons. " +
    "Indigo gradient sections using progressively lighter card fills. All Calibri for structured compliance readability.",
  codePatterns: `// --- Title Slide: indigo gradient sections with amber accent ---
s.background = { fill: D.bg };
// Indigo gradient band at bottom
s.addShape("rect", { x: 0, y: 4.2, w: 10, h: 1.43, fill: { color: D.surface } });
s.addShape("rect", { x: 0, y: 4.2, w: 10, h: 0.03, fill: { color: D.accent } });
// Amber vertical accent bar
s.addShape("rect", { x: 0.8, y: 1.0, w: 0.06, h: 2.6, fill: { color: D.accent } });
s.addText("Risk &\\nCompliance\\nReport", {
  x: 1.2, y: 1.0, w: 6, h: 2.6,
  fontSize: 50, fontFace: D.headerFont, color: D.text, bold: true, lineSpacingMultiple: 0.95,
});
s.addText("FY26 Q4  |  Enterprise Risk Management", {
  x: 1.2, y: 3.8, w: 6, h: 0.35,
  fontSize: 12, fontFace: D.bodyFont, color: D.textMuted, charSpacing: 1,
});
// Decorative amber diamond
s.addShape("rect", { x: 8.5, y: 2.2, w: 0.5, h: 0.5, fill: { color: D.accent, transparency: 70 }, rotate: 45 });
s.addShape("rect", { x: 8.7, y: 2.4, w: 0.3, h: 0.3, fill: { color: D.accent, transparency: 40 }, rotate: 45 });

// --- KRI Gauges (SHAPE-BUILT: semi-circle arcs with needle) ---
s.background = { fill: D.bg };
s.addText("Key Risk Indicators", {
  x: 0.8, y: 0.3, w: 8, h: 0.5,
  fontSize: 22, fontFace: D.headerFont, color: D.text, bold: true,
});
s.addText("Real-time KRI dashboard — risk tolerance thresholds shown", {
  x: 0.8, y: 0.8, w: 8, h: 0.3, fontSize: 10, fontFace: D.bodyFont, color: D.textMuted,
});
// Build 3 gauge indicators
const gauges = [
  { label: "Credit Risk", value: 72, threshold: 80, status: "amber" },
  { label: "Operational Risk", value: 45, threshold: 70, status: "green" },
  { label: "Market Risk", value: 88, threshold: 75, status: "red" },
];
gauges.forEach((g, i) => {
  const cx = 1.8 + i * 2.8;
  const cy = 2.8;
  const radius = 1.0;
  // Semi-circle background arc (built from segments)
  const segments = 12;
  for (let seg = 0; seg <= segments; seg++) {
    const angle = Math.PI + (Math.PI * seg / segments);
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    // Determine segment colour based on position
    const pct = seg / segments * 100;
    const segColor = pct < 40 ? "22C55E" : pct < 70 ? D.accent : D.warn;
    s.addShape("ellipse", {
      x: x - 0.06, y: y - 0.06, w: 0.12, h: 0.12,
      fill: { color: segColor },
    });
  }
  // Centre filled area
  s.addShape("ellipse", { x: cx - 0.55, y: cy - 0.55, w: 1.1, h: 1.1, fill: { color: D.card } });
  // Value display in centre
  s.addText(g.value.toString(), {
    x: cx - 0.5, y: cy - 0.45, w: 1.0, h: 0.55,
    fontSize: 28, fontFace: D.headerFont, color: g.status === "green" ? "22C55E" : g.status === "amber" ? D.accent : D.warn,
    bold: true, align: "center", valign: "middle",
  });
  s.addText("/ " + g.threshold, {
    x: cx - 0.5, y: cy + 0.05, w: 1.0, h: 0.25,
    fontSize: 10, fontFace: D.bodyFont, color: D.textMuted, align: "center",
  });
  // Needle line (from centre pointing to value position on arc)
  const needleAngle = Math.PI + (Math.PI * g.value / 100);
  const nx = cx + (radius - 0.2) * Math.cos(needleAngle);
  const ny = cy + (radius - 0.2) * Math.sin(needleAngle);
  s.addShape("line", { x: cx, y: cy, w: nx - cx, h: ny - cy, line: { color: D.text, width: 1.5 } });
  // Label
  s.addText(g.label, {
    x: cx - 1.0, y: cy + 0.45, w: 2.0, h: 0.3,
    fontSize: 10, fontFace: D.bodyFont, color: D.text, align: "center", bold: true,
  });
});

// --- Risk Matrix 5x5 with traffic-light colouring ---
s.background = { fill: D.bg };
s.addText("Enterprise Risk Matrix", {
  x: 0.8, y: 0.3, w: 8, h: 0.5,
  fontSize: 22, fontFace: D.headerFont, color: D.text, bold: true,
});
s.addText("Likelihood vs Impact — 5-point scale", {
  x: 0.8, y: 0.8, w: 8, h: 0.3, fontSize: 10, fontFace: D.bodyFont, color: D.textMuted,
});
const riskColors = [
  ["22C55E","22C55E","F59E0B","F59E0B","EF4444"],
  ["22C55E","F59E0B","F59E0B","EF4444","EF4444"],
  ["F59E0B","F59E0B","EF4444","EF4444","991B1B"],
  ["F59E0B","EF4444","EF4444","991B1B","991B1B"],
  ["EF4444","EF4444","991B1B","991B1B","991B1B"],
];
const cellW = 0.82, cellH = 0.62, gridX = 2.5, gridY = 1.4;
// Axis labels
s.addText("LIKELIHOOD \\u2192", { x: gridX, y: gridY + 5 * (cellH + 0.05) + 0.1, w: 5 * (cellW + 0.05), h: 0.25, fontSize: 8, fontFace: D.bodyFont, color: D.textDim, align: "center", charSpacing: 2 });
s.addText("I\\nM\\nP\\nA\\nC\\nT", { x: gridX - 0.55, y: gridY + 0.5, w: 0.4, h: 3.0, fontSize: 8, fontFace: D.bodyFont, color: D.textDim, align: "center", charSpacing: 2 });
["Rare","Unlikely","Possible","Likely","Certain"].forEach((lbl, c) => {
  s.addText(lbl, { x: gridX + c * (cellW + 0.05), y: gridY - 0.28, w: cellW, h: 0.24, fontSize: 7, fontFace: D.bodyFont, color: D.textMuted, align: "center" });
});
["Negligible","Minor","Moderate","Major","Severe"].reverse().forEach((lbl, r) => {
  s.addText(lbl, { x: gridX - 0.95, y: gridY + r * (cellH + 0.05), w: 0.9, h: cellH, fontSize: 7, fontFace: D.bodyFont, color: D.textMuted, align: "right", valign: "middle" });
});
for (let r = 0; r < 5; r++) {
  for (let c = 0; c < 5; c++) {
    s.addShape("rect", {
      x: gridX + c * (cellW + 0.05), y: gridY + r * (cellH + 0.05),
      w: cellW, h: cellH,
      fill: { color: riskColors[r][c], transparency: 15 }, rectRadius: 0.03,
    });
  }
}

// --- Compliance Scorecard: pass/fail/warning table with severity badges ---
s.background = { fill: D.bg };
s.addText("Compliance Scorecard", {
  x: 0.8, y: 0.3, w: 8, h: 0.5,
  fontSize: 22, fontFace: D.headerFont, color: D.text, bold: true,
});
// Table header
s.addShape("rect", { x: 0.5, y: 1.0, w: 9.0, h: 0.42, fill: { color: D.elevated } });
const headers = ["Control Area", "Status", "Score", "Last Audit", "Severity"];
const colWidths = [2.5, 1.2, 1.0, 1.8, 2.5];
let hx = 0.6;
headers.forEach((h, i) => {
  s.addText(h, { x: hx, y: 1.0, w: colWidths[i], h: 0.42, fontSize: 9, fontFace: D.bodyFont, color: D.accent, bold: true, valign: "middle" });
  hx += colWidths[i];
});
// Table rows
const complianceRows = [
  { area: "Data Privacy (GDPR)", status: "PASS", score: "94%", audit: "2026-01-15", severity: "Low", color: "22C55E" },
  { area: "SOX Controls", status: "WARN", score: "78%", audit: "2026-02-01", severity: "Medium", color: D.accent },
  { area: "Cybersecurity (NIST)", status: "PASS", score: "91%", audit: "2025-12-20", severity: "Low", color: "22C55E" },
  { area: "AML / KYC", status: "FAIL", score: "52%", audit: "2026-02-10", severity: "Critical", color: D.warn },
  { area: "Operational Resilience", status: "WARN", score: "68%", audit: "2026-01-28", severity: "High", color: "F97316" },
];
complianceRows.forEach((row, ri) => {
  const y = 1.48 + ri * 0.52;
  const rowBg = ri % 2 === 0 ? D.surface : D.bg;
  s.addShape("rect", { x: 0.5, y, w: 9.0, h: 0.48, fill: { color: rowBg } });
  let rx = 0.6;
  s.addText(row.area, { x: rx, y, w: colWidths[0], h: 0.48, fontSize: 9, fontFace: D.bodyFont, color: D.text, valign: "middle" }); rx += colWidths[0];
  // Status badge
  s.addShape("rect", { x: rx + 0.05, y: y + 0.1, w: 0.7, h: 0.28, fill: { color: row.color, transparency: 75 }, rectRadius: 0.14 });
  s.addText(row.status, { x: rx + 0.05, y: y + 0.1, w: 0.7, h: 0.28, fontSize: 7, fontFace: D.bodyFont, color: row.color, bold: true, align: "center", valign: "middle" }); rx += colWidths[1];
  s.addText(row.score, { x: rx, y, w: colWidths[2], h: 0.48, fontSize: 9, fontFace: D.bodyFont, color: D.text, valign: "middle" }); rx += colWidths[2];
  s.addText(row.audit, { x: rx, y, w: colWidths[3], h: 0.48, fontSize: 9, fontFace: D.bodyFont, color: D.textMuted, valign: "middle" }); rx += colWidths[3];
  // Severity badge
  s.addShape("rect", { x: rx + 0.05, y: y + 0.1, w: 0.9, h: 0.28, fill: { color: row.color, transparency: 80 }, rectRadius: 0.14 });
  s.addText(row.severity, { x: rx + 0.05, y: y + 0.1, w: 0.9, h: 0.28, fontSize: 7, fontFace: D.bodyFont, color: row.color, bold: true, align: "center", valign: "middle" });
});
// Bar chart for risk category comparison
s.addChart(pres.charts.BAR, [
  { name: "Risk Score", labels: ["Credit","Market","Operational","Compliance","Cyber"], values: [72, 88, 45, 65, 38] },
], {
  x: 0.5, y: 4.1, w: 9.0, h: 1.1,
  chartColors: [D.primary],
  barDir: "bar",
  showLegend: false,
  catAxisLabelColor: D.textMuted, valAxisLabelColor: D.textMuted,
  catAxisLabelFontSize: 8, valAxisLabelFontSize: 8,
  plotArea: { fill: { color: D.surface } },
});`,
  footerPattern: `function addFooter(s, num) {
  s.addShape("rect", { x: 0, y: 5.42, w: 10, h: 0.01, fill: { color: D.divider } });
  s.addText("DUSK  |  RISK & COMPLIANCE", { x: 0.8, y: 5.25, w: 4, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textDim, charSpacing: 2 });
  s.addText(num.toString().padStart(2, "0"), { x: 8.5, y: 5.25, w: 0.8, h: 0.25, fontSize: 7, fontFace: D.bodyFont, color: D.textDim, align: "right" });
}`,
  qualityChecklist: `- All backgrounds: D.bg ("1E1B4B") deep indigo, D.surface ("27245C") for content panels
- Indigo (#6366F1) as primary on chart fills, grid cells, and structural elements
- Amber (#F59E0B) as accent for alerts, warning badges, thresholds, and title accent bar
- Red (#EF4444) for failures, critical severity, and high-risk matrix cells
- KRI gauges: semi-circle arc dots with green/amber/red zones, centre value display, needle line
- Risk matrix: 5x5 grid with traffic-light colouring (green→yellow→orange→red→dark-red)
- Compliance scorecard: structured table with status badges (pill shapes) and alternating row fills
- Severity badges: coloured pill shapes (rectRadius: 0.14) with matching text colour
- Bar chart for risk category comparison using native pres.charts.BAR
- All Calibri for structured compliance readability
- 8-12 slides, audit-ready formatting with clear data hierarchy`,
};
