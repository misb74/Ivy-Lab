import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFile } from 'fs/promises';

export interface McpServerConfig {
  type: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

interface ServerEntry {
  name: string;
  client: Client;
  transport: StdioClientTransport;
  tools: string[];
  config: McpServerConfig;
  health: 'healthy' | 'degraded' | 'dead';
}

const DEFERRED_SERVERS = new Set([
  'data-nlrb', 'data-eurostat', 'data-esco', 'data-ilostat',
  'data-fred', 'data-indeed', 'data-uk-paygap', 'data-revelio',
  'data-felten-aioe', 'data-atlas', 'data-labor-market', 'data-research-index',
  'agent-computer-use', 'agent-transcription', 'agent-swarm',
  'agent-notification', 'agent-connector', 'agent-tool-forge',
  'agent-data-analysis', 'spec-engine', 'agent-triangulator',
  'report-cloner', 'agent-builder',
]);

export class MCPManager {
  private servers = new Map<string, ServerEntry>();
  private toolToServer = new Map<string, string>();
  private anthropicTools: AnthropicTool[] = [];
  private projectDir = '';
  private serverConfigs = new Map<string, McpServerConfig>();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  async initialize(configPath: string): Promise<void> {
    console.log('[bot] Initializing MCP servers...');
    this.projectDir = configPath.replace(/\/\.mcp\.json$/, '');
    const raw = await readFile(configPath, 'utf-8');
    const config: McpConfig = JSON.parse(raw);

    const entries = Object.entries(config.mcpServers);
    for (const [name, cfg] of entries) {
      this.serverConfigs.set(name, cfg);
    }

    const results = await Promise.allSettled(
      entries.map(([name, cfg]) => this.connectServer(name, cfg)),
    );

    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        console.warn(`  [MCP] Failed to connect to ${entries[i][0]}: ${(results[i] as PromiseRejectedResult).reason}`);
      }
    }

    console.log(`[bot] MCP init complete: ${this.servers.size}/${entries.length} servers, ${this.anthropicTools.length} tools`);

    this.healthCheckInterval = setInterval(() => this.healthCheckAll(), 60_000);
  }

  private async connectServer(name: string, config: McpServerConfig): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: { ...process.env, ...(config.env || {}) } as Record<string, string>,
      cwd: this.projectDir,
    });

    const client = new Client({ name: `ivy-bot-${name}`, version: '3.0.0' });
    await client.connect(transport);

    const { tools } = await client.listTools();
    const toolNames: string[] = [];

    for (const tool of tools) {
      toolNames.push(tool.name);
      if (this.toolToServer.has(tool.name)) {
        console.warn(`  [MCP] Duplicate tool "${tool.name}" from "${name}" — skipping`);
        continue;
      }
      this.toolToServer.set(tool.name, name);
      this.anthropicTools.push({
        name: tool.name,
        description: tool.description || '',
        input_schema: (tool.inputSchema as Record<string, any>) || { type: 'object', properties: {} },
      });
    }

    this.servers.set(name, { name, client, transport, tools: toolNames, config, health: 'healthy' });
    console.log(`  Connected to ${name}: ${tools.length} tools`);
  }

  getActiveTools(): AnthropicTool[] {
    const seen = new Set<string>();
    return this.anthropicTools.filter(tool => {
      if (seen.has(tool.name)) return false;
      seen.add(tool.name);
      const server = this.toolToServer.get(tool.name);
      return !server || !DEFERRED_SERVERS.has(server);
    });
  }

  searchTools(query: string, maxResults = 10): AnthropicTool[] {
    const deferred = this.anthropicTools.filter(tool => {
      const server = this.toolToServer.get(tool.name);
      return server && DEFERRED_SERVERS.has(server);
    });
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);

    return deferred
      .map(tool => {
        let score = 0;
        const text = `${tool.name} ${tool.description}`.toLowerCase();
        for (const kw of keywords) {
          if (tool.name.toLowerCase().includes(kw)) score += 3;
          if (tool.description.toLowerCase().includes(kw)) score += 1;
        }
        if (tool.name.toLowerCase() === query.toLowerCase()) score += 10;
        return { tool, score };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(s => s.tool);
  }

  async callTool(name: string, input: Record<string, any>): Promise<string> {
    const serverName = this.toolToServer.get(name);
    if (!serverName) return JSON.stringify({ error: `Unknown tool: ${name}` });

    const server = this.servers.get(serverName);
    if (!server) return JSON.stringify({ error: `Server not found: ${serverName}` });

    const flattenResult = (result: any): string => {
      if (Array.isArray(result.content)) {
        return result.content
          .map((block: any) => block.text || JSON.stringify(block))
          .join('\n');
      }
      return typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content);
    };

    const shouldReconnect = (message: string): boolean =>
      /not connected|connection closed|transport closed/i.test(message);

    try {
      const result = await server.client.callTool({ name, arguments: input });
      return flattenResult(result);
    } catch (err: any) {
      console.error(`[MCP] Tool call failed (${name}):`, err.message);

      if (shouldReconnect(String(err?.message ?? ''))) {
        try {
          const config = this.serverConfigs.get(serverName) || server.config;
          await this.removeServer(serverName);
          await this.connectServer(serverName, config);
          const refreshed = this.servers.get(serverName);
          if (refreshed) {
            const retried = await refreshed.client.callTool({ name, arguments: input });
            return flattenResult(retried);
          }
        } catch (reconnectErr: any) {
          console.error(`[MCP] Reconnect failed (${serverName}):`, reconnectErr.message);
        }
      }

      return JSON.stringify({ error: err.message });
    }
  }

  private async removeServer(name: string): Promise<void> {
    const entry = this.servers.get(name);
    if (!entry) return;
    try { await entry.client.close(); } catch { /* ignore */ }
    for (const toolName of entry.tools) {
      this.toolToServer.delete(toolName);
    }
    const toolSet = new Set(entry.tools);
    for (let i = this.anthropicTools.length - 1; i >= 0; i--) {
      if (toolSet.has(this.anthropicTools[i].name)) {
        this.anthropicTools.splice(i, 1);
      }
    }
    this.servers.delete(name);
  }

  private async healthCheckAll(): Promise<void> {
    for (const [name, entry] of this.servers) {
      try {
        await entry.client.listTools();
        if (entry.health !== 'healthy') {
          console.log(`[MCP] Server ${name} recovered`);
          entry.health = 'healthy';
        }
      } catch {
        console.warn(`[MCP] Health check failed for ${name}, restarting...`);
        entry.health = 'dead';
        const config = this.serverConfigs.get(name) || entry.config;
        try {
          await this.removeServer(name);
          await this.connectServer(name, config);
        } catch (err: any) {
          console.error(`[MCP] Failed to restart ${name}: ${err.message}`);
        }
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    await Promise.allSettled(
      Array.from(this.servers.values()).map(async entry => {
        try { await entry.client.close(); } catch { /* ignore */ }
      }),
    );
    this.servers.clear();
    this.toolToServer.clear();
    this.anthropicTools = [];
    console.log('[bot] MCP servers shut down');
  }
}
