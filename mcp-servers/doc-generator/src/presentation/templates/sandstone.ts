import type { PresentationTemplate } from '../types.js';

export const sandstone: PresentationTemplate = {
  name: "sandstone",
  displayName: "Sandstone",
  description: "Warm sandstone editorial with copper and amber tones, Pareto charts, process flowcharts, maturity scorecards, and benchmarking layouts.",
  tags: ["warm", "process", "editorial", "benchmarking", "industrial"],
  designTokens: `const D = {
  bg: "FAF5EF", surface: "FFFFFF", card: "F0E8DC", elevated: "E6D9C6",
  primary: "B45309", secondary: "78350F", accent: "D97706", accentLight: "FDE68A",
  white: "FFFFFF", black: "000000",
  fontHead: "Georgia", fontBody: "Calibri",
  titleSize: 28, subtitleSize: 16, headingSize: 20, bodySize: 11, smallSize: 9,
};`,
  layoutDna: `Slides use a warm parchment FAF5EF background with FFFFFF content surfaces. Headers are Georgia in copper (B45309) with amber (D97706) accents for highlights. A copper accent bar (h: 0.08) sits at the bottom of every content slide. The title slide uses a warm split layout: a copper panel on the left third with the title on the right. Cards rest on F0E8DC with subtle E6D9C6 borders. Pareto charts combine bar and line overlays. Process flowcharts use shape-built rects, diamonds, and arrows. Maturity scorecards feature progress bars with delta arrows. The overall feel is editorial benchmarking with warm industrial tones.`,
  codePatterns: `
// --- TITLE SLIDE WITH WARM SPLIT LAYOUT ---
function titleSlide(pres, title, subtitle) {
  const s = pres.addSlide();
  s.background = { color: D.bg };
  // Copper left panel
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 3.2, h: 5.63, fill: { color: D.primary },
  });
  // Small amber square decoration on panel
  s.addShape(pres.ShapeType.rect, {
    x: 1.35, y: 2.0, w: 0.5, h: 0.5, fill: { color: D.accent },
  });
  // Panel subtitle text
  s.addText("BENCHMARKING\\nREPORT", {
    x: 0.4, y: 3.0, w: 2.4, h: 0.8, fontSize: 12,
    fontFace: D.fontBody, color: D.accentLight, align: "center",
    lineSpacingMultiple: 1.3,
  });
  // Title on right
  s.addText(title, {
    x: 3.8, y: 1.8, w: 5.6, h: 1.0, fontSize: D.titleSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });
  s.addText(subtitle, {
    x: 3.8, y: 2.9, w: 5.6, h: 0.5, fontSize: D.subtitleSize,
    fontFace: D.fontBody, color: D.secondary,
  });
  // Copper accent bar at bottom
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 5.55, w: 10, h: 0.08, fill: { color: D.primary },
  });
  return s;
}

// --- PARETO CHART (COMBO: BAR + LINE overlay) ---
function paretoSlide(pres, title, categories, barValues, cumulativePct) {
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });

  // Bar chart (primary values)
  const barData = [{ name: "Count", labels: categories, values: barValues }];
  s.addChart(pres.charts.BAR, barData, {
    x: 0.8, y: 1.0, w: 8.4, h: 3.5,
    showLegend: false,
    barDir: "col", barGrouping: "clustered",
    chartColors: [D.primary],
    catAxisLabelColor: D.secondary, catAxisLabelFontSize: D.smallSize,
    catAxisLabelRotate: 0,
    valAxisLabelColor: D.secondary, valAxisLabelFontSize: D.smallSize,
    showValue: true, dataLabelPosition: "outEnd",
    dataLabelFontSize: D.smallSize, dataLabelColor: D.primary,
  });

  // Line chart overlay (cumulative %)
  const lineData = [{ name: "Cumulative %", labels: categories, values: cumulativePct }];
  s.addChart(pres.charts.LINE, lineData, {
    x: 0.8, y: 1.0, w: 8.4, h: 3.5,
    showLegend: false,
    lineSize: 2, lineSmooth: false,
    chartColors: [D.accent],
    catAxisHidden: true, valAxisHidden: true,
    showValue: true, dataLabelPosition: "t",
    dataLabelFontSize: D.smallSize - 1, dataLabelColor: D.accent,
  });

  // Copper accent bar
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 5.55, w: 10, h: 0.08, fill: { color: D.primary },
  });
  return s;
}

// --- PROCESS FLOWCHART (SHAPE-BUILT: rects + diamonds + arrows) ---
function flowchartSlide(pres, title, steps) {
  // steps: [{ label, type: "process"|"decision"|"start"|"end" }]
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });

  const startX = 0.6, startY = 1.2;
  const stepW = 1.4, stepH = 0.7, gapX = 0.4;
  const maxPerRow = 5;

  steps.forEach((step, i) => {
    const row = Math.floor(i / maxPerRow);
    const col = row % 2 === 0 ? i % maxPerRow : maxPerRow - 1 - (i % maxPerRow);
    const sx = startX + col * (stepW + gapX);
    const sy = startY + row * 1.4;

    if (step.type === "decision") {
      // Diamond shape (rotated rect approximation)
      const dSize = 0.9;
      s.addShape(pres.ShapeType.diamond, {
        x: sx + (stepW - dSize) / 2, y: sy - 0.1, w: dSize, h: dSize,
        fill: { color: D.accent },
        line: { color: D.primary, width: 1 },
      });
      s.addText(step.label, {
        x: sx, y: sy + 0.05, w: stepW, h: 0.6,
        fontSize: D.smallSize - 1, fontFace: D.fontBody, color: D.white,
        align: "center", valign: "middle",
      });
    } else if (step.type === "start" || step.type === "end") {
      // Rounded rect for start/end
      s.addShape(pres.ShapeType.roundRect, {
        x: sx, y: sy, w: stepW, h: stepH,
        fill: { color: step.type === "start" ? D.primary : D.secondary },
        rectRadius: 0.2,
      });
      s.addText(step.label, {
        x: sx, y: sy, w: stepW, h: stepH,
        fontSize: D.smallSize, fontFace: D.fontBody, color: D.white,
        align: "center", valign: "middle", bold: true,
      });
    } else {
      // Standard process rect
      s.addShape(pres.ShapeType.rect, {
        x: sx, y: sy, w: stepW, h: stepH,
        fill: { color: D.surface },
        line: { color: D.primary, width: 1 },
        rectRadius: 0.06,
      });
      s.addText(step.label, {
        x: sx, y: sy, w: stepW, h: stepH,
        fontSize: D.smallSize, fontFace: D.fontBody, color: D.primary,
        align: "center", valign: "middle",
      });
    }

    // Arrow to next step
    if (i < steps.length - 1) {
      const nextRow = Math.floor((i + 1) / maxPerRow);
      if (nextRow === row) {
        // Horizontal arrow
        const dir = row % 2 === 0 ? 1 : -1;
        const arrowX = dir > 0 ? sx + stepW : sx;
        s.addShape(pres.ShapeType.rect, {
          x: Math.min(arrowX, arrowX + dir * gapX),
          y: sy + stepH / 2 - 0.015,
          w: gapX, h: 0.03,
          fill: { color: D.accent },
        });
        // Arrowhead triangle
        s.addShape(pres.ShapeType.triangle, {
          x: dir > 0 ? sx + stepW + gapX - 0.15 : sx - 0.15,
          y: sy + stepH / 2 - 0.08,
          w: 0.15, h: 0.16, fill: { color: D.accent },
          rotate: dir > 0 ? 90 : 270,
        });
      } else {
        // Vertical connector between rows
        s.addShape(pres.ShapeType.rect, {
          x: sx + stepW / 2 - 0.015,
          y: sy + stepH,
          w: 0.03, h: 1.4 - stepH,
          fill: { color: D.accent },
        });
      }
    }
  });

  // Copper accent bar
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 5.55, w: 10, h: 0.08, fill: { color: D.primary },
  });
  return s;
}

// --- MATURITY SCORECARDS WITH PROGRESS BARS AND DELTA ARROWS ---
function maturityScorecardSlide(pres, title, scorecards) {
  // scorecards: [{ dimension, currentScore, targetScore, maxScore, delta }]
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });

  scorecards.slice(0, 6).forEach((sc, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const cx = 0.6 + col * 4.6;
    const cy = 1.0 + row * 1.35;
    const cardW = 4.3;

    // Card background
    s.addShape(pres.ShapeType.rect, {
      x: cx, y: cy, w: cardW, h: 1.15,
      fill: { color: D.surface }, rectRadius: 0.06,
      line: { color: D.elevated, width: 0.5 },
    });

    // Dimension label
    s.addText(sc.dimension, {
      x: cx + 0.15, y: cy + 0.08, w: 2.5, h: 0.25,
      fontSize: D.bodySize, fontFace: D.fontBody, color: D.primary, bold: true,
    });

    // Score text
    s.addText(sc.currentScore + " / " + sc.maxScore, {
      x: cx + cardW - 1.2, y: cy + 0.08, w: 1.0, h: 0.25,
      fontSize: D.bodySize, fontFace: D.fontBody, color: D.accent,
      align: "right", bold: true,
    });

    // Progress bar background
    const barX = cx + 0.15, barY = cy + 0.45, barW = cardW - 0.3, barH = 0.2;
    s.addShape(pres.ShapeType.rect, {
      x: barX, y: barY, w: barW, h: barH,
      fill: { color: D.card }, rectRadius: 0.1,
    });
    // Current progress fill
    const currentFill = (sc.currentScore / sc.maxScore) * barW;
    s.addShape(pres.ShapeType.rect, {
      x: barX, y: barY, w: currentFill, h: barH,
      fill: { color: D.primary }, rectRadius: 0.1,
    });
    // Target line
    const targetX = barX + (sc.targetScore / sc.maxScore) * barW;
    s.addShape(pres.ShapeType.rect, {
      x: targetX, y: barY - 0.05, w: 0.025, h: barH + 0.1,
      fill: { color: D.accent },
    });
    s.addText("Target", {
      x: targetX - 0.25, y: barY - 0.2, w: 0.5, h: 0.15,
      fontSize: 6, fontFace: D.fontBody, color: D.accent, align: "center",
    });

    // Delta arrow
    const isPositive = sc.delta >= 0;
    const deltaSymbol = isPositive ? "▲" : "▼";
    const deltaColor = isPositive ? "16A34A" : "DC2626";
    s.addText(deltaSymbol + " " + Math.abs(sc.delta), {
      x: cx + 0.15, y: cy + 0.78, w: 1.0, h: 0.25,
      fontSize: D.smallSize, fontFace: D.fontBody, color: deltaColor, bold: true,
    });
    s.addText("vs. prior period", {
      x: cx + 1.0, y: cy + 0.78, w: 1.5, h: 0.25,
      fontSize: D.smallSize - 1, fontFace: D.fontBody, color: D.secondary,
    });
  });

  // Copper accent bar
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 5.55, w: 10, h: 0.08, fill: { color: D.primary },
  });
  return s;
}

// --- THREE-COLUMN NUMBERED RECOMMENDATIONS ---
function recommendationsSlide(pres, title, recommendations) {
  // recommendations: [{ number, heading, detail }]
  const s = pres.addSlide();
  s.background = { color: D.bg };
  s.addText(title, {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5, fontSize: D.headingSize,
    fontFace: D.fontHead, color: D.primary, bold: true,
  });

  const cols = Math.min(recommendations.length, 3);
  const colW = (8.4 - (cols - 1) * 0.3) / cols;
  recommendations.slice(0, cols).forEach((rec, i) => {
    const rx = 0.8 + i * (colW + 0.3);
    // Card
    s.addShape(pres.ShapeType.rect, {
      x: rx, y: 1.0, w: colW, h: 3.5,
      fill: { color: D.surface }, rectRadius: 0.08,
      line: { color: D.elevated, width: 0.5 },
    });
    // Copper top accent
    s.addShape(pres.ShapeType.rect, {
      x: rx, y: 1.0, w: colW, h: 0.06,
      fill: { color: D.primary },
    });
    // Number badge
    s.addShape(pres.ShapeType.ellipse, {
      x: rx + colW / 2 - 0.3, y: 1.25, w: 0.6, h: 0.6,
      fill: { color: D.primary },
    });
    s.addText(String(rec.number), {
      x: rx + colW / 2 - 0.3, y: 1.25, w: 0.6, h: 0.6,
      fontSize: 18, fontFace: D.fontHead, color: D.white,
      align: "center", valign: "middle", bold: true,
    });
    // Heading
    s.addText(rec.heading, {
      x: rx + 0.2, y: 2.0, w: colW - 0.4, h: 0.4,
      fontSize: D.bodySize + 1, fontFace: D.fontBody, color: D.primary,
      align: "center", bold: true,
    });
    // Detail
    s.addText(rec.detail, {
      x: rx + 0.2, y: 2.5, w: colW - 0.4, h: 1.8,
      fontSize: D.smallSize, fontFace: D.fontBody, color: D.secondary,
      valign: "top", lineSpacingMultiple: 1.3,
    });
  });

  // Copper accent bar
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 5.55, w: 10, h: 0.08, fill: { color: D.primary },
  });
  return s;
}
`,
  footerPattern: `function addFooter(s, num) {
  // Copper accent bar acts as visual footer
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 5.55, w: 10, h: 0.08, fill: { color: "B45309" },
  });
  s.addText("SANDSTONE | BENCHMARKING REPORT", {
    x: 0.6, y: 5.2, w: 4.0, h: 0.3, fontSize: 7,
    fontFace: "Calibri", color: "78350F", align: "left",
  });
  s.addText(String(num), {
    x: 8.4, y: 5.2, w: 1.0, h: 0.3, fontSize: 7,
    fontFace: "Calibri", color: "78350F", align: "right",
  });
}`,
  qualityChecklist: `- Copper (B45309) and amber (D97706) are the primary accent colours
- FAF5EF warm parchment background on every slide
- Georgia headers / Calibri body throughout
- Title slide uses warm split layout: copper left panel with title on right
- Pareto chart combines BAR + LINE as separate addChart calls
- Process flowchart uses shape-built rects, diamonds, and directional arrows
- Maturity scorecards have progress bars with target lines and delta arrows
- Three-column recommendations use numbered circular badges
- Copper accent bar (h: 0.08) at bottom of every content slide
- Editorial benchmarking tone with warm industrial palette`,
};
