import { getDb } from '../db/database.js';

export async function cloneStatus(params: { job_id: string }) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM clone_jobs WHERE id = ?').get(params.job_id) as Record<string, unknown> | undefined;

  if (!row) {
    throw new Error(`Clone job not found: ${params.job_id}`);
  }

  const blueprint = row.blueprint ? JSON.parse(row.blueprint as string) : null;
  const dataplan = row.dataplan ? JSON.parse(row.dataplan as string) : null;
  const briefs = row.briefs ? JSON.parse(row.briefs as string) : null;

  return {
    job_id: row.id,
    name: row.name,
    status: row.status,
    stage: getStageDescription(row.status as string),
    blueprint_saved: !!blueprint,
    blueprint_section_count: blueprint?.sections?.length ?? 0,
    dataplan_saved: !!dataplan,
    dataplan_mapping_count: dataplan?.mappings?.length ?? 0,
    briefs_count: briefs?.length ?? 0,
    report_generated: !!row.output_path,
    output_path: row.output_path ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getStageDescription(status: string): string {
  switch (status) {
    case 'created': return 'Job created — awaiting PDF ingestion and blueprint extraction';
    case 'blueprint_saved': return 'Blueprint saved — awaiting data mapping (Plumber stage)';
    case 'dataplan_saved': return 'DataPlan saved — awaiting metric computation (Analyst stage)';
    case 'analyzing': return 'Computing metrics and producing analytical briefs';
    case 'generating': return 'Generating cloned report document';
    case 'complete': return 'Report generation complete';
    default: return `Unknown status: ${status}`;
  }
}
