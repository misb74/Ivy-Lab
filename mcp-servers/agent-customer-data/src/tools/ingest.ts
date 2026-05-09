import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDbForTenant } from '../db/database.js';
import { ingestFile } from '../engine/ingester.js';
import { detectSchema } from '../engine/schema-detector.js';

interface IngestParams {
  _ctx?: { tenant_id?: string };
  dataset_name?: string;
  file_path: string;
  file_type?: string;
  mapping?: Record<string, string | null>;
}

/**
 * Ingest a customer data file (CSV/XLSX) into the tenant database.
 * If no mapping is provided, auto-detects schema and uses detected concepts.
 */
export async function customerDataIngest(input: IngestParams): Promise<string> {
  const { _ctx, ...params } = input;
  const tenantId = _ctx?.tenant_id || 'default';
  const db = getDbForTenant(tenantId);

  const filePath = path.resolve(params.file_path);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  const filename = path.basename(filePath);
  const ext = path.extname(filename).toLowerCase().replace(/^\./, '');
  const fileType = params.file_type || ext || 'csv';

  // Generate dataset ID
  const datasetId = crypto.randomUUID();
  const datasetName = params.dataset_name || filename.replace(/\.[^.]+$/, '');

  // Read sample rows to detect schema
  const sampleRows = await readSampleRows(filePath, fileType, 20);
  const headers = sampleRows.length > 0 ? Object.keys(sampleRows[0]) : [];
  const detected = detectSchema(headers, sampleRows);

  // Build mapping: prefer user-provided, fall back to auto-detected
  const mapping: Record<string, string | null> = {};
  for (const col of detected) {
    if (params.mapping && col.original_name in params.mapping) {
      mapping[col.original_name] = params.mapping[col.original_name];
    } else {
      mapping[col.original_name] = col.ivy_concept;
    }
  }

  // Insert dataset record
  db.prepare(`
    INSERT INTO datasets (id, name, filename, file_type, column_count, columns_json, mapping_json, status, file_size_bytes)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ingesting', ?)
  `).run(
    datasetId,
    datasetName,
    filename,
    fileType,
    headers.length,
    JSON.stringify(headers),
    JSON.stringify(mapping),
    stat.size
  );

  // Insert column mappings
  const insertMapping = db.prepare(`
    INSERT INTO column_mappings (id, dataset_id, original_name, ivy_concept, data_type, detection_confidence, user_confirmed)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMappings = db.transaction(() => {
    for (const col of detected) {
      const userProvided = params.mapping && col.original_name in params.mapping;
      insertMapping.run(
        crypto.randomUUID(),
        datasetId,
        col.original_name,
        mapping[col.original_name] ?? null,
        col.data_type,
        col.confidence,
        userProvided ? 1 : 0
      );
    }
  });
  insertMappings();

  // Ingest records
  try {
    const result = await ingestFile(db, datasetId, filePath, fileType, mapping);

    // Update dataset with final row count and status
    db.prepare(`
      UPDATE datasets SET row_count = ?, status = 'ready', updated_at = datetime('now')
      WHERE id = ?
    `).run(result.rowCount, datasetId);

    return JSON.stringify({
      dataset_id: datasetId,
      name: datasetName,
      filename,
      file_type: fileType,
      row_count: result.rowCount,
      column_count: headers.length,
      columns: detected.map((c) => ({
        name: c.original_name,
        concept: mapping[c.original_name],
        confidence: c.confidence,
        data_type: c.data_type,
      })),
      errors: result.errors.slice(0, 10),
      status: 'ready',
    });
  } catch (err) {
    db.prepare(`
      UPDATE datasets SET status = 'error', error_message = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run((err as Error).message, datasetId);
    throw err;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

async function readSampleRows(
  filePath: string,
  fileType: string,
  maxRows: number
): Promise<Record<string, any>[]> {
  const normalized = fileType.toLowerCase().replace(/^\./, '');

  if (normalized === 'csv' || normalized === 'tsv') {
    return readCsvSample(filePath, maxRows, normalized === 'tsv' ? '\t' : ',');
  } else if (normalized === 'xlsx' || normalized === 'xls') {
    return readXlsxSample(filePath, maxRows);
  }

  return [];
}

async function readCsvSample(
  filePath: string,
  maxRows: number,
  delimiter: string
): Promise<Record<string, any>[]> {
  const { createReadStream } = await import('fs');
  const { createInterface } = await import('readline');

  const rows: Record<string, any>[] = [];
  let headers: string[] = [];

  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (headers.length === 0) {
      headers = parseLine(line, delimiter);
      continue;
    }

    const values = parseLine(line, delimiter);
    const row: Record<string, any> = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? '').trim();
    });
    rows.push(row);

    if (rows.length >= maxRows) break;
  }

  rl.close();
  stream.destroy();
  return rows;
}

async function readXlsxSample(
  filePath: string,
  maxRows: number
): Promise<Record<string, any>[]> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.default.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: Record<string, any>[] = [];
  let headers: string[] = [];

  worksheet.eachRow((row, rowIdx) => {
    if (rows.length >= maxRows) return;

    const values = (Array.isArray(row.values) ? row.values.slice(1) : []) as unknown[];
    const strValues = values.map((v) => (v == null ? '' : String(v).trim()));

    if (rowIdx === 1) {
      headers = strValues;
      return;
    }

    const rowObj: Record<string, any> = {};
    headers.forEach((h, i) => {
      rowObj[h] = strValues[i] ?? '';
    });
    rows.push(rowObj);
  });

  return rows;
}

function parseLine(line: string, delimiter: string): string[] {
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
