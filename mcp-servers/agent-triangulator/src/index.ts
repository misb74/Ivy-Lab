import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Resolve monorepo root and set data directory env vars BEFORE importing DataFetcher
const __dirname = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = resolve(__dirname, '..', '..', '..');
if (!process.env.AEI_DATA_DIR) {
  process.env.AEI_DATA_DIR = resolve(MONOREPO_ROOT, 'data', 'cache', 'anthropic-econ-index');
}
if (!process.env.WORKBANK_DATA_DIR) {
  process.env.WORKBANK_DATA_DIR = resolve(MONOREPO_ROOT, 'data', 'cache', 'workbank');
}

// Import the triangulator's deterministic pipeline
import { DataFetcher } from '@auxia/triangulator-server/data-fetcher';
import { score } from '@auxia/triangulator-server/scorer';

const server = new McpServer({ name: 'ivy-agent-triangulator', version: '1.0.0' });

let fetcher: DataFetcher | null = null;

async function getFetcher(): Promise<DataFetcher> {
  if (!fetcher) {
    fetcher = new DataFetcher();
    await fetcher.init();
  }
  return fetcher;
}

// ── Tool: triangulate_functional_outlook ─────────────────────────────────────

server.tool(
  'triangulate_functional_outlook',
  'Generate a deterministically scored AI impact triangulation for a job function. ' +
  'Returns correctly scaled metrics from AEI, O*NET, BLS, WORKBank, and Felten data sources. ' +
  'Use this instead of manually constructing functional_outlook artifacts from raw data tools — ' +
  'it handles all scale normalization (AEI exposure, O*NET importance 0-100, WORKBank 1-7 Human Agency Scale, BLS unemployment). ' +
  'The returned JSON contains all fields for a functional_outlook artifact EXCEPT triangulation_summary and strategic_implications, ' +
  'which you should write yourself based on the scored data.',
  {
    function_name: z.string().describe('Name of the job function (e.g., "Human Resources", "Finance", "Software Engineering")'),
    occupation_codes: z.array(z.string()).describe('Array of O*NET SOC codes (e.g., ["11-3121.00", "13-1071.00"]). Use onet_search_occupations to find codes first.'),
  },
  async ({ function_name, occupation_codes }) => {
    try {
      const f = await getFetcher();
      const raw = await f.fetch(function_name, occupation_codes);
      const scored = score(raw);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(scored, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: (error as Error).message,
            hint: 'Ensure occupation codes are valid O*NET SOC codes (e.g., "11-3121.00")',
          }),
        }],
        isError: true,
      };
    }
  }
);

// ── Tool: triangulate_autocomplete ───────────────────────────────────────────

server.tool(
  'triangulate_autocomplete',
  'Search for O*NET occupation codes by keyword. Returns matching occupations with SOC codes. ' +
  'Use this to find the right occupation_codes before calling triangulate_functional_outlook.',
  {
    query: z.string().describe('Search keyword (e.g., "human resources", "software", "nurse")'),
  },
  async ({ query }) => {
    try {
      const f = await getFetcher();
      const onet = f.onet;
      if (!onet) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'O*NET client not available (ONET_API_KEY missing?)' }) }],
          isError: true,
        };
      }

      const results = await onet.searchOccupations(query, 20);
      const occupations = results.map((r: any) => ({
        code: r.code,
        title: r.title,
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify({ query, results: occupations }, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// ── Connect ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
