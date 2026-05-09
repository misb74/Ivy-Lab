import type { PresentationTemplate } from '../types.js';

export const graphite: PresentationTemplate = {
  name: "graphite",
  displayName: "Graphite",
  description: "Dark editorial magazine with graphite tones, amber and green accents, big-number callouts, pull-stat strips, heatmap tables, and multi-column magazine grids.",
  tags: ["dark", "editorial", "magazine", "amber", "data-rich"],
  designTokens: `const D = {
  bg: "18181B", surface: "27272A", card: "3F3F46", elevated: "52525B",
  primary: "F59E0B", secondary: "EF4444", accent: "10B981", accentLight: "D1FAE5",
  white: "FAFAFA", dimWhite: "A1A1AA",
  fontHead: "Georgia", fontBody: "Calibri",
  titleSize: 32, subtitleSize: 16, headingSize: 20, bodySize: 11, smallSize: 9,
};`,
  layoutDna: `Slides use a deep graphite 18181B background with 27272A surfaces for content panels. The feel is dark editorial magazine: bold amber (F59E0B) headlines, green (10B981) for positive data, and red (EF4444) for alerts. The title slide features a large watermark letter in the background. Pull-stat strips span the full slide width in amber. Big-number callouts dominate data slides. Heatmap tables use conditionally coloured cells. Vertical amber line decorations add editorial flair. All text is light (FAFAFA or A1A1AA) for readability against the dark background.`,
  codePatterns: `
// --- TITLE SLIDE WITH MAGAZINE WATERMARK ---
function titleSlide(pres, title, subtitle, watermarkLetter) {
  const s = pres.addSlide();
  s.background = { color: D.bg };
  // Large watermark letter
  s.addText(watermarkLetter || "G", {
    x: 5.5, y: -0.5, w: 5.0, h: 6.5, fontSize: 280,
    fontFace: D.fontHead, color: D.surface, bold: true, align: "center",
  });
  // Vertical amber line
  s.addShape(pres.ShapeType.rect, {
    x: 0.8, y: 1.0, w: 0.06, h: 3.0, fill: { color: D.primary },
  });
  s.addText(title, {
    x: 1.1, y: 1.5, w: 6.5, h: 1.0, fontSize: D.titleSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });
  s.addText(subtitle, {
    x: 1.1, y: 2.6, w: 6.5, h: 0.5, fontSize: D.subtitleSize,
    fontFace: D.fontBody, color: D.dimWhite,
  });
  return s;
}

// --- BIG NUMBER CALLOUTS WITH CONTEXT SIDEBARS ---
function bigNumberSlide(pres, title, callouts) {
  // callouts: [{ number, label, context, trend }]
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });

  const cols = Math.min(callouts.length, 3);
  const cardW = (8.4 - (cols - 1) * 0.3) / cols;
  callouts.slice(0, cols).forEach((c, i) => {
    const cx = 0.8 + i * (cardW + 0.3);
    // Card background
    s.addShape(pres.ShapeType.rect, {
      x: cx, y: 1.0, w: cardW, h: 3.2,
      fill: { color: D.surface }, rectRadius: 0.08,
    });
    // Amber top accent
    s.addShape(pres.ShapeType.rect, {
      x: cx, y: 1.0, w: cardW, h: 0.06,
      fill: { color: D.primary }, rectRadius: 0.03,
    });
    // Big number
    s.addText(c.number, {
      x: cx + 0.2, y: 1.2, w: cardW - 0.4, h: 1.0,
      fontSize: 48, fontFace: D.fontHead, color: D.primary,
      align: "center", bold: true,
    });
    // Label
    s.addText(c.label, {
      x: cx + 0.2, y: 2.2, w: cardW - 0.4, h: 0.35,
      fontSize: D.bodySize + 1, fontFace: D.fontBody, color: D.white,
      align: "center", bold: true,
    });
    // Context sidebar (darker sub-panel)
    s.addShape(pres.ShapeType.rect, {
      x: cx + 0.15, y: 2.7, w: cardW - 0.3, h: 1.2,
      fill: { color: D.card }, rectRadius: 0.06,
    });
    s.addText(c.context, {
      x: cx + 0.3, y: 2.8, w: cardW - 0.6, h: 0.7,
      fontSize: D.smallSize, fontFace: D.fontBody, color: D.dimWhite,
      valign: "top",
    });
    // Trend indicator
    const trendColor = c.trend === "up" ? D.accent : D.secondary;
    const trendSymbol = c.trend === "up" ? "▲" : "▼";
    s.addText(trendSymbol + " " + c.trend, {
      x: cx + 0.3, y: 3.55, w: cardW - 0.6, h: 0.25,
      fontSize: D.smallSize, fontFace: D.fontBody, color: trendColor,
      bold: true,
    });
  });
  return s;
}

// --- PULL-STAT STRIP (FULL-WIDTH AMBER BAR) ---
function pullStatSlide(pres, title, stats, bodyText) {
  // stats: [{ value, label }]
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });

  // Full-width amber strip
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 1.0, w: 10, h: 1.0, fill: { color: D.primary },
  });
  const statW = 10 / stats.length;
  stats.forEach((st, i) => {
    s.addText(st.value, {
      x: i * statW, y: 1.0, w: statW, h: 0.55,
      fontSize: 22, fontFace: D.fontHead, color: D.bg,
      align: "center", valign: "bottom", bold: true,
    });
    s.addText(st.label, {
      x: i * statW, y: 1.55, w: statW, h: 0.4,
      fontSize: D.smallSize, fontFace: D.fontBody, color: D.bg,
      align: "center", valign: "top",
    });
  });

  // Body text below
  if (bodyText) {
    s.addText(bodyText, {
      x: 0.8, y: 2.3, w: 8.4, h: 2.5,
      fontSize: D.bodySize, fontFace: D.fontBody, color: D.dimWhite,
      valign: "top", lineSpacingMultiple: 1.4,
    });
  }
  return s;
}

// --- CONDITIONAL-FORMAT HEATMAP TABLE ---
function heatmapTableSlide(pres, title, headers, rows, heatmapCols) {
  // heatmapCols: indices of columns that should be heat-mapped
  // Each row cell value is { text, heat } where heat is 0-1
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });

  function heatColor(heat) {
    // 0 = green (accent), 0.5 = amber (primary), 1 = red (secondary)
    if (heat < 0.5) return D.accent;
    if (heat < 0.75) return D.primary;
    return D.secondary;
  }

  const tableRows = [
    headers.map(h => ({ text: h, options: {
      bold: true, fontSize: D.smallSize, fontFace: D.fontBody, color: D.bg,
      fill: { color: D.primary }, align: "center",
    }})),
    ...rows.map(row => row.map((cell, ci) => {
      const isHeatCol = heatmapCols && heatmapCols.includes(ci);
      return {
        text: cell.text || cell,
        options: {
          fontSize: D.smallSize, fontFace: D.fontBody,
          color: isHeatCol ? D.bg : D.dimWhite,
          fill: { color: isHeatCol ? heatColor(cell.heat || 0) : D.surface },
          align: "center",
        },
      };
    })),
  ];
  s.addTable(tableRows, {
    x: 0.6, y: 1.0, w: 8.8,
    border: { type: "solid", pt: 0.5, color: D.card },
    colW: Array(headers.length).fill(8.8 / headers.length),
    rowH: 0.35,
  });
  return s;
}

// --- PIE/DOUGHNUT WITH AMBER-GREEN PALETTE ---
function doughnutSlide(pres, title, chartData) {
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });
  // Vertical amber line decoration
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 0.9, w: 0.04, h: 4.0, fill: { color: D.primary },
  });
  s.addChart(pres.charts.DOUGHNUT, chartData, {
    x: 1.5, y: 1.0, w: 4.0, h: 3.8,
    showLegend: false, holeSize: 55,
    chartColors: [D.primary, D.accent, D.secondary, D.elevated, D.card],
    dataLabelPosition: "outEnd", dataLabelFontSize: D.smallSize,
    dataLabelColor: D.dimWhite,
  });
  // Right-side legend
  chartData[0].labels.forEach((label, i) => {
    const ly = 1.2 + i * 0.55;
    const colors = [D.primary, D.accent, D.secondary, D.elevated, D.card];
    s.addShape(pres.ShapeType.rect, {
      x: 6.2, y: ly + 0.05, w: 0.3, h: 0.3,
      fill: { color: colors[i % colors.length] }, rectRadius: 0.04,
    });
    s.addText(label, {
      x: 6.7, y: ly, w: 2.8, h: 0.4,
      fontSize: D.bodySize, fontFace: D.fontBody, color: D.white,
    });
  });
  return s;
}
`,
  footerPattern: `function addFooter(s, num) {
  s.addText("GRAPHITE | People Strategy Outlook | " + num, {
    x: 0, y: 5.2, w: 10, h: 0.35, fontSize: 7,
    fontFace: "Calibri", color: "A1A1AA", align: "center",
  });
}`,
  qualityChecklist: `- Dark graphite (18181B) background used on every slide
- Amber (F59E0B) is the primary accent for headlines and highlights
- Green (10B981) for positive data, red (EF4444) for negative/alerts
- Georgia headers / Calibri body throughout
- Title slide features large watermark letter and vertical amber line
- Big-number callouts have dark context sidebars with trend indicators
- Pull-stat strips span full width in amber with embedded numbers
- Heatmap tables use conditional colours (green/amber/red) on data cells
- Doughnut chart uses amber-green palette with separate legend
- Magazine editorial feel: bold, data-rich, high contrast`,
};
