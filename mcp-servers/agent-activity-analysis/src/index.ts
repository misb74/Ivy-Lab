import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getSupabase } from './supabase.js';
import type { ActivitySummaryRow, DeltaRow, OutlierRow, ExportTask } from './types.js';

// Startup — surface Supabase hydration credential state.
// Mirrors gateway/src/index.ts banner. When creds are missing, every
// hydration call in this MCP child silently falls back to mock data.
// Make the degraded state impossible to miss at the child-process level.
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  const banner = [
    '',
    '════════════════════════════════════════════════════════════════',
    '  ⚠  SUPABASE HYDRATION CREDENTIALS MISSING (agent-activity-analysis)',
    '════════════════════════════════════════════════════════════════',
    '  SUPABASE_URL and/or SUPABASE_ANON_KEY are not set in .env.',
    '  All hydration calls will SILENTLY fall back to MOCK task',
    '  profiles. Simulation output will be derived from fabricated',
    '  priors, not real O*NET / WorkBank / BLS data.',
    '',
    '  Set both vars in .env to enable real-data hydration.',
    '  Set STRICT_HYDRATION=1 to refuse to start without them.',
    '════════════════════════════════════════════════════════════════',
    '',
  ].join('\n');
  console.error(banner);
  if (process.env.STRICT_HYDRATION === '1') {
    console.error('[agent-activity-analysis startup] STRICT_HYDRATION=1 — exiting.');
    process.exit(1);
  }
} else {
  console.error('[agent-activity-analysis startup] Supabase hydration credentials present — real-data path enabled.');
}

const server = new McpServer({
  name: 'agent-activity-analysis',
  version: '1.0.0',
  description: 'Activity Analysis Agent — aggregates interview data, detects deltas from baseline, surfaces outliers and patterns, computes confidence scores, and exports for downstream tools.',
});

// ── Helper: fetch completed responses for a project ──
async function getProjectResponses(projectId: string, roleId?: string) {
  const sb = getSupabase();

  let sessionsQuery = sb
    .from('interview_sessions')
    .select('id, role_id')
    .eq('project_id', projectId)
    .eq('status', 'complete');
  if (roleId) sessionsQuery = sessionsQuery.eq('role_id', roleId);

  const { data: sessions } = await sessionsQuery;
  if (!sessions || sessions.length === 0) return { sessions: [], responses: [], roles: [] };

  const sessionIds = sessions.map(s => s.id);
  const { data: responses } = await sb
    .from('interview_responses')
    .select('*')
    .in('session_id', sessionIds);

  const { data: roles } = await sb
    .from('interview_project_roles')
    .select('id, role_name, department, baseline_activities')
    .eq('project_id', projectId);

  return { sessions: sessions || [], responses: responses || [], roles: roles || [] };
}

