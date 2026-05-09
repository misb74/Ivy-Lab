import { getDb } from '../db/database.js';
import { ForgedServerRow } from '../db/schema.js';

export async function forgeList(params: {
  status?: string;
}): Promise<{
  servers: Array<{
    id: string;
    name: string;
    description: string;
    status: string;
    tools: string[];
    test_passed: boolean;
    created_at: string;
    updated_at: string;
    error?: string;
  }>;
  total: number;
}> {
  const db = getDb();

  let rows: ForgedServerRow[];
  if (params.status) {
    rows = db.prepare('SELECT * FROM forged_servers WHERE status = ? ORDER BY updated_at DESC')
      .all(params.status) as ForgedServerRow[];
  } else {
    rows = db.prepare('SELECT * FROM forged_servers ORDER BY updated_at DESC')
      .all() as ForgedServerRow[];
  }

  const servers = rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    tools: JSON.parse(row.tools_json),
    test_passed: row.test_passed === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...(row.error ? { error: row.error } : {}),
  }));

  return { servers, total: servers.length };
}
