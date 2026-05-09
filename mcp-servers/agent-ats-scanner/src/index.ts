// @ts-nocheck — MCP SDK + Zod can trigger excessive TS inference in tool schemas.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { analyzeTalentBuild } from './analyzer.js';
import { getCompanyDeltas, getCompanyJobs } from './repository.js';
import { fetchJobAds, scanCompanyJobs } from './scanner.js';
import { hasServiceRoleKey } from './supabase.js';

if (!process.env.SUPABASE_URL || !hasServiceRoleKey()) {
  console.error([
    '',
    '════════════════════════════════════════════════════════════════',
    '  ATS SCANNER SUPABASE WRITE CREDENTIALS MISSING',
    '════════════════════════════════════════════════════════════════',
    '  agent-ats-scanner writes to Supabase ats_* tables.',
    '  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for production use.',
    '  It will try SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY as a fallback, but RLS will normally block writes.',
    '════════════════════════════════════════════════════════════════',
    '',
  ].join('\n'));
}

const ctxSchema = z.object({
  tenant_id: z.string().optional(),
  user_id: z.string().optional(),
}).optional();

const atsSystemSchema = z.enum([
  'greenhouse',
  'lever',
  'ashby',
  'smartrecruiters',
  'workable',
  'breezy',
  'recruitee',
  'unknown',
]);

const server = new McpServer({
  name: 'agent-ats-scanner',
  version: '1.0.0',
  description: 'Universal ATS Scanner — scans public company careers systems, persists jobs/adverts to Supabase, computes deltas, and analyzes competitor talent build.',
});

server.tool(
  'ats_scan_company_jobs',
  'Fetch the current public job list for a company from supported ATS feeds and persist the scan, postings, and deltas to Supabase. Phase 1 supports Group A systems: Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Breezy, and Recruitee.',
  {
    company_name: z.string().describe('Company name to scan, e.g. "Stripe" or "Anthropic"'),
    company_slug: z.string().optional().describe('ATS-specific slug if known, e.g. "stripe" for Greenhouse/Lever/Ashby'),
    ats_system: atsSystemSchema.optional().describe('ATS hint. If omitted, the scanner probes supported Group A systems.'),
    careers_url: z.string().optional().describe('Known careers URL or ATS board URL. Used to infer system and slug.'),
    include_descriptions: z.boolean().optional().describe('Persist descriptions included in list-feed responses. Defaults to false.'),
    search_terms: z.array(z.string()).optional().describe('Optional terms used to filter returned jobs. The scan still persists all jobs found.'),
    _ctx: ctxSchema,
  },
  async (params) => {
    try {
      const result = await scanCompanyJobs(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: (error as Error).message }, null, 2) }], isError: true };
    }
  },
);

server.tool(
  'ats_fetch_job_ads',
  'Fetch and persist full advert text for jobs already discovered by ats_scan_company_jobs. Uses descriptions already in ATS feeds when available, otherwise fetches the public job URL.',
  {
    company_name: z.string().describe('Company whose persisted jobs should be enriched'),
    query: z.string().optional().describe('Optional keyword/query filter, e.g. "AI machine learning"'),
    job_ids: z.array(z.string()).optional().describe('Optional persisted ats_job_postings IDs to fetch'),
    limit: z.number().optional().describe('Maximum adverts to fetch. Defaults to 25.'),
    force_refresh: z.boolean().optional().describe('Fetch public job URLs even when a persisted description already exists.'),
    _ctx: ctxSchema,
  },
  async (params) => {
    try {
      const result = await fetchJobAds(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: (error as Error).message }, null, 2) }], isError: true };
    }
  },
);

server.tool(
  'ats_get_company_jobs',
  'Read persisted company jobs from Supabase without fetching the web. Use this for fast follow-up questions after a scan has run.',
  {
    company_name: z.string().describe('Company name'),
    active_only: z.boolean().optional().describe('Only return currently active jobs. Defaults to true.'),
    query: z.string().optional().describe('Optional plain keyword filter'),
    limit: z.number().optional().describe('Max jobs to return. Defaults to 100.'),
    _ctx: ctxSchema,
  },
  async (params) => {
    try {
      const result = await getCompanyJobs(params);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            company: result.company,
            jobs_returned: result.jobs.length,
            jobs: result.jobs,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: (error as Error).message }, null, 2) }], isError: true };
    }
  },
);

server.tool(
  'ats_get_job_deltas',
  'Read persisted job changes for a company: new, closed, or changed jobs detected by previous scans.',
  {
    company_name: z.string().describe('Company name'),
    since: z.string().optional().describe('ISO timestamp lower bound for detected_at'),
    limit: z.number().optional().describe('Max deltas to return. Defaults to 100.'),
    _ctx: ctxSchema,
  },
  async (params) => {
    try {
      const result = await getCompanyDeltas(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: (error as Error).message }, null, 2) }], isError: true };
    }
  },
);

server.tool(
  'ats_analyze_talent_build',
  'Analyze what talent one or more companies appear to be building from first-party ATS data. Optionally refreshes scans first, then summarizes role mix, seniority, geography, departments, and skills.',
  {
    companies: z.array(z.string()).min(1).max(8).describe('Companies to compare'),
    query: z.string().optional().describe('Focus area, e.g. "AI strategy", "oncology data science", or "cybersecurity"'),
    refresh: z.boolean().optional().describe('Run a fresh ATS scan before analyzing. Defaults to true.'),
    fetch_descriptions: z.boolean().optional().describe('Fetch/persist relevant full adverts before analysis. Defaults to false.'),
    max_jobs_per_company: z.number().optional().describe('Maximum active jobs to analyze per company. Defaults to 200.'),
    _ctx: ctxSchema,
  },
  async (params) => {
    try {
      const result = await analyzeTalentBuild(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: (error as Error).message }, null, 2) }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
