import type { PresentationTemplate } from '../types.js';

export const auroraBorealis: PresentationTemplate = {
  name: "aurora-borealis",
  displayName: "Aurora Borealis",
  description: "Deep cosmic aurora with purple, pink, and cyan accents, tech radar rings, bubble charts, area charts, roadmap swim-lanes, and 2x2 matrices.",
  tags: ["dark", "vibrant", "tech", "futuristic", "competitive"],
  designTokens: `const D = {
  bg: "0A0A1A", surface: "121228", card: "1C1C3A", elevated: "2A2A50",
  primary: "7C3AED", secondary: "EC4899", accent: "06B6D4",
  gradient1: "A855F7", gradient2: "3B82F6",
  white: "F0F0FF", dimWhite: "9CA3AF",
  fontHead: "Calibri", fontBody: "Calibri",
  titleSize: 30, subtitleSize: 16, headingSize: 20, bodySize: 11, smallSize: 9,
};`,
  layoutDna: `Slides use a deep cosmic 0A0A1A background with 121228 content surfaces. The triple-accent system uses purple (7C3AED) for primary, pink (EC4899) for secondary, and cyan (06B6D4) for tertiary highlights. The title slide features overlapping translucent ellipses creating an aurora effect. Tech radars use concentric circles with plotted dots. Swim-lane roadmaps use coloured phase bars. All charts leverage the purple-pink-cyan palette. Cards sit on 1C1C3A with elevated 2A2A50 borders. The futuristic theme uses geometric shapes and high-contrast data visualisations.`,
  codePatterns: `
// --- TITLE SLIDE WITH AURORA EFFECT ---
function titleSlide(pres, title, subtitle) {
  const s = pres.addSlide();
  s.background = { color: D.bg };
  // Overlapping translucent ellipses (aurora effect)
  const auroras = [
    { x: 2.0, y: 0.2, w: 6.0, h: 3.0, color: D.primary, transp: 80 },
    { x: 4.0, y: 0.8, w: 5.5, h: 2.5, color: D.secondary, transp: 85 },
    { x: 3.0, y: 1.2, w: 5.0, h: 2.0, color: D.accent, transp: 82 },
    { x: 1.5, y: 0.5, w: 4.5, h: 2.8, color: D.gradient1, transp: 88 },
    { x: 5.0, y: 0.0, w: 4.0, h: 3.5, color: D.gradient2, transp: 86 },
  ];
  auroras.forEach(a => {
    s.addShape(pres.ShapeType.ellipse, {
      x: a.x, y: a.y, w: a.w, h: a.h,
      fill: { color: a.color, transparency: a.transp },
    });
  });
  s.addText(title, {
    x: 1.0, y: 2.5, w: 8.0, h: 1.0, fontSize: D.titleSize,
    fontFace: D.fontHead, color: D.white, bold: true, align: "center",
  });
  s.addText(subtitle, {
    x: 1.5, y: 3.5, w: 7.0, h: 0.5, fontSize: D.subtitleSize,
    fontFace: D.fontBody, color: D.dimWhite, align: "center",
  });
  return s;
}

// --- TECH RADAR (SHAPE-BUILT: concentric rings + plotted dots) ---
function techRadarSlide(pres, title, quadrants) {
  // quadrants: [{ name, items: [{ label, ring: 0|1|2 }] }]
  // rings: 0=adopt, 1=trial, 2=assess
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.2, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });

  const cx = 4.2, cy = 2.8;
  const rings = [
    { r: 2.4, color: D.elevated, label: "Assess" },
    { r: 1.6, color: D.card, label: "Trial" },
    { r: 0.8, color: D.surface, label: "Adopt" },
  ];

  // Draw concentric circles (outer to inner)
  rings.forEach(ring => {
    s.addShape(pres.ShapeType.ellipse, {
      x: cx - ring.r, y: cy - ring.r, w: ring.r * 2, h: ring.r * 2,
      fill: { color: ring.color, transparency: 40 },
      line: { color: D.primary, width: 0.5, dashType: "dash" },
    });
  });

  // Ring labels
  rings.forEach((ring, i) => {
    s.addText(ring.label, {
      x: cx + ring.r - 0.6, y: cy - 0.15, w: 0.6, h: 0.3,
      fontSize: 7, fontFace: D.fontBody, color: D.dimWhite, align: "center",
    });
  });

  // Crosshair lines
  s.addShape(pres.ShapeType.line, {
    x: cx - 2.4, y: cy, w: 4.8, h: 0,
    line: { color: D.primary, width: 0.3, transparency: 60 },
  });
  s.addShape(pres.ShapeType.line, {
    x: cx, y: cy - 2.4, w: 0, h: 4.8,
    line: { color: D.primary, width: 0.3, transparency: 60 },
  });

  // Quadrant labels
  const qColors = [D.primary, D.secondary, D.accent, D.gradient1];
  const qPositions = [
    { x: cx - 2.3, y: cy - 2.6 }, // top-left
    { x: cx + 0.5, y: cy - 2.6 }, // top-right
    { x: cx - 2.3, y: cy + 2.5 }, // bottom-left
    { x: cx + 0.5, y: cy + 2.5 }, // bottom-right
  ];
  quadrants.forEach((q, qi) => {
    s.addText(q.name, {
      x: qPositions[qi].x, y: qPositions[qi].y, w: 1.8, h: 0.25,
      fontSize: D.smallSize, fontFace: D.fontBody, color: qColors[qi], bold: true,
    });

    // Plot dots by ring
    const angleStart = qi * 90;
    q.items.forEach((item, ii) => {
      const ring = rings[item.ring] || rings[2];
      const angle = ((angleStart + 20 + ii * 25) * Math.PI) / 180;
      const dist = ring.r * 0.7;
      const dotX = cx + Math.cos(angle) * dist - 0.12;
      const dotY = cy - Math.sin(angle) * dist - 0.12;
      s.addShape(pres.ShapeType.ellipse, {
        x: dotX, y: dotY, w: 0.24, h: 0.24,
        fill: { color: qColors[qi] },
      });
      s.addText(item.label, {
        x: dotX - 0.3, y: dotY + 0.25, w: 0.84, h: 0.2,
        fontSize: 6, fontFace: D.fontBody, color: D.white, align: "center",
      });
    });
  });

  // Legend sidebar
  s.addShape(pres.ShapeType.rect, {
    x: 7.5, y: 1.0, w: 2.2, h: 1.5,
    fill: { color: D.surface }, rectRadius: 0.08,
    line: { color: D.elevated, width: 0.5 },
  });
  ["Adopt", "Trial", "Assess"].forEach((label, i) => {
    s.addShape(pres.ShapeType.ellipse, {
      x: 7.7, y: 1.15 + i * 0.45, w: 0.2, h: 0.2,
      fill: { color: [D.primary, D.secondary, D.accent][i] },
    });
    s.addText(label, {
      x: 8.0, y: 1.1 + i * 0.45, w: 1.5, h: 0.3,
      fontSize: D.smallSize, fontFace: D.fontBody, color: D.white,
    });
  });
  return s;
}

// --- BUBBLE CHART ---
function bubbleChartSlide(pres, title, chartData) {
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.2, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });
  s.addChart(pres.charts.BUBBLE, chartData, {
    x: 0.8, y: 0.9, w: 8.4, h: 4.0,
    showLegend: true, legendPos: "b", legendFontSize: D.smallSize,
    legendColor: D.dimWhite,
    chartColors: [D.primary, D.secondary, D.accent, D.gradient1],
    catAxisLabelColor: D.dimWhite, catAxisLabelFontSize: D.smallSize,
    valAxisLabelColor: D.dimWhite, valAxisLabelFontSize: D.smallSize,
    showValue: false,
  });
  return s;
}

// --- SWIM-LANE ROADMAP ---
function swimLaneSlide(pres, title, lanes) {
  // lanes: [{ name, phases: [{ label, startCol, spanCols, color }] }]
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.2, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });

  const laneX = 2.0, laneY = 0.9, laneW = 7.4;
  const totalCols = 4; // e.g., Q1 Q2 Q3 Q4
  const colW = laneW / totalCols;
  const laneH = 0.7, laneGap = 0.15;

  // Column headers (quarters)
  ["Q1", "Q2", "Q3", "Q4"].forEach((q, i) => {
    s.addText(q, {
      x: laneX + i * colW, y: laneY, w: colW, h: 0.35,
      fontSize: D.smallSize, fontFace: D.fontBody, color: D.dimWhite,
      align: "center", bold: true,
    });
    // Vertical gridline
    s.addShape(pres.ShapeType.rect, {
      x: laneX + i * colW, y: laneY + 0.35, w: 0.01, h: lanes.length * (laneH + laneGap),
      fill: { color: D.elevated, transparency: 50 },
    });
  });

  lanes.forEach((lane, li) => {
    const ly = laneY + 0.4 + li * (laneH + laneGap);
    // Lane label
    s.addText(lane.name, {
      x: 0.3, y: ly, w: 1.5, h: laneH,
      fontSize: D.smallSize, fontFace: D.fontBody, color: D.white,
      valign: "middle", bold: true,
    });
    // Lane background
    s.addShape(pres.ShapeType.rect, {
      x: laneX, y: ly, w: laneW, h: laneH,
      fill: { color: D.surface, transparency: 50 },
      line: { color: D.elevated, width: 0.3 },
    });
    // Phase bars
    const phaseColors = [D.primary, D.secondary, D.accent, D.gradient1];
    lane.phases.forEach((phase, pi) => {
      const px = laneX + phase.startCol * colW + 0.05;
      const pw = phase.spanCols * colW - 0.1;
      s.addShape(pres.ShapeType.roundRect, {
        x: px, y: ly + 0.1, w: pw, h: laneH - 0.2,
        fill: { color: phase.color || phaseColors[pi % phaseColors.length] },
        rectRadius: 0.12,
      });
      s.addText(phase.label, {
        x: px, y: ly + 0.1, w: pw, h: laneH - 0.2,
        fontSize: D.smallSize - 1, fontFace: D.fontBody, color: D.white,
        align: "center", valign: "middle", bold: true,
      });
    });
  });
  return s;
}

// --- 2x2 RISK/OPPORTUNITY MATRIX ---
function riskMatrixSlide(pres, title, quadrants) {
  // quadrants: [{ label, items, color }] — TL, TR, BL, BR
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.2, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });

  const gridX = 1.5, gridY = 0.9, cellW = 3.5, cellH = 2.0, gap = 0.15;
  const quadColors = [D.primary, D.secondary, D.accent, D.gradient1];
  const positions = [
    { x: gridX, y: gridY },
    { x: gridX + cellW + gap, y: gridY },
    { x: gridX, y: gridY + cellH + gap },
    { x: gridX + cellW + gap, y: gridY + cellH + gap },
  ];

  // Axis labels
  s.addText("HIGH IMPACT", {
    x: gridX, y: gridY - 0.2, w: cellW * 2 + gap, h: 0.2,
    fontSize: 7, fontFace: D.fontBody, color: D.dimWhite, align: "center",
  });
  s.addText("← LOW LIKELIHOOD          HIGH LIKELIHOOD →", {
    x: gridX, y: gridY + cellH * 2 + gap + 0.05, w: cellW * 2 + gap, h: 0.2,
    fontSize: 7, fontFace: D.fontBody, color: D.dimWhite, align: "center",
  });

  quadrants.forEach((q, qi) => {
    const pos = positions[qi];
    const color = q.color || quadColors[qi];
    // Quadrant cell
    s.addShape(pres.ShapeType.rect, {
      x: pos.x, y: pos.y, w: cellW, h: cellH,
      fill: { color: color, transparency: 80 },
      line: { color: color, width: 1 },
      rectRadius: 0.06,
    });
    // Quadrant label
    s.addText(q.label, {
      x: pos.x + 0.15, y: pos.y + 0.1, w: cellW - 0.3, h: 0.25,
      fontSize: D.smallSize, fontFace: D.fontBody, color: color, bold: true,
    });
    // Items
    q.items.slice(0, 4).forEach((item, ii) => {
      s.addText("- " + item, {
        x: pos.x + 0.15, y: pos.y + 0.4 + ii * 0.35, w: cellW - 0.3, h: 0.3,
        fontSize: D.smallSize, fontFace: D.fontBody, color: D.white,
      });
    });
  });
  return s;
}

// --- AREA CHART WITH MULTI-COLOUR SERIES ---
function areaChartSlide(pres, title, chartData) {
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.2, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });
  s.addChart(pres.charts.AREA, chartData, {
    x: 0.8, y: 0.9, w: 8.4, h: 4.0,
    showLegend: true, legendPos: "b", legendFontSize: D.smallSize,
    legendColor: D.dimWhite,
    chartColors: [D.primary, D.secondary, D.accent],
    chartColorsOpacity: 40,
    catAxisLabelColor: D.dimWhite, catAxisLabelFontSize: D.smallSize,
    valAxisLabelColor: D.dimWhite, valAxisLabelFontSize: D.smallSize,
    lineSize: 2,
  });
  return s;
}
`,
  footerPattern: `function addFooter(s, num) {
  s.addText("AURORA BOREALIS | CONFIDENTIAL", {
    x: 0.6, y: 5.2, w: 4.0, h: 0.3, fontSize: 7,
    fontFace: "Calibri", color: "9CA3AF", align: "left",
  });
  s.addText(String(num), {
    x: 8.4, y: 5.2, w: 1.0, h: 0.3, fontSize: 7,
    fontFace: "Calibri", color: "9CA3AF", align: "right",
  });
}`,
  qualityChecklist: `- Deep cosmic background (0A0A1A) on every slide
- Triple-accent system: purple (7C3AED), pink (EC4899), cyan (06B6D4)
- Calibri for both headers and body text
- Title slide has overlapping translucent ellipses (aurora effect)
- Tech radar uses 3 concentric circles with plotted dots by quadrant
- Bubble chart uses native pres.charts.BUBBLE
- Area charts use multi-colour series with transparency
- Swim-lane roadmaps have coloured phase bars across quarters
- 2x2 risk/opportunity matrices use colour-coded quadrants
- Futuristic cosmic theme: geometric shapes, high contrast, vibrant accents`,
};
