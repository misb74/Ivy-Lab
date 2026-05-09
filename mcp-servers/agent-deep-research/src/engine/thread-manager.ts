import { getDb } from '../db/database.js';
import type { Thread, ThreadActions, ThreadAction, SubQuestion, ProjectContext } from './types.js';
import { inferCompaniesFromQuestion } from './intent.js';

// Re-use source group definitions from multi-search conceptually
// We build actions inline based on the source_group and sub_question

/** Tool definitions per source group — mirrors agent-multi-search but generates actions locally */
const SOURCE_GROUP_TOOLS: Record<string, Array<{
  tool_name: string;
  server_name: string;
  param_builder: (question: string, ctx: ProjectContext) => Record<string, unknown>;
}>> = {
  skills_occupation: [
    {
      tool_name: 'lightcast_search_skills',
      server_name: 'data-lightcast',
      param_builder: (q) => ({ query: q, limit: 20 }),
    },
    {
      tool_name: 'lightcast_trending_skills',
      server_name: 'data-lightcast',
      param_builder: (q, ctx) => ({
        occupation_code: ctx.occupation_code,
        location: ctx.location,
        limit: 20,
      }),
    },
    {
      tool_name: 'onet_search_occupations',
      server_name: 'data-onet',
      param_builder: (q) => ({ keyword: q, limit: 10 }),
    },
    {
      tool_name: 'esco_search_occupations',
      server_name: 'data-esco',
      param_builder: (q) => ({ query: q, limit: 10 }),
    },
  ],
  labor_trends: [
    {
      tool_name: 'bls_employment_trend',
      server_name: 'data-bls',
      param_builder: (q, ctx) => ({
        occupation_code: ctx.occupation_code || q,
        location: ctx.location,
        years: 5,
      }),
    },
    {
      tool_name: 'indeed_job_postings_trend',
      server_name: 'data-indeed',
      param_builder: (q, ctx) => ({
        country: ctx.country || 'US',
        sector: q,
        months: 24,
      }),
    },
    {
      tool_name: 'fred_labor_dashboard',
      server_name: 'data-fred',
      param_builder: () => ({}),
    },
    {
      tool_name: 'revelio_hiring_trends',
      server_name: 'data-revelio',
      param_builder: () => ({ months: 12 }),
    },
  ],
  all_workforce: [
    {
      tool_name: 'lightcast_search_skills',
      server_name: 'data-lightcast',
      param_builder: (q) => ({ query: q, limit: 15 }),
    },
    {
      tool_name: 'onet_search_occupations',
      server_name: 'data-onet',
      param_builder: (q) => ({ keyword: q, limit: 10 }),
    },
    {
      tool_name: 'bls_occupation_wages',
      server_name: 'data-bls',
      param_builder: (q, ctx) => ({
        occupation_code: ctx.occupation_code || q,
        location: ctx.location,
      }),
    },
    {
      tool_name: 'adzuna_search_jobs',
      server_name: 'data-adzuna',
      param_builder: (q, ctx) => ({
        company: q,
        location: ctx.location,
        country: ctx.country || 'gb',
        max_results: 15,
      }),
    },
  ],
  web: [
    {
      tool_name: 'quick_research',
      server_name: 'agent-research',
      param_builder: (q) => ({ query: q }),
    },
    {
      tool_name: 'scholarly_search',
      server_name: 'agent-research',
      param_builder: (q) => ({ query: q, num_results: 10 }),
    },
  ],
  job_market: [
    {
      tool_name: 'adzuna_search_jobs',
      server_name: 'data-adzuna',
      param_builder: (q, ctx) => ({
        company: q,
        location: ctx.location,
        country: ctx.country || 'gb',
        max_results: 20,
      }),
    },
    {
      tool_name: 'indeed_job_postings_trend',
      server_name: 'data-indeed',
      param_builder: (q, ctx) => ({
        country: ctx.country || 'US',
        sector: q,
        months: 24,
      }),
    },
    {
      tool_name: 'lightcast_demand_forecast',
      server_name: 'data-lightcast',
      param_builder: (q, ctx) => ({
        occupation_code: ctx.occupation_code || q,
        location: ctx.location,
      }),
    },
  ],
  wages: [
    {
      tool_name: 'bls_occupation_wages',
      server_name: 'data-bls',
      param_builder: (q, ctx) => ({
        occupation_code: ctx.occupation_code || q,
        location: ctx.location,
      }),
    },
    {
      tool_name: 'adzuna_salary_data',
      server_name: 'data-adzuna',
      param_builder: (q, ctx) => ({
        company: q,
        role: ctx.occupation_code,
        country: ctx.country || 'us',
      }),
    },
    {
      tool_name: 'indeed_wage_tracker',
      server_name: 'data-indeed',
      param_builder: (q) => ({ sector: q, months: 12 }),
    },
  ],
  ai_impact: [
    {
      tool_name: 'aei_job_exposure',
      server_name: 'data-anthropic-econ-index',
      param_builder: (q, ctx) => ({
        occupation_code: ctx.occupation_code,
        query: ctx.occupation_code ? undefined : q,
        limit: 10,
      }),
    },
    {
      tool_name: 'aioe_occupation_exposure',
      server_name: 'data-felten-aioe',
      param_builder: (q, ctx) => ({
        occupation_code: ctx.occupation_code,
        query: ctx.occupation_code ? undefined : q,
      }),
    },
    {
      tool_name: 'workbank_occupation_automation',
      server_name: 'data-workbank',
      param_builder: (q, ctx) => ({
        occupation_code: ctx.occupation_code || q,
      }),
    },
  ],
  company_jobs: [
    {
      tool_name: 'ats_analyze_talent_build',
      server_name: 'agent-ats-scanner',
      param_builder: (q, ctx) => ({
        companies: (ctx.companies && ctx.companies.length > 0) ? ctx.companies : inferCompaniesFromQuestion(q),
        query: ctx.ats_query || q,
        refresh: true,
        fetch_descriptions: true,
        max_jobs_per_company: 200,
      }),
    },
  ],
};

