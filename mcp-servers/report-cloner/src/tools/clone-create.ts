import crypto from 'crypto';
import fs from 'fs';
import { getDb } from '../db/database.js';

interface CloneCreateParams {
  name: string;
  original_report_path: string;
  data_source_paths: string[];
  reporting_period: {
    label: string;
    start: string;
    end: string;
    snapshot_date: string;
  };
}

export async function cloneCreate(params: CloneCreateParams) {
  const { name, original_report_path, data_source_paths, reporting_period } = params;

  // Validate files exist
  if (!fs.existsSync(original_report_path)) {
    throw new Error(`Original report not found: ${original_report_path}`);
  }
  const missingData = data_source_paths.filter(p => !fs.existsSync(p));
  if (missingData.length > 0) {
    throw new Error(`Data source files not found: ${missingData.join(', ')}`);
  }

  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = getDb();

  db.prepare(`
    INSERT INTO clone_jobs (id, name, status, original_report_path, data_source_paths, reporting_period, created_at, updated_at)
    VALUES (?, ?, 'created', ?, ?, ?, ?, ?)
  `).run(
    jobId,
    name,
    original_report_path,
    JSON.stringify(data_source_paths),
    JSON.stringify(reporting_period),
    now,
    now,
  );

  return {
    job_id: jobId,
    status: 'created',
    files_registered: {
      original_report: original_report_path,
      data_sources: data_source_paths,
    },
    reporting_period,
  };
}
