import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getDb } from './db/database.js';
import { ensureFresh } from './sync/sync-engine.js';

const server = new McpServer({
  name: 'ivy-data-labor-market',
  version: '1.0.0',
  description: 'Labor market datasets from Indeed Hiring Lab and academic sources with staleness-aware caching',
});

// ── Tool 1: Job Postings ──
server.tool(
  'labor_market_job_postings',
  'Query Indeed Hiring Lab job posting index trends. Returns time series of seasonally-adjusted job posting volumes normalized to Feb 2020 = 100. Covers 11 countries, 564 US metros, 38 sectors. Updated weekly.',
  {
    country: z.string().describe('ISO country code (US, GB, CA, AU, DE, FR, IE, IT, NL, ES)'),
    sector: z.string().optional().describe('Sector filter (e.g., "Software Development", "Nursing", "Finance")'),
    metro: z.string().optional().describe('Metro area name or CBSA code (US only)'),
    date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
    posting_type: z.enum(['total', 'new']).optional().default('total').describe('Total postings or new postings (on Indeed < 7 days)'),
  },
  async (params) => {
    try {
      await ensureFresh('job_postings');
      const db = getDb();

      let sql = 'SELECT date, country_code, sector, metro, index_sa, index_nsa, posting_type FROM job_postings WHERE country_code = ?';
      const binds: unknown[] = [params.country.toUpperCase()];

      if (params.sector) {
        sql += ' AND sector LIKE ?';
        binds.push(`%${params.sector}%`);
      }
      if (params.metro) {
        sql += ' AND (metro LIKE ? OR metro_code = ?)';
        binds.push(`%${params.metro}%`, params.metro);
      }
      if (params.date_from) {
        sql += ' AND date >= ?';
        binds.push(params.date_from);
      }
      if (params.date_to) {
        sql += ' AND date <= ?';
        binds.push(params.date_to);
      }
      if (params.posting_type) {
        sql += ' AND (posting_type = ? OR posting_type IS NULL)';
        binds.push(params.posting_type);
      }

      sql += ' ORDER BY date DESC LIMIT 500';
      const rows = db.prepare(sql).all(...binds);

      const meta = db.prepare('SELECT last_synced, row_count FROM data_sources WHERE source_name LIKE ?').get('indeed_job_postings%') as any;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            data: rows,
            metadata: {
              count: rows.length,
              country: params.country.toUpperCase(),
              sector: params.sector || null,
              last_synced: meta?.last_synced || null,
              source: 'Indeed Hiring Lab (CC BY 4.0)',
              note: 'Index normalized to Feb 1, 2020 = 100',
            },
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool 2: Wages ──
server.tool(
  'labor_market_wages',
  'Query Indeed Hiring Lab posted wage growth data. Returns year-over-year wage growth trends from job posting salaries. Covers 11 countries, 20 sectors. Updated monthly.',
  {
    country: z.string().describe('ISO country code (US, CA, GB, FR, DE, IE, IT, NL, ES, JP)'),
    sector: z.string().optional().describe('Sector filter (e.g., "Nursing", "Construction", "Retail")'),
    date_from: z.string().optional().describe('Start month (e.g., "Jan-23" or "2023-01")'),
    date_to: z.string().optional().describe('End month'),
  },
  async (params) => {
    try {
      await ensureFresh('wage_growth');
      const db = getDb();

      let sql = 'SELECT month, country_code, country, sector, sample_size, yoy_growth, yoy_3mo_avg FROM wage_growth WHERE country_code = ?';
      const binds: unknown[] = [params.country.toUpperCase()];

      if (params.sector) { sql += ' AND sector LIKE ?'; binds.push(`%${params.sector}%`); }
      if (params.date_from) { sql += ' AND month >= ?'; binds.push(params.date_from); }
      if (params.date_to) { sql += ' AND month <= ?'; binds.push(params.date_to); }

      sql += ' ORDER BY month DESC LIMIT 200';
      const rows = db.prepare(sql).all(...binds);

      const meta = db.prepare('SELECT last_synced FROM data_sources WHERE source_name = ?').get('indeed_wages') as any;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            data: rows,
            metadata: {
              count: rows.length,
              country: params.country.toUpperCase(),
              sector: params.sector || null,
              last_synced: meta?.last_synced || null,
              source: 'Indeed Hiring Lab Wage Tracker (CC BY 4.0)',
            },
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool 3: AI Demand ──
server.tool(
  'labor_market_ai_demand',
  'Query Indeed Hiring Lab AI job posting share. Returns daily share of job postings mentioning AI/GenAI terms as a percentage of all postings. Covers 9 countries. Updated monthly.',
  {
    country: z.string().describe('ISO country code (AU, CA, DE, FR, GB, IE, IT, NL, US)'),
    date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
  },
  async (params) => {
    try {
      await ensureFresh('ai_postings');
      const db = getDb();

      let sql = 'SELECT date, country_code, ai_share_pct FROM ai_postings WHERE country_code = ?';
      const binds: unknown[] = [params.country.toUpperCase()];

      if (params.date_from) { sql += ' AND date >= ?'; binds.push(params.date_from); }
      if (params.date_to) { sql += ' AND date <= ?'; binds.push(params.date_to); }

      sql += ' ORDER BY date DESC LIMIT 500';
      const rows = db.prepare(sql).all(...binds);

      const meta = db.prepare('SELECT last_synced FROM data_sources WHERE source_name = ?').get('indeed_ai') as any;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            data: rows,
            metadata: { count: rows.length, country: params.country.toUpperCase(), last_synced: meta?.last_synced || null, source: 'Indeed Hiring Lab AI Tracker (CC BY 4.0)' },
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool 4: Remote Work ──
server.tool(
  'labor_market_remote',
  'Query Indeed Hiring Lab remote/hybrid work trends. Returns share of remote job postings and optionally remote job searches. Covers 7-8 countries, ~47 sectors. Updated monthly.',
  {
    country: z.string().describe('ISO country code (AU, CA, DE, FR, GB, IE, US)'),
    sector: z.string().optional().describe('Sector code filter (e.g., "techsoftware", "finance", "hr")'),
    date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
    include_searches: z.boolean().optional().default(false).describe('Also return remote job search share data'),
  },
  async (params) => {
    try {
      await ensureFresh('remote_postings');
      const db = getDb();

      let sql = 'SELECT date, country_code, sector, remote_share_postings FROM remote_postings WHERE country_code = ?';
      const binds: unknown[] = [params.country.toUpperCase()];

      if (params.sector) { sql += ' AND sector LIKE ?'; binds.push(`%${params.sector}%`); }
      if (params.date_from) { sql += ' AND date >= ?'; binds.push(params.date_from); }
      if (params.date_to) { sql += ' AND date <= ?'; binds.push(params.date_to); }

      sql += ' ORDER BY date DESC LIMIT 500';
      const postings = db.prepare(sql).all(...binds);

      let searches: unknown[] = [];
      if (params.include_searches) {
        await ensureFresh('remote_searches');
        let searchSql = 'SELECT date, country_code, remote_share_searches FROM remote_searches WHERE country_code = ?';
        const searchBinds: unknown[] = [params.country.toUpperCase()];
        if (params.date_from) { searchSql += ' AND date >= ?'; searchBinds.push(params.date_from); }
        if (params.date_to) { searchSql += ' AND date <= ?'; searchBinds.push(params.date_to); }
        searchSql += ' ORDER BY date DESC LIMIT 500';
        searches = db.prepare(searchSql).all(...searchBinds);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            postings: { data: postings, count: postings.length },
            searches: params.include_searches ? { data: searches, count: searches.length } : null,
            metadata: { country: params.country.toUpperCase(), sector: params.sector || null, source: 'Indeed Hiring Lab Remote Tracker (CC BY 4.0)' },
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool 5: Pay Transparency ──
server.tool(
  'labor_market_pay_transparency',
  'Query Indeed Hiring Lab pay transparency data. Returns share of job postings with explicit salary/wage info. Covers 8 countries, 38+ sectors. Updated monthly.',
  {
    country: z.string().describe('ISO country code (AU, CA, DE, FR, GB, IE, JP, US)'),
    sector: z.string().optional().describe('Sector filter'),
    date_from: z.string().optional().describe('Start date (YYYY-MM)'),
    date_to: z.string().optional().describe('End date (YYYY-MM)'),
  },
  async (params) => {
    try {
      await ensureFresh('pay_transparency');
      const db = getDb();

      let sql = 'SELECT date, country_code, country, sector, transparency_pct, transparency_3mo_avg FROM pay_transparency WHERE country_code = ?';
      const binds: unknown[] = [params.country.toUpperCase()];

      if (params.sector) { sql += ' AND sector LIKE ?'; binds.push(`%${params.sector}%`); }
      if (params.date_from) { sql += ' AND date >= ?'; binds.push(params.date_from); }
      if (params.date_to) { sql += ' AND date <= ?'; binds.push(params.date_to); }

      sql += ' ORDER BY date DESC LIMIT 200';
      const rows = db.prepare(sql).all(...binds);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            data: rows,
            metadata: { count: rows.length, country: params.country.toUpperCase(), source: 'Indeed Hiring Lab Pay Transparency Tracker (CC BY 4.0)' },
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool 6: Academic Data ──
server.tool(
  'labor_market_academic',
  'Query academic labor market datasets: Tufts Digital Planet Lab geographic AI risk scores, or Stanford DEL employment indices for AI-exposed age cohorts.',
  {
    dataset: z.enum(['geographic_risk', 'employment_indices']).describe('Which academic dataset to query'),
    region: z.string().optional().describe('Region or state filter (geographic_risk)'),
    metro: z.string().optional().describe('Metro area filter (geographic_risk)'),
    age_cohort: z.string().optional().describe('Age cohort filter (employment_indices, e.g., "22-25")'),
    occupation_group: z.string().optional().describe('Occupation group filter (employment_indices)'),
  },
  async (params) => {
    try {
      const db = getDb();

      if (params.dataset === 'geographic_risk') {
        let sql = 'SELECT region, metro, state, risk_score, jobs_at_risk, income_exposure, source, data_year FROM geographic_risk WHERE 1=1';
        const binds: unknown[] = [];

        if (params.region) { sql += ' AND (region LIKE ? OR state LIKE ?)'; binds.push(`%${params.region}%`, `%${params.region}%`); }
        if (params.metro) { sql += ' AND metro LIKE ?'; binds.push(`%${params.metro}%`); }

        sql += ' ORDER BY risk_score DESC LIMIT 100';
        const rows = db.prepare(sql).all(...binds);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              data: rows,
              metadata: { count: rows.length, dataset: 'geographic_risk', source: 'Tufts Digital Planet Lab' },
            }, null, 2),
          }],
        };
      } else {
        let sql = 'SELECT date, age_cohort, occupation_group, ai_exposure_level, relative_employment_change, source, data_year FROM employment_indices WHERE 1=1';
        const binds: unknown[] = [];

        if (params.age_cohort) { sql += ' AND age_cohort LIKE ?'; binds.push(`%${params.age_cohort}%`); }
        if (params.occupation_group) { sql += ' AND occupation_group LIKE ?'; binds.push(`%${params.occupation_group}%`); }

        sql += ' ORDER BY date DESC LIMIT 100';
        const rows = db.prepare(sql).all(...binds);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              data: rows,
              metadata: { count: rows.length, dataset: 'employment_indices', source: 'Stanford Digital Economy Lab' },
            }, null, 2),
          }],
        };
      }
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Start server ──
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[labor-market] MCP server running on stdio');