/**
 * Create threads from a plan's sub-questions.
 */
export function createThreads(projectId: string, subQuestions: SubQuestion[]): Thread[] {
  const db = getDb();
  const now = new Date().toISOString();
  const threads: Thread[] = [];

  const insert = db.prepare(`
    INSERT INTO threads (id, project_id, sub_question, source_group, priority, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (let i = 0; i < subQuestions.length; i++) {
      const sq = subQuestions[i];
      const id = `thr_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
      insert.run(id, projectId, sq.question, sq.source_group, sq.priority, now, now);
      threads.push({
        id,
        project_id: projectId,
        sub_question: sq.question,
        source_group: sq.source_group,
        priority: sq.priority,
        status: 'pending',
        actions_json: null,
        findings_count: 0,
        created_at: now,
        updated_at: now,
      });
    }

    // Update project thread count
    db.prepare('UPDATE projects SET total_threads = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(subQuestions.length, 'researching', now, projectId);
  });

  transaction();
  return threads;
}

/**
 * Get next pending thread and generate actions for Claude to execute.
 */
export function getNextThread(projectId: string, context: ProjectContext): ThreadActions | null {
  const db = getDb();
  const now = new Date().toISOString();

  const thread = db.prepare(`
    SELECT * FROM threads
    WHERE project_id = ? AND status = 'pending'
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
  `).get(projectId) as Thread | undefined;

  if (!thread) return null;

  // Generate actions based on source group
  const toolDefs = SOURCE_GROUP_TOOLS[thread.source_group] || SOURCE_GROUP_TOOLS.web;
  const actions: ThreadAction[] = toolDefs.map((def, i) => ({
    action_id: `${thread.id}_${i}`,
    tool_name: def.tool_name,
    server_name: def.server_name,
    params: def.param_builder(thread.sub_question, context),
    description: `Query ${def.server_name} via ${def.tool_name} for: ${thread.sub_question}`,
  }));

  // Update thread status and store actions
  const actionsJson = JSON.stringify(actions);
  db.prepare('UPDATE threads SET status = ?, actions_json = ?, updated_at = ? WHERE id = ?')
    .run('dispatched', actionsJson, now, thread.id);

  return {
    thread_id: thread.id,
    sub_question: thread.sub_question,
    source_group: thread.source_group,
    actions,
    instructions: `Execute all ${actions.length} actions in parallel. Then call deep_research_submit with the thread_id and all results.`,
  };
}

/**
 * Get all threads for a project.
 */
export function getThreads(projectId: string): Thread[] {
  const db = getDb();
  return db.prepare('SELECT * FROM threads WHERE project_id = ? ORDER BY priority DESC')
    .all(projectId) as Thread[];
}

/**
 * Update thread status.
 */
export function updateThreadStatus(threadId: string, status: string, findingsCount?: number): void {
  const db = getDb();
  const now = new Date().toISOString();
  if (findingsCount !== undefined) {
    db.prepare('UPDATE threads SET status = ?, findings_count = ?, updated_at = ? WHERE id = ?')
      .run(status, findingsCount, now, threadId);
  } else {
    db.prepare('UPDATE threads SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, now, threadId);
  }
}
