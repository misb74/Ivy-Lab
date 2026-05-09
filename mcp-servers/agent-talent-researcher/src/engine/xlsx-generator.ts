// ============================================================
// xlsx-generator.ts — Professional Excel workbook generator
// for talent research roles. Produces a 4-tab workbook with
// Talent Profiles, Market Intelligence, Certifications &
// Regulatory, and Approach Strategy tabs.
// ============================================================

import ExcelJS from "exceljs";
import type {
  ResearchResults,
  CandidateProfile,
  MarketIntelligence,
  CertificationEntry,
  RegulatoryFramework,
  ApproachEntry,
  RoleSpec,
} from "./types.js";

// ── Color Palette ───────────────────────────────────────────

const COLORS = {
  DARK_NAVY: "1B2A4A",
  HEADER_BLUE: "2C3E6B",
  TIER1_GREEN: "E2EFDA",
  TIER2_AMBER: "FFF2CC",
  TIER3_RED: "FCE4EC",
  LIGHT_GRAY: "F5F5F5",
  ACCENT_GREEN: "548235",
  ACCENT_RED: "C00000",
  BORDER_GRAY: "D9D9D9",
} as const;

const TAB_COLORS = {
  PROFILES: "4472C4",
  MARKET: "548235",
  CERTS: "ED7D31",
  APPROACH: "70AD47",
} as const;

// ── Thin Border Style ───────────────────────────────────────

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: `FF${COLORS.BORDER_GRAY}` } },
  bottom: { style: "thin", color: { argb: `FF${COLORS.BORDER_GRAY}` } },
  left: { style: "thin", color: { argb: `FF${COLORS.BORDER_GRAY}` } },
  right: { style: "thin", color: { argb: `FF${COLORS.BORDER_GRAY}` } },
};

// ── Helper Functions ────────────────────────────────────────

/**
 * Apply header styling to a row: white bold Calibri 11, HEADER_BLUE fill,
 * center alignment, thin borders.
 */
function styleHeaderRow(
  ws: ExcelJS.Worksheet,
  rowNumber: number,
  colCount: number
): void {
  const row = ws.getRow(rowNumber);
  for (let col = 1; col <= colCount; col++) {
    const cell = row.getCell(col);
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${COLORS.HEADER_BLUE}` },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = THIN_BORDER;
  }
  row.height = 40;
}

/**
 * Apply data-row styling: Calibri 10, wrap text, top alignment,
 * thin borders, optional fill color.
 */
function styleDataRow(
  ws: ExcelJS.Worksheet,
  rowNumber: number,
  colCount: number,
  fillColor?: string
): void {
  const row = ws.getRow(rowNumber);
  for (let col = 1; col <= colCount; col++) {
    const cell = row.getCell(col);
    cell.font = { name: "Calibri", size: 10 };
    cell.alignment = {
      vertical: "top",
      wrapText: true,
    };
    cell.border = THIN_BORDER;
    if (fillColor) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: `FF${fillColor}` },
      };
    }
  }
}

/**
 * Return the background color for a candidate row based on openness score.
 */
function getTierColor(openness: number): string {
  if (openness >= 5) return COLORS.TIER1_GREEN;
  if (openness === 4) return COLORS.TIER2_AMBER;
  if (openness === 3) return COLORS.LIGHT_GRAY;
  return COLORS.TIER3_RED; // 1–2
}

/**
 * Return the font color for the openness score cell.
 */
function getOpennessFont(openness: number): Partial<ExcelJS.Font> {
  if (openness >= 5) return { name: "Calibri", size: 10, bold: true, color: { argb: `FF${COLORS.ACCENT_GREEN}` } };
  if (openness === 4) return { name: "Calibri", size: 10, bold: true, color: { argb: "FFBF8F00" } }; // amber
  if (openness <= 2) return { name: "Calibri", size: 10, bold: true, color: { argb: `FF${COLORS.ACCENT_RED}` } };
  return { name: "Calibri", size: 10, bold: true };
}

/**
 * Build a text progress bar using full/empty block characters.
 */
function makeProgressBar(pct: number, width: number = 12): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

/**
 * Write a merged title row across the given number of columns.
 */
function writeTitleRow(
  ws: ExcelJS.Worksheet,
  rowNumber: number,
  text: string,
  colCount: number,
  fontSize: number = 16
): void {
  ws.mergeCells(rowNumber, 1, rowNumber, colCount);
  const cell = ws.getRow(rowNumber).getCell(1);
  cell.value = text;
  cell.font = {
    name: "Calibri",
    size: fontSize,
    bold: true,
    color: { argb: `FF${COLORS.DARK_NAVY}` },
  };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFFFFF" },
  };
  ws.getRow(rowNumber).height = fontSize * 2 + 4;
}

/**
 * Write a merged subtitle row across the given number of columns.
 */
function writeSubtitleRow(
  ws: ExcelJS.Worksheet,
  rowNumber: number,
  text: string,
  colCount: number
): void {
  ws.mergeCells(rowNumber, 1, rowNumber, colCount);
  const cell = ws.getRow(rowNumber).getCell(1);
  cell.value = text;
  cell.font = {
    name: "Calibri",
    size: 10,
    italic: true,
    color: { argb: "FF808080" },
  };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.getRow(rowNumber).height = 30;
}

/**
 * Write a section header row (merged, bold, dark navy, light gray fill).
 */
function writeSectionHeader(
  ws: ExcelJS.Worksheet,
  rowNumber: number,
  text: string,
  colCount: number
): void {
  ws.mergeCells(rowNumber, 1, rowNumber, colCount);
  const cell = ws.getRow(rowNumber).getCell(1);
  cell.value = text;
  cell.font = {
    name: "Calibri",
    size: 12,
    bold: true,
    color: { argb: `FF${COLORS.DARK_NAVY}` },
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${COLORS.LIGHT_GRAY}` },
  };
  cell.alignment = { horizontal: "left", vertical: "middle" };
  cell.border = THIN_BORDER;
  ws.getRow(rowNumber).height = 28;
}

