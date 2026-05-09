import { getDb } from '../db/database.js';
import { generateWorkbook } from '../engine/xlsx-generator.js';
import type { RoleRow, RoleSpec, ResearchResults } from '../engine/types.js';

export interface RoleExportParams {
  role_id: string;
}

export async function roleExport(params: RoleExportParams): Promise<{
  role_id: string;
  title: string;
  output_path: string;
  filepath: string;
  candidates_exported: number;
  message: string;
}> {
  const { role_id } = params;
  const db = getDb();
  const now = new Date().toISOString();

  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(role_id) as RoleRow | undefined;
  if (!role) {
    throw new Error(`Role ${role_id} not found`);
  }

  if (!role.results_json) {
    throw new Error(`Role ${role_id} has no research results. Submit results first.`);
  }

  const spec: RoleSpec = JSON.parse(role.spec_json);
  const results: ResearchResults = JSON.parse(role.results_json);

  // Get the batch output directory
  const batch = db.prepare('SELECT output_dir FROM batches WHERE id = ?').get(role.batch_id) as { output_dir: string } | undefined;
  if (!batch) {
    throw new Error(`Batch ${role.batch_id} not found`);
  }

  // Generate filename from role title
  const safeTitle = role.title.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  const safeLocation = role.location.replace(/[^a-zA-Z0-9]+/g, '_');
  const fileName = `${safeTitle}_${safeLocation}_Talent_Research.xlsx`;
  const outputPath = `${batch.output_dir}/${fileName}`;

  await generateWorkbook(spec, results, outputPath);

  // Update role status
  db.prepare(
    'UPDATE roles SET status = ?, progress = 100, output_path = ?, completed_at = ?, updated_at = ? WHERE id = ?'
  ).run('complete', outputPath, now, now, role_id);

  // Update batch completed count
  db.prepare(
    `UPDATE batches SET
      completed_roles = (SELECT COUNT(*) FROM roles WHERE batch_id = ? AND status = 'complete'),
      updated_at = ?
    WHERE id = ?`
  ).run(role.batch_id, now, role.batch_id);

  // Check if batch is complete
  const batchRow = db.prepare('SELECT total_roles, completed_roles, failed_roles FROM batches WHERE id = ?')
    .get(role.batch_id) as { total_roles: number; completed_roles: number; failed_roles: number };

  if (batchRow.completed_roles + batchRow.failed_roles >= batchRow.total_roles) {
    db.prepare('UPDATE batches SET status = ?, updated_at = ? WHERE id = ?')
      .run('completed', now, role.batch_id);
  }

  return {
    role_id,
    title: role.title,
    output_path: outputPath,
    filepath: outputPath,
    candidates_exported: results.candidates.length,
    message: `Workbook generated: ${fileName} (${results.candidates.length} candidates)`,
  };
}
