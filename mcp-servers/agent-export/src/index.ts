import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initializeSchema } from './db/schema.js';
import { exportArtifact } from './tools/export-artifact.js';
import { exportBatch } from './tools/export-batch.js';
import { exportEmbedCode } from './tools/export-embed-code.js';
import { exportList } from './tools/export-list.js';

const server = new McpServer({
  name: 'agent-export',
  version: '2.0.0',
});

// Initialize database schema
initializeSchema();

// --- Tool: export_artifact ---
server.tool(
  'export_artifact',
  'Export a single artifact to specified format (pdf, pptx, xlsx)',
  {
    title: z.string().describe('Title of the export artifact'),
    format: z.enum(['pdf', 'pptx', 'xlsx']).describe('Output format: pdf, pptx, or xlsx'),
    type: z.string().describe('Type/category of the artifact (e.g., report, dashboard, analysis)'),
    data: z.record(z.unknown()).describe('Structured data to export. For PDF: { sections: [...] }. For PPTX: { slides: [...] }. For XLSX: { sheets: [...] }'),
  },
  async (params) => {
    try {
      const result = await exportArtifact(params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// --- Tool: export_batch ---
server.tool(
  'export_batch',
  'Export multiple artifacts in a batch, returns manifest of all exports',
  {
    artifacts: z.array(z.object({
      title: z.string().describe('Title of the artifact'),
      format: z.enum(['pdf', 'pptx', 'xlsx']).describe('Output format'),
      type: z.string().describe('Type/category of the artifact'),
      data: z.record(z.unknown()).describe('Structured data to export'),
    })).describe('Array of artifacts to export in batch'),
  },
  async (params) => {
    try {
      const result = await exportBatch(params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// --- Tool: export_embed_code ---
server.tool(
  'export_embed_code',
  'Generate embeddable HTML code for an artifact',
  {
    title: z.string().describe('Title of the embeddable artifact'),
    content: z.string().describe('HTML content to embed'),
    type: z.string().describe('Type/category of the artifact'),
    styles: z.string().optional().describe('Optional custom CSS styles'),
    expiresInHours: z.number().optional().describe('Token expiration time in hours (default: 72)'),
  },
  async (params) => {
    try {
      const result = exportEmbedCode(params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// --- Tool: export_list ---
server.tool(
  'export_list',
  'List all exports with status and download info',
  {
    status: z.string().optional().describe('Filter by status: pending, completed, failed'),
    format: z.string().optional().describe('Filter by format: pdf, pptx, xlsx, embed'),
    limit: z.number().optional().describe('Max results to return (default: 50)'),
    offset: z.number().optional().describe('Offset for pagination (default: 0)'),
  },
  async (params) => {
    try {
      const result = exportList(params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('agent-export MCP server v2.0.0 running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