// ── Tool: activity_analysis_summary ──
server.tool(
  'activity_analysis_summary',
  'Aggregated time allocation across all respondents for a project, grouped by activity. Returns mean time %, standard deviation, frequency mode, complexity average, and confidence score per activity.',
  {
    project_id: z.string().describe('Project ID'),
    role_id: z.string().optional().describe('Filter to a specific role'),
    group_by: z.enum(['activity', 'role', 'department']).optional().default('activity').describe('Grouping level'),
  },
  async (params) => {
    try {
      const { sessions, responses } = await getProjectResponses(params.project_id, params.role_id);
      if (sessions.length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ message: 'No completed interviews found.' }) }] };
      }

      const byProcess = new Map<string, Array<typeof responses[0]>>();
      for (const r of responses) {
        if (r.status === 'removed') continue;
        const arr = byProcess.get(r.process_id) || [];
        arr.push(r);
        byProcess.set(r.process_id, arr);
      }

      const summary: ActivitySummaryRow[] = [];

      for (const [processId, processResponses] of byProcess) {
        const withTime = processResponses.filter(r => r.time_allocation_pct != null);
        const times = withTime.map(r => r.time_allocation_pct as number);
        const mean = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
        const variance = times.length > 1
          ? times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / (times.length - 1)
          : 0;
        const stddev = Math.sqrt(variance);

        const freqCounts: Record<string, number> = {};
        for (const r of processResponses) {
          if (r.frequency) freqCounts[r.frequency] = (freqCounts[r.frequency] || 0) + 1;
        }
        const modeFreq = Object.entries(freqCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

        const complexityMap = { low: 1, medium: 2, high: 3 } as const;
        const complexities = processResponses
          .filter(r => r.complexity)
          .map(r => complexityMap[r.complexity as keyof typeof complexityMap]);
        const avgComplexity = complexities.length > 0
          ? complexities.reduce((a, b) => a + b, 0) / complexities.length
          : 0;

        const responseFraction = Math.min(processResponses.length / sessions.length, 1);
        const variancePenalty = stddev > 15 ? 0.3 : stddev > 10 ? 0.15 : 0;
        const confidence = Math.max(0, Math.min(1, responseFraction - variancePenalty));

        summary.push({
          process_id: processId,
          process_name: processResponses[0].process_name,
          respondent_count: processResponses.length,
          confirmed_count: processResponses.filter(r => r.status === 'confirmed').length,
          removed_count: 0,
          avg_time_allocation_pct: Math.round(mean * 10) / 10,
          stddev_time_allocation_pct: Math.round(stddev * 10) / 10,
          most_common_frequency: modeFreq,
          avg_complexity_score: Math.round(avgComplexity * 10) / 10,
          confidence: Math.round(confidence * 100) / 100,
        });
      }

      summary.sort((a, b) => b.avg_time_allocation_pct - a.avg_time_allocation_pct);
      const totalTimePct = summary.reduce((sum, s) => sum + s.avg_time_allocation_pct, 0);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: params.project_id,
            total_respondents: sessions.length,
            total_activities: summary.length,
            total_time_allocation_pct: Math.round(totalTimePct * 10) / 10,
            summary,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: activity_analysis_deltas ──
server.tool(
  'activity_analysis_deltas',
  'Compare current interview data against the baseline activities. Detects what has grown, shrunk, appeared (new), or disappeared (gone).',
  {
    project_id: z.string().describe('Project ID'),
    role_id: z.string().optional().describe('Filter to a specific role'),
  },
  async (params) => {
    try {
      const { sessions, responses, roles } = await getProjectResponses(params.project_id, params.role_id);
      if (sessions.length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ message: 'No completed interviews found.' }) }] };
      }

      const baselineProcessIds = new Set<string>();
      const baselineNames = new Map<string, string>();
      for (const role of roles) {
        const activities = (role.baseline_activities as Array<{ process_id: string; process_name: string }>) || [];
        for (const a of activities) {
          baselineProcessIds.add(a.process_id);
          baselineNames.set(a.process_id, a.process_name);
        }
      }

      const responsesByProcess = new Map<string, Array<typeof responses[0]>>();
      for (const r of responses) {
        const arr = responsesByProcess.get(r.process_id) || [];
        arr.push(r);
        responsesByProcess.set(r.process_id, arr);
      }

      const deltas: DeltaRow[] = [];

      for (const processId of baselineProcessIds) {
        const processName = baselineNames.get(processId) || processId;
        const processResponses = responsesByProcess.get(processId);

        if (!processResponses || processResponses.length === 0) {
          deltas.push({
            process_id: processId,
            process_name: processName,
            delta_type: 'gone',
            detail: 'No practitioners confirmed this activity — it may have been eliminated or redistributed.',
          });
          continue;
        }

        const removedCount = processResponses.filter(r => r.status === 'removed').length;
        const confirmedCount = processResponses.filter(r => r.status !== 'removed').length;

        if (removedCount > confirmedCount) {
          deltas.push({
            process_id: processId,
            process_name: processName,
            delta_type: 'shrunk',
            detail: `${removedCount} of ${processResponses.length} practitioners marked this as removed. Activity is declining.`,
          });
        }
      }

      for (const [processId, processResponses] of responsesByProcess) {
        if (!baselineProcessIds.has(processId)) {
          const newResponses = processResponses.filter(r => r.status === 'new');
          if (newResponses.length > 0) {
            const avgTime = newResponses
              .filter(r => r.time_allocation_pct != null)
              .reduce((sum, r) => sum + (r.time_allocation_pct || 0), 0) / newResponses.length;
            deltas.push({
              process_id: processId,
              process_name: processResponses[0].process_name,
              delta_type: 'new',
              detail: `Reported by ${newResponses.length} practitioner(s), avg ${Math.round(avgTime)}% of week. Not in baseline.`,
            });
          }
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: params.project_id,
            baseline_activities: baselineProcessIds.size,
            deltas_found: deltas.length,
            deltas,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: activity_analysis_outliers ──
server.tool(
  'activity_analysis_outliers',
  'Flag individual responses that diverge significantly from the cohort average. Helps identify data quality issues or genuinely different workloads.',
  {
    project_id: z.string().describe('Project ID'),
    threshold: z.number().optional().default(2).describe('Standard deviations from mean to flag (default 2)'),
  },
  async (params) => {
    try {
      const { sessions, responses } = await getProjectResponses(params.project_id);
      if (sessions.length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ message: 'No completed interviews found.' }) }] };
      }

      const byProcess = new Map<string, Array<{ session_id: string; pct: number; name: string }>>();
      for (const r of responses) {
        if (r.time_allocation_pct == null || r.status === 'removed') continue;
        const arr = byProcess.get(r.process_id) || [];
        arr.push({ session_id: r.session_id, pct: r.time_allocation_pct, name: r.process_name });
        byProcess.set(r.process_id, arr);
      }

      const outliers: OutlierRow[] = [];

      for (const [processId, entries] of byProcess) {
        if (entries.length < 3) continue;
        const mean = entries.reduce((s, e) => s + e.pct, 0) / entries.length;
        const stddev = Math.sqrt(
          entries.reduce((s, e) => s + (e.pct - mean) ** 2, 0) / (entries.length - 1)
        );
        if (stddev < 1) continue;

        for (const entry of entries) {
          const deviation = Math.abs(entry.pct - mean) / stddev;
          if (deviation >= params.threshold) {
            outliers.push({
              session_id: entry.session_id,
              process_id: processId,
              process_name: entry.name,
              reported_pct: entry.pct,
              cohort_avg_pct: Math.round(mean * 10) / 10,
              deviation: Math.round(deviation * 10) / 10,
            });
          }
        }
      }

      outliers.sort((a, b) => b.deviation - a.deviation);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: params.project_id,
            threshold_stddev: params.threshold,
            outliers_found: outliers.length,
            outliers,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: activity_analysis_confidence ──
