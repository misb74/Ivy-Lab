import { createTask, updateTask } from '../engine/task-manager.js';
import { generateSubQuestions } from '../engine/planner.js';
import { searchDuckDuckGo } from '../engine/searcher.js';
import { fetchPageContent } from '../engine/fetcher.js';
import { synthesize } from '../engine/synthesizer.js';
import { saveResearchResult } from '../storage/research-cache.js';

export interface StartParams {
  query: string;
  depth?: 'quick' | 'standard' | 'deep';
}

export async function researchStart(params: StartParams): Promise<{
  task_id: string;
  status: string;
  message: string;
}> {
  const { query, depth = 'standard' } = params;
  const task = createTask(query, depth);

  // Run research in background
  runResearch(task.id, query, depth).catch(error => {
    updateTask(task.id, {
      status: 'error',
      error: (error as Error).message,
    });
  });

  return {
    task_id: task.id,
    status: 'planning',
    message: `Research started. Use research_status with task_id "${task.id}" to check progress.`,
  };
}

async function runResearch(taskId: string, query: string, depth: 'quick' | 'standard' | 'deep'): Promise<void> {
  // Phase 1: Planning
  const subQuestions = generateSubQuestions(query, depth);
  updateTask(taskId, { status: 'planning', progress: 10, subQuestions });

  // Phase 2: Searching
  updateTask(taskId, { status: 'researching', progress: 20 });

  const maxSearches = depth === 'quick' ? 1 : depth === 'standard' ? 3 : 5;
  const questionsToSearch = subQuestions.slice(0, maxSearches);

  const allResults = [];
  for (let i = 0; i < questionsToSearch.length; i++) {
    const results = await searchDuckDuckGo(questionsToSearch[i], depth === 'deep' ? 8 : 5);
    allResults.push(...results);
    updateTask(taskId, {
      progress: 20 + Math.round((i + 1) / questionsToSearch.length * 40),
      sources: allResults.map(r => ({ url: r.url, title: r.title, snippet: r.snippet })),
    });
  }

  // Phase 3: Fetching top pages
  const uniqueUrls = [...new Set(allResults.map(r => r.url))].slice(0, depth === 'deep' ? 8 : 4);
  const fetchedPages = await Promise.all(uniqueUrls.map(url => fetchPageContent(url)));
  updateTask(taskId, { progress: 75 });

  // Phase 4: Synthesis
  updateTask(taskId, { status: 'synthesizing', progress: 80 });
  const report = synthesize(query, subQuestions, allResults, fetchedPages);

  const synthesis = JSON.stringify(report, null, 2);
  updateTask(taskId, {
    status: 'complete',
    progress: 100,
    synthesis,
    completed_at: new Date().toISOString(),
  });

  // Cache result
  const task = (await import('../engine/task-manager.js')).getTask(taskId);
  if (task) saveResearchResult(task);
}