// ── Tab Builders ────────────────────────────────────────────

/**
 * TAB 1 — Talent Profiles
 */
function buildTalentProfilesTab(
  wb: ExcelJS.Workbook,
  roleSpec: RoleSpec,
  candidates: CandidateProfile[]
): void {
  const ws = wb.addWorksheet("Talent Profiles", {
    properties: { tabColor: { argb: `FF${TAB_COLORS.PROFILES}` } },
  });

  const COL_COUNT = 18;
  const COL_WIDTHS = [6, 22, 30, 28, 16, 18, 25, 25, 30, 22, 30, 45, 8, 30, 35, 10, 40, 50];
  COL_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // Row 1 — Title
  const titleText = `${roleSpec.title.toUpperCase()} — TALENT PROFILES — RANKED BY FIT`;
  writeTitleRow(ws, 1, titleText, COL_COUNT);

  // Row 2 — Subtitle
  const criteriaParts: string[] = [];
  if (roleSpec.location) criteriaParts.push(`Location: ${roleSpec.location}`);
  if (roleSpec.industry_experience?.length) criteriaParts.push(`Industries: ${roleSpec.industry_experience.join(", ")}`);
  if (roleSpec.certifications?.length) criteriaParts.push(`Certs: ${roleSpec.certifications.join(", ")}`);
  if (roleSpec.regulatory_requirements?.length) criteriaParts.push(`Regulatory: ${roleSpec.regulatory_requirements.join(", ")}`);
  if (roleSpec.org_size) criteriaParts.push(`Org size: ${roleSpec.org_size}`);
  const subtitleText = criteriaParts.length > 0
    ? `Role Criteria: ${criteriaParts.join("  |  ")}`
    : "Role Criteria: see specification";
  writeSubtitleRow(ws, 2, subtitleText, COL_COUNT);

  // Row 3 — blank spacer
  ws.getRow(3).height = 8;

  // Row 4 — Headers
  const HEADERS = [
    "Rank",
    "Name",
    "Current Title",
    "Current Company",
    "Profile Link",
    "Top 100 Org?",
    "Industry Exp 1",
    "Industry Exp 2",
    "Gov/Military Background",
    "Certifications",
    "Regulatory Experience",
    "Key Previous Roles",
    "Years Exp",
    "Education",
    "Thought Leadership",
    "Openness (1-5)",
    "Openness Signals",
    "Recruiter Notes",
  ];
  const headerRow = ws.getRow(4);
  HEADERS.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  styleHeaderRow(ws, 4, COL_COUNT);

  // Row 5+ — Candidate data
  candidates.forEach((c, idx) => {
    const r = 5 + idx;
    const row = ws.getRow(r);
    const values: (string | number)[] = [
      c.rank,
      c.name,
      c.current_title,
      c.current_company,
      '', // placeholder for Profile Link (set below as hyperlink)
      c.top_100_org,
      c.industry_experience_1,
      c.industry_experience_2,
      c.gov_military_background,
      c.certifications,
      c.regulatory_experience,
      c.key_previous_roles,
      c.years_experience,
      c.education,
      c.thought_leadership,
      c.openness_score,
      c.openness_signals,
      c.recruiter_notes,
    ];
    values.forEach((v, i) => {
      row.getCell(i + 1).value = v;
    });

    // Profile Link column (col 5) — hyperlink or N/A
    const profileCell = row.getCell(5);
    if (c.source_url) {
      profileCell.value = { text: 'View Profile', hyperlink: c.source_url } as ExcelJS.CellHyperlinkValue;
      profileCell.font = { name: "Calibri", size: 10, color: { argb: 'FF0563C1' }, underline: true };
    } else {
      profileCell.value = 'N/A';
    }

    const tierColor = getTierColor(c.openness_score);
    styleDataRow(ws, r, COL_COUNT, tierColor);
    row.height = 80;

    // Bold the Name column (col 2)
    row.getCell(2).font = { name: "Calibri", size: 10, bold: true };

    // Restore hyperlink styling on Profile Link after styleDataRow override
    if (c.source_url) {
      profileCell.font = { name: "Calibri", size: 10, color: { argb: 'FF0563C1' }, underline: true };
    }

    // Center Rank (1), Years Exp (13), Openness (16) — shifted by 1 for new column
    [1, 13, 16].forEach((col) => {
      row.getCell(col).alignment = {
        horizontal: "center",
        vertical: "top",
        wrapText: true,
      };
    });

    // Color the openness score font (now col 16)
    row.getCell(16).font = getOpennessFont(c.openness_score);
  });

  // Freeze panes at C5 (columns A-B frozen, rows 1-4 frozen)
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 4, topLeftCell: "C5", activeCell: "C5" }];

  // Auto-filter on row 4
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4 + candidates.length, column: COL_COUNT },
  };

  // Legend rows after data
  const legendStart = 5 + candidates.length + 2; // 2-row gap

  writeSectionHeader(ws, legendStart, "COLOR LEGEND — OPENNESS SCORE", COL_COUNT);

  const legendData = [
    { label: "Score 5 — Highly Open", color: COLORS.TIER1_GREEN, desc: "Candidate has given strong signals of openness to new opportunities (actively networking, recent LinkedIn updates, recruiter-confirmed interest)." },
    { label: "Score 4 — Open", color: COLORS.TIER2_AMBER, desc: "Candidate shows moderate signals of openness (engaged at industry events, responded positively to initial outreach, contract nearing end)." },
    { label: "Score 3 — Neutral", color: COLORS.LIGHT_GRAY, desc: "No clear signals either way. Worth approaching with a compelling value proposition but expect longer courting period." },
    { label: "Score 1–2 — Low Openness", color: COLORS.TIER3_RED, desc: "Recently promoted, publicly committed to current role, or known to be unresponsive. Long-term relationship-building recommended." },
  ];

  legendData.forEach((item, i) => {
    const r = legendStart + 1 + i;
    const row = ws.getRow(r);
    row.getCell(1).value = "";
    ws.mergeCells(r, 2, r, 4);
    row.getCell(2).value = item.label;
    row.getCell(2).font = { name: "Calibri", size: 10, bold: true };
    ws.mergeCells(r, 5, r, COL_COUNT);
    row.getCell(5).value = item.desc;
    row.getCell(5).font = { name: "Calibri", size: 10, italic: true };
    row.getCell(5).alignment = { wrapText: true, vertical: "top" };
    styleDataRow(ws, r, COL_COUNT, item.color);
    row.height = 36;
  });
}

