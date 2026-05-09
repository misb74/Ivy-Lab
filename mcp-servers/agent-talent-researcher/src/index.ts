import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { batchCreate } from './tools/batch-create.js';
import { batchStatus } from './tools/batch-status.js';
import { roleNext } from './tools/role-next.js';
import { roleSubmit } from './tools/role-submit.js';
import { roleExport } from './tools/role-export.js';
import { batchExport } from './tools/batch-export.js';
import { batchDeliver } from './tools/batch-deliver.js';
import { closeDb } from './db/database.js';

const server = new McpServer({
  name: 'agent-talent-researcher',
  version: '2.0.0',
  description: 'Talent Research Agent — batch research business-critical roles, identify candidates, generate professional xlsx workbooks with ranked profiles, market intelligence, certifications, and approach strategies.',
});

// ── Tool: talent_batch_create ──
server.tool(
  'talent_batch_create',
  'Create a new talent research batch. Pass roles inline (preferred) or via CSV path. Each role will be researched independently and output as a professional xlsx workbook.',
  {
    csv_path: z.string().optional().describe('Absolute path to CSV file with role specifications. Use this OR roles, not both.'),
    roles: z.array(z.object({
      title: z.string().describe('Role title (e.g. "Head of Digital HR")'),
      location: z.string().describe('Location (e.g. "London, UK")'),
      industry_experience: z.string().describe('Pipe-separated industries (e.g. "Financial services|Technology")'),
      org_size: z.string().describe('Target org size (e.g. "5,000+")'),
      regulatory_requirements: z.string().optional().describe('Pipe-separated regulatory requirements'),
      certifications: z.string().optional().describe('Pipe-separated certifications'),
      nice_to_haves: z.string().optional().describe('Pipe-separated nice-to-haves'),
      custom_criteria: z.string().optional().describe('Free-text custom criteria'),
    })).optional().describe('Inline role specs (preferred over csv_path — no file creation needed)'),
    batch_name: z.string().optional().describe('Optional batch name (defaults to filename or "batch")'),
    email_to: z.string().optional().describe('Email address to deliver results to when batch completes'),
    recipient_name: z.string().optional().describe('Recipient name for the delivery email greeting'),
  },
  async (params) => {
    try {
      const result = await batchCreate(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool: talent_batch_status ──
server.tool(
  'talent_batch_status',
  'Show progress table for a talent research batch. Displays a formatted CLI table with status, candidate counts, and progress bars for each role.',
  {
    batch_id: z.string().optional().describe('Batch ID to check. If omitted, shows all batches.'),
  },
  async (params) => {
    try {
      const result = await batchStatus(params);
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool: talent_role_next ──
server.tool(
  'talent_role_next',
  'Get the next unresearched role from a batch. Returns the role spec and 3 tailored research prompts to run as parallel Task agents. Call this in a loop until all roles are processed.',
  {
    batch_id: z.string().describe('Batch ID to get next role from'),
  },
  async (params) => {
    try {
      const result = await roleNext(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool: talent_role_submit ──
server.tool(
  'talent_role_submit',
  'Submit compiled research results for a role. Pass the structured JSON with candidates, market intelligence, certifications, regulatory frameworks, and approach strategies.',
  {
    role_id: z.string().describe('Role ID to submit results for'),
    results: z.object({
      candidates: z.array(z.object({
        rank: z.number(),
        name: z.string(),
        current_title: z.string(),
        current_company: z.string(),
        source_url: z.string().url().describe('LinkedIn URL or verified source URL for this candidate'),
        top_100_org: z.string(),
        industry_experience_1: z.string(),
        industry_experience_2: z.string(),
        gov_military_background: z.string(),
        certifications: z.string(),
        regulatory_experience: z.string(),
        key_previous_roles: z.string(),
        years_experience: z.string(),
        education: z.string(),
        thought_leadership: z.string(),
        openness_score: z.number().min(1).max(5),
        openness_signals: z.string(),
        recruiter_notes: z.string(),
      })),
      market_intelligence: z.object({
        stats: z.array(z.object({
          statistic: z.string(),
          value: z.string(),
          source: z.string(),
          implication: z.string(),
        })),
        tier_rankings: z.array(z.object({
          tier: z.string(),
          description: z.string(),
          openness_score: z.string(),
          approach_strategy: z.string(),
        })),
        recommendations: z.array(z.object({
          criteria: z.string(),
          pick_1: z.string(),
          pick_2: z.string(),
          pick_3: z.string(),
          why: z.string(),
        })),
      }),
      certifications: z.array(z.object({
        certification: z.string(),
        priority: z.string(),
        why_required: z.string(),
        candidates_who_have_it: z.string(),
      })),
      regulatory_frameworks: z.array(z.object({
        framework: z.string(),
        relevance: z.string(),
        candidates_with_experience: z.string(),
      })),
      approach_strategies: z.array(z.object({
        priority: z.string(),
        name: z.string(),
        current_status: z.string(),
        recommended_approach: z.string(),
        talking_points: z.string(),
      })),
    }).describe('Structured research results'),
  },
  async (params) => {
    try {
      const result = await roleSubmit(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool: talent_role_export ──
server.tool(
  'talent_role_export',
  'Generate the professional xlsx workbook for a researched role. Creates a 4-tab workbook (Talent Profiles, Market Intelligence, Certifications & Regulatory, Approach Strategy).',
  {
    role_id: z.string().describe('Role ID to generate workbook for'),
  },
  async (params) => {
    try {
      const result = await roleExport(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool: talent_batch_export ──
server.tool(
  'talent_batch_export',
  'Generate the summary dashboard workbook for an entire batch. Creates _SUMMARY_DASHBOARD.xlsx with batch overview, cross-role candidate overlap, and quality scores.',
  {
    batch_id: z.string().describe('Batch ID to generate summary for'),
  },
  async (params) => {
    try {
      const result = await batchExport(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool: talent_batch_deliver ──
server.tool(
  'talent_batch_deliver',
  'Build email template variables from a completed batch. Returns TalentResearchVars ready to pass to send_templated_email. Works even if email_to was not set (useful for manual sending).',
  {
    batch_id: z.string().describe('Batch ID to build delivery variables for'),
  },
  async (params) => {
    try {
      const result = await batchDeliver(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool: talent_batch_auto_execute ──
server.tool(
  'talent_batch_auto_execute',
  'Auto-execute all roles in a talent research batch. The gateway execution engine loops through each role: searches for profiles via talent_search_profiles, submits results, and generates xlsx exports. Returns when the full batch is complete including summary dashboard.',
  {
    batch_id: z.string().describe('Batch ID from talent_batch_create'),
  },
  async (params) => {
    try {
      const { getDb } = await import('./db/database.js');
      const db = getDb();
      const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(params.batch_id) as any;
      if (!batch) throw new Error(`Batch "${params.batch_id}" not found`);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            __ivy_execution_manifest: true,
            type: 'loop',
            source_server: 'agent-talent-researcher',
            next_tool: 'talent_role_next',
            next_params: { batch_id: params.batch_id },
            submit_tool: 'talent_role_submit',
            completion_field: 'complete',
            finalize_steps: [
              { tool: 'talent_batch_export', params: { batch_id: params.batch_id } },
            ],
          }),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// Cleanup on exit
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Talent Researcher Agent MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
