import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getDb, closeDb } from './db/database.js';
import { generatePlan } from './engine/planner.js';
import { createThreads, getNextThread, getThreads, updateThreadStatus } from './engine/thread-manager.js';
import { extractFindings, responseHash } from './engine/extractors.js';
import { analyzeGaps } from './engine/gap-detector.js';
import { synthesize } from './engine/synthesizer.js';
import { calculateProjectConfidence } from './engine/confidence.js';
import { buildInsightArtifact } from './engine/artifact-builder.js';
import { enrichProjectContext } from './engine/intent.js';
import type { Project, ProjectContext, Finding, Source, SynthesisResult } from './engine/types.js';

const server = new McpServer({
  name: 'agent-deep-research',
  version: '1.0.0',
  description: 'Deep Research Agent — structured multi-source research with SQLite persistence, question decomposition, parallel thread execution, finding extraction with provenance, gap detection, and synthesis with confidence scoring.',
});

// ── Tool: deep_research_create ──
server.tool(
  'deep_research_create',
  'Create a new deep research project from a question. Returns project ID and instructs you to call deep_research_plan next.',
  {
    question: z.string().describe('The research question to investigate'),
    name: z.string().optional().describe('Project name (defaults to first 50 chars of question)'),
    context: z.object({
      domain: z.string().optional().describe('Domain focus (e.g. "workforce planning", "HR technology")'),
      constraints: z.array(z.string()).optional().describe('Research constraints or boundaries'),
      prior_knowledge: z.array(z.string()).optional().describe('Known facts to build upon'),
      occupation_code: z.string().optional().describe('SOC/O*NET code if occupation-specific'),
      location: z.string().optional().describe('Geographic focus'),
      industry: z.string().optional().describe('Industry focus'),
      country: z.string().optional().describe('Country code (e.g. "us", "gb")'),
      companies: z.array(z.string()).optional().describe('Target companies for company-level research or ATS scanning'),
      include_hiring_data: z.boolean().optional().describe('Force-enable the company jobs/ATS lane'),
      skip_hiring_data: z.boolean().optional().describe('Force-disable the company jobs/ATS lane'),
      ats_query: z.string().optional().describe('Optional focus query for ATS jobs, e.g. "AI machine learning"'),
    }).optional().describe('Research context for better planning'),
  },
  async (params) => {
    try {
      const db = getDb();
      const now = new Date().toISOString();
      const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const name = params.name || params.question.slice(0, 50);
      const context = enrichProjectContext(params.question, params.context || {});
      const contextJson = JSON.stringify(context);

      db.prepare(`
        INSERT INTO projects (id, name, question, context_json, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'planning', ?, ?)
      `).run(id, name, params.question, contextJson, now, now);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: id,
            name,
            question: params.question,
            context,
            status: 'planning',
            next_step: 'Call deep_research_plan with this project_id to generate the research plan.',
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: deep_research_plan ──
server.tool(
  'deep_research_plan',
  'Generate a structured research plan: sub-questions, source groups, priorities. Creates threads in the database. Present the plan to the user for confirmation before proceeding.',
  {
    project_id: z.string().describe('Project ID from deep_research_create'),
  },
  async (params) => {
    try {
      const db = getDb();
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.project_id) as Project | undefined;
      if (!project) throw new Error(`Project "${params.project_id}" not found`);
      if (project.status !== 'planning') throw new Error(`Project status is "${project.status}", expected "planning"`);

      const context: ProjectContext = JSON.parse(project.context_json || '{}');
      const plan = generatePlan(project.question, context);

      // Create threads from plan
      const threads = createThreads(project.id, plan.sub_questions);

      // Store plan
      const now = new Date().toISOString();
      db.prepare('UPDATE projects SET plan_json = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(plan), now, project.id);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: project.id,
            plan,
            threads_created: threads.length,
            thread_summary: threads.map((t) => ({
              id: t.id,
              sub_question: t.sub_question,
              source_group: t.source_group,
              priority: t.priority,
            })),
            next_step: 'Present this plan to the user. Once confirmed, call deep_research_next to get the first thread\'s actions.',
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: deep_research_next ──
server.tool(
  'deep_research_next',
  'Get the next research thread\'s actions for Claude to execute. Returns tool names, servers, and pre-built params. Execute all actions in parallel, then call deep_research_submit.',
  {
    project_id: z.string().describe('Project ID'),
  },
  async (params) => {
    try {
      const db = getDb();
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.project_id) as Project | undefined;
      if (!project) throw new Error(`Project "${params.project_id}" not found`);

      const context: ProjectContext = JSON.parse(project.context_json || '{}');
      const threadActions = getNextThread(project.id, context);

      if (!threadActions) {
        // All threads done — check for synthesis
        const threads = getThreads(project.id);
        const completedCount = threads.filter((t) => t.status === 'complete').length;
        const failedCount = threads.filter((t) => t.status === 'failed').length;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              complete: true,
              project_id: project.id,
              threads_completed: completedCount,
              threads_failed: failedCount,
              total_threads: threads.length,
              next_step: 'All threads processed. Call deep_research_synthesize to generate the final report.',
            }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            complete: false,
            ...threadActions,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: deep_research_submit ──
server.tool(
  'deep_research_submit',
  'Submit tool results for a research thread. Extracts findings with provenance, detects gaps. If gaps remain, returns additional actions to execute.',
  {
    thread_id: z.string().describe('Thread ID from deep_research_next'),
    results: z.array(z.object({
      action_id: z.string().describe('Action ID from the thread actions'),
      tool_name: z.string().describe('Tool that was called'),
      server_name: z.string().describe('Server the tool belongs to'),
      data: z.any().describe('Raw result data'),
      success: z.boolean().describe('Whether the call succeeded'),
      error: z.string().optional().describe('Error message if failed'),
    })).describe('Results from executing thread actions'),
  },
  async (params) => {
    try {
      const db = getDb();
      const thread = db.prepare('SELECT * FROM threads WHERE id = ?').get(params.thread_id) as any;
      if (!thread) throw new Error(`Thread "${params.thread_id}" not found`);

      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(thread.project_id) as Project;
      const context: ProjectContext = JSON.parse(project.context_json || '{}');
      const now = new Date().toISOString();

      // Update thread to collecting
      updateThreadStatus(params.thread_id, 'collecting');

      // Extract findings from each result
      let totalFindings = 0;
      const insertFinding = db.prepare(`
        INSERT INTO findings (id, thread_id, project_id, finding_type, content, data_json, confidence, relevance, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertSource = db.prepare(`
        INSERT INTO sources (id, finding_id, tool_name, server_name, source_url, api_endpoint, raw_response_hash, retrieved_at, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction(() => {
        for (const result of params.results) {
          if (!result.success) continue;

          const extracted = extractFindings(result.tool_name, result.data);
          for (const ef of extracted) {
            const findingId = `f_${Date.now()}_${totalFindings}_${Math.random().toString(36).slice(2, 6)}`;
            insertFinding.run(
              findingId,
              params.thread_id,
              thread.project_id,
              ef.finding_type,
              ef.content,
              JSON.stringify(ef.data),
              ef.confidence,
              ef.relevance,
              now,
            );

            const sourceId = `s_${Date.now()}_${totalFindings}_${Math.random().toString(36).slice(2, 6)}`;
            insertSource.run(
              sourceId,
              findingId,
              ef.source_tool,
              ef.source_server,
              ef.source_url || null,
              result.tool_name,
              responseHash(result.data),
              now,
              '{}',
            );

            totalFindings++;
          }
        }
      });

      transaction();

      // Update thread findings count
      updateThreadStatus(params.thread_id, 'complete', totalFindings);

      // Update project completed count
      const completedCount = db.prepare(
        "SELECT COUNT(*) as count FROM threads WHERE project_id = ? AND status = 'complete'"
      ).get(thread.project_id) as { count: number };
      db.prepare('UPDATE projects SET completed_threads = ?, updated_at = ? WHERE id = ?')
        .run(completedCount.count, now, thread.project_id);

      // Gap analysis
      const gaps = analyzeGaps(params.thread_id, thread.sub_question, thread.source_group, context);

      const response: any = {
        thread_id: params.thread_id,
        findings_extracted: totalFindings,
        failed_sources: params.results.filter((r) => !r.success).length,
        gap_analysis: gaps,
      };

      if (gaps.adequately_answered) {
        response.next_step = 'Thread complete. Call deep_research_next for the next thread.';
      } else if (gaps.additional_actions && gaps.additional_actions.length > 0) {
        response.next_step = 'Gaps detected. Execute the additional_actions below, then call deep_research_submit again with the same thread_id.';
        response.additional_actions = gaps.additional_actions;
      } else {
        response.next_step = 'Thread has gaps but no automatic fill actions available. Call deep_research_next for the next thread.';
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: deep_research_synthesize ──
server.tool(
  'deep_research_synthesize',
  'Consolidate all findings into a synthesis report with evidence chains, confidence scores, gaps, and recommendations. Call after all threads are complete.',
  {
    project_id: z.string().describe('Project ID'),
  },
  async (params) => {
    try {
      const db = getDb();
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.project_id) as Project | undefined;
      if (!project) throw new Error(`Project "${params.project_id}" not found`);

      const now = new Date().toISOString();
      db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?')
        .run('synthesizing', now, project.id);

      const synthesis = synthesize(project.id);

      // Store synthesis and update status
      db.prepare('UPDATE projects SET synthesis_json = ?, status = ?, confidence_score = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(synthesis), 'complete', synthesis.confidence_assessment.overall, now, project.id);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: project.id,
            question: project.question,
            status: 'complete',
            synthesis,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: deep_research_status ──
server.tool(
  'deep_research_status',
  'Get project progress: thread statuses, finding counts, confidence score.',
  {
    project_id: z.string().describe('Project ID'),
  },
  async (params) => {
    try {
      const db = getDb();
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.project_id) as Project | undefined;
      if (!project) throw new Error(`Project "${params.project_id}" not found`);

      const threads = getThreads(project.id);
      const findingsCount = db.prepare(
        'SELECT COUNT(*) as count FROM findings WHERE project_id = ?'
      ).get(project.id) as { count: number };

      const confidence = calculateProjectConfidence(project.id);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: project.id,
            name: project.name,
            question: project.question,
            status: project.status,
            progress: {
              total_threads: threads.length,
              completed: threads.filter((t) => t.status === 'complete').length,
              in_progress: threads.filter((t) => t.status === 'dispatched' || t.status === 'collecting').length,
              pending: threads.filter((t) => t.status === 'pending').length,
              failed: threads.filter((t) => t.status === 'failed').length,
            },
            total_findings: findingsCount.count,
            confidence,
            threads: threads.map((t) => ({
              id: t.id,
              sub_question: t.sub_question,
              source_group: t.source_group,
              status: t.status,
              findings_count: t.findings_count,
            })),
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: deep_research_resume ──
server.tool(
  'deep_research_resume',
  'Resume an incomplete research project from a previous session. Returns current status and next actions.',
  {
    project_id: z.string().describe('Project ID to resume'),
  },
  async (params) => {
    try {
      const db = getDb();
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.project_id) as Project | undefined;
      if (!project) throw new Error(`Project "${params.project_id}" not found`);

      if (project.status === 'complete') {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              project_id: project.id,
              status: 'complete',
              message: 'This project is already complete. Use deep_research_query to search its findings.',
            }, null, 2),
          }],
        };
      }

      // Unpause if paused
      if (project.status === 'paused') {
        const now = new Date().toISOString();
        db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?')
          .run('researching', now, project.id);
      }

      // Reset any dispatched threads back to pending (they were interrupted)
      db.prepare("UPDATE threads SET status = 'pending' WHERE project_id = ? AND status = 'dispatched'")
        .run(project.id);

      const threads = getThreads(project.id);
      const pendingCount = threads.filter((t) => t.status === 'pending').length;
      const completedCount = threads.filter((t) => t.status === 'complete').length;

      let nextStep: string;
      if (project.status === 'planning' || !project.plan_json) {
        nextStep = 'Call deep_research_plan to generate the research plan.';
      } else if (pendingCount > 0) {
        nextStep = 'Call deep_research_next to continue with the next thread.';
      } else if (completedCount === threads.length) {
        nextStep = 'All threads complete. Call deep_research_synthesize to generate the report.';
      } else {
        nextStep = 'Call deep_research_next to continue.';
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: project.id,
            name: project.name,
            question: project.question,
            status: 'resumed',
            progress: {
              total_threads: threads.length,
              completed: completedCount,
              pending: pendingCount,
              failed: threads.filter((t) => t.status === 'failed').length,
            },
            next_step: nextStep,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: deep_research_list ──
server.tool(
  'deep_research_list',
  'List all research projects with summaries.',
  {},
  async () => {
    try {
      const db = getDb();
      const projects = db.prepare(
        'SELECT id, name, question, status, total_threads, completed_threads, confidence_score, created_at, updated_at FROM projects ORDER BY updated_at DESC'
      ).all() as Project[];

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            total_projects: projects.length,
            projects: projects.map((p) => ({
              id: p.id,
              name: p.name,
              question: p.question.slice(0, 100),
              status: p.status,
              threads: `${p.completed_threads}/${p.total_threads}`,
              confidence: p.confidence_score,
              created: p.created_at,
              updated: p.updated_at,
            })),
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: deep_research_query ──
server.tool(
  'deep_research_query',
  'Search across all findings (cross-project). Filter by type, confidence threshold, keyword, or project.',
  {
    keyword: z.string().optional().describe('Search keyword in finding content'),
    finding_type: z.enum(['fact', 'statistic', 'data_point', 'trend', 'quote', 'insight']).optional().describe('Filter by finding type'),
    min_confidence: z.number().min(0).max(1).optional().describe('Minimum confidence threshold (0-1)'),
    project_id: z.string().optional().describe('Limit to specific project'),
    limit: z.number().optional().describe('Max results (default 20)'),
  },
  async (params) => {
    try {
      const db = getDb();
      const conditions: string[] = [];
      const values: any[] = [];

      if (params.keyword) {
        conditions.push('f.content LIKE ?');
        values.push(`%${params.keyword}%`);
      }
      if (params.finding_type) {
        conditions.push('f.finding_type = ?');
        values.push(params.finding_type);
      }
      if (params.min_confidence != null) {
        conditions.push('f.confidence >= ?');
        values.push(params.min_confidence);
      }
      if (params.project_id) {
        conditions.push('f.project_id = ?');
        values.push(params.project_id);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = params.limit || 20;

      const findings = db.prepare(`
        SELECT f.*, p.name as project_name, p.question as project_question
        FROM findings f
        JOIN projects p ON p.id = f.project_id
        ${where}
        ORDER BY f.confidence DESC, f.created_at DESC
        LIMIT ?
      `).all(...values, limit) as any[];

      // Get sources for each finding
      const results = findings.map((f) => {
        const sources = db.prepare(
          'SELECT tool_name, server_name, source_url FROM sources WHERE finding_id = ?'
        ).all(f.id) as Array<{ tool_name: string; server_name: string; source_url: string | null }>;

        return {
          id: f.id,
          project: f.project_name,
          finding_type: f.finding_type,
          content: f.content,
          confidence: f.confidence,
          relevance: f.relevance,
          sources: sources.map((s) => `${s.server_name}/${s.tool_name}`),
          created_at: f.created_at,
        };
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            total_results: results.length,
            query: {
              keyword: params.keyword,
              finding_type: params.finding_type,
              min_confidence: params.min_confidence,
              project_id: params.project_id,
            },
            findings: results,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: deep_research_to_artifact ──
server.tool(
  'deep_research_to_artifact',
  'Convert a completed deep research project into an Ivy insight artifact card. Returns structured JSON ready for <artifact> wrapping.',
  {
    project_id: z.string().describe('Project ID of a completed research project'),
  },
  async (params) => {
    try {
      const db = getDb();
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.project_id) as Project | undefined;
      if (!project) throw new Error(`Project "${params.project_id}" not found`);
      if (project.status !== 'complete') throw new Error(`Project status is "${project.status}" — must be "complete" to generate artifact`);
      if (!project.synthesis_json) throw new Error('Project has no synthesis data. Run deep_research_synthesize first.');

      const synthesis: SynthesisResult = JSON.parse(project.synthesis_json);
      const artifact = buildInsightArtifact(project, synthesis);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(artifact, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: deep_research_auto_execute ──
server.tool(
  'deep_research_auto_execute',
  'Auto-execute all research threads for a planned project. The gateway execution engine handles all tool calls, thread cycling, finding submission, synthesis, and artifact generation autonomously. Returns when the full pipeline is complete. Use this after deep_research_plan and user confirmation.',
  {
    project_id: z.string().describe('Project ID with status "researching" (after plan was confirmed)'),
  },
  async (params) => {
    try {
      const db = getDb();
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.project_id) as Project | undefined;
      if (!project) throw new Error(`Project "${params.project_id}" not found`);
      if (project.status !== 'researching') throw new Error(`Project status is "${project.status}", expected "researching". Run deep_research_plan first.`);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            __ivy_execution_manifest: true,
            type: 'loop',
            source_server: 'agent-deep-research',
            next_tool: 'deep_research_next',
            next_params: { project_id: params.project_id },
            submit_tool: 'deep_research_submit',
            completion_field: 'complete',
            finalize_steps: [
              { tool: 'deep_research_synthesize', params: { project_id: params.project_id } },
              { tool: 'deep_research_to_artifact', params: { project_id: params.project_id } },
            ],
          }),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Cleanup ──
process.on('SIGINT', () => { closeDb(); process.exit(0); });
process.on('SIGTERM', () => { closeDb(); process.exit(0); });

// ── Start server ──
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('agent-deep-research running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