/**
 * TAB 2 — Market Intelligence
 */
function buildMarketIntelligenceTab(
  wb: ExcelJS.Workbook,
  roleSpec: RoleSpec,
  market: MarketIntelligence
): void {
  const ws = wb.addWorksheet("Market Intelligence", {
    properties: { tabColor: { argb: `FF${TAB_COLORS.MARKET}` } },
  });

  const COL_COUNT = 5;
  const COL_WIDTHS = [35, 40, 40, 55, 60];
  COL_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // Row 1 — Title
  writeTitleRow(ws, 1, "MARKET INTELLIGENCE", COL_COUNT);

  // Row 2 — Subtitle
  writeSubtitleRow(
    ws,
    2,
    `Market landscape, tier rankings, and top recommendations for ${roleSpec.title}`,
    COL_COUNT
  );

  // Row 3 — blank spacer
  ws.getRow(3).height = 8;

  // ── Market Stats Section ──────────────────────────────────

  const statsHeaders = ["Key Statistic", "Value", "Source", "Implication"];
  // We use only 4 columns for this section; the 5th column stays empty.
  const statsRow = ws.getRow(4);
  statsHeaders.forEach((h, i) => {
    statsRow.getCell(i + 1).value = h;
  });
  styleHeaderRow(ws, 4, 4);
  // Clear style on col 5
  ws.getRow(4).getCell(5).value = "";

  market.stats.forEach((stat, idx) => {
    const r = 5 + idx;
    const row = ws.getRow(r);
    row.getCell(1).value = stat.statistic;
    row.getCell(2).value = stat.value;
    row.getCell(3).value = stat.source;
    row.getCell(4).value = stat.implication;
    const fill = idx % 2 === 0 ? COLORS.LIGHT_GRAY : undefined;
    styleDataRow(ws, r, 4, fill);
    row.height = 50;
  });

  // ── Tier Ranking Key Section ──────────────────────────────

  let currentRow = 5 + market.stats.length + 2;

  writeSectionHeader(ws, currentRow, "TIER RANKING KEY", COL_COUNT);
  currentRow++;

  const tierHeaders = ["Tier", "Description", "Openness Score", "Approach Strategy"];
  const tierHeaderRow = ws.getRow(currentRow);
  tierHeaders.forEach((h, i) => {
    tierHeaderRow.getCell(i + 1).value = h;
  });
  styleHeaderRow(ws, currentRow, 4);
  currentRow++;

  market.tier_rankings.forEach((tier) => {
    const row = ws.getRow(currentRow);
    row.getCell(1).value = tier.tier;
    row.getCell(2).value = tier.description;
    row.getCell(3).value = tier.openness_score;
    row.getCell(4).value = tier.approach_strategy;

    // Color by tier name
    let tierColor: string | undefined;
    const tierLower = tier.tier.toLowerCase();
    if (tierLower.includes("1") || tierLower.includes("gold") || tierLower.includes("top")) {
      tierColor = COLORS.TIER1_GREEN;
    } else if (tierLower.includes("2") || tierLower.includes("silver")) {
      tierColor = COLORS.TIER2_AMBER;
    } else if (tierLower.includes("3") || tierLower.includes("bronze")) {
      tierColor = COLORS.LIGHT_GRAY;
    } else {
      tierColor = COLORS.TIER3_RED;
    }
    styleDataRow(ws, currentRow, 4, tierColor);
    row.height = 50;
    currentRow++;
  });

  // ── Top Recommendations by Criteria Section ───────────────

  currentRow += 1; // gap

  writeSectionHeader(ws, currentRow, "TOP RECOMMENDATIONS BY CRITERIA", COL_COUNT);
  currentRow++;

  const recHeaders = ["Criteria", "Pick 1", "Pick 2", "Pick 3", "Why"];
  const recHeaderRow = ws.getRow(currentRow);
  recHeaders.forEach((h, i) => {
    recHeaderRow.getCell(i + 1).value = h;
  });
  styleHeaderRow(ws, currentRow, COL_COUNT);
  currentRow++;

  market.recommendations.forEach((rec, idx) => {
    const row = ws.getRow(currentRow);
    row.getCell(1).value = rec.criteria;
    row.getCell(2).value = rec.pick_1;
    row.getCell(3).value = rec.pick_2;
    row.getCell(4).value = rec.pick_3;
    row.getCell(5).value = rec.why;
    const fill = idx % 2 === 0 ? COLORS.LIGHT_GRAY : undefined;
    styleDataRow(ws, currentRow, COL_COUNT, fill);
    row.height = 60;
    currentRow++;
  });
}

