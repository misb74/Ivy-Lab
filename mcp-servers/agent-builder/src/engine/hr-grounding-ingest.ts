import Database from 'better-sqlite3';
import ExcelJS from 'exceljs';
import crypto from 'crypto';
import fs from 'fs';
import { applyLabels } from './hr-grounding-rules.js';
import { seedToolMappings } from './hr-grounding-tool-map.js';

export interface IngestResult {
  import_run_id: string;
  total_rows: number;
  unique_processes: number;
  broken_descriptions: number;
  taxonomy_nodes: { l1: number; l2: number; l3: number; l4: number };
  duration_ms: number;
  skipped_reason?: string;
}

export interface IngestOptions {
  filePath: string;
  sheetName?: string;
}

interface ProcessEntry {
  l2: string;
  l3: string;
  l4: string;
  description: string;
  descriptionValid: boolean;
  frequency: number;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function deterministicId(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function fileHash(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function rollbackImportRun(db: Database.Database, importRunId: string): void {
  const txn = db.transaction(() => {
    // Delete in reverse dependency order
    db.prepare('DELETE FROM hr_task_match_cache WHERE process_id IN (SELECT id FROM hr_work_process WHERE import_run_id = ?)').run(importRunId);
    db.prepare('DELETE FROM hr_process_labels WHERE process_id IN (SELECT id FROM hr_work_process WHERE import_run_id = ?)').run(importRunId);
    db.prepare('DELETE FROM hr_tool_mapping WHERE created_at IN (SELECT started_at FROM hr_import_runs WHERE id = ?)').run(importRunId);
    db.prepare('DELETE FROM hr_work_process WHERE import_run_id = ?').run(importRunId);
    db.prepare('DELETE FROM hr_work_taxonomy WHERE import_run_id = ?').run(importRunId);
    db.prepare('DELETE FROM hr_import_runs WHERE id = ?').run(importRunId);
  });
  txn();
}

export async function ingestHrWorkbook(
  db: Database.Database,
  options: IngestOptions,
): Promise<IngestResult> {
  const startTime = Date.now();
  const hash = fileHash(options.filePath);

  // Idempotency check
  const existingRun = db.prepare(
    'SELECT id, unique_processes, total_rows, broken_descriptions FROM hr_import_runs WHERE source_hash = ? AND status = ?'
  ).get(hash, 'complete') as { id: string; unique_processes: number; total_rows: number; broken_descriptions: number } | undefined;

  if (existingRun) {
    return {
      import_run_id: existingRun.id,
      total_rows: existingRun.total_rows,
      unique_processes: existingRun.unique_processes,
      broken_descriptions: existingRun.broken_descriptions,
      taxonomy_nodes: countTaxonomyNodes(db),
      duration_ms: Date.now() - startTime,
      skipped_reason: 'File already imported (matching hash)',
    };
  }

  // Clean up failed/running previous runs
  const staleRuns = db.prepare(
    "SELECT id FROM hr_import_runs WHERE status IN ('running', 'failed')"
  ).all() as Array<{ id: string }>;
  for (const stale of staleRuns) {
    rollbackImportRun(db, stale.id);
  }

  const runId = deterministicId(`run-${hash}-${Date.now()}`);
  const now = new Date().toISOString();

  // Read workbook
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(options.filePath);

  const sheetName = options.sheetName || workbook.worksheets[0]?.name;
  if (!sheetName) throw new Error('No worksheets found in workbook');
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) throw new Error(`Worksheet "${sheetName}" not found`);

  // Create import run record
  db.prepare(`
    INSERT INTO hr_import_runs (id, source_file, source_hash, sheet_name, total_rows, unique_processes, status, started_at)
    VALUES (?, ?, ?, ?, 0, 0, 'running', ?)
  `).run(runId, 'hr-work-ontology', hash, sheetName, now);

  try {
    // Parse rows and deduplicate
    const processMap = new Map<string, ProcessEntry>();
    let totalRows = 0;
    let brokenDescriptions = 0;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      totalRows++;

      const l1 = String(row.getCell(1).value || '').trim();
      const l2 = String(row.getCell(2).value || '').trim();
      const l3 = String(row.getCell(3).value || '').trim();
      const l4 = String(row.getCell(4).value || '').trim();

      // ExcelJS returns formula errors as objects: { formula: "#REF!", result: { error: "#REF!" } }
      const rawDesc = row.getCell(5).value;
      let desc = '';
      let isBroken = false;
      if (rawDesc === null || rawDesc === undefined) {
        isBroken = true;
      } else if (typeof rawDesc === 'object') {
        // Formula error or formula result object
        const obj = rawDesc as any;
        if (obj.error || (obj.result && obj.result.error) || (obj.formula && obj.formula.includes('#REF'))) {
          isBroken = true;
        } else if (obj.result && typeof obj.result === 'string') {
          desc = obj.result.trim();
        } else {
          desc = String(rawDesc).trim();
        }
      } else {
        desc = String(rawDesc).trim();
        if (desc.includes('=#REF') || desc.includes('#REF!')) {
          isBroken = true;
          desc = '';
        }
      }

      if (!l1 || !l2 || !l3 || !l4) return;

      const key = `${l2}|${l3}|${l4}`;
      if (isBroken && !processMap.has(key)) brokenDescriptions++;

      const existing = processMap.get(key);
      if (existing) {
        existing.frequency++;
        // Prefer valid description over broken one
        if (!existing.descriptionValid && !isBroken) {
          existing.description = desc;
          existing.descriptionValid = true;
          brokenDescriptions--;
        }
      } else {
        processMap.set(key, {
          l2, l3, l4,
          description: isBroken ? '' : desc,
          descriptionValid: !isBroken,
          frequency: 1,
        });
      }
    });

    // Compute frequency ranks
    const entries = [...processMap.values()];
    const sortedByFreq = [...entries].sort((a, b) => a.frequency - b.frequency);
    for (let i = 0; i < sortedByFreq.length; i++) {
      (sortedByFreq[i] as any)._frequencyRank = (i + 1) / sortedByFreq.length;
    }

    // Insert everything in a single transaction
    const txn = db.transaction(() => {
      // L1 node (always "Manage Human Resources")
      const l1Name = 'Manage Human Resources';
      const l1Code = `L1-${slugify(l1Name)}`;
      const l1Id = deterministicId(l1Code);
      db.prepare(`
        INSERT OR IGNORE INTO hr_work_taxonomy (id, level, code, name, parent_id, import_run_id, created_at)
        VALUES (?, 1, ?, ?, NULL, ?, ?)
      `).run(l1Id, l1Code, l1Name, runId, now);

      // Collect unique L2 and L3 values
      const l2Set = new Map<string, string>(); // name -> id
      const l3Set = new Map<string, string>(); // "l2|l3" -> id

      for (const entry of entries) {
        if (!l2Set.has(entry.l2)) {
          const code = `L2-${slugify(entry.l2)}`;
          const id = deterministicId(code);
          l2Set.set(entry.l2, id);
          db.prepare(`
            INSERT OR IGNORE INTO hr_work_taxonomy (id, level, code, name, parent_id, import_run_id, created_at)
            VALUES (?, 2, ?, ?, ?, ?, ?)
          `).run(id, code, entry.l2, l1Id, runId, now);
        }

        const l3Key = `${entry.l2}|${entry.l3}`;
        if (!l3Set.has(l3Key)) {
          const code = `L3-${slugify(entry.l2)}-${slugify(entry.l3)}`;
          const id = deterministicId(code);
          l3Set.set(l3Key, id);
          db.prepare(`
            INSERT OR IGNORE INTO hr_work_taxonomy (id, level, code, name, parent_id, import_run_id, created_at)
            VALUES (?, 3, ?, ?, ?, ?, ?)
          `).run(id, code, entry.l3, l2Set.get(entry.l2)!, runId, now);
        }
      }

      // Insert L4 taxonomy nodes and process rows
      const insertProcess = db.prepare(`
        INSERT OR IGNORE INTO hr_work_process
          (id, taxonomy_id, l2_domain, l3_subdomain, l4_process, description,
           description_valid, frequency, frequency_rank, import_run_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const entry of entries) {
        const l3Key = `${entry.l2}|${entry.l3}`;
        const l4Code = `L4-${slugify(entry.l2)}-${slugify(entry.l3)}-${slugify(entry.l4)}`;
        const l4Id = deterministicId(l4Code);

        db.prepare(`
          INSERT OR IGNORE INTO hr_work_taxonomy (id, level, code, name, parent_id, import_run_id, created_at)
          VALUES (?, 4, ?, ?, ?, ?, ?)
        `).run(l4Id, l4Code, entry.l4, l3Set.get(l3Key)!, runId, now);

        const processId = deterministicId(`process-${entry.l2}|${entry.l3}|${entry.l4}`);
        insertProcess.run(
          processId, l4Id, entry.l2, entry.l3, entry.l4,
          entry.description || null,
          entry.descriptionValid ? 1 : 0,
          entry.frequency,
          (entry as any)._frequencyRank,
          runId, now,
        );

        // Apply labels
        applyLabels(db, processId, entry.l2, entry.l3, entry.description || '', entry.descriptionValid);
      }

      // Seed tool mappings
      seedToolMappings(db);

      // Update import run
      db.prepare(`
        UPDATE hr_import_runs
        SET total_rows = ?, unique_processes = ?, broken_descriptions = ?,
            status = 'complete', completed_at = ?
        WHERE id = ?
      `).run(totalRows, entries.length, brokenDescriptions, new Date().toISOString(), runId);
    });

    txn();

    return {
      import_run_id: runId,
      total_rows: totalRows,
      unique_processes: entries.length,
      broken_descriptions: brokenDescriptions,
      taxonomy_nodes: countTaxonomyNodes(db),
      duration_ms: Date.now() - startTime,
    };
  } catch (err) {
    // Mark run as failed
    db.prepare("UPDATE hr_import_runs SET status = 'failed', error = ?, completed_at = ? WHERE id = ?")
      .run(String(err), new Date().toISOString(), runId);
    throw err;
  }
}

function countTaxonomyNodes(db: Database.Database): { l1: number; l2: number; l3: number; l4: number } {
  const counts = db.prepare(`
    SELECT level, COUNT(*) as cnt FROM hr_work_taxonomy GROUP BY level
  `).all() as Array<{ level: number; cnt: number }>;

  const result = { l1: 0, l2: 0, l3: 0, l4: 0 };
  for (const row of counts) {
    if (row.level === 1) result.l1 = row.cnt;
    else if (row.level === 2) result.l2 = row.cnt;
    else if (row.level === 3) result.l3 = row.cnt;
    else if (row.level === 4) result.l4 = row.cnt;
  }
  return result;
}
