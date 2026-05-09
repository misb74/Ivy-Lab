import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { closeDb } from './db/database.js';
import { specCreate } from './tools/spec-create.js';
import { specGet } from './tools/spec-get.js';
import { specList } from './tools/spec-list.js';
import { specAddTool } from './tools/spec-add-tool.js';
import { specAddGuardrail } from './tools/spec-add-guardrail.js';
import { specAddTask } from './tools/spec-add-task.js';
import { specFromSimulation } from './tools/spec-from-simulation.js';
import { specValidate } from './tools/spec-validate.js';
import { specCompose } from './tools/spec-compose.js';
import { specScaffold } from './tools/spec-scaffold.js';
import { specToArtifact } from './tools/spec-to-artifact.js';

const server = new McpServer({
  name: 'agent-builder',
  version: '1.0.0',
  description: 'Agent Builder — create AI agent specifications from WorkVine simulations or from scratch. Compose agent configs or scaffold full Claude Agent SDK projects.',
});

// ── Tool: agent_spec_create ──
server.tool(
  'agent_spec_create',
  'Create a new agent specification from scratch. Returns spec_id. Add tasks, tools, and guardrails next.',
  {
    name: z.string().describe('Agent name'),
    purpose: z.string().describe('What the agent does and why'),
    description: z.string().optional().describe('Detailed description'),
    model: z.enum(['sonnet', 'opus', 'haiku']).optional().describe('Claude model (default: sonnet)'),
    source_simulation_id: z.string().optional().describe('Link to WorkVine simulation'),
    source_scenario_id: z.string().optional().describe('Link to WorkVine scenario'),
  },
  async (params) => {
    try {
      const result = await specCreate(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: agent_spec_from_simulation ──
server.tool(
  'agent_spec_from_simulation',
  'Auto-create an agent spec from a WorkVine workforce simulation. Extracts automatable tasks, infers tools, generates guardrails from human-edge scores, and sets success criteria from simulation metrics.',
  {
    simulation_id: z.string().describe('WorkVine simulation ID'),
    scenario_id: z.string().describe('Scenario ID within the simulation'),
    spec_name: z.string().optional().describe('Custom name (auto-generated if omitted)'),
    automation_threshold: z.number().min(0).max(1).optional().describe('Min AI capability score to include (default: 0.7)'),
  },
  async (params) => {
    try {
      const result = await specFromSimulation(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: agent_spec_add_tool ──
server.tool(
  'agent_spec_add_tool',
  'Add an MCP tool to the agent spec. The tool must come from a known MCP server in .mcp.json.',
  {
    spec_id: z.string().describe('Spec ID'),
    tool_name: z.string().describe('MCP tool name (e.g. "deep_research_create")'),
    server_name: z.string().describe('MCP server name (e.g. "agent-deep-research")'),
    description: z.string().optional().describe('What this tool does'),
    required: z.boolean().optional().describe('Is this tool required? (default: true)'),
    params_schema_json: z.string().optional().describe('JSON schema for tool parameters'),
  },
  async (params) => {
    try {
      const result = await specAddTool(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: agent_spec_add_guardrail ──
server.tool(
  'agent_spec_add_guardrail',
  'Add a safety guardrail to the agent spec. Types: input (validate inputs), output (check outputs), escalation (stop and involve human), constraint (limit agent behavior).',
  {
    spec_id: z.string().describe('Spec ID'),
    guardrail_type: z.enum(['input', 'output', 'escalation', 'constraint']).describe('Guardrail type'),
    condition: z.string().describe('When this guardrail triggers'),
    action: z.string().describe('What happens when triggered'),
    priority: z.number().min(1).max(10).optional().describe('Priority 1-10 (default: 5)'),
  },
  async (params) => {
    try {
      const result = await specAddGuardrail(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: agent_spec_add_task ──
server.tool(
  'agent_spec_add_task',
  'Add a task to the agent spec. Tasks define what the agent does, in what order.',
  {
    spec_id: z.string().describe('Spec ID'),
    task_description: z.string().describe('What the task involves'),
    source_role: z.string().optional().describe('Original role this task came from'),
    source_task_id: z.string().optional().describe('Original task ID from simulation'),
    automation_score: z.number().min(0).max(1).optional().describe('AI capability score (0-1)'),
    sequence_order: z.number().optional().describe('Execution order (auto-incremented if omitted)'),
    assignment: z.enum(['agent', 'hybrid', 'human']).optional().describe('Who handles this (default: agent)'),
    grounding_process_id: z.string().optional().describe('Matched HR process ID from ontology'),
    grounding_confidence: z.number().min(0).max(1).optional().describe('Grounding match confidence'),
    grounding_source: z.enum(['hr_ontology', 'ungrounded']).optional().describe('Grounding source'),
  },
  async (params) => {
    try {
      const result = await specAddTask(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: agent_spec_validate ──
server.tool(
  'agent_spec_validate',
  'Validate an agent spec for completeness: checks tasks, tools, guardrails, success criteria, and validates tool servers against .mcp.json.',
  {
    spec_id: z.string().describe('Spec ID to validate'),
  },
  async (params) => {
    try {
      const result = await specValidate(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: agent_spec_compose ──
server.tool(
  'agent_spec_compose',
  'Generate a composed agent configuration from a validated spec: system prompt, tool whitelist, workflow steps, and guardrail hooks. Immediately usable within Ivy.',
  {
    spec_id: z.string().describe('Spec ID (must be validated)'),
  },
  async (params) => {
    try {
      const result = await specCompose(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: agent_spec_scaffold ──
server.tool(
  'agent_spec_scaffold',
  'Generate a full Claude Agent SDK Python project from a validated spec. Creates pyproject.toml, agent.py, guardrails.py, tools.py, CLAUDE.md, tests, and README.',
  {
    spec_id: z.string().describe('Spec ID (must be validated or composed)'),
    output_dir: z.string().optional().describe('Output directory (default: .outputs/agents/{name}/)'),
  },
  async (params) => {
    try {
      const result = await specScaffold(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: agent_spec_to_artifact ──
server.tool(
  'agent_spec_to_artifact',
  'Convert an agent spec to a renderable artifact card showing tasks, tools, guardrails, and next steps.',
  {
    spec_id: z.string().describe('Spec ID'),
  },
  async (params) => {
    try {
      const artifact = await specToArtifact(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(artifact, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: agent_spec_get ──
server.tool(
  'agent_spec_get',
  'Retrieve full details of an agent spec including all tasks, tools, guardrails, success criteria, and outputs.',
  {
    spec_id: z.string().describe('Spec ID'),
  },
  async (params) => {
    try {
      const result = await specGet(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: agent_spec_list ──
server.tool(
  'agent_spec_list',
  'List all agent specs with summary counts. Filter by status.',
  {
    limit: z.number().optional().describe('Max results (default: 20)'),
    offset: z.number().optional().describe('Pagination offset'),
    status: z.enum(['draft', 'tools_added', 'validated', 'composed', 'scaffolded']).optional().describe('Filter by status'),
  },
  async (params) => {
    try {
      const result = await specList(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: agent_build ──
server.tool(
  'agent_build',
  'Trigger a REAL agent build using Claude Code. Spawns Claude Code as a subprocess that writes real Python code, implements real guardrails, runs real tests, and delivers a working agent. Progress streams to the UI in real-time via ThinkingPanel.',
  {
    spec_id: z.string().describe('Spec ID (must be validated)'),
    session_id: z.string().optional().describe('WebSocket session ID for real-time progress streaming'),
  },
  async (params) => {
    try {
      const gatewayPort = process.env.GATEWAY_PORT || '8000';
      const response = await fetch(`http://localhost:${gatewayPort}/api/agent-builder/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spec_id: params.spec_id,
          session_id: params.session_id,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Build request failed: ${response.status}`);
      }

      const result = await response.json();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            ...result,
            message: 'Build started! Claude Code is now building your agent. Progress is streaming to the UI.',
            next_step: `Poll ${result.poll_url} for status, or watch the ThinkingPanel for real-time progress.`,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: agent_hr_grounding_import ──
server.tool(
  'agent_hr_grounding_import',
  'Import HR work ontology from xlsx workbook. Idempotent — safe to re-run. Populates taxonomy, processes, labels, and tool mappings.',
  {
    file_path: z.string().describe('Path to hr-work-ontology.xlsx'),
  },
  async (params) => {
    try {
      const { ingestHrWorkbook } = await import('./engine/hr-grounding-ingest.js');
      const { getDb } = await import('./db/database.js');
      const result = await ingestHrWorkbook(getDb(), { filePath: params.file_path });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: agent_hr_grounding_status ──
server.tool(
  'agent_hr_grounding_status',
  'Check HR grounding status: import runs, process count, label coverage, tool mappings.',
  {},
  async () => {
    try {
      const { getDb } = await import('./db/database.js');
      const db = getDb();
      const runs = db.prepare('SELECT id, status, total_rows, unique_processes, broken_descriptions, completed_at FROM hr_import_runs ORDER BY started_at DESC LIMIT 5').all();
      const processCount = (db.prepare('SELECT COUNT(*) as cnt FROM hr_work_process').get() as any)?.cnt || 0;
      const labelCount = (db.prepare('SELECT COUNT(*) as cnt FROM hr_process_labels').get() as any)?.cnt || 0;
      const toolMappingCount = (db.prepare('SELECT COUNT(*) as cnt FROM hr_tool_mapping').get() as any)?.cnt || 0;
      const taxonomyCounts = db.prepare('SELECT level, COUNT(*) as cnt FROM hr_work_taxonomy GROUP BY level').all();
      const labelBreakdown = db.prepare(`
        SELECT automation_likelihood, judgment_risk, data_sensitivity, COUNT(*) as cnt
        FROM hr_process_labels GROUP BY automation_likelihood, judgment_risk, data_sensitivity
      `).all();

      const status = {
        import_runs: runs,
        processes: processCount,
        labels: labelCount,
        label_coverage: processCount > 0 ? `${((labelCount / processCount) * 100).toFixed(0)}%` : 'n/a',
        tool_mappings: toolMappingCount,
        taxonomy: taxonomyCounts,
        label_breakdown: labelBreakdown,
        grounding_available: processCount > 0,
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: agent_hr_grounding_metrics ──
server.tool(
  'agent_hr_grounding_metrics',
  'Query suggestion acceptance rates for grounding quality feedback loop.',
  {},
  async () => {
    try {
      const { getDb } = await import('./db/database.js');
      const db = getDb();
      const stats = db.prepare(`
        SELECT suggestion_type, action, COUNT(*) as count
        FROM hr_suggestion_events
        GROUP BY suggestion_type, action
      `).all();
      return { content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Start Server ──
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('agent-builder failed to start:', err);
  closeDb();
  process.exit(1);
});

process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});