/**
 * TAB 3 — Certifications & Regulatory
 */
function buildCertificationsTab(
  wb: ExcelJS.Workbook,
  roleSpec: RoleSpec,
  certifications: CertificationEntry[],
  regulatoryFrameworks: RegulatoryFramework[]
): void {
  const ws = wb.addWorksheet("Certifications & Regulatory", {
    properties: { tabColor: { argb: `FF${TAB_COLORS.CERTS}` } },
  });

  const COL_COUNT = 4;
  const COL_WIDTHS = [32, 50, 65, 70];
  COL_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // Row 1 — Title
  writeTitleRow(ws, 1, "CERTIFICATIONS & REGULATORY LANDSCAPE", COL_COUNT);

  // Row 2 — Subtitle
  writeSubtitleRow(
    ws,
    2,
    `Certification requirements and regulatory framework analysis for ${roleSpec.title}`,
    COL_COUNT
  );

  // Row 3 — spacer
  ws.getRow(3).height = 8;

  // ── Certification Requirements ────────────────────────────

  writeSectionHeader(ws, 4, "CERTIFICATION REQUIREMENTS", COL_COUNT);

  const certHeaders = ["Certification", "Priority", "Why Required", "Candidates Who Have It"];
  const certHeaderRow = ws.getRow(5);
  certHeaders.forEach((h, i) => {
    certHeaderRow.getCell(i + 1).value = h;
  });
  styleHeaderRow(ws, 5, COL_COUNT);

  let currentRow = 6;
  certifications.forEach((cert) => {
    const row = ws.getRow(currentRow);
    row.getCell(1).value = cert.certification;
    row.getCell(2).value = cert.priority;
    row.getCell(3).value = cert.why_required;
    row.getCell(4).value = cert.candidates_who_have_it;

    // Color by priority
    let color: string | undefined;
    const priorityLower = cert.priority.toLowerCase();
    if (priorityLower.includes("must")) {
      color = COLORS.TIER1_GREEN;
    } else if (priorityLower.includes("highly")) {
      color = COLORS.TIER2_AMBER;
    } else if (priorityLower.includes("preferred")) {
      color = COLORS.LIGHT_GRAY;
    }
    // "Nice-to-Have" => no fill (white)

    styleDataRow(ws, currentRow, COL_COUNT, color);
    row.height = 55;
    currentRow++;
  });

  // ── Regulatory Frameworks ─────────────────────────────────

  currentRow += 1; // gap

  writeSectionHeader(ws, currentRow, "REGULATORY FRAMEWORKS", COL_COUNT);
  currentRow++;

  const regHeaders = ["Framework", "Relevance", "Candidates with Experience"];
  const regHeaderRow = ws.getRow(currentRow);
  regHeaders.forEach((h, i) => {
    regHeaderRow.getCell(i + 1).value = h;
  });
  // Style only 3 columns for this section
  styleHeaderRow(ws, currentRow, 3);
  currentRow++;

  regulatoryFrameworks.forEach((fw, idx) => {
    const row = ws.getRow(currentRow);
    row.getCell(1).value = fw.framework;
    row.getCell(2).value = fw.relevance;
    row.getCell(3).value = fw.candidates_with_experience;
    const fill = idx % 2 === 0 ? COLORS.LIGHT_GRAY : undefined;
    styleDataRow(ws, currentRow, 3, fill);
    row.height = 55;
    currentRow++;
  });
}

