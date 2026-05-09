import { getDb } from '../db/database.js';

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function specAddGuardrail(params: {
  spec_id: string;
  guardrail_type: 'input' | 'output' | 'escalation' | 'constraint';
  condition: string;
  action: string;
  priority?: number;
}) {
  const db = getDb();
  const now = new Date().toISOString();

  const spec = db.prepare('SELECT id, status FROM agent_specs WHERE id = ?').get(params.spec_id) as any;
  if (!spec) throw new Error(`Spec "${params.spec_id}" not found`);
  if (!['draft', 'tools_added'].includes(spec.status)) {
    throw new Error(`Spec status is "${spec.status}" — cannot add guardrails after validation.`);
  }

  const id = genId('guard');
  db.prepare(`
    INSERT INTO spec_guardrails (id, spec_id, guardrail_type, condition, action, priority, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, params.spec_id, params.guardrail_type, params.condition, params.action, params.priority || 5, now);

  db.prepare('UPDATE agent_specs SET updated_at = ? WHERE id = ?').run(now, params.spec_id);

  const count = (db.prepare('SELECT COUNT(*) as c FROM spec_guardrails WHERE spec_id = ?').get(params.spec_id) as any).c;

  return {
    guardrail_id: id,
    guardrail_type: params.guardrail_type,
    condition: params.condition,
    spec_guardrail_count: count,
  };
}
