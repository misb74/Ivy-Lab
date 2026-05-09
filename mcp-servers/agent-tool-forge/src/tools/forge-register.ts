import { getDb } from '../db/database.js';
import { ForgedServerRow } from '../db/schema.js';

const GATEWAY_PORT = process.env.GATEWAY_PORT || '8000';

export async function forgeRegister(params: {
  name: string;
}): Promise<{ name: string; tools: string[]; status: string }> {
  const db = getDb();
  const serverName = params.name.startsWith('forged-') ? params.name : `forged-${params.name}`;

  const row = db.prepare('SELECT * FROM forged_servers WHERE name = ?').get(serverName) as ForgedServerRow | undefined;
  if (!row) {
    throw new Error(`Server "${serverName}" not found`);
  }

  if (!row.test_passed) {
    throw new Error(`Server "${serverName}" has not passed tests. Run forge_test first.`);
  }

  if (row.status === 'active') {
    return {
      name: serverName,
      tools: JSON.parse(row.tools_json),
      status: 'active',
    };
  }

  // Call gateway internal API to hot-load the server
  const config = JSON.parse(row.config_json);
  const response = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/api/internal/forge/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: serverName, config }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Gateway registration failed: ${(body as any).error || response.statusText}`);
  }

  const result = await response.json() as { ok: boolean; tools: string[] };

  // Update status to active
  db.prepare('UPDATE forged_servers SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run('active', row.id);

  return {
    name: serverName,
    tools: result.tools || JSON.parse(row.tools_json),
    status: 'active',
  };
}
