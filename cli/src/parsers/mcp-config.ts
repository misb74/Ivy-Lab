import fs from 'node:fs/promises';
import { MCP_CONFIG } from '../constants.js';
import type { ServerDef } from '../types.js';

export async function parseServers(): Promise<ServerDef[]> {
  const raw = JSON.parse(await fs.readFile(MCP_CONFIG, 'utf-8'));
  const entries = Object.entries(raw.mcpServers) as [string, any][];

  return entries
    .map(([name, cfg]) => {
      const args: string[] = cfg.args ?? [];
      const isExternal = args[0] === '-c';
      let entryFile: string | undefined;

      if (isExternal) {
        const match = args[1]?.match(/exec npx\s+(\S+)/);
        entryFile = match?.[1]; // npx package name
      } else {
        entryFile = args[1]; // path to .ts file
      }

      return { name, command: cfg.command, args, entryFile, isExternal } as ServerDef;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
