import { getDb } from '../db/database.js';

export async function specGet(params: { spec_id: string }) {
  const db = getDb();

  const spec = db.prepare('SELECT * FROM agent_specs WHERE id = ?').get(params.spec_id) as any;
  if (!spec) throw new Error(`Spec "${params.spec_id}" not found`);

  const tools = db.prepare('SELECT * FROM spec_tools WHERE spec_id = ? ORDER BY tool_name').all(params.spec_id);
  const guardrails = db.prepare('SELECT * FROM spec_guardrails WHERE spec_id = ? ORDER BY priority DESC').all(params.spec_id);
  const tasks = db.prepare('SELECT * FROM spec_tasks WHERE spec_id = ? ORDER BY sequence_order').all(params.spec_id);
  const criteria = db.prepare('SELECT * FROM spec_success_criteria WHERE spec_id = ?').all(params.spec_id);
  const outputs = db.prepare('SELECT id, spec_id, output_type, generated_at FROM spec_outputs WHERE spec_id = ? ORDER BY generated_at DESC').all(params.spec_id);

  return {
    ...spec,
    tools,
    guardrails,
    tasks,
    success_criteria: criteria,
    outputs,
    summary: {
      tool_count: tools.length,
      guardrail_count: guardrails.length,
      task_count: tasks.length,
      criteria_count: criteria.length,
      output_count: outputs.length,
    },
  };
}
