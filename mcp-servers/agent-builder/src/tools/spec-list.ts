import { getDb } from '../db/database.js';

export async function specList(params: {
  limit?: number;
  offset?: number;
  status?: string;
}) {
  const db = getDb();
  const limit = params.limit || 20;
  const offset = params.offset || 0;

  let query = `
    SELECT s.*,
      (SELECT COUNT(*) FROM spec_tools WHERE spec_id = s.id) AS tool_count,
      (SELECT COUNT(*) FROM spec_guardrails WHERE spec_id = s.id) AS guardrail_count,
      (SELECT COUNT(*) FROM spec_tasks WHERE spec_id = s.id) AS task_count,
      (SELECT COUNT(*) FROM spec_success_criteria WHERE spec_id = s.id) AS criteria_count
    FROM agent_specs s
  `;
  const queryParams: any[] = [];

  if (params.status) {
    query += ' WHERE s.status = ?';
    queryParams.push(params.status);
  }

  query += ' ORDER BY s.updated_at DESC LIMIT ? OFFSET ?';
  queryParams.push(limit, offset);

  const specs = db.prepare(query).all(...queryParams);
  const total = db.prepare(
    params.status
      ? 'SELECT COUNT(*) as count FROM agent_specs WHERE status = ?'
      : 'SELECT COUNT(*) as count FROM agent_specs',
  ).get(...(params.status ? [params.status] : [])) as any;

  return {
    specs,
    total: total.count,
    limit,
    offset,
  };
}
