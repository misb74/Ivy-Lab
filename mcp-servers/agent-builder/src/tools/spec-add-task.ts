import { getDb } from '../db/database.js';

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function specAddTask(params: {
  spec_id: string;
  task_description: string;
  source_role?: string;
  source_task_id?: string;
  automation_score?: number;
  sequence_order?: number;
  assignment?: 'agent' | 'hybrid' | 'human';
  grounding_process_id?: string;
  grounding_confidence?: number;
  grounding_source?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();

  const spec = db.prepare('SELECT id, status FROM agent_specs WHERE id = ?').get(params.spec_id) as any;
  if (!spec) throw new Error(`Spec "${params.spec_id}" not found`);
  if (!['draft', 'tools_added'].includes(spec.status)) {
    throw new Error(`Spec status is "${spec.status}" — cannot add tasks after validation.`);
  }

  // Auto-assign sequence_order if not provided
  let order = params.sequence_order;
  if (order === undefined) {
    const max = db.prepare('SELECT MAX(sequence_order) as m FROM spec_tasks WHERE spec_id = ?').get(params.spec_id) as any;
    order = (max.m || 0) + 1;
  }

  const id = genId('task');
  db.prepare(`
    INSERT INTO spec_tasks (id, spec_id, task_description, source_role, source_task_id, automation_score, sequence_order, assignment, grounding_process_id, grounding_confidence, grounding_source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, params.spec_id, params.task_description,
    params.source_role || null, params.source_task_id || null,
    params.automation_score ?? null, order,
    params.assignment || 'agent',
    params.grounding_process_id || null,
    params.grounding_confidence ?? null,
    params.grounding_source || null,
    now,
  );

  db.prepare('UPDATE agent_specs SET updated_at = ? WHERE id = ?').run(now, params.spec_id);

  const count = (db.prepare('SELECT COUNT(*) as c FROM spec_tasks WHERE spec_id = ?').get(params.spec_id) as any).c;

  return {
    task_id: id,
    task_description: params.task_description,
    sequence_order: order,
    assignment: params.assignment || 'agent',
    spec_task_count: count,
  };
}
