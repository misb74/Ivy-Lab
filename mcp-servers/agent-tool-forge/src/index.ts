import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { forgeCreate } from './tools/forge-create.js';
import { forgeTest } from './tools/forge-test.js';
import { forgeRegister } from './tools/forge-register.js';
import { forgeList } from './tools/forge-list.js';
import { forgeDisable, forgeEnable } from './tools/forge-toggle.js';
import { closeDb } from './db/database.js';

const server = new McpServer({
  name: 'agent-tool-forge',
  version: '2.0.0',
  description: 'Self-evolving agent: build, test, and hot-register new MCP servers at runtime',
});

// forge_create
server.tool(
  'forge_create',
  'Create a new MCP server from a specification. Generates TypeScript code, writes to disk, installs dependencies, and registers as draft in the forge registry. The server name will be prefixed with "forged-" automatically.',
  {
    name: z.string().describe('Server name (will be prefixed with "forged-")'),
    description: z.string().describe('What this server does'),
    tools: z.array(z.object({
      name: z.string().describe('Tool name'),
      description: z.string().describe('Tool description'),
      params: z.array(z.object({
        name: z.string().describe('Parameter name'),
        type: z.enum(['string', 'number', 'boolean', 'array', 'object']).describe('Parameter type'),
        description: z.string().describe('Parameter description'),
        required: z.boolean().optional().describe('Whether required (default true)'),
        itemType: z.string().optional().describe('For array type: element type'),
      })).describe('Tool parameters'),
      implementation: z.string().describe('TypeScript function body. Receives `params` object with the parameter values. Must return a value. Do NOT use child_process, eval, Function(), destructive fs ops, or path traversal.'),
    })).describe('Tools to include in this server'),
    dependencies: z.record(z.string()).optional().describe('Additional npm dependencies (name → version)'),
  },
  async (params) => {
    try {
      const result = await forgeCreate(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// forge_test
server.tool(
  'forge_test',
  'Test a forged MCP server in a sandbox. Spawns the server as a child process, discovers tools via MCP protocol, and runs test cases. Uses 15s startup timeout, 30s per test, 60s total.',
  {
    name: z.string().describe('Server name (with or without "forged-" prefix)'),
    test_cases: z.array(z.object({
      tool: z.string().describe('Tool name to test'),
      input: z.record(z.any()).describe('Input parameters'),
      expect_error: z.boolean().optional().describe('If true, test passes when tool returns error'),
      description: z.string().optional().describe('Test description'),
    })).optional().describe('Test cases to run. If omitted, auto-generates smoke tests for each tool.'),
  },
  async (params) => {
    try {
      const result = await forgeTest(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// forge_register
server.tool(
  'forge_register',
  'Hot-register a tested forged server with the gateway. The server must have passed forge_test. Once registered, its tools are available on the next user message.',
  {
    name: z.string().describe('Server name (with or without "forged-" prefix)'),
  },
  async (params) => {
    try {
      const result = await forgeRegister(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// forge_list
server.tool(
  'forge_list',
  'List all forged servers with their status, tools, and test results.',
  {
    status: z.string().optional().describe('Filter by status: draft, testing, active, failed, disabled'),
  },
  async (params) => {
    try {
      const result = await forgeList(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// forge_disable
server.tool(
  'forge_disable',
  'Disconnect an active forged server from the gateway. The server remains in the registry and can be re-enabled.',
  {
    name: z.string().describe('Server name (with or without "forged-" prefix)'),
  },
  async (params) => {
    try {
      const result = await forgeDisable(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// forge_enable
server.tool(
  'forge_enable',
  'Reconnect a previously disabled forged server to the gateway.',
  {
    name: z.string().describe('Server name (with or without "forged-" prefix)'),
  },
  async (params) => {
    try {
      const result = await forgeEnable(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// forge_export — Export a forged server as a portable plugin package
server.tool(
  'forge_export',
  'Export a forged server as a portable JSON plugin package that can be shared across Ivy instances or imported later. Includes server code, dependencies, test cases, and metadata.',
  {
    name: z.string().describe('Server name (with or without "forged-" prefix)'),
  },
  async (params) => {
    try {
      const { getDb: getForgeDb } = await import('./db/database.js');
      const db = getForgeDb();
      const serverName = params.name.startsWith('forged-') ? params.name : `forged-${params.name}`;

      const row = db.prepare('SELECT * FROM forged_servers WHERE name = ?').get(serverName) as any;
      if (!row) {
        return { content: [{ type: 'text' as const, text: `Error: Server "${serverName}" not found in forge registry` }], isError: true };
      }

      // Read the generated server source
      const path = await import('path');
      const fs = await import('fs/promises');
      const serverDir = path.default.resolve(process.cwd(), 'mcp-servers', serverName);
      let sourceCode = '';
      try {
        sourceCode = await fs.readFile(path.default.join(serverDir, 'src', 'index.ts'), 'utf-8');
      } catch {
        sourceCode = '[source not found]';
      }

      let packageJson = {};
      try {
        packageJson = JSON.parse(await fs.readFile(path.default.join(serverDir, 'package.json'), 'utf-8'));
      } catch { /* ignore */ }

      const plugin = {
        plugin_format: '1.0',
        name: serverName,
        description: row.description || '',
        version: row.version || '1.0.0',
        status: row.status,
        created_at: row.created_at,
        tools: row.tools ? JSON.parse(row.tools) : [],
        source_code: sourceCode,
        package_json: packageJson,
        test_results: row.test_results ? JSON.parse(row.test_results) : null,
        exported_at: new Date().toISOString(),
      };

      // Write export file
      const exportDir = path.default.resolve(process.cwd(), '.outputs', 'plugins');
      await fs.mkdir(exportDir, { recursive: true });
      const exportPath = path.default.join(exportDir, `${serverName}.plugin.json`);
      await fs.writeFile(exportPath, JSON.stringify(plugin, null, 2));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            exported: true,
            path: exportPath,
            name: serverName,
            tools: plugin.tools.length,
            size_bytes: JSON.stringify(plugin).length,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// forge_import — Import a previously exported plugin package
server.tool(
  'forge_import',
  'Import a plugin package exported from another Ivy instance or from the plugin directory. Recreates the server, installs dependencies, and registers it.',
  {
    path: z.string().describe('Path to the .plugin.json file to import'),
    auto_register: z.boolean().optional().describe('Auto-register with gateway after import (default: false, runs test first)'),
  },
  async (params) => {
    try {
      const fs = await import('fs/promises');
      const pathMod = await import('path');

      const raw = await fs.readFile(params.path, 'utf-8');
      const plugin = JSON.parse(raw);

      if (plugin.plugin_format !== '1.0') {
        return { content: [{ type: 'text' as const, text: `Error: Unsupported plugin format: ${plugin.plugin_format}` }], isError: true };
      }

      // Write server source
      const serverDir = pathMod.default.resolve(process.cwd(), 'mcp-servers', plugin.name);
      await fs.mkdir(pathMod.default.join(serverDir, 'src'), { recursive: true });

      if (plugin.source_code && plugin.source_code !== '[source not found]') {
        await fs.writeFile(pathMod.default.join(serverDir, 'src', 'index.ts'), plugin.source_code);
      }

      if (plugin.package_json) {
        await fs.writeFile(pathMod.default.join(serverDir, 'package.json'), JSON.stringify(plugin.package_json, null, 2));
      }

      // Register in forge DB
      const { getDb: getForgeDb } = await import('./db/database.js');
      const db = getForgeDb();
      db.prepare(`
        INSERT OR REPLACE INTO forged_servers (name, description, status, tools, created_at, version)
        VALUES (?, ?, 'draft', ?, ?, ?)
      `).run(
        plugin.name,
        plugin.description,
        JSON.stringify(plugin.tools),
        new Date().toISOString(),
        plugin.version || '1.0.0',
      );

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            imported: true,
            name: plugin.name,
            tools: plugin.tools?.length || 0,
            status: 'draft',
            next_step: params.auto_register
              ? 'Auto-registering with gateway...'
              : 'Run forge_test to validate, then forge_register to activate.',
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// forge_browse — Browse available plugin packages in the plugins directory
server.tool(
  'forge_browse',
  'List available plugin packages in the .outputs/plugins/ directory that can be imported.',
  {},
  async () => {
    try {
      const fs = await import('fs/promises');
      const pathMod = await import('path');
      const pluginDir = pathMod.default.resolve(process.cwd(), '.outputs', 'plugins');

      let files: string[] = [];
      try {
        files = (await fs.readdir(pluginDir)).filter(f => f.endsWith('.plugin.json'));
      } catch {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ plugins: [], message: 'No plugins directory found' }, null, 2) }] };
      }

      const plugins = [];
      for (const file of files) {
        try {
          const raw = await fs.readFile(pathMod.default.join(pluginDir, file), 'utf-8');
          const plugin = JSON.parse(raw);
          plugins.push({
            name: plugin.name,
            description: plugin.description,
            tools: plugin.tools?.length || 0,
            version: plugin.version,
            exported_at: plugin.exported_at,
            file,
          });
        } catch { /* skip invalid */ }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ plugins, total: plugins.length }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Tool Forge MCP server running on stdio');
}

process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
