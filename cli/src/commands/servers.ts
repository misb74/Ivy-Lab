import { spawn } from 'node:child_process';
import path from 'node:path';
import { parseServers } from '../parsers/mcp-config.js';
import { parseTools } from '../parsers/tool-reference.js';
import { renderTable } from '../ui/table.js';
import { heading, dim, bold, green, yellow, red, badge, gray, serverName } from '../ui/format.js';
import type { ServerDef, HealthResult } from '../types.js';

export async function serversList() {
  const [servers, tools] = await Promise.all([parseServers(), parseTools()]);

  // Count tools per server from tool-reference.md
  const toolCounts = new Map<string, number>();
  for (const t of tools) {
    toolCounts.set(t.server, (toolCounts.get(t.server) ?? 0) + 1);
  }

  console.log(`\n  ${heading('MCP Servers')}\n`);

  const rows = servers.map(s => {
    const entry = s.isExternal
      ? s.entryFile ?? 'npx'
      : s.entryFile ? path.basename(path.dirname(path.dirname(s.entryFile))) : '?';
    const count = toolCounts.get(s.name);
    const countStr = count ? `${count} tools` : dim('?');
    const tag = s.isExternal ? yellow(' ext') : '';
    return [green(s.name) + tag, entry, countStr];
  });

  const table = renderTable(['Server', 'Package / Dir', 'Tools'], rows, { maxColWidth: 40 });
  console.log(table);

  const ext = servers.filter(s => s.isExternal).length;
  const local = servers.length - ext;
  console.log(`\n  ${bold(`${servers.length} servers`)} (${local} local, ${ext} external)\n`);
}

function healthCheck(server: ServerDef, timeoutMs: number): Promise<HealthResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(server.command, server.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let resolved = false;

    const finish = (result: HealthResult) => {
      if (resolved) return;
      resolved = true;
      child.kill();
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ server: server.name, status: 'timeout', latencyMs: timeoutMs });
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      // Look for JSON-RPC response in the Content-Length framed data
      const jsonMatch = stdout.match(/\{[\s\S]*"result"[\s\S]*\}/);
      if (jsonMatch) {
        clearTimeout(timer);
        try {
          const resp = JSON.parse(jsonMatch[0]);
          finish({
            server: server.name,
            status: 'ok',
            latencyMs: Date.now() - start,
            serverInfo: resp.result?.serverInfo,
          });
        } catch {
          finish({
            server: server.name,
            status: 'ok',
            latencyMs: Date.now() - start,
          });
        }
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      finish({ server: server.name, status: 'error', latencyMs: Date.now() - start, error: err.message });
    });

    child.on('exit', (code) => {
      clearTimeout(timer);
      if (!resolved) {
        finish({
          server: server.name,
          status: code === 0 ? 'ok' : 'error',
          latencyMs: Date.now() - start,
          error: code ? `exit ${code}` : undefined,
        });
      }
    });

    // Send MCP initialize request
    const req = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'ivy-cli', version: '1.0.0' },
      },
    });
    const header = `Content-Length: ${Buffer.byteLength(req)}\r\n\r\n`;
    child.stdin.write(header + req);
  });
}

export async function serversHealth() {
  const servers = await parseServers();
  console.log(`\n  ${heading('Health Check')} ${dim(`(${servers.length} servers)`)}\n`);

  const concurrency = 6;
  const results: HealthResult[] = [];
  const queue = [...servers];

  async function worker() {
    while (queue.length > 0) {
      const server = queue.shift()!;
      const timeout = server.isExternal ? 10_000 : 5_000;
      process.stdout.write(`  Checking ${server.name}...\r`);
      const result = await healthCheck(server, timeout);
      results.push(result);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  // Sort results: ok first, then errors, then timeouts
  results.sort((a, b) => {
    const order = { ok: 0, error: 1, timeout: 2 };
    return order[a.status] - order[b.status] || a.server.localeCompare(b.server);
  });

  const rows = results.map(r => {
    const statusStr =
      r.status === 'ok' ? green('\u2713 ok') :
      r.status === 'timeout' ? yellow('\u25cb timeout') :
      red('\u2717 error');
    const latency = `${r.latencyMs}ms`;
    const info = r.serverInfo ? `${r.serverInfo.name} v${r.serverInfo.version}` : r.error ?? '';
    return [r.server, statusStr, latency, dim(info)];
  });

  console.log('');
  const table = renderTable(['Server', 'Status', 'Latency', 'Info'], rows, { maxColWidth: 40 });
  console.log(table);

  const ok = results.filter(r => r.status === 'ok').length;
  const err = results.filter(r => r.status === 'error').length;
  const timeouts = results.filter(r => r.status === 'timeout').length;
  console.log(`\n  ${green(`${ok} ok`)}  ${err > 0 ? red(`${err} errors`) : ''}  ${timeouts > 0 ? yellow(`${timeouts} timeouts`) : ''}\n`);
}
