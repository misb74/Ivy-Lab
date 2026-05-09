/**
 * Code generation template for forged MCP servers.
 * Takes a ServerSpec and generates a complete, runnable MCP server.
 */

export interface ToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  itemType?: string;       // for array type
  default?: any;
}

export interface ToolSpec {
  name: string;
  description: string;
  params: ToolParam[];
  implementation: string;  // Function body — receives `params` object, must return a value
}

export interface ServerSpec {
  name: string;
  description: string;
  tools: ToolSpec[];
  dependencies?: Record<string, string>;
}

function zodType(param: ToolParam): string {
  switch (param.type) {
    case 'string': return 'z.string()';
    case 'number': return 'z.number()';
    case 'boolean': return 'z.boolean()';
    case 'array': {
      const inner = param.itemType === 'number' ? 'z.number()' :
                    param.itemType === 'boolean' ? 'z.boolean()' :
                    'z.string()';
      return `z.array(${inner})`;
    }
    case 'object': return 'z.record(z.any())';
    default: return 'z.string()';
  }
}

function generateToolRegistration(tool: ToolSpec): string {
  const paramEntries = tool.params.map(p => {
    let schema = zodType(p);
    if (!p.required) schema += '.optional()';
    schema += `.describe(${JSON.stringify(p.description)})`;
    return `    ${p.name}: ${schema},`;
  }).join('\n');

  return `
server.tool(
  ${JSON.stringify(tool.name)},
  ${JSON.stringify(tool.description)},
  {
${paramEntries}
  },
  async (params) => {
    try {
      const result = await (async () => {
        ${tool.implementation}
      })();
      return { content: [{ type: 'text' as const, text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: \`Error: \${(error as Error).message}\` }], isError: true };
    }
  }
);`;
}

export function generateServerCode(spec: ServerSpec): string {
  const toolRegistrations = spec.tools.map(t => generateToolRegistration(t)).join('\n');

  return `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: ${JSON.stringify(spec.name)},
  version: '1.0.0',
  description: ${JSON.stringify(spec.description)},
});
${toolRegistrations}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('${spec.name} MCP server running on stdio');
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
`;
}

export function generatePackageJson(spec: ServerSpec): string {
  const deps: Record<string, string> = {
    '@modelcontextprotocol/sdk': '^1.0.0',
    'zod': '^3.23.0',
    ...(spec.dependencies || {}),
  };

  const pkg = {
    name: `@auxia/forged-${spec.name}`,
    version: '1.0.0',
    private: true,
    type: 'module',
    main: './src/index.ts',
    scripts: {
      start: 'tsx src/index.ts',
    },
    dependencies: deps,
    devDependencies: {
      tsx: '^4.19.0',
      typescript: '^5.7.0',
    },
  };

  return JSON.stringify(pkg, null, 2);
}