server.tool(
  'activity_analysis_confidence',
  'Per-activity confidence scoring — how many people confirmed it, how consistent the timing data was, response rate gaps.',
  {
    project_id: z.string().describe('Project ID'),
    role_id: z.string().optional().describe('Filter to a specific role'),
    min_confidence: z.number().min(0).max(1).optional().default(0).describe('Only return activities below this confidence threshold'),
  },
  async (params) => {
    try {
      const { sessions, responses, roles } = await getProjectResponses(params.project_id, params.role_id);
      if (sessions.length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ message: 'No completed interviews found.' }) }] };
      }

      const baselineCount = roles.reduce((sum, r) => {
        const acts = (r.baseline_activities as Array<{ process_id: string }>) || [];
        return sum + acts.length;
      }, 0);

      const byProcess = new Map<string, Array<typeof responses[0]>>();
      for (const r of responses) {
        if (r.status === 'removed') continue;
        const arr = byProcess.get(r.process_id) || [];
        arr.push(r);
        byProcess.set(r.process_id, arr);
      }

      const scores: Array<{
        process_id: string;
        process_name: string;
        response_count: number;
        response_rate: number;
        time_stddev: number;
        confidence: number;
        flags: string[];
      }> = [];

      for (const [processId, processResponses] of byProcess) {
        const responseRate = processResponses.length / sessions.length;
        const times = processResponses.filter(r => r.time_allocation_pct != null).map(r => r.time_allocation_pct as number);
        const mean = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
        const stddev = times.length > 1
          ? Math.sqrt(times.reduce((s, t) => s + (t - mean) ** 2, 0) / (times.length - 1))
          : 0;

        const flags: string[] = [];
        if (responseRate < 0.5) flags.push('low_response_rate');
        if (stddev > 15) flags.push('high_variance');
        if (times.length === 0) flags.push('no_time_data');
        if (processResponses.length < 3) flags.push('insufficient_sample');

        const confidence = Math.max(0, Math.min(1,
          responseRate * 0.5 +
          (stddev < 10 ? 0.3 : stddev < 15 ? 0.15 : 0) +
          (times.length >= 3 ? 0.2 : times.length >= 1 ? 0.1 : 0)
        ));

        scores.push({
          process_id: processId,
          process_name: processResponses[0].process_name,
          response_count: processResponses.length,
          response_rate: Math.round(responseRate * 100) / 100,
          time_stddev: Math.round(stddev * 10) / 10,
          confidence: Math.round(confidence * 100) / 100,
          flags,
        });
      }

      const filtered = params.min_confidence > 0
        ? scores.filter(s => s.confidence < params.min_confidence)
        : scores;

      filtered.sort((a, b) => a.confidence - b.confidence);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: params.project_id,
            total_respondents: sessions.length,
            baseline_activities: baselineCount,
            observed_activities: byProcess.size,
            scores: filtered,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: activity_analysis_export ──