/**
 * TAB 4 — Approach Strategy
 */
function buildApproachStrategyTab(
  wb: ExcelJS.Workbook,
  roleSpec: RoleSpec,
  strategies: ApproachEntry[]
): void {
  const ws = wb.addWorksheet("Approach Strategy", {
    properties: { tabColor: { argb: `FF${TAB_COLORS.APPROACH}` } },
  });

  const COL_COUNT = 5;
  const COL_WIDTHS = [14, 22, 40, 55, 70];
  COL_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // Row 1 — Title
  writeTitleRow(ws, 1, "APPROACH STRATEGY", COL_COUNT);

  // Row 2 — Subtitle
  writeSubtitleRow(
    ws,
    2,
    `Prioritized outreach plan for ${roleSpec.title} — sequenced by candidate openness and strategic fit`,
    COL_COUNT
  );

  // Row 3 — spacer
  ws.getRow(3).height = 8;

  // Row 4 — Headers
  const HEADERS = [
    "Priority",
    "Name",
    "Current Status",
    "Recommended Approach",
    "Talking Points",
  ];
  const headerRow = ws.getRow(4);
  HEADERS.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  styleHeaderRow(ws, 4, COL_COUNT);

  // Row 5+ — Strategy data
  strategies.forEach((s, idx) => {
    const r = 5 + idx;
    const row = ws.getRow(r);
    row.getCell(1).value = s.priority;
    row.getCell(2).value = s.name;
    row.getCell(3).value = s.current_status;
    row.getCell(4).value = s.recommended_approach;
    row.getCell(5).value = s.talking_points;

    // Color by priority
    let color: string | undefined;
    const priorityLower = s.priority.toLowerCase();
    if (priorityLower.includes("immediate")) {
      color = COLORS.TIER1_GREEN;
    } else if (priorityLower.includes("high")) {
      color = COLORS.TIER2_AMBER;
    } else if (priorityLower.includes("medium")) {
      color = COLORS.LIGHT_GRAY;
    } else if (priorityLower.includes("long")) {
      color = COLORS.TIER3_RED;
    }

    styleDataRow(ws, r, COL_COUNT, color);
    row.height = 80;

    // Bold Priority (col 1) and Name (col 2)
    row.getCell(1).font = { name: "Calibri", size: 10, bold: true };
    row.getCell(2).font = { name: "Calibri", size: 10, bold: true };
  });

  // Freeze panes at A5 (rows 1-4 frozen)
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 4, topLeftCell: "A5", activeCell: "A5" }];

  // Auto-filter on row 4
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4 + strategies.length, column: COL_COUNT },
  };
}

// ── Main Export ─────────────────────────────────────────────

/**
 * Generate a professional 4-tab Excel workbook for a talent research role.
 *
 * @param roleSpec - The role specification (title, location, criteria)
 * @param results - Complete research results (candidates, market intel, certs, strategies)
 * @param outputPath - Absolute file path for the .xlsx output
 * @returns The outputPath after writing
 */
export async function generateWorkbook(
  roleSpec: RoleSpec,
  results: ResearchResults,
  outputPath: string
): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ivy Talent Researcher";
  wb.created = new Date();
  wb.modified = new Date();

  // Build each tab
  buildTalentProfilesTab(wb, roleSpec, results.candidates);
  buildMarketIntelligenceTab(wb, roleSpec, results.market_intelligence);
  buildCertificationsTab(
    wb,
    roleSpec,
    results.certifications,
    results.regulatory_frameworks
  );
  buildApproachStrategyTab(wb, roleSpec, results.approach_strategies);

  // Write to disk
  await wb.xlsx.writeFile(outputPath);

  return outputPath;
}
