import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { closeDb } from './db/database.js';
import { cloneCreate } from './tools/clone-create.js';
import { cloneStatus } from './tools/clone-status.js';
import { ingestPdf } from './tools/ingest-pdf.js';
import { profileExcelTool } from './tools/profile-excel.js';
import { computeMetricsTool } from './tools/compute-metrics.js';
import { saveBlueprint } from './tools/save-blueprint.js';
import { saveDataplan } from './tools/save-dataplan.js';

const server = new McpServer({
  name: 'report-cloner',
  version: '1.0.0',
  description: 'Report Cloner — ingest an existing board report PDF, map fresh HRIS data, and generate a structurally identical updated report.',
});

// ── 1. clone_create ──
// @ts-expect-error — MCP SDK generic type depth limit with 7 tool registrations
server.tool(
  'clone_create',
  'Create a new report cloning job. Registers the original report PDF and data source Excel files, returns a job_id for tracking.',
  {
    name: z.string().describe('Job name, e.g. "Q1 2026 Board Report"'),
    original_report_path: z.string().describe('Absolute path to the original PDF report'),
    data_source_paths: z.string().describe('JSON array of absolute paths to Excel/CSV data files'),
    reporting_period: z.string().describe('JSON object with label, start, end, snapshot_date fields'),
  },
  async (params) => {
    try {
      const data_source_paths = JSON.parse(params.data_source_paths) as string[];
      const reporting_period = JSON.parse(params.reporting_period) as { label: string; start: string; end: string; snapshot_date: string };
      const result = await cloneCreate({ ...params, data_source_paths, reporting_period });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── 2. clone_status ──
server.tool(
  'clone_status',
  'Check the current state of a clone job — which stage it is at, what has been completed, and what is pending.',
  {
    job_id: z.string().describe('The clone job ID'),
  },
  async (params) => {
    try {
      const result = await cloneStatus(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── 3. ingest_pdf ──
server.tool(
  'ingest_pdf',
  'Extract text, headings, and tables from the original report PDF. Uses pdf-parse for text and pdfplumber for table detection. Returns structured page-by-page extraction.',
  {
    job_id: z.string().describe('The clone job ID'),
    file_path: z.string().describe('Absolute path to the PDF file'),
  },
  async (params) => {
    try {
      const result = await ingestPdf(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── 4. profile_excel ──
server.tool(
  'profile_excel',
  'Profile an Excel file — sheets, columns, data types, sample values, statistics, and data quality flags. Returns a manifest for data mapping.',
  {
    job_id: z.string().describe('The clone job ID'),
    file_path: z.string().describe('Absolute path to the Excel file'),
  },
  async (params) => {
    try {
      const result = await profileExcelTool(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── 5. compute_metrics ──
server.tool(
  'compute_metrics',
  'Execute specific data computations from the DataPlan against Excel files. Supports count, sum, mean, filter_count, group_aggregate, and derived (pandas expression) operations. Pass computations as a JSON string array of objects with: computation_id, source_file, sheet, operation (count|sum|mean|filter_count|group_aggregate|derived), optional filters [{column, operator, value}], optional group_by, aggregation_column, aggregation, formula.',
  {
    job_id: z.string().describe('The clone job ID'),
    computations: z.string().describe('JSON array of computation spec objects'),
  },
  async (params) => {
    try {
      const computations = JSON.parse(params.computations);
      const result = await computeMetricsTool({ job_id: params.job_id, computations });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── 6. save_blueprint ──
server.tool(
  'save_blueprint',
  'Persist a validated ReportBlueprint to the clone job record. Call after the user validates the blueprint from the Reader stage.',
  {
    job_id: z.string().describe('The clone job ID'),
    blueprint: z.any().describe('The full ReportBlueprint JSON object'),
  },
  async (params) => {
    try {
      const result = await saveBlueprint(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── 7. save_dataplan ──
server.tool(
  'save_dataplan',
  'Persist a validated DataPlan to the clone job record. Call after the user resolves all data mapping gaps from the Plumber stage.',
  {
    job_id: z.string().describe('The clone job ID'),
    dataplan: z.any().describe('The full DataPlan JSON object'),
  },
  async (params) => {
    try {
      const result = await saveDataplan(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Cleanup ──
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

// ── Start ──
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Report Cloner MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
