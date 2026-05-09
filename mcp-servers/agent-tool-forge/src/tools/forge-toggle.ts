import { getDb } from '../db/database.js';
import { ForgedServerRow } from '../db/schema.js';

const GATEWAY_PORT = process.env.GATEWAY_PORT || '8000';

export async function forgeDisable(params: {
  name: string;
}): Promise<{ name: string; status: string }> {
  const db = getDb();
  const serverName = params.name.startsWith('forged-') ? params.name : `forged-${params.name}`;

  const row = db.prepare('SELECT * FROM forged_servers WHERE name = ?').get(serverName) as ForgedServerRow | undefined;
  if (!row) {
    throw new Error(`Server "${serverName}" not found`);
  }

  if (row.status !== 'active') {
    throw new Error(`Server "${serverName}" is not active (current status: ${row.status})`);
  }

  // Call gateway to unregister
  const response = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/api/internal/forge/unregister`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: serverName }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Gateway unregister failed: ${(body as any).error || response.statusText}`);
  }

  db.prepare('UPDATE forged_servers SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run('disabled', row.id);

  return { name: serverName, status: 'disabled' };
}

export async function forgeEnable(params: {
  name: string;
}): Promise<{ name: string; tools: string[]; status: string }> {
  const db = getDb();
  const serverName = params.name.startsWith('forged-') ? params.name : `forged-${params.name}`;

  const row = db.prepare('SELECT * FROM forged_servers WHERE name = ?').get(serverName) as ForgedServerRow | undefined;
  if (!row) {
    throw new Error(`Server "${serverName}" not found`);
  }

  if (row.status !== 'disabled') {
    throw new Error(`Server "${serverName}" is not disabled (current status: ${row.status}). Only disabled servers can be re-enabled.`);
  }

  if (!row.test_passed) {
    throw new Error(`Server "${serverName}" has not passed tests. Run forge_test first.`);
  }

  // Call gateway to register
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

  db.prepare('UPDATE forged_servers SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run('active', row.id);

  return {
    name: serverName,
    tools: result.tools || JSON.parse(row.tools_json),
    status: 'active',
  };
}
