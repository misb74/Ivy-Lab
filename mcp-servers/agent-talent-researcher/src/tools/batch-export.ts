import path from 'path';
import ExcelJS from 'exceljs';
import { getDb } from '../db/database.js';
import type { RoleRow, BatchRow } from '../engine/types.js';

const HEADER_BLUE = '2C3E6B';
const TIER1_GREEN = 'E2EFDA';
const TIER2_AMBER = 'FFF2CC';
const TIER3_RED = 'FCE4EC';
const LIGHT_GRAY = 'F5F5F5';
const DARK_NAVY = '1B2A4A';
const BORDER_GRAY = 'D9D9D9';

export interface BatchExportParams {
  batch_id: string;
}

export async function batchExport(params: BatchExportParams): Promise<{
  batch_id: string;
  summary_path: string;
  filepath: string;
  total_workbooks: number;
  message: string;
}> {
  const { batch_id } = params;
  const db = getDb();

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batch_id) as BatchRow | undefined;
  if (!batch) {
    throw new Error(`Batch ${batch_id} not found`);
  }

  const roles = db.prepare(
    'SELECT * FROM roles WHERE batch_id = ? ORDER BY role_index'
  ).all(batch_id) as RoleRow[];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ivy Talent Researcher';
  wb.created = new Date();

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: BORDER_GRAY } },
    bottom: { style: 'thin', color: { argb: BORDER_GRAY } },
    left: { style: 'thin', color: { argb: BORDER_GRAY } },
    right: { style: 'thin', color: { argb: BORDER_GRAY } },
  };

  // ── Tab 1: Batch Overview ──
  const ws1 = wb.addWorksheet('Batch Overview', { properties: { tabColor: { argb: '4472C4' } } });

  ws1.mergeCells('A1:F1');
  const titleCell = ws1.getCell('A1');
  titleCell.value = `TALENT RESEARCH BATCH: ${batch.name}`;
  titleCell.font = { name: 'Calibri', bold: true, color: { argb: DARK_NAVY }, size: 16 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(1).height = 35;

  ws1.mergeCells('A2:F2');
  const subCell = ws1.getCell('A2');
  subCell.value = `Generated ${new Date().toLocaleDateString('en-GB')} | ${roles.length} roles researched`;
  subCell.font = { name: 'Calibri', italic: true, color: { argb: '666666' }, size: 10 };
  subCell.alignment = { horizontal: 'center' };

  const headers = ['#', 'Role', 'Location', 'Status', 'Candidates', 'Output File'];
  const headerRow = ws1.getRow(4);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });
  headerRow.height = 30;

  roles.forEach((role, i) => {
    const r = i + 5;
    const row = ws1.getRow(r);
    const statusEmoji = role.status === 'complete' ? '✓' : role.status === 'failed' ? '✗' : '○';
    const values = [
      role.role_index,
      role.title,
      role.location,
      `${statusEmoji} ${role.status.charAt(0).toUpperCase() + role.status.slice(1)}`,
      role.candidates_found || 0,
      role.output_path ? path.basename(role.output_path) : '-',
    ];

    let fillColor = i % 2 === 0 ? LIGHT_GRAY : 'FFFFFF';
    if (role.status === 'complete') fillColor = TIER1_GREEN;
    else if (role.status === 'failed') fillColor = TIER3_RED;

    values.forEach((v, j) => {
      const cell = row.getCell(j + 1);
      cell.value = v;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
    });
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    row.height = 22;
  });

  ws1.getColumn(1).width = 6;
  ws1.getColumn(2).width = 40;
  ws1.getColumn(3).width = 15;
  ws1.getColumn(4).width = 15;
  ws1.getColumn(5).width = 12;
  ws1.getColumn(6).width = 50;

  // ── Tab 2: Cross-Role Candidate Overlap ──
  const ws2 = wb.addWorksheet('Candidate Overlap', { properties: { tabColor: { argb: 'ED7D31' } } });

  ws2.mergeCells('A1:D1');
  ws2.getCell('A1').value = 'CROSS-ROLE CANDIDATE OVERLAP';
  ws2.getCell('A1').font = { name: 'Calibri', bold: true, color: { argb: DARK_NAVY }, size: 16 };
  ws2.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(1).height = 35;

  ws2.mergeCells('A2:D2');
  ws2.getCell('A2').value = 'Candidates appearing in multiple role searches - indicates versatile talent';
  ws2.getCell('A2').font = { name: 'Calibri', italic: true, color: { argb: '666666' }, size: 10 };
  ws2.getCell('A2').alignment = { horizontal: 'center' };

  // Build overlap map
  const candidateRoleMap = new Map<string, string[]>();
  for (const role of roles) {
    if (!role.results_json) continue;
    try {
      const results = JSON.parse(role.results_json);
      for (const c of results.candidates || []) {
        const name = c.name?.toLowerCase().trim();
        if (!name) continue;
        if (!candidateRoleMap.has(name)) candidateRoleMap.set(name, []);
        candidateRoleMap.get(name)!.push(role.title);
      }
    } catch { /* skip malformed */ }
  }

  const overlaps = Array.from(candidateRoleMap.entries())
    .filter(([, roles]) => roles.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  const olHeaders = ['Candidate', 'Appears In # Roles', 'Roles', 'Versatility Signal'];
  const olHeaderRow = ws2.getRow(4);
  olHeaders.forEach((h, i) => {
    const cell = olHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });

  if (overlaps.length === 0) {
    ws2.mergeCells('A5:D5');
    ws2.getCell('A5').value = 'No cross-role overlaps detected (each role has unique candidates)';
    ws2.getCell('A5').font = { name: 'Calibri', italic: true, size: 10 };
  } else {
    overlaps.forEach(([name, roles], i) => {
      const r = i + 5;
      const row = ws2.getRow(r);
      const fillColor = i % 2 === 0 ? LIGHT_GRAY : 'FFFFFF';
      const displayName = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      const vals = [
        displayName,
        roles.length,
        roles.join('; '),
        roles.length >= 3 ? 'High versatility - strong cross-functional leader' : 'Moderate versatility - dual-sector relevance',
      ];
      vals.forEach((v, j) => {
        const cell = row.getCell(j + 1);
        cell.value = v;
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = thinBorder;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      });
      row.getCell(1).font = { name: 'Calibri', bold: true, size: 10 };
      row.height = 25;
    });
  }

  ws2.getColumn(1).width = 30;
  ws2.getColumn(2).width = 18;
  ws2.getColumn(3).width = 60;
  ws2.getColumn(4).width = 45;

  // ── Tab 3: Quality Scores ──
  const ws3 = wb.addWorksheet('Quality Scores', { properties: { tabColor: { argb: '70AD47' } } });

  ws3.mergeCells('A1:E1');
  ws3.getCell('A1').value = 'RESEARCH QUALITY SCORES';
  ws3.getCell('A1').font = { name: 'Calibri', bold: true, color: { argb: DARK_NAVY }, size: 16 };
  ws3.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws3.getRow(1).height = 35;

  ws3.mergeCells('A2:E2');
  ws3.getCell('A2').value = 'Roles flagged for thin research or low candidate coverage may need manual supplementation';
  ws3.getCell('A2').font = { name: 'Calibri', italic: true, color: { argb: '666666' }, size: 10 };
  ws3.getCell('A2').alignment = { horizontal: 'center' };

  const qHeaders = ['#', 'Role', 'Candidates', 'Quality', 'Flag'];
  const qHeaderRow = ws3.getRow(4);
  qHeaders.forEach((h, i) => {
    const cell = qHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });

  roles.forEach((role, i) => {
    const r = i + 5;
    const row = ws3.getRow(r);
    const count = role.candidates_found || 0;
    let quality = 'N/A';
    let flag = '';
    let fillColor = 'FFFFFF';

    if (role.status === 'complete') {
      if (count >= 20) { quality = 'Strong'; fillColor = TIER1_GREEN; }
      else if (count >= 15) { quality = 'Adequate'; fillColor = TIER2_AMBER; flag = 'Could use more candidates'; }
      else if (count >= 10) { quality = 'Thin'; fillColor = TIER2_AMBER; flag = 'Needs supplementation'; }
      else { quality = 'Insufficient'; fillColor = TIER3_RED; flag = 'REQUIRES MANUAL RESEARCH'; }
    } else if (role.status === 'failed') {
      quality = 'Failed';
      fillColor = TIER3_RED;
      flag = role.error || 'Research failed - retry needed';
    }

    [role.role_index, role.title, count, quality, flag].forEach((v, j) => {
      const cell = row.getCell(j + 1);
      cell.value = v;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
    });
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.height = 22;
  });

  ws3.getColumn(1).width = 6;
  ws3.getColumn(2).width = 40;
  ws3.getColumn(3).width = 12;
  ws3.getColumn(4).width = 15;
  ws3.getColumn(5).width = 45;

  // Save
  const summaryPath = path.join(batch.output_dir, '_SUMMARY_DASHBOARD.xlsx');
  await wb.xlsx.writeFile(summaryPath);

  const completedCount = roles.filter(r => r.status === 'complete').length;

  return {
    batch_id,
    summary_path: summaryPath,
    filepath: summaryPath,
    total_workbooks: completedCount,
    message: `Summary dashboard generated: _SUMMARY_DASHBOARD.xlsx (${completedCount}/${roles.length} roles complete)`,
  };
}
