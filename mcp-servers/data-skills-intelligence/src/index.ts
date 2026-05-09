import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';
import { getDb, seed, isSeeded, type SkillRow } from './database.js';

const server = new McpServer({
  name: 'data-skills-intelligence',
  version: '1.0.0',
  description: 'Query 249 community AI agent skills — search, detail, and task-matching across 19 categories.',
});

// Auto-seed on first run if DB is empty
function ensureSeeded(): void {
  if (isSeeded()) return;
  const jsonPath = '/Users/moraybrown/Desktop/Skills_Master/skills_data.json';
  if (!fs.existsSync(jsonPath)) return;
  const data: SkillRow[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  seed(data);
}

// ── Tool 1: skills_search ──
server.tool(
  'skills_search',
  'Search the 249-skill AI agent ecosystem by keyword, category, or both. Returns skill names, categories, repos, and URLs (not full content). Use skills_detail to get full content for a specific skill.',
  {
    query: z.string().optional().describe('Search keywords (FTS5 — supports AND, OR, phrases). Leave empty to list by category.'),
    category: z.string().optional().describe('Filter by category (e.g. "development", "ml-data-science", "productivity")'),
    limit: z.number().optional().describe('Max results (default 20)'),
  },
  async ({ query, category, limit }) => {
    try {
      ensureSeeded();
      const db = getDb();
      const maxResults = limit ?? 20;
      let results: any[];

      if (query) {
        // FTS5 search with optional category filter
        const ftsQuery = query.replace(/[^\w\s"*-]/g, '').trim();
        if (category) {
          results = db.prepare(`
            SELECT s.id, s.name, s.category, s.repo, s.url, s.chars,
                   MIN(rank) AS relevance
            FROM skills_fts fts
            JOIN skills s ON s.id = fts.rowid
            WHERE skills_fts MATCH @query AND s.category = @category
            GROUP BY s.id
            ORDER BY relevance
            LIMIT @limit
          `).all({ query: ftsQuery, category, limit: maxResults });
        } else {
          results = db.prepare(`
            SELECT s.id, s.name, s.category, s.repo, s.url, s.chars,
                   MIN(rank) AS relevance
            FROM skills_fts fts
            JOIN skills s ON s.id = fts.rowid
            WHERE skills_fts MATCH @query
            GROUP BY s.id
            ORDER BY relevance
            LIMIT @limit
          `).all({ query: ftsQuery, limit: maxResults });
        }
      } else if (category) {
        results = db.prepare(`
          SELECT id, name, category, repo, url, chars
          FROM skills WHERE category = @category
          ORDER BY name LIMIT @limit
        `).all({ category, limit: maxResults });
      } else {
        // No query, no category — return taxonomy summary
        const cats = db.prepare(`
          SELECT category, COUNT(*) as count
          FROM skills GROUP BY category ORDER BY count DESC
        `).all();
        const total = db.prepare('SELECT COUNT(*) as c FROM skills').get() as { c: number };
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              total_skills: total.c,
              categories: cats,
              hint: 'Use query param to search, or category param to filter.',
            }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count: results.length, results }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// ── Tool 2: skills_detail ──
server.tool(
  'skills_detail',
  'Get the full content of a specific skill by name or ID. Returns the complete documentation including install instructions, code examples, and "when to use" guidance.',
  {
    name: z.string().optional().describe('Skill name (e.g. "statistical-analysis", "brainstorming")'),
    id: z.number().optional().describe('Skill ID'),
  },
  async ({ name, id }) => {
    try {
      ensureSeeded();
      const db = getDb();
      let skill: SkillRow | undefined;

      if (id) {
        skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as SkillRow | undefined;
      } else if (name) {
        skill = db.prepare('SELECT * FROM skills WHERE name = ? COLLATE NOCASE').get(name) as SkillRow | undefined;
        if (!skill) {
          // Fuzzy fallback: LIKE match
          skill = db.prepare('SELECT * FROM skills WHERE name LIKE ? COLLATE NOCASE LIMIT 1').get(`%${name}%`) as SkillRow | undefined;
        }
      }

      if (!skill) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Skill not found: ${name || id}` }) }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: skill.id,
            name: skill.name,
            category: skill.category,
            repo: skill.repo,
            url: skill.url,
            chars: skill.chars,
            content: skill.content,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// ── Tool 3: skills_for_task ──
server.tool(
  'skills_for_task',
  'Find AI agent skills that can automate a given task statement. The key bridge between automation assessment and real agent capabilities. Returns matching skills ranked by relevance, with summaries extracted from their content.',
  {
    task: z.string().describe('Task statement to match (e.g. "schedule candidate interviews", "generate PDF reports from data", "analyze meeting transcripts")'),
    limit: z.number().optional().describe('Max results (default 10)'),
  },
  async ({ task, limit }) => {
    try {
      ensureSeeded();
      const db = getDb();
      const maxResults = limit ?? 10;

      // Build FTS query from task statement — extract meaningful terms
      const stopwords = new Set(['a','an','the','and','or','to','of','in','for','on','with','from','by','is','are','was','were','be','been','being','that','this','it','at','as','do','does','did','has','have','had','will','would','can','could','should','may','might']);
      const terms = task
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(t => t.length > 2 && !stopwords.has(t));

      if (terms.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Task statement too vague — provide more specific terms.' }) }],
          isError: true,
        };
      }

      // Use OR for broad matching
      const ftsQuery = terms.join(' OR ');

      const results = db.prepare(`
        SELECT s.id, s.name, s.category, s.repo, s.url, s.chars,
               MIN(rank) AS relevance
        FROM skills_fts fts
        JOIN skills s ON s.id = fts.rowid
        WHERE skills_fts MATCH @query
        GROUP BY s.name
        ORDER BY relevance
        LIMIT @limit
      `).all({ query: ftsQuery, limit: maxResults }) as (SkillRow & { relevance: number })[];

      // Extract description from content frontmatter for each match
      const enriched = results.map(r => {
        const content = db.prepare('SELECT content FROM skills WHERE id = ?').get(r.id) as { content: string };
        let description = '';
        const descMatch = content.content.match(/description:\s*(.+?)(?:\n|$)/);
        if (descMatch) description = descMatch[1].trim();

        return {
          name: r.name,
          category: r.category,
          repo: r.repo,
          url: r.url,
          description,
          relevance_rank: r.relevance,
        };
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            task,
            matches: enriched.length,
            skills: enriched,
            gap: enriched.length === 0
              ? 'No existing agent skills match this task — potential opportunity gap for Ivy.'
              : undefined,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
