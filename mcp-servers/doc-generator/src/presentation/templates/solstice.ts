import type { PresentationTemplate } from '../types.js';

export const solstice: PresentationTemplate = {
  name: "solstice",
  displayName: "Solstice",
  description: "Premium solstice design with warm rose and coral, initiative tracking cards, doughnut charts, circular decorative motifs, and engagement-focused layouts.",
  tags: ["light", "organic", "pink", "premium", "people"],
  designTokens: `const D = {
  bg: "FDF2F8", surface: "FFFFFF", card: "FCE7F3", elevated: "F9A8D4",
  primary: "9D174D", secondary: "831843", accent: "BE185D", accentLight: "FBCFE8",
  white: "FFFFFF", black: "000000",
  fontHead: "Georgia", fontBody: "Calibri",
  titleSize: 28, subtitleSize: 16, headingSize: 20, bodySize: 11, smallSize: 9,
};`,
  layoutDna: `Slides use a soft rose-pink FDF2F8 background with FFFFFF content surfaces. Headers are Georgia in deep rose (9D174D) positioned top-left. A rose accent bar (h: 0.08) sits at the bottom of every content slide, acting as both a visual footer and brand anchor. Circular motifs appear as decorative elements: the title slide features three overlapping translucent circles. Cards use FCE7F3 backgrounds with rose-tinted left borders. Doughnut charts pair with separate legend cards that have coloured left borders. The overall feel is warm, organic, and premium with circular geometry reinforcing the theme.`,
  codePatterns: `
// --- TITLE SLIDE ---
function titleSlide(pres, title, subtitle) {
  const s = pres.addSlide();
  s.background = { color: D.bg };
  // Three overlapping decorative circles
  const circles = [
    { x: 6.2, y: 0.8, size: 2.5, color: D.accentLight, opacity: 0.3 },
    { x: 7.0, y: 1.4, size: 2.0, color: D.elevated, opacity: 0.4 },
    { x: 6.6, y: 0.4, size: 1.6, color: D.card, opacity: 0.5 },
  ];
  circles.forEach(c => {
    s.addShape(pres.ShapeType.ellipse, {
      x: c.x, y: c.y, w: c.size, h: c.size,
      fill: { color: c.color, transparency: Math.round(c.opacity * 100) },
    });
  });
  s.addText(title, {
    x: 0.8, y: 1.8, w: 5.5, h: 1.0, fontSize: D.titleSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });
  s.addText(subtitle, {
    x: 0.8, y: 2.9, w: 5.5, h: 0.5, fontSize: D.subtitleSize,
    fontFace: D.fontBody, color: D.secondary,
  });
  // Rose accent bar at bottom
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 5.55, w: 10, h: 0.08, fill: { color: D.accent },
  });
  return s;
}

// --- DOUGHNUT CHART WITH LEGEND CARDS ---
function doughnutSlide(pres, title, chartData, legendItems) {
  // legendItems: [{ label, value, color }]
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });

  // Doughnut chart on left
  s.addChart(pres.charts.DOUGHNUT, chartData, {
    x: 0.6, y: 1.0, w: 4.5, h: 3.8,
    showLegend: false, showTitle: false,
    holeSize: 60,
    chartColors: legendItems.map(l => l.color),
    dataLabelPosition: "outEnd", dataLabelFontSize: D.smallSize,
  });

  // Legend cards on right with coloured left borders
  legendItems.forEach((item, i) => {
    const cy = 1.1 + i * 0.75;
    // Card background
    s.addShape(pres.ShapeType.rect, {
      x: 5.5, y: cy, w: 4.0, h: 0.6,
      fill: { color: D.surface }, rectRadius: 0.06,
      line: { color: D.card, width: 0.5 },
    });
    // Coloured left border
    s.addShape(pres.ShapeType.rect, {
      x: 5.5, y: cy, w: 0.08, h: 0.6,
      fill: { color: item.color },
    });
    // Label
    s.addText(item.label, {
      x: 5.75, y: cy + 0.05, w: 2.8, h: 0.25,
      fontSize: D.bodySize, fontFace: D.fontBody, color: D.primary, bold: true,
    });
    // Value
    s.addText(item.value, {
      x: 5.75, y: cy + 0.3, w: 2.8, h: 0.25,
      fontSize: D.smallSize, fontFace: D.fontBody, color: D.secondary,
    });
  });

  // Rose accent bar
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 5.55, w: 10, h: 0.08, fill: { color: D.accent },
  });
  return s;
}

// --- INITIATIVE CARDS WITH TIMELINE AND PROGRESS ---
function initiativeCardsSlide(pres, title, initiatives) {
  // initiatives: [{ name, timeline, progress, target, status }]
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });

  const cols = Math.min(initiatives.length, 3);
  const cardW = (8.4 - (cols - 1) * 0.3) / cols;
  initiatives.slice(0, cols).forEach((init, i) => {
    const cx = 0.8 + i * (cardW + 0.3);
    const cy = 1.1;
    // Card
    s.addShape(pres.ShapeType.rect, {
      x: cx, y: cy, w: cardW, h: 3.6,
      fill: { color: D.surface }, rectRadius: 0.1,
      line: { color: D.card, width: 0.5 },
    });
    // Rose left border
    s.addShape(pres.ShapeType.rect, {
      x: cx, y: cy, w: 0.06, h: 3.6, fill: { color: D.accent },
    });
    // Initiative name
    s.addText(init.name, {
      x: cx + 0.2, y: cy + 0.15, w: cardW - 0.4, h: 0.35,
      fontSize: D.bodySize + 1, fontFace: D.fontBody, color: D.primary, bold: true,
    });
    // Timeline badge
    s.addShape(pres.ShapeType.roundRect, {
      x: cx + 0.2, y: cy + 0.55, w: 1.4, h: 0.3,
      fill: { color: D.card }, rectRadius: 0.15,
    });
    s.addText(init.timeline, {
      x: cx + 0.2, y: cy + 0.55, w: 1.4, h: 0.3,
      fontSize: D.smallSize, fontFace: D.fontBody, color: D.primary, align: "center",
    });
    // Progress bar background
    s.addShape(pres.ShapeType.rect, {
      x: cx + 0.2, y: cy + 1.1, w: cardW - 0.4, h: 0.18,
      fill: { color: D.card }, rectRadius: 0.09,
    });
    // Progress bar fill
    const barFillW = (cardW - 0.4) * (init.progress / 100);
    s.addShape(pres.ShapeType.rect, {
      x: cx + 0.2, y: cy + 1.1, w: barFillW, h: 0.18,
      fill: { color: D.accent }, rectRadius: 0.09,
    });
    // Target line
    const targetX = cx + 0.2 + (cardW - 0.4) * (init.target / 100);
    s.addShape(pres.ShapeType.rect, {
      x: targetX, y: cy + 1.02, w: 0.02, h: 0.34,
      fill: { color: D.primary },
    });
    // Progress label
    s.addText(init.progress + "% complete (target: " + init.target + "%)", {
      x: cx + 0.2, y: cy + 1.35, w: cardW - 0.4, h: 0.25,
      fontSize: D.smallSize, fontFace: D.fontBody, color: D.secondary,
    });
    // Status
    s.addText(init.status, {
      x: cx + 0.2, y: cy + 1.7, w: cardW - 0.4, h: 1.7,
      fontSize: D.smallSize, fontFace: D.fontBody, color: D.secondary,
      valign: "top",
    });
  });

  // Rose accent bar
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 5.55, w: 10, h: 0.08, fill: { color: D.accent },
  });
  return s;
}

// --- PRIORITY MATRIX 2x2 WITH PILL ITEMS ---
function priorityMatrixSlide(pres, title, quadrants) {
  // quadrants: [{ label, items: [{ text, color? }] }] — TL, TR, BL, BR
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });

  const gridX = 0.8, gridY = 1.0, cellW = 4.1, cellH = 2.0, gap = 0.2;
  const positions = [
    { x: gridX, y: gridY },
    { x: gridX + cellW + gap, y: gridY },
    { x: gridX, y: gridY + cellH + gap },
    { x: gridX + cellW + gap, y: gridY + cellH + gap },
  ];

  quadrants.forEach((q, qi) => {
    const pos = positions[qi];
    // Quadrant background
    s.addShape(pres.ShapeType.rect, {
      x: pos.x, y: pos.y, w: cellW, h: cellH,
      fill: { color: D.surface }, rectRadius: 0.08,
      line: { color: D.card, width: 0.5 },
    });
    // Quadrant label
    s.addText(q.label, {
      x: pos.x + 0.15, y: pos.y + 0.1, w: cellW - 0.3, h: 0.3,
      fontSize: D.smallSize + 1, fontFace: D.fontBody, color: D.primary, bold: true,
    });
    // Pill-shaped items
    q.items.slice(0, 4).forEach((item, ii) => {
      const pillY = pos.y + 0.5 + ii * 0.35;
      s.addShape(pres.ShapeType.roundRect, {
        x: pos.x + 0.15, y: pillY, w: cellW - 0.3, h: 0.28,
        fill: { color: item.color || D.card }, rectRadius: 0.14,
      });
      s.addText(item.text, {
        x: pos.x + 0.3, y: pillY, w: cellW - 0.6, h: 0.28,
        fontSize: D.smallSize, fontFace: D.fontBody, color: D.primary,
        valign: "middle",
      });
    });
  });

  // Rose accent bar
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 5.55, w: 10, h: 0.08, fill: { color: D.accent },
  });
  return s;
}

// --- NUMBERED PROCESS STEPS WITH CIRCULAR BADGES ---
function processStepsSlide(pres, title, steps) {
  // steps: [{ number, heading, detail }]
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });

  const count = Math.min(steps.length, 5);
  const stepW = (8.4 - (count - 1) * 0.2) / count;
  steps.slice(0, count).forEach((step, i) => {
    const sx = 0.8 + i * (stepW + 0.2);
    // Circular badge
    s.addShape(pres.ShapeType.ellipse, {
      x: sx + stepW / 2 - 0.3, y: 1.1, w: 0.6, h: 0.6,
      fill: { color: D.accent },
    });
    s.addText(String(step.number), {
      x: sx + stepW / 2 - 0.3, y: 1.1, w: 0.6, h: 0.6,
      fontSize: 16, fontFace: D.fontHead, color: D.white,
      align: "center", valign: "middle", bold: true,
    });
    // Step heading
    s.addText(step.heading, {
      x: sx, y: 1.85, w: stepW, h: 0.35,
      fontSize: D.bodySize, fontFace: D.fontBody, color: D.primary,
      align: "center", bold: true,
    });
    // Step detail
    s.addText(step.detail, {
      x: sx, y: 2.25, w: stepW, h: 1.5,
      fontSize: D.smallSize, fontFace: D.fontBody, color: D.secondary,
      align: "center", valign: "top",
    });
  });

  // Rose accent bar
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 5.55, w: 10, h: 0.08, fill: { color: D.accent },
  });
  return s;
}
`,
  footerPattern: `function addFooter(s, num) {
  // Rose accent bar acts as visual footer
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 5.55, w: 10, h: 0.08, fill: { color: "BE185D" },
  });
  // Slide number right-aligned
  s.addText(String(num), {
    x: 8.5, y: 5.2, w: 1.0, h: 0.3, fontSize: 7,
    fontFace: "Calibri", color: "9D174D", align: "right",
  });
}`,
  qualityChecklist: `- Rose (9D174D) and coral (BE185D) palette used consistently
- FDF2F8 background with FFFFFF content surfaces throughout
- Georgia headers / Calibri body throughout
- Three overlapping circles decorate the title slide
- Rose accent bar (h: 0.08) sits at bottom of every content slide
- Doughnut chart uses separate legend cards with coloured left borders
- Initiative cards include timeline badges and progress bars with target lines
- Priority matrix uses pill-shaped items inside 2x2 grid
- Numbered process steps use circular rose badges
- Warm organic feel with circular motifs and soft pink tones`,
};
