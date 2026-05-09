import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { customerDataIngest } from './tools/ingest.js';
import { customerDataList } from './tools/list-datasets.js';
import { customerDataQuery } from './tools/query.js';
import { customerDataSchema } from './tools/schema.js';
import { customerDataStats } from './tools/stats.js';
import { customerDataDelete } from './tools/delete.js';
import { customerDataAggregateRoles } from './tools/aggregate-roles.js';
import { customerDataSocLookup } from './tools/soc-lookup.js';
import { customerDataPrepareSimulation } from './tools/prepare-simulation.js';

const server = new McpServer({
  name: 'agent-customer-data',
  version: '1.0.0',
  description: 'Customer data upload, schema mapping, and querying',
});

// --- Tool: customer_data_ingest ---
server.tool(
  'customer_data_ingest',
  'Ingest a customer data file (CSV/XLSX). Auto-detects column schema and maps to canonical HR concepts. Returns dataset ID and detected mappings.',
  {
    file_path: z.string().describe('Absolute path to the CSV or XLSX file to ingest'),
    file_type: z.string().optional().describe('File type override: csv, tsv, xlsx (auto-detected from extension if omitted)'),
    dataset_name: z.string().optional().describe('Human-readable name for the dataset (defaults to filename)'),
    mapping: z.record(z.string().nullable()).optional().describe('Manual column mapping: { "Original Column": "IVY_CONCEPT" }. Overrides auto-detection.'),
    _ctx: z.object({ tenant_id: z.string().optional() }).optional().describe('Tenant context'),
  },
  async (params) => {
    try {
      const result = await customerDataIngest(params);
      return {
        content: [{ type: 'text' as const, text: result }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// --- Tool: customer_data_list ---
server.tool(
  'customer_data_list',
  'List all ingested customer datasets for this tenant. Shows name, row count, status, and metadata.',
  {
    status: z.string().optional().describe('Filter by status: pending, mapping, ingesting, ready, error, archived'),
    limit: z.number().optional().describe('Max results (default: 50)'),
    offset: z.number().optional().describe('Pagination offset (default: 0)'),
    _ctx: z.object({ tenant_id: z.string().optional() }).optional().describe('Tenant context'),
  },
  async (params) => {
    try {
      const result = customerDataList(params);
      return {
        content: [{ type: 'text' as const, text: result }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// --- Tool: customer_data_query ---
server.tool(
  'customer_data_query',
  'Query records from an ingested dataset with filters, column selection, grouping, and aggregation. Returns paginated results.',
  {
    dataset_id: z.string().describe('ID of the dataset to query'),
    filters: z.array(z.object({
      field: z.string().describe('Column name (use _job_title, _department, _location, _salary etc. for denormalized fields)'),
      op: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'like', 'in', 'is_null', 'is_not_null']).describe('Comparison operator'),
      value: z.any().optional().describe('Value to compare against (array for "in", omit for is_null/is_not_null)'),
    })).optional().describe('Filter conditions (all ANDed together)'),
    select: z.array(z.string()).optional().describe('Columns to return (default: all)'),
    group_by: z.array(z.string()).optional().describe('Columns to group by'),
    metrics: z.array(z.object({
      field: z.string().describe('Column to aggregate'),
      agg: z.enum(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']).describe('Aggregation function'),
    })).optional().describe('Aggregation metrics (requires group_by for meaningful results)'),
    order_by: z.string().optional().describe('Column to sort by, optionally with ASC/DESC (e.g., "_salary DESC")'),
    limit: z.number().optional().describe('Max rows to return (default: 100)'),
    offset: z.number().optional().describe('Pagination offset (default: 0)'),
    _ctx: z.object({ tenant_id: z.string().optional() }).optional().describe('Tenant context'),
  },
  async (params) => {
    try {
      const result = customerDataQuery(params);
      return {
        content: [{ type: 'text' as const, text: result }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// --- Tool: customer_data_schema ---
server.tool(
  'customer_data_schema',
  'Get the schema of a dataset: columns, detected concept mappings, data types, confidence scores, and sample rows.',
  {
    dataset_id: z.string().describe('ID of the dataset'),
    sample_limit: z.number().optional().describe('Number of sample rows to include (default: 5)'),
    _ctx: z.object({ tenant_id: z.string().optional() }).optional().describe('Tenant context'),
  },
  async (params) => {
    try {
      const result = customerDataSchema(params);
      return {
        content: [{ type: 'text' as const, text: result }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// --- Tool: customer_data_stats ---
server.tool(
  'customer_data_stats',
  'Compute aggregated statistics on a dataset: COUNT, SUM, AVG, MIN, MAX grouped by one or more columns.',
  {
    dataset_id: z.string().describe('ID of the dataset'),
    group_by: z.array(z.string()).optional().describe('Columns to group by (e.g., ["_department", "_job_level"])'),
    metrics: z.array(z.object({
      field: z.string().describe('Column to aggregate (e.g., "_salary", "id")'),
      agg: z.enum(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']).describe('Aggregation function'),
    })).describe('Metrics to compute'),
    filters: z.array(z.object({
      field: z.string(),
      op: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'like', 'in', 'is_null', 'is_not_null']),
      value: z.any().optional(),
    })).optional().describe('Optional filters'),
    order_by: z.string().optional().describe('Column to sort by'),
    limit: z.number().optional().describe('Max groups to return (default: 100)'),
    _ctx: z.object({ tenant_id: z.string().optional() }).optional().describe('Tenant context'),
  },
  async (params) => {
    try {
      const result = customerDataStats(params);
      return {
        content: [{ type: 'text' as const, text: result }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// --- Tool: customer_data_delete ---
server.tool(
  'customer_data_delete',
  'Delete a dataset and all its records. Requires confirm: true to execute.',
  {
    dataset_id: z.string().describe('ID of the dataset to delete'),
    confirm: z.boolean().optional().describe('Set to true to confirm deletion'),
    _ctx: z.object({ tenant_id: z.string().optional() }).optional().describe('Tenant context'),
  },
  async (params) => {
    try {
      const result = customerDataDelete(params);
      return {
        content: [{ type: 'text' as const, text: result }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// --- Tool: customer_data_aggregate_roles ---
server.tool(
  'customer_data_aggregate_roles',
  'Aggregate individual employee records into role summaries for workforce simulation. Groups by job title, computes headcount, FTE, salary stats, and flags missing SOC codes. Use this to convert a 100K employee roster into ~500 role definitions for wrs_create.',
  {
    dataset_id: z.string().describe('Dataset ID to aggregate'),
    group_by: z.array(z.string()).optional().describe('Columns to group by (default: [_job_title]). Add _department or _location for finer granularity.'),
    department_filter: z.string().optional().describe('Only include employees in this department'),
    location_filter: z.string().optional().describe('Only include employees in this location'),
    min_headcount: z.number().optional().describe('Exclude roles with fewer than N employees (default: 1)'),
    _ctx: z.object({ tenant_id: z.string().optional() }).optional().describe('Tenant context'),
  },
  async (params) => {
    try {
      const result = customerDataAggregateRoles(params);
      return {
        content: [{ type: 'text' as const, text: result }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// --- Tool: customer_data_soc_lookup ---
server.tool(
  'customer_data_soc_lookup',
  'Map job titles to O*NET SOC codes using built-in dictionary with fuzzy matching. Batch-capable: accepts array of job titles, returns best-match SOC codes with confidence scores. Use after customer_data_aggregate_roles to fill in missing SOC codes before creating a simulation.',
  {
    job_titles: z.array(z.string()).describe('Array of job titles to look up SOC codes for'),
    min_confidence: z.number().optional().describe('Minimum match confidence 0-1 (default: 0.3). Lower values return more matches but with lower accuracy.'),
    _ctx: z.object({ tenant_id: z.string().optional() }).optional().describe('Tenant context'),
  },
  async (params) => {
    try {
      const result = customerDataSocLookup(params);
      return {
        content: [{ type: 'text' as const, text: result }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// --- Tool: customer_data_prepare_simulation ---
server.tool(
  'customer_data_prepare_simulation',
  'End-to-end pipeline: aggregate employee records into roles, map job titles to O*NET SOC codes, and produce a wrs_create-ready payload. This is the "Import Org → Simulate" connector. Call this after ingesting a CSV/XLSX employee roster. In decision-grade mode, set fail_on_fallback_soc=true to block generic fallback SOC mappings and surface unresolved roles for review instead.',
  {
    dataset_id: z.string().describe('Dataset ID of the ingested employee roster'),
    simulation_name: z.string().optional().describe('Name for the simulation (default: dataset name + Simulation)'),
    org_name: z.string().optional().describe('Organization name (default: dataset name)'),
    department_filter: z.string().optional().describe('Only include roles from this department'),
    min_headcount: z.number().optional().describe('Exclude roles with fewer than N employees (default: 2)'),
    min_soc_confidence: z.number().optional().describe('Minimum SOC code match confidence 0-1 (default: 0.55)'),
    fail_on_fallback_soc: z.boolean().optional().describe('Decision-grade mode. When true, do not return wrs_create_payload if any role would use the generic fallback SOC code.'),
    _ctx: z.object({ tenant_id: z.string().optional() }).optional().describe('Tenant context'),
  },
  async (params) => {
    try {
      const result = customerDataPrepareSimulation(params);
      return {
        content: [{ type: 'text' as const, text: result }],
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
  console.error('agent-customer-data MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
