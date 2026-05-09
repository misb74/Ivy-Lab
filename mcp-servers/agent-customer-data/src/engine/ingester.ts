import fs from 'fs';
import readline from 'readline';
import type Database from 'better-sqlite3';
import ExcelJS from 'exceljs';
import { DENORMALIZED_FIELDS } from './concept-map.js';

interface ColumnMapping {
  [originalName: string]: string | null; // originalName → ivy_concept or null
}

const BATCH_SIZE = 1000;

/**
 * Ingest a file (CSV or XLSX) into the records table for a given dataset.
 * Reads the file, applies column mappings, and inserts rows in batches.
 */
export async function ingestFile(
  db: Database.Database,
  datasetId: string,
  filePath: string,
  fileType: string,
  mapping: ColumnMapping
): Promise<{ rowCount: number; errors: string[] }> {
  const errors: string[] = [];
  let rowCount = 0;

  // Build reverse mapping: ivy_concept → original column name
  const conceptToOriginal = new Map<string, string>();
  for (const [original, concept] of Object.entries(mapping)) {
    if (concept) conceptToOriginal.set(concept, original);
  }

  const insertStmt = db.prepare(`
    INSERT INTO records (dataset_id, row_number, data_json, _job_title, _department, _location, _job_level, _job_family, _salary, _fte, _hire_date, _soc_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((rows: any[][]) => {
    for (const row of rows) {
      insertStmt.run(...row);
    }
  });

  const normalizedType = fileType.toLowerCase().replace(/^\./, '');

  if (normalizedType === 'csv' || normalizedType === 'tsv') {
    const result = await ingestCsv(
      filePath,
      datasetId,
      mapping,
      conceptToOriginal,
      insertBatch,
      normalizedType === 'tsv' ? '\t' : ','
    );
    rowCount = result.rowCount;
    errors.push(...result.errors);
  } else if (normalizedType === 'xlsx' || normalizedType === 'xls') {
    const result = await ingestXlsx(
      filePath,
      datasetId,
      mapping,
      conceptToOriginal,
      insertBatch
    );
    rowCount = result.rowCount;
    errors.push(...result.errors);
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  return { rowCount, errors };
}

// ── CSV ingestion ────────────────────────────────────────────────────

async function ingestCsv(
  filePath: string,
  datasetId: string,
  mapping: ColumnMapping,
  conceptToOriginal: Map<string, string>,
  insertBatch: (rows: any[][]) => void,
  delimiter: string
): Promise<{ rowCount: number; errors: string[] }> {
  const errors: string[] = [];
  let headers: string[] = [];
  let rowNumber = 0;
  let batch: any[][] = [];

  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (headers.length === 0) {
      headers = parseCsvLine(line, delimiter);
      continue;
    }

    rowNumber++;
    try {
      const values = parseCsvLine(line, delimiter);
      const rowObj: Record<string, string> = {};
      headers.forEach((h, i) => {
        rowObj[h] = (values[i] ?? '').trim();
      });

      const record = buildRecord(datasetId, rowNumber, rowObj, conceptToOriginal);
      batch.push(record);

      if (batch.length >= BATCH_SIZE) {
        insertBatch(batch);
        batch = [];
      }
    } catch (err) {
      errors.push(`Row ${rowNumber}: ${(err as Error).message}`);
    }
  }

  if (batch.length > 0) {
    insertBatch(batch);
  }

  return { rowCount: rowNumber, errors };
}

// ── XLSX ingestion ───────────────────────────────────────────────────

async function ingestXlsx(
  filePath: string,
  datasetId: string,
  mapping: ColumnMapping,
  conceptToOriginal: Map<string, string>,
  insertBatch: (rows: any[][]) => void
): Promise<{ rowCount: number; errors: string[] }> {
  const errors: string[] = [];
  let rowNumber = 0;
  let batch: any[][] = [];

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('No worksheets found in XLSX file');

  let headers: string[] = [];

  worksheet.eachRow((row, rowIdx) => {
    const values = (Array.isArray(row.values) ? row.values.slice(1) : []) as unknown[];
    const strValues = values.map((v) => (v == null ? '' : String(v).trim()));

    if (rowIdx === 1) {
      headers = strValues;
      return;
    }

    rowNumber++;
    try {
      const rowObj: Record<string, string> = {};
      headers.forEach((h, i) => {
        rowObj[h] = strValues[i] ?? '';
      });

      const record = buildRecord(datasetId, rowNumber, rowObj, conceptToOriginal);
      batch.push(record);

      if (batch.length >= BATCH_SIZE) {
        insertBatch(batch);
        batch = [];
      }
    } catch (err) {
      errors.push(`Row ${rowNumber}: ${(err as Error).message}`);
    }
  });

  if (batch.length > 0) {
    insertBatch(batch);
  }

  return { rowCount: rowNumber, errors };
}

// ── Helpers ──────────────────────────────────────────────────────────

function buildRecord(
  datasetId: string,
  rowNumber: number,
  rowObj: Record<string, string>,
  conceptToOriginal: Map<string, string>
): any[] {
  const dataJson = JSON.stringify(rowObj);

  // Extract denormalized fields via mapping
  const getDenorm = (concept: string): string | number | null => {
    const origCol = conceptToOriginal.get(concept);
    if (!origCol) return null;
    const val = rowObj[origCol];
    if (!val || val.trim() === '') return null;
    return val.trim();
  };

  const getNumericDenorm = (concept: string): number | null => {
    const val = getDenorm(concept);
    if (val == null) return null;
    const cleaned = String(val).replace(/[$£€,\s]/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  return [
    datasetId,
    rowNumber,
    dataJson,
    getDenorm('JOB_TITLE'),
    getDenorm('DEPARTMENT'),
    getDenorm('LOCATION'),
    getDenorm('JOB_LEVEL'),
    getDenorm('JOB_FAMILY'),
    getNumericDenorm('SALARY'),
    getNumericDenorm('FTE'),
    getDenorm('HIRE_DATE'),
    getDenorm('SOC_CODE'),
  ];
}

/**
 * Parse a CSV/TSV line respecting quoted fields.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  result.push(current);
  return result;
}
