import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import crypto from 'crypto';
import { getDb } from './db/database.js';
import { seedIfEmpty } from './seed.js';

const server = new McpServer({
  name: 'ivy-data-research-index',
  version: '1.0.0',
  description: 'Curated academic and institutional research findings with full-text search',
});

function genId(): string { return crypto.randomUUID().slice(0, 12); }

let initialized = false;
function init() {
  if (!initialized) {
    getDb();
    seedIfEmpty();
    initialized = true;
  }
}

// ── Tool 1: Search ──
server.tool(
  'research_index_search',
  'Search the curated research findings index. Supports full-text search across academic and institutional research on AI workforce impact, labor market trends, skills, and displacement. Returns findings with source attribution and confidence scores.',
  {
    query: z.string().describe('Full-text search query (e.g., "AI displacement entry level", "wage growth remote work")'),
    institution: z.string().optional().describe('Filter by institution ID (e.g., "hbs", "stanford_del", "cepr")'),
    finding_type: z.enum(['statistic', 'trend', 'projection', 'methodology', 'framework']).optional().describe('Filter by finding type'),
    geography: z.string().optional().describe('Filter by geography (e.g., "US", "Europe", "Global")'),
    sector: z.string().optional().describe('Filter by sector'),
    date_from: z.string().optional().describe('Publication date from (YYYY-MM-DD)'),
    date_to: z.string().optional().describe('Publication date to (YYYY-MM-DD)'),
    limit: z.number().optional().default(20).describe('Max results (default 20)'),
  },
  async (params) => {
    try {
      init();
      const db = getDb();

      let sql: string;
      const conditions: string[] = [];
      const binds: unknown[] = [];

      if (params.query) {
        sql = `
          SELECT f.id, f.finding_type, f.content, f.data_value, f.data_unit,
                 f.geography, f.sector, f.time_period, f.confidence, f.tags_json,
                 p.title as publication_title, p.authors, p.published_date, p.url as publication_url,
                 i.name as institution_name, i.type as institution_type,
                 rank
          FROM findings_fts fts
          JOIN findings f ON f.rowid = fts.rowid
          JOIN publications p ON f.publication_id = p.id
          JOIN institutions i ON p.institution_id = i.id
          WHERE findings_fts MATCH ?
        `;
        binds.push(params.query);
      } else {
        sql = `
          SELECT f.id, f.finding_type, f.content, f.data_value, f.data_unit,
                 f.geography, f.sector, f.time_period, f.confidence, f.tags_json,
                 p.title as publication_title, p.authors, p.published_date, p.url as publication_url,
                 i.name as institution_name, i.type as institution_type
          FROM findings f
          JOIN publications p ON f.publication_id = p.id
          JOIN institutions i ON p.institution_id = i.id
        `;
      }

      if (params.institution) {
        conditions.push('i.id = ?');
        binds.push(params.institution);
      }
      if (params.finding_type) {
        conditions.push('f.finding_type = ?');
        binds.push(params.finding_type);
      }
      if (params.geography) {
        conditions.push('f.geography LIKE ?');
        binds.push(`%${params.geography}%`);
      }
      if (params.sector) {
        conditions.push('f.sector LIKE ?');
        binds.push(`%${params.sector}%`);
      }
      if (params.date_from) {
        conditions.push('p.published_date >= ?');
        binds.push(params.date_from);
      }
      if (params.date_to) {
        conditions.push('p.published_date <= ?');
        binds.push(params.date_to);
      }

      if (conditions.length > 0) {
        sql += (params.query ? ' AND ' : ' WHERE ') + conditions.join(' AND ');
      }

      sql += params.query ? ' ORDER BY rank LIMIT ?' : ' ORDER BY f.confidence DESC, p.published_date DESC LIMIT ?';
      binds.push(params.limit || 20);

      const rows = db.prepare(sql).all(...binds);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            results: rows,
            count: rows.length,
            query: params.query || null,
            filters: {
              institution: params.institution || null,
              finding_type: params.finding_type || null,
              geography: params.geography || null,
              sector: params.sector || null,
            },
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool 2: Ingest ──
server.tool(
  'research_index_ingest',
  'Add a new research finding to the index. Creates institution and publication records if they do not exist. Used for manual curation and auto-enrichment from deep research pipeline.',
  {
    institution_name: z.string().describe('Name of the institution'),
    institution_type: z.enum(['university', 'think_tank', 'consultancy', 'government', 'ngo', 'corporate']).optional().default('university'),
    institution_url: z.string().optional(),
    publication_title: z.string().describe('Title of the publication'),
    publication_url: z.string().optional(),
    published_date: z.string().optional().describe('Publication date (YYYY-MM-DD)'),
    publication_type: z.enum(['paper', 'report', 'survey', 'index', 'dataset', 'blog']).optional().default('paper'),
    finding_type: z.enum(['statistic', 'trend', 'projection', 'methodology', 'framework']).describe('Type of finding'),
    content: z.string().describe('The finding text'),
    data_value: z.number().optional().describe('Numeric value if applicable'),
    data_unit: z.string().optional().describe('Unit (e.g., "percent", "jobs", "multiplier")'),
    geography: z.string().optional(),
    sector: z.string().optional(),
    time_period: z.string().optional(),
    confidence: z.number().optional().default(0.7).describe('Confidence score 0-1'),
    tags: z.array(z.string()).optional().default([]),
    deep_research_project_id: z.string().optional().describe('If auto-enriched, the source project ID'),
  },
  async (params) => {
    try {
      init();
      const db = getDb();
      const now = new Date().toISOString();

      const instId = params.institution_name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
      db.prepare('INSERT OR IGNORE INTO institutions (id, name, type, url) VALUES (?, ?, ?, ?)').run(
        instId, params.institution_name, params.institution_type, params.institution_url || null
      );

      const pubId = genId();
      const existingPub = db.prepare('SELECT id FROM publications WHERE title = ? AND institution_id = ?').get(params.publication_title, instId) as { id: string } | undefined;
      const finalPubId = existingPub?.id || pubId;
      if (!existingPub) {
        db.prepare('INSERT INTO publications (id, institution_id, title, published_date, url, publication_type) VALUES (?, ?, ?, ?, ?, ?)').run(
          finalPubId, instId, params.publication_title, params.published_date || null, params.publication_url || null, params.publication_type
        );
      }

      const findingId = genId();
      db.prepare(`INSERT INTO findings (id, publication_id, finding_type, content, data_value, data_unit, geography, sector, time_period, confidence, tags_json, auto_enriched, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        findingId, finalPubId, params.finding_type, params.content,
        params.data_value ?? null, params.data_unit || null,
        params.geography || null, params.sector || null, params.time_period || null,
        params.confidence, JSON.stringify(params.tags), params.deep_research_project_id ? 1 : 0,
        now, now
      );

      if (params.deep_research_project_id) {
        db.prepare('INSERT INTO finding_sources (id, finding_id, deep_research_project_id, retrieved_at) VALUES (?, ?, ?, ?)').run(
          genId(), findingId, params.deep_research_project_id, now
        );
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            finding_id: findingId,
            institution_id: instId,
            publication_id: finalPubId,
            auto_enriched: !!params.deep_research_project_id,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool 3: Institutions ──
server.tool(
  'research_index_institutions',
  'List all tracked research institutions with finding counts.',
  {
    type: z.enum(['university', 'think_tank', 'consultancy', 'government', 'ngo', 'corporate']).optional().describe('Filter by institution type'),
  },
  async (params) => {
    try {
      init();
      const db = getDb();

      let sql = `
        SELECT i.id, i.name, i.type, i.url, i.domain_pattern,
               COUNT(DISTINCT p.id) as publication_count,
               COUNT(DISTINCT f.id) as finding_count,
               MAX(p.published_date) as latest_publication
        FROM institutions i
        LEFT JOIN publications p ON p.institution_id = i.id
        LEFT JOIN findings f ON f.publication_id = p.id
      `;
      const binds: unknown[] = [];
      if (params.type) {
        sql += ' WHERE i.type = ?';
        binds.push(params.type);
      }
      sql += ' GROUP BY i.id ORDER BY finding_count DESC';

      const rows = db.prepare(sql).all(...binds);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ institutions: rows, count: rows.length }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool 4: Stats ──
server.tool(
  'research_index_stats',
  'Get research index health: total findings, breakdowns by type/institution, auto-enrichment stats, and coverage gaps.',
  {},
  async () => {
    try {
      init();
      const db = getDb();

      const totalFindings = (db.prepare('SELECT COUNT(*) as c FROM findings').get() as { c: number }).c;
      const autoEnriched = (db.prepare('SELECT COUNT(*) as c FROM findings WHERE auto_enriched = 1').get() as { c: number }).c;
      const totalInstitutions = (db.prepare('SELECT COUNT(*) as c FROM institutions').get() as { c: number }).c;
      const totalPublications = (db.prepare('SELECT COUNT(*) as c FROM publications').get() as { c: number }).c;

      const byType = db.prepare('SELECT finding_type, COUNT(*) as count FROM findings GROUP BY finding_type ORDER BY count DESC').all();
      const byInstitution = db.prepare(`
        SELECT i.name, COUNT(f.id) as finding_count, MAX(p.published_date) as latest
        FROM institutions i
        LEFT JOIN publications p ON p.institution_id = i.id
        LEFT JOIN findings f ON f.publication_id = p.id
        GROUP BY i.id ORDER BY finding_count DESC
      `).all();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total_findings: totalFindings,
            auto_enriched: autoEnriched,
            manual_curated: totalFindings - autoEnriched,
            total_institutions: totalInstitutions,
            total_publications: totalPublications,
            by_type: byType,
            by_institution: byInstitution,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Start server ──
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[research-index] MCP server running on stdio');