server.tool(
  'activity_analysis_export',
  'Export validated activity data in the format expected by downstream tools (hr-automation, workforce-sim, task-decomposition). Returns an array of task objects with time allocation, frequency, complexity, and confidence.',
  {
    project_id: z.string().describe('Project ID'),
    role_id: z.string().optional().describe('Filter to a specific role'),
    format: z.enum(['hr_automation', 'workforce_sim', 'generic']).optional().default('generic').describe('Output format for target tool'),
    min_confidence: z.number().min(0).max(1).optional().default(0.3).describe('Exclude activities below this confidence'),
  },
  async (params) => {
    try {
      const { sessions, responses } = await getProjectResponses(params.project_id, params.role_id);
      if (sessions.length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ message: 'No completed interviews found.' }) }] };
      }

      const byProcess = new Map<string, Array<typeof responses[0]>>();
      for (const r of responses) {
        if (r.status === 'removed') continue;
        const arr = byProcess.get(r.process_id) || [];
        arr.push(r);
        byProcess.set(r.process_id, arr);
      }

      const tasks: ExportTask[] = [];

      for (const [, processResponses] of byProcess) {
        const times = processResponses.filter(r => r.time_allocation_pct != null).map(r => r.time_allocation_pct as number);
        const mean = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
        const stddev = times.length > 1
          ? Math.sqrt(times.reduce((s, t) => s + (t - mean) ** 2, 0) / (times.length - 1))
          : 0;

        const responseRate = processResponses.length / sessions.length;
        const confidence = Math.max(0, Math.min(1,
          responseRate * 0.5 + (stddev < 10 ? 0.3 : stddev < 15 ? 0.15 : 0) + (times.length >= 3 ? 0.2 : 0.1)
        ));

        if (confidence < params.min_confidence) continue;

        const freqCounts: Record<string, number> = {};
        for (const r of processResponses) {
          if (r.frequency) freqCounts[r.frequency] = (freqCounts[r.frequency] || 0) + 1;
        }
        const modeFreq = Object.entries(freqCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'weekly';

        const compCounts: Record<string, number> = {};
        for (const r of processResponses) {
          if (r.complexity) compCounts[r.complexity] = (compCounts[r.complexity] || 0) + 1;
        }
        const modeComp = Object.entries(compCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'medium';

        tasks.push({
          task: processResponses[0].process_name,
          time_allocation_pct: Math.round(mean * 10) / 10,
          frequency: modeFreq,
          complexity: modeComp,
          confidence: Math.round(confidence * 100) / 100,
          source: 'interview',
        });
      }

      tasks.sort((a, b) => b.time_allocation_pct - a.time_allocation_pct);

      let output: unknown;

      if (params.format === 'hr_automation') {
        output = {
          tasks: tasks.map(t => t.task),
          metadata: tasks,
          instruction: 'Pass the tasks array to assessAutomation(role, tasks). The metadata array has the timing and confidence data to enrich the assessment.',
        };
      } else if (params.format === 'workforce_sim') {
        output = {
          role_tasks: tasks.map(t => ({
            task_statement: t.task,
            time_allocation: t.time_allocation_pct / 100,
            importance: t.confidence,
            source: 'interview',
            frequency: t.frequency,
            complexity: t.complexity,
          })),
          instruction: 'Use these to populate role_task records in a workforce simulation.',
        };
      } else {
        output = { tasks };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: params.project_id,
            format: params.format,
            total_respondents: sessions.length,
            exported_tasks: tasks.length,
            min_confidence_applied: params.min_confidence,
            data: output,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Start server ──
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
