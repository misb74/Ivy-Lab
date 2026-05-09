import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { ExcelProfile, SheetProfile, ColumnProfile } from './types.js';

export async function profileExcel(filePath: string): Promise<ExcelProfile> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel file not found: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  const fileSizeMb = Math.round((stats.size / (1024 * 1024)) * 100) / 100;
  const ext = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath);
  const sourceId = crypto.randomUUID();

  const workbook = new ExcelJS.Workbook();
  if (ext === '.csv') {
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }

  const sheets: SheetProfile[] = [];

  for (const worksheet of workbook.worksheets) {
    const sheetProfile = profileSheet(worksheet);
    sheets.push(sheetProfile);
  }

  return {
    source_id: sourceId,
    filename,
    format: ext.replace('.', ''),
    file_size_mb: fileSizeMb,
    sheets,
  };
}

function profileSheet(worksheet: ExcelJS.Worksheet): SheetProfile {
  const rowCount = worksheet.rowCount;
  const headerRow = 1;
  const dataStartRow = 2;

  // Get headers from first row
  const firstRow = worksheet.getRow(headerRow);
  const headers: string[] = [];
  firstRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? `Column_${colNumber}`).trim();
  });

  // Profile each column
  const columns: ColumnProfile[] = [];
  const dataQualityFlags: string[] = [];
  let dateCoverage: SheetProfile['date_coverage'] | undefined;

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const colNumber = colIdx + 1;
    const colName = headers[colIdx];
    const values: unknown[] = [];

    for (let rowNum = dataStartRow; rowNum <= Math.min(rowCount, dataStartRow + 9999); rowNum++) {
      const cell = worksheet.getRow(rowNum).getCell(colNumber);
      values.push(cell.value);
    }

    const profile = profileColumn(colName, values);
    columns.push(profile);

    // Check for date column coverage
    if (profile.data_type === 'date' && !dateCoverage) {
      const dates = values.filter(v => v instanceof Date || (typeof v === 'string' && !isNaN(Date.parse(v))));
      if (dates.length > 0) {
        const sorted = dates.map(d => d instanceof Date ? d : new Date(d as string)).sort((a, b) => a.getTime() - b.getTime());
        dateCoverage = {
          earliest: sorted[0].toISOString().slice(0, 10),
          latest: sorted[sorted.length - 1].toISOString().slice(0, 10),
          column: colName,
        };
      }
    }

    // Quality flags
    const nullPct = (profile.null_count / Math.max(values.length, 1)) * 100;
    if (nullPct > 50) {
      dataQualityFlags.push(`Column "${colName}" is ${Math.round(nullPct)}% null`);
    }
    if (profile.data_type === 'mixed') {
      dataQualityFlags.push(`Column "${colName}" has mixed data types`);
    }
  }

  if (rowCount < 2) {
    dataQualityFlags.push('Sheet has no data rows');
  }

  return {
    sheet_name: worksheet.name,
    row_count: Math.max(rowCount - 1, 0),
    header_row: headerRow,
    data_start_row: dataStartRow,
    columns,
    data_quality_flags: dataQualityFlags,
    date_coverage: dateCoverage,
  };
}

function profileColumn(colName: string, values: unknown[]): ColumnProfile {
  const sampleSize = 5;
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  const nullCount = values.length - nonNull.length;

  // Determine data type
  let dataType: ColumnProfile['data_type'] = 'empty';
  const types = new Set<string>();

  for (const v of nonNull.slice(0, 100)) {
    if (v instanceof Date) {
      types.add('date');
    } else if (typeof v === 'number') {
      types.add('number');
    } else if (typeof v === 'boolean') {
      types.add('boolean');
    } else if (typeof v === 'string') {
      if (!isNaN(Date.parse(v)) && /\d{4}[-\/]\d{2}[-\/]\d{2}/.test(v)) {
        types.add('date');
      } else if (!isNaN(Number(v)) && v.trim() !== '') {
        types.add('number');
      } else {
        types.add('string');
      }
    } else if (typeof v === 'object' && v !== null) {
      // ExcelJS date objects
      types.add('date');
    }
  }

  if (types.size === 0) dataType = 'empty';
  else if (types.size === 1) dataType = [...types][0] as ColumnProfile['data_type'];
  else dataType = 'mixed';

  // Sample values
  const samples = nonNull.slice(0, sampleSize).map(v => {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'object' && v !== null) return String(v);
    return v as string | number | null;
  });

  // Distinct values
  const distinctSet = new Set(nonNull.map(v => String(v)));
  const distinctValues = distinctSet.size;

  // Numeric stats
  let min: number | string | undefined;
  let max: number | string | undefined;
  let mean: number | undefined;

  if (dataType === 'number') {
    const nums = nonNull.map(v => typeof v === 'string' ? Number(v) : v as number).filter(n => !isNaN(n));
    if (nums.length > 0) {
      min = Math.min(...nums);
      max = Math.max(...nums);
      mean = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
    }
  }

  // Infer role
  const role = inferColumnRole(colName, dataType, distinctValues, nonNull.length);

  return {
    column_name: colName,
    data_type: dataType,
    sample_values: samples,
    distinct_values: distinctValues,
    null_count: nullCount,
    min,
    max,
    mean,
    role,
  };
}

function inferColumnRole(name: string, type: string, distinct: number, total: number): ColumnProfile['role'] {
  const lower = name.toLowerCase();

  // Date columns
  if (type === 'date' || /date|_dt|timestamp|period|month|year/i.test(lower)) {
    return 'date';
  }

  // Identifier columns
  if (/\b(id|employee.?id|emp.?no|staff.?id|badge|number)\b/i.test(lower)) {
    return 'identifier';
  }

  // Flag/boolean columns
  if (type === 'boolean' || distinct <= 5 && /status|flag|active|type|category/i.test(lower)) {
    return 'flag';
  }

  // Dimension columns (categorical with moderate cardinality)
  if (type === 'string' && distinct < total * 0.5 && distinct > 1) {
    return 'dimension';
  }

  // Measure columns (numeric)
  if (type === 'number') {
    return 'measure';
  }

  // Text columns (high cardinality strings)
  if (type === 'string') {
    return 'text';
  }

  return undefined;
}
