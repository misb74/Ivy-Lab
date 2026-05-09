import { getDb } from '../db/database.js';

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function specAddTool(params: {
  spec_id: string;
  tool_name: string;
  server_name: string;
  description?: string;
  required?: boolean;
  params_schema_json?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();

  const spec = db.prepare('SELECT id, status FROM agent_specs WHERE id = ?').get(params.spec_id) as any;
  if (!spec) throw new Error(`Spec "${params.spec_id}" not found`);
  if (!['draft', 'tools_added'].includes(spec.status)) {
    throw new Error(`Spec status is "${spec.status}" — cannot add tools after validation. Create a new version.`);
  }

  // Check for duplicate
  const existing = db.prepare(
    'SELECT id FROM spec_tools WHERE spec_id = ? AND tool_name = ? AND server_name = ?',
  ).get(params.spec_id, params.tool_name, params.server_name);
  if (existing) throw new Error(`Tool "${params.tool_name}" from "${params.server_name}" already in spec`);

  const id = genId('tool');
  db.prepare(`
    INSERT INTO spec_tools (id, spec_id, tool_name, server_name, description, required, params_schema_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, params.spec_id, params.tool_name, params.server_name, params.description || null, params.required !== false ? 1 : 0, params.params_schema_json || null, now);

  // Advance status if still draft
  if (spec.status === 'draft') {
    db.prepare("UPDATE agent_specs SET status = 'tools_added', updated_at = ? WHERE id = ?").run(now, params.spec_id);
  }

  const toolCount = (db.prepare('SELECT COUNT(*) as c FROM spec_tools WHERE spec_id = ?').get(params.spec_id) as any).c;

  return {
    tool_id: id,
    tool_name: params.tool_name,
    server_name: params.server_name,
    spec_tool_count: toolCount,
  };
}
