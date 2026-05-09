import fs from 'node:fs/promises';
import { TOOL_REFERENCE } from '../constants.js';
import type { ToolDef } from '../types.js';

export async function parseTools(): Promise<ToolDef[]> {
  const text = await fs.readFile(TOOL_REFERENCE, 'utf-8');
  const lines = text.split('\n');
  const tools: ToolDef[] = [];

  let serverLabel = '';
  let serverName = '';

  for (const line of lines) {
    // Match section heading: ## N. Section Title
    const headingMatch = line.match(/^## \d+\.\s+(.+)/);
    if (headingMatch) {
      serverLabel = headingMatch[1].trim();
      continue;
    }

    // Match server line: **Server**: `server-name` ...
    const serverMatch = line.match(/\*\*Server\*\*:\s*`([^`]+)`/);
    if (serverMatch) {
      serverName = serverMatch[1].replace(/\s*\(MCP\)/, '').trim();
      continue;
    }

    // Match tool row: | `tool_name` | description | params | algorithm? |
    const toolMatch = line.match(/^\|\s*`(\w+)`\s*\|/);
    if (toolMatch) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 3) {
        tools.push({
          name: cells[0].replace(/`/g, ''),
          description: cells[1],
          params: cells[2].replace(/`/g, ''),
          server: serverName,
          serverLabel,
          algorithm: cells[3] || undefined,
        });
      }
    }
  }

  return tools;
}

export function searchTools(tools: ToolDef[], query: string): ToolDef[] {
  const q = query.toLowerCase();
  return tools.filter(
    t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.server.toLowerCase().includes(q) ||
      t.serverLabel.toLowerCase().includes(q)
  );
}
