import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initializeSchema } from './db/schema.js';
import { handleWrsCreate } from './tools/wrs-create.js';
import { handleWrsHydrate } from './tools/wrs-hydrate.js';
import { handleWrsRun } from './tools/wrs-run.js';
import { handleWrsCompare } from './tools/wrs-compare.js';
import { handleWrsDecisionRecord } from './tools/wrs-decision-record.js';
import { handleWrsTransition } from './tools/wrs-transition.js';
import { handleWrsExport } from './tools/wrs-export.js';
import { handleWrsGet } from './tools/wrs-get.js';
import { handleWrsList } from './tools/wrs-list.js';

const server = new McpServer({
  name: 'agent-workforce-sim',
  version: '2.0.0',
});

initializeSchema();

server.tool(
  'wrs_create',
  'Create a workforce redesign simulation with organization structure and role taxonomy',
  {
    simulation_name: z.string().describe('Simulation name'),
    org_name: z.string().describe('Organization name'),
    industry_naics: z.string().optional().describe('Optional NAICS industry code'),
    headcount: z.number().min(1).describe('Total workforce headcount'),
    time_horizon_months: z.number().min(1).max(60).optional().describe('Simulation horizon in months'),
    monte_carlo_iterations: z.number().min(100).max(50000).optional().describe('Monte Carlo iterations'),
    department_name: z.string().optional().describe('Initial department name'),
    team_name: z.string().optional().describe('Initial team name'),
    roles: z
      .array(
        z.object({
          title: z.string(),
          onet_soc_code: z.string(),
          fte_count: z.number().min(0),
          annual_cost_per_fte: z.number().optional(),
          level: z.string().optional(),
          location: z.string().optional(),
        })
      )
      .optional()
      .describe('Initial team roles'),
    input_provenance: z
      .object({
        status: z.enum(['verified', 'inferred']).optional(),
        headcount_source: z.string().optional(),
        role_fte_source: z.string().optional(),
        requires_confirmation: z.boolean().optional(),
        warnings: z.array(z.string()).optional(),
        evidence: z.string().optional(),
      })
      .passthrough()
      .optional()
      .describe('Credibility metadata for baseline FTE inputs'),
  },
  async (params) => {
    try {
      const result = await handleWrsCreate(params);
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

server.tool(
  'wrs_hydrate',
  'Hydrate role/task records from connector sources with reliability policy and degraded-source tracking',
  {
    simulation_id: z.string().describe('Simulation ID to hydrate'),
    role_id: z.string().optional().describe('Optional role ID to hydrate a single role'),
    use_mock_data: z
      .boolean()
      .optional()
      .describe('Use deterministic mock connector responses. Default true in Gate A.'),
    prefetched_sources: z
      .record(z.unknown())
      .optional()
      .describe('Pre-fetched data from gateway orchestrator. Bypasses all API calls when provided.'),
  },
  async (params) => {
    try {
      const result = await handleWrsHydrate(params);
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

server.tool(
  'wrs_run',
  'Execute deterministic workforce simulation run and persist reproducibility contract hashes',
  {
    simulation_id: z.string().describe('Simulation ID to run'),
    scenario_name: z.string().optional().describe('Scenario name'),
    seed: z.number().int().optional().describe('Monte Carlo seed'),
    parameter_overrides: z.record(z.unknown()).optional().describe('Scenario parameter overrides'),
    maturation_params: z.record(z.unknown()).optional().describe('Maturation curve parameters'),
    snapshot_ids: z.array(z.string()).optional().describe('Snapshot IDs used for deterministic run'),
    source_versions: z.record(z.string()).optional().describe('Source versions used in run'),
  },
  async (params) => {
    try {
      const result = handleWrsRun(params);
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

server.tool(
  'wrs_get',
  'Retrieve a stored simulation\'s full results including summary metrics, artifacts, and role-department mapping',
  {
    simulation_id: z.string().describe('Simulation ID to retrieve'),
    scenario_id: z.string().optional().describe('Specific scenario ID. Default: latest scenario'),
  },
  async (params) => {
    try {
      const result = handleWrsGet(params);
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

server.tool(
  'wrs_list',
  'List all simulations with status, role count, and latest scenario summary',
  {
    limit: z.number().int().min(1).max(200).optional().describe('Max results to return (default 50)'),
    offset: z.number().int().min(0).optional().describe('Offset for pagination (default 0)'),
  },
  async (params) => {
    try {
      const result = handleWrsList(params);
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

server.tool(
  'wrs_compare',
  'Compare two or more simulation scenarios side-by-side',
  {
    simulation_id: z.string().describe('Simulation ID'),
    scenario_ids: z.array(z.string()).min(2).describe('Scenario IDs to compare'),
    include_counterfactual: z.boolean().optional().describe('Include do-nothing baseline scenario'),
    parameter_overrides: z
      .object({
        viability_threshold_pct: z.number().optional(),
        ranking_weights: z
          .object({
            net_annual_savings: z.number().optional(),
            tasks_automated_pct: z.number().optional(),
            resistance_risk: z.number().optional(),
            investment_efficiency: z.number().optional(),
          })
          .optional(),
      })
      .passthrough()
      .optional()
      .describe('Comparator overrides (weights + viability gate)'),
  },
  async (params) => {
    try {
      const result = handleWrsCompare(params);
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

server.tool(
  'wrs_decision_record',
  'Create a deterministic finance transformation decision record from simulation scenarios',
  {
    simulation_id: z.string().describe('Simulation ID'),
    scenario_ids: z.array(z.string()).min(1).describe('Scenario IDs to synthesize into one decision record'),
    parameter_overrides: z
      .object({
        viability_threshold_pct: z.number().optional(),
        ranking_weights: z
          .object({
            net_annual_savings: z.number().optional(),
            tasks_automated_pct: z.number().optional(),
            resistance_risk: z.number().optional(),
            investment_efficiency: z.number().optional(),
          })
          .optional(),
      })
      .passthrough()
      .optional()
      .describe('Comparator overrides (weights + viability gate)'),
    monitor_ids: z.array(z.string()).optional().describe('Optional attached monitor IDs'),
    context: z
      .object({
        org_name: z.string().optional(),
        function_name: z.string().optional(),
        headcount: z.number().optional(),
      })
      .optional()
      .describe('Optional finance transformation context'),
  },
  async (params) => {
    try {
      const result = handleWrsDecisionRecord(params);
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

server.tool(
  'wrs_transition',
  'Generate a sequenced transition plan for a simulation scenario',
  {
    simulation_id: z.string().describe('Simulation ID'),
    scenario_id: z.string().describe('Scenario ID'),
  },
  async (params) => {
    try {
      const result = handleWrsTransition(params);
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

server.tool(
  'wrs_export',
  'Export simulation scenario outputs for reporting',
  {
    simulation_id: z.string().describe('Simulation ID'),
    scenario_id: z.string().describe('Scenario ID'),
    format: z.enum(['html', 'docx', 'pptx']).optional().describe('Export format'),
  },
  async (params) => {
    try {
      const result = handleWrsExport(params);
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Agent Workforce Sim MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
