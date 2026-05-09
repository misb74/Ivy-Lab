export interface ServerDef {
  name: string;
  command: string;
  args: string[];
  entryFile?: string;
  isExternal: boolean;
}

export interface ToolDef {
  name: string;
  description: string;
  params: string;
  server: string;
  serverLabel: string;
  algorithm?: string;
}

export interface SkillDef {
  name: string;
  tier: 'tier1' | 'tier2';
  triggers: string[];
  path: string;
  frontmatter: { name: string; description: string };
  body?: string;
}

export interface HealthResult {
  server: string;
  status: 'ok' | 'error' | 'timeout';
  latencyMs: number;
  serverInfo?: { name: string; version: string };
  error?: string;
}
