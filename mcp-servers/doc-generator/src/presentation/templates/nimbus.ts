import type { PresentationTemplate } from '../types.js';

export const nimbus: PresentationTemplate = {
  name: "nimbus",
  displayName: "Nimbus",
  description: "Cloud-level executive briefing with charcoal and gold accents, board-ready data tables, financial waterfall charts, and premium card layouts.",
  tags: ["light", "luxury", "consulting", "financial", "executive"],
  designTokens: `const D = {
  bg: "FAFAFA", surface: "FFFFFF", card: "F5F5F5", elevated: "EBEBEB",
  primary: "292524", secondary: "57534E", accent: "B8860B", accentLight: "F5DEB3",
  white: "FFFFFF", black: "000000",
  fontHead: "Georgia", fontBody: "Calibri",
  titleSize: 28, subtitleSize: 16, headingSize: 20, bodySize: 11, smallSize: 9,
};`,
  layoutDna: `Every slide uses a FAFAFA background with FFFFFF content surfaces. Headers are set in Georgia charcoal (292524) with generous top margins. A thin gold (B8860B) horizontal rule (0.04" tall) separates the header from body content. Cards and data panels sit on F5F5F5 with subtle 1px EBEBEB borders to create depth without noise. The title slide is centred with a small gold square decorative element above the main title. All data visualisations use charcoal for primary data and dark gold for accent highlights, keeping the palette restrained and board-appropriate.`,
  codePatterns: `
// --- TITLE SLIDE ---
function titleSlide(pres, title, subtitle) {
  const s = pres.addSlide();
  s.background = { color: D.bg };
  // Small gold square decoration
  s.addShape(pres.ShapeType.rect, {
    x: 4.75, y: 1.6, w: 0.5, h: 0.5, fill: { color: D.accent },
  });
  s.addText(title, {
    x: 1.0, y: 2.3, w: 8.0, h: 0.9, fontSize: D.titleSize,
    fontFace: D.fontHead, color: D.primary, align: "center", bold: true,
  });
  s.addText(subtitle, {
    x: 1.5, y: 3.3, w: 7.0, h: 0.5, fontSize: D.subtitleSize,
    fontFace: D.fontBody, color: D.secondary, align: "center",
  });
  // Thin gold divider
  s.addShape(pres.ShapeType.rect, {
    x: 3.5, y: 4.1, w: 3.0, h: 0.04, fill: { color: D.accent },
  });
  return s;
}

// --- FINANCIAL WATERFALL CHART (SHAPE-BUILT) ---
function waterfallSlide(pres, title, items) {
  // items: [{ label, value, isTotal? }]
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 0.85, w: 8.8, h: 0.04, fill: { color: D.accent },
  });

  const chartX = 0.8, chartY = 1.2, chartW = 8.4, chartH = 3.5;
  const barW = chartW / (items.length * 1.5);
  const gap = (chartW - barW * items.length) / (items.length + 1);
  const maxVal = Math.max(...items.map(i => Math.abs(i.value)));
  const scale = chartH / (maxVal * 1.3);
  const baseline = chartY + chartH * 0.6;

  // Baseline axis
  s.addShape(pres.ShapeType.rect, {
    x: chartX, y: baseline, w: chartW, h: 0.02, fill: { color: D.elevated },
  });

  let running = 0;
  items.forEach((item, i) => {
    const x = chartX + gap + i * (barW + gap);
    const isPos = item.value >= 0;
    const barH = Math.abs(item.value) * scale;

    if (item.isTotal) {
      // Total bar from baseline
      const y = item.value >= 0 ? baseline - barH : baseline;
      s.addShape(pres.ShapeType.rect, {
        x, y, w: barW, h: barH, fill: { color: D.primary },
      });
    } else {
      const prevTop = baseline - running * scale;
      running += item.value;
      const currTop = baseline - running * scale;
      const y = Math.min(prevTop, currTop);
      s.addShape(pres.ShapeType.rect, {
        x, y, w: barW, h: barH,
        fill: { color: isPos ? D.accent : D.secondary },
      });
      // Connector line to next bar
      if (i < items.length - 1) {
        const nextX = chartX + gap + (i + 1) * (barW + gap);
        s.addShape(pres.ShapeType.line, {
          x: x + barW, y: currTop, w: nextX - (x + barW), h: 0,
          line: { color: D.elevated, width: 1, dashType: "dash" },
        });
      }
    }
    // Value label
    s.addText(item.value >= 0 ? "+" + item.value : "" + item.value, {
      x, y: baseline - running * scale - 0.3, w: barW, h: 0.25,
      fontSize: D.smallSize, fontFace: D.fontBody, color: D.primary,
      align: "center", bold: true,
    });
    // Category label
    s.addText(item.label, {
      x: x - 0.1, y: baseline + 0.08, w: barW + 0.2, h: 0.3,
      fontSize: D.smallSize - 1, fontFace: D.fontBody, color: D.secondary,
      align: "center",
    });
  });
  return s;
}

// --- BOARD-READY COMPARISON TABLE ---
function comparisonTableSlide(pres, title, headers, rows, highlightIdx) {
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 0.85, w: 8.8, h: 0.04, fill: { color: D.accent },
  });

  const tableRows = [
    headers.map(h => ({ text: h, options: {
      bold: true, fontSize: D.bodySize, fontFace: D.fontBody, color: D.white,
      fill: { color: D.primary }, align: "center",
    }})),
    ...rows.map((row, ri) => row.map(cell => ({
      text: cell, options: {
        fontSize: D.bodySize, fontFace: D.fontBody, color: D.primary,
        fill: { color: ri === highlightIdx ? D.accentLight : (ri % 2 === 0 ? D.surface : D.card) },
        align: "center",
      },
    }))),
  ];
  s.addTable(tableRows, {
    x: 0.6, y: 1.1, w: 8.8,
    border: { type: "solid", pt: 0.5, color: D.elevated },
    colW: Array(headers.length).fill(8.8 / headers.length),
    rowH: 0.4,
  });
  return s;
}

// --- EXECUTIVE SUMMARY CARDS ---
function execSummarySlide(pres, title, cards) {
  // cards: [{ heading, value, detail }]
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 0.85, w: 8.8, h: 0.04, fill: { color: D.accent },
  });

  const cols = Math.min(cards.length, 4);
  const cardW = (8.4 - (cols - 1) * 0.3) / cols;
  cards.slice(0, cols).forEach((c, i) => {
    const cx = 0.8 + i * (cardW + 0.3);
    // Card background with shadow effect (offset darker rect behind)
    s.addShape(pres.ShapeType.rect, {
      x: cx + 0.04, y: 1.24, w: cardW, h: 2.2,
      fill: { color: D.elevated }, rectRadius: 0.08,
    });
    s.addShape(pres.ShapeType.rect, {
      x: cx, y: 1.2, w: cardW, h: 2.2,
      fill: { color: D.surface }, rectRadius: 0.08,
      line: { color: D.elevated, width: 0.5 },
    });
    // Gold top accent
    s.addShape(pres.ShapeType.rect, {
      x: cx + 0.15, y: 1.35, w: cardW - 0.3, h: 0.04,
      fill: { color: D.accent },
    });
    // Value
    s.addText(c.value, {
      x: cx + 0.15, y: 1.55, w: cardW - 0.3, h: 0.6,
      fontSize: 26, fontFace: D.fontHead, color: D.accent,
      align: "center", bold: true,
    });
    // Heading
    s.addText(c.heading, {
      x: cx + 0.15, y: 2.15, w: cardW - 0.3, h: 0.35,
      fontSize: D.bodySize + 1, fontFace: D.fontBody, color: D.primary,
      align: "center", bold: true,
    });
    // Detail
    s.addText(c.detail, {
      x: cx + 0.15, y: 2.55, w: cardW - 0.3, h: 0.7,
      fontSize: D.smallSize, fontFace: D.fontBody, color: D.secondary,
      align: "center",
    });
  });
  return s;
}

// --- FINANCIAL TREND LINE CHART ---
function trendLineSlide(pres, title, chartData) {
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 0.85, w: 8.8, h: 0.04, fill: { color: D.accent },
  });
  s.addChart(pres.charts.LINE, chartData, {
    x: 0.8, y: 1.1, w: 8.4, h: 3.8,
    showLegend: true, legendPos: "b", legendFontSize: D.smallSize,
    lineSize: 2, lineSmooth: false,
    catAxisLabelColor: D.secondary, catAxisLabelFontSize: D.smallSize,
    valAxisLabelColor: D.secondary, valAxisLabelFontSize: D.smallSize,
    chartColors: [D.primary, D.accent, D.secondary],
    showValue: false,
  });
  return s;
}
`,
  footerPattern: `function addFooter(s, num) {
  // Thin gold divider above footer
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 5.15, w: 8.8, h: 0.02, fill: { color: "B8860B" },
  });
  s.addText("NIMBUS | BOARD CONFIDENTIAL", {
    x: 0.6, y: 5.2, w: 4.0, h: 0.3, fontSize: 7,
    fontFace: "Calibri", color: "57534E", align: "left",
  });
  s.addText(String(num), {
    x: 8.4, y: 5.2, w: 1.0, h: 0.3, fontSize: 7,
    fontFace: "Calibri", color: "57534E", align: "right",
  });
}`,
  qualityChecklist: `- Charcoal (292524) and dark gold (B8860B) are the only accent colours used
- FAFAFA background with FFFFFF surfaces creates subtle layering
- Georgia headers / Calibri body throughout
- Thin gold dividers separate header from content on every slide
- Executive summary cards have shadow effect (offset rect behind)
- Waterfall chart uses shape-built rects with dashed connectors
- Comparison tables highlight key rows with accentLight (F5DEB3)
- Title slide has centred small gold square decoration
- Board-room appropriate: no playful elements, restrained palette
- Footer reads "NIMBUS | BOARD CONFIDENTIAL" with gold divider above`,
};
