import { getDb } from '../db/database.js';

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function specCreate(params: {
  name: string;
  purpose: string;
  description?: string;
  model?: string;
  source_simulation_id?: string;
  source_scenario_id?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const id = genId('spec');

  db.prepare(`
    INSERT INTO agent_specs (id, name, description, purpose, status, source_simulation_id, source_scenario_id, model, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
  `).run(
    id,
    params.name,
    params.description || null,
    params.purpose,
    params.source_simulation_id || null,
    params.source_scenario_id || null,
    params.model || 'sonnet',
    now,
    now,
  );

  return {
    spec_id: id,
    name: params.name,
    purpose: params.purpose,
    status: 'draft',
    model: params.model || 'sonnet',
    next_step: 'Add tasks with agent_spec_add_task, tools with agent_spec_add_tool, and guardrails with agent_spec_add_guardrail. Or use agent_spec_from_simulation to auto-populate from a WorkVine simulation.',
  };
}
