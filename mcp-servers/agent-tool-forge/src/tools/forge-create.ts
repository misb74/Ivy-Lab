import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { getDb } from '../db/database.js';
import { generateServerCode, generatePackageJson, ServerSpec } from '../templates/mcp-server.js';

const BLOCKED_PATTERNS = [
  /\bchild_process\b/,
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /\bfs\s*\.\s*rmSync\b/,
  /\bfs\s*\.\s*rmdirSync\b/,
  /\bfs\s*\.\s*unlinkSync\b/,
  /\bfs\.promises\s*\.\s*rm\b/,
  /\bfs\.promises\s*\.\s*unlink\b/,
  /\.\.\//,  // path traversal
];

function scanForBlockedPatterns(code: string): string[] {
  const violations: string[] = [];
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(code)) {
      violations.push(`Blocked pattern found: ${pattern.source}`);
    }
  }
  return violations;
}

export async function forgeCreate(params: {
  name: string;
  description: string;
  tools: Array<{
    name: string;
    description: string;
    params: Array<{
      name: string;
      type: 'string' | 'number' | 'boolean' | 'array' | 'object';
      description: string;
      required?: boolean;
      itemType?: string;
      default?: any;
    }>;
    implementation: string;
  }>;
  dependencies?: Record<string, string>;
}): Promise<{
  id: string;
  name: string;
  server_path: string;
  tools: string[];
  status: string;
}> {
  const db = getDb();
  const serverName = `forged-${params.name}`;

  // Check for existing server with same name
  const existing = db.prepare('SELECT id FROM forged_servers WHERE name = ?').get(serverName);
  if (existing) {
    throw new Error(`Server "${serverName}" already exists. Use forge_disable + forge_create to replace it.`);
  }

  // Scan all tool implementations for blocked patterns
  for (const tool of params.tools) {
    const violations = scanForBlockedPatterns(tool.implementation);
    if (violations.length > 0) {
      throw new Error(`Security scan failed for tool "${tool.name}": ${violations.join('; ')}`);
    }
  }

  const spec: ServerSpec = {
    name: serverName,
    description: params.description,
    tools: params.tools,
    dependencies: params.dependencies,
  };

  // Generate code
  const serverCode = generateServerCode(spec);
  const packageJson = generatePackageJson(spec);

  // Write to disk
  const projectDir = process.cwd();
  const serverDir = path.join(projectDir, 'data', 'forged-servers', serverName);
  const srcDir = path.join(serverDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(path.join(srcDir, 'index.ts'), serverCode);
  fs.writeFileSync(path.join(serverDir, 'package.json'), packageJson);

  // Install dependencies
  try {
    execSync('npm install --ignore-scripts', {
      cwd: serverDir,
      timeout: 30_000,
      stdio: 'pipe',
    });
  } catch (err: any) {
    throw new Error(`Failed to install dependencies: ${err.stderr?.toString().slice(0, 200) || err.message}`);
  }

  // Build MCP config for this server
  const config = {
    type: 'stdio',
    command: 'npx',
    args: ['tsx', path.join(serverDir, 'src', 'index.ts')],
  };

  // Register in SQLite
  const id = randomUUID();
  const toolNames = params.tools.map(t => t.name);

  db.prepare(`
    INSERT INTO forged_servers (id, name, description, server_path, config_json, status, tools_json, dependencies_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, datetime('now'), datetime('now'))
  `).run(
    id,
    serverName,
    params.description,
    serverDir,
    JSON.stringify(config),
    JSON.stringify(toolNames),
    JSON.stringify(params.dependencies || {}),
  );

  return {
    id,
    name: serverName,
    server_path: serverDir,
    tools: toolNames,
    status: 'draft',
  };
}
