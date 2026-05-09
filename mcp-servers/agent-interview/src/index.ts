import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getSupabase } from './supabase.js';
import type { BaselineActivity } from './types.js';

// Startup — surface Supabase hydration credential state.
// Mirrors gateway/src/index.ts banner. When creds are missing, every
// hydration call in this MCP child silently falls back to mock data.
// Make the degraded state impossible to miss at the child-process level.
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  const banner = [
    '',
    '════════════════════════════════════════════════════════════════',
    '  ⚠  SUPABASE HYDRATION CREDENTIALS MISSING (agent-interview)',
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
    console.error('[agent-interview startup] STRICT_HYDRATION=1 — exiting.');
    process.exit(1);
  }
} else {
  console.error('[agent-interview startup] Supabase hydration credentials present — real-data path enabled.');
}

const server = new McpServer({
  name: 'agent-interview',
  version: '1.0.0',
  description: 'Activity Analysis Interview Agent — manages interview projects, generates practitioner session links, and guides structured activity data collection against the HR work ontology.',
});

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Tool: interview_create_project ──
server.tool(
  'interview_create_project',
  'Create a new activity analysis project. The HR leader specifies the organisation, departments, and roles to interview. For each role, provide baseline_activities — an array of HR ontology process objects (process_id, process_name, l2_domain, l3_subdomain) that Ivy will validate with practitioners. Returns project ID and next step.',
  {
    org_name: z.string().describe('Organisation name'),
    created_by: z.string().describe('Creator identifier (e.g. session owner or email)'),
    roles: z.array(z.object({
      role_name: z.string().describe('e.g. "Benefits Administrator"'),
      department: z.string().optional().describe('e.g. "Compensation & Benefits"'),
      baseline_activities: z.array(z.object({
        process_id: z.string().describe('HR ontology process ID from hr_work_process table'),
        process_name: z.string().describe('L4 process name'),
        l2_domain: z.string().describe('L2 domain name'),
        l3_subdomain: z.string().describe('L3 subdomain name'),
      })).describe('Activities mapped to this role from the HR ontology'),
    })).min(1).describe('Roles to include in this project'),
  },
  async (params) => {
    try {
      const sb = getSupabase();
      const projectId = genId('proj');
      const now = new Date().toISOString();

      const { error: projErr } = await sb.from('interview_projects').insert({
        id: projectId,
        org_name: params.org_name,
        created_by: params.created_by,
        status: 'draft',
        config_json: '{}',
        created_at: now,
        updated_at: now,
      });
      if (projErr) throw new Error(`Failed to create project: ${projErr.message}`);

      const roleRows = params.roles.map(r => ({
        id: genId('role'),
        project_id: projectId,
        role_name: r.role_name,
        department: r.department || null,
        baseline_activities: r.baseline_activities,
        created_at: now,
      }));

      const { error: roleErr } = await sb.from('interview_project_roles').insert(roleRows);
      if (roleErr) throw new Error(`Failed to create roles: ${roleErr.message}`);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: projectId,
            org_name: params.org_name,
            roles_created: roleRows.length,
            role_ids: roleRows.map(r => ({ id: r.id, role_name: r.role_name })),
            status: 'draft',
            next_step: 'Call interview_generate_sessions to create practitioner links for each role.',
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: interview_generate_sessions ──
server.tool(
  'interview_generate_sessions',
  'Generate unique session links for practitioners. Creates one session per count for a given role. Each session gets a unique token that becomes the practitioner link. Also activates the project.',
  {
    project_id: z.string().describe('Project ID from interview_create_project'),
    role_id: z.string().describe('Role ID to generate sessions for'),
    count: z.number().int().min(1).max(5000).describe('Number of practitioner sessions to create'),
  },
  async (params) => {
    try {
      const sb = getSupabase();

      const { data: project } = await sb
        .from('interview_projects')
        .select('id, status')
        .eq('id', params.project_id)
        .single();
      if (!project) throw new Error(`Project "${params.project_id}" not found`);

      const { data: role } = await sb
        .from('interview_project_roles')
        .select('id, role_name')
        .eq('id', params.role_id)
        .eq('project_id', params.project_id)
        .single();
      if (!role) throw new Error(`Role "${params.role_id}" not found in project`);

      const sessions: Array<{
        id: string;
        project_id: string;
        role_id: string;
        practitioner_token: string;
        status: string;
        current_activity_index: number;
        created_at: string;
      }> = [];
      const now = new Date().toISOString();

      for (let i = 0; i < params.count; i++) {
        const token = `${params.project_id.slice(5, 11)}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
        sessions.push({
          id: genId('sess'),
          project_id: params.project_id,
          role_id: params.role_id,
          practitioner_token: token,
          status: 'pending',
          current_activity_index: 0,
          created_at: now,
        });
      }

      for (let i = 0; i < sessions.length; i += 100) {
        const batch = sessions.slice(i, i + 100);
        const { error } = await sb.from('interview_sessions').insert(batch);
        if (error) throw new Error(`Failed to create sessions (batch ${i}): ${error.message}`);
      }

      await sb
        .from('interview_projects')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', params.project_id);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: params.project_id,
            role: role.role_name,
            sessions_created: sessions.length,
            sample_links: sessions.slice(0, 3).map(s => ({
              token: s.practitioner_token,
              url: `/interview/${s.practitioner_token}`,
            })),
            project_status: 'active',
            next_step: 'Share the links with practitioners. Each link starts a guided interview with Ivy.',
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: interview_start ──
server.tool(
  'interview_start',
  'Start an interview session for a practitioner. Called when a practitioner clicks their link. Returns the role info and list of baseline activities to walk through. Marks session as in_progress.',
  {
    practitioner_token: z.string().describe('Unique token from the practitioner link'),
  },
  async (params) => {
    try {
      const sb = getSupabase();

      const { data: session } = await sb
        .from('interview_sessions')
        .select('id, project_id, role_id, status')
        .eq('practitioner_token', params.practitioner_token)
        .single();
      if (!session) throw new Error('Invalid session link');
      if (session.status === 'complete') throw new Error('This interview has already been completed');
      if (session.status === 'expired') throw new Error('This interview link has expired');

      const { data: role } = await sb
        .from('interview_project_roles')
        .select('role_name, department, baseline_activities')
        .eq('id', session.role_id)
        .single();
      if (!role) throw new Error('Role not found');

      const { data: project } = await sb
        .from('interview_projects')
        .select('org_name')
        .eq('id', session.project_id)
        .single();

      await sb
        .from('interview_sessions')
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq('id', session.id);

      const { data: existing } = await sb
        .from('interview_responses')
        .select('process_id')
        .eq('session_id', session.id);
      const answeredProcessIds = new Set((existing || []).map(r => r.process_id));

      const activities = (role.baseline_activities as BaselineActivity[]) || [];
      const remaining = activities.filter(a => !answeredProcessIds.has(a.process_id));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            session_id: session.id,
            org_name: project?.org_name,
            role_name: role.role_name,
            department: role.department,
            total_activities: activities.length,
            already_answered: answeredProcessIds.size,
            remaining_activities: remaining.length,
            activities: remaining,
            instruction: 'Walk the practitioner through each activity. For each one, ask: (1) Do you still do this? (2) If yes, what % of your week? (3) How often? Use interview_next to get the next activity and interview_submit to record each response.',
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: interview_next ──
server.tool(
  'interview_next',
  'Get the next activity to discuss with the practitioner. Returns the activity details and its position in the sequence. Returns null when all activities are done.',
  {
    session_id: z.string().describe('Session ID from interview_start'),
  },
  async (params) => {
    try {
      const sb = getSupabase();

      const { data: session } = await sb
        .from('interview_sessions')
        .select('id, role_id, current_activity_index')
        .eq('id', params.session_id)
        .single();
      if (!session) throw new Error('Session not found');

      const { data: role } = await sb
        .from('interview_project_roles')
        .select('baseline_activities')
        .eq('id', session.role_id)
        .single();
      if (!role) throw new Error('Role not found');

      const activities = (role.baseline_activities as BaselineActivity[]) || [];

      const { data: existing } = await sb
        .from('interview_responses')
        .select('process_id')
        .eq('session_id', session.id);
      const answeredProcessIds = new Set((existing || []).map(r => r.process_id));

      const next = activities.find(a => !answeredProcessIds.has(a.process_id));

      if (!next) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              done: true,
              answered: answeredProcessIds.size,
              total: activities.length,
              instruction: 'All baseline activities covered. Ask the practitioner if there are activities they do regularly that were not mentioned. For any new ones, use interview_submit with status "new". When finished, call interview_submit with close_session=true to close the session.',
            }, null, 2),
          }],
        };
      }

      const position = activities.indexOf(next) + 1;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            done: false,
            position,
            total: activities.length,
            answered: answeredProcessIds.size,
            activity: next,
            prompts: [
              `Do you still do "${next.process_name}"?`,
              'If yes: roughly what percentage of your week does this take?',
              'How often do you do it — daily, weekly, monthly, quarterly, or ad-hoc?',
              'Would you say the complexity is low, medium, or high?',
            ],
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: interview_submit ──
server.tool(
  'interview_submit',
  'Record a practitioner response for a single activity. Call with status "confirmed" if unchanged, "changed" if timing differs, "removed" if practitioner no longer does it, or "new" for activities not in the baseline. Call with close_session=true after the final activity to mark the interview complete.',
  {
    session_id: z.string().describe('Session ID'),
    process_id: z.string().optional().describe('HR ontology process ID (omit only when closing session)'),
    process_name: z.string().optional().describe('Process name (required for "new" activities)'),
    status: z.enum(['confirmed', 'changed', 'removed', 'new']).optional().describe('Activity status'),
    time_allocation_pct: z.number().min(0).max(100).optional().describe('Percentage of week spent on this activity'),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'ad_hoc']).optional(),
    duration_hours_per_occurrence: z.number().min(0).optional().describe('Hours per occurrence'),
    complexity: z.enum(['low', 'medium', 'high']).optional(),
    notes: z.string().optional().describe('Practitioner comments'),
    close_session: z.boolean().optional().describe('Set true to mark the interview complete'),
  },
  async (params) => {
    try {
      const sb = getSupabase();

      if (params.close_session) {
        const { data: responses } = await sb
          .from('interview_responses')
          .select('time_allocation_pct')
          .eq('session_id', params.session_id);

        const totalPct = (responses || []).reduce((sum, r) => sum + (r.time_allocation_pct || 0), 0);

        await sb
          .from('interview_sessions')
          .update({ status: 'complete', completed_at: new Date().toISOString() })
          .eq('id', params.session_id);

        const { data: session } = await sb
          .from('interview_sessions')
          .select('project_id')
          .eq('id', params.session_id)
          .single();

        let projectComplete = false;
        if (session) {
          const { data: pending } = await sb
            .from('interview_sessions')
            .select('id')
            .eq('project_id', session.project_id)
            .neq('status', 'complete')
            .limit(1);
          projectComplete = !pending || pending.length === 0;

          if (projectComplete) {
            await sb
              .from('interview_projects')
              .update({ status: 'complete', updated_at: new Date().toISOString() })
              .eq('id', session.project_id);
          }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              session_closed: true,
              total_time_allocation_pct: Math.round(totalPct * 10) / 10,
              time_warning: totalPct > 120 ? 'Total exceeds 120% — some activities may overlap' :
                            totalPct < 60 ? 'Total below 60% — some activities may be missing' : null,
              project_complete: projectComplete,
            }, null, 2),
          }],
        };
      }

      if (!params.process_id || !params.status) {
        throw new Error('process_id and status are required when not closing session');
      }

      const responseId = genId('resp');
      const { error } = await sb.from('interview_responses').insert({
        id: responseId,
        session_id: params.session_id,
        process_id: params.process_id,
        process_name: params.process_name || params.process_id,
        status: params.status,
        time_allocation_pct: params.time_allocation_pct || null,
        frequency: params.frequency || null,
        duration_hours_per_occurrence: params.duration_hours_per_occurrence || null,
        complexity: params.complexity || null,
        notes: params.notes || null,
        submitted_at: new Date().toISOString(),
      });
      if (error) throw new Error(`Failed to save response: ${error.message}`);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            response_id: responseId,
            recorded: {
              process_name: params.process_name || params.process_id,
              status: params.status,
              time_allocation_pct: params.time_allocation_pct,
              frequency: params.frequency,
            },
            next_step: 'Call interview_next to get the next activity.',
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: interview_status ──
server.tool(
  'interview_status',
  'Get project-level dashboard — how many sessions are complete, in progress, pending. Used by the HR leader to monitor progress.',
  {
    project_id: z.string().describe('Project ID'),
  },
  async (params) => {
    try {
      const sb = getSupabase();

      const { data: project } = await sb
        .from('interview_projects')
        .select('*')
        .eq('id', params.project_id)
        .single();
      if (!project) throw new Error(`Project "${params.project_id}" not found`);

      const { data: roles } = await sb
        .from('interview_project_roles')
        .select('id, role_name, department')
        .eq('project_id', params.project_id);

      const { data: sessions } = await sb
        .from('interview_sessions')
        .select('id, role_id, status, started_at, completed_at')
        .eq('project_id', params.project_id);

      const statusCounts = { pending: 0, in_progress: 0, complete: 0, expired: 0 };
      for (const s of sessions || []) {
        statusCounts[s.status as keyof typeof statusCounts]++;
      }

      const roleBreakdown = (roles || []).map(role => {
        const roleSessions = (sessions || []).filter(s => s.role_id === role.id);
        return {
          role_name: role.role_name,
          department: role.department,
          total_sessions: roleSessions.length,
          complete: roleSessions.filter(s => s.status === 'complete').length,
          in_progress: roleSessions.filter(s => s.status === 'in_progress').length,
          pending: roleSessions.filter(s => s.status === 'pending').length,
        };
      });

      const total = (sessions || []).length;
      const completionPct = total > 0 ? Math.round((statusCounts.complete / total) * 100) : 0;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: params.project_id,
            org_name: project.org_name,
            project_status: project.status,
            overall: {
              total_sessions: total,
              ...statusCounts,
              completion_pct: completionPct,
            },
            by_role: roleBreakdown,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: interview_get_results ──
server.tool(
  'interview_get_results',
  'Get all collected interview data for a project. Returns responses grouped by role, ready for agent-activity-analysis to consume. Optionally filter by role.',
  {
    project_id: z.string().describe('Project ID'),
    role_id: z.string().optional().describe('Filter to a specific role'),
  },
  async (params) => {
    try {
      const sb = getSupabase();

      let sessionsQuery = sb
        .from('interview_sessions')
        .select('id, role_id, status')
        .eq('project_id', params.project_id)
        .eq('status', 'complete');
      if (params.role_id) sessionsQuery = sessionsQuery.eq('role_id', params.role_id);

      const { data: sessions } = await sessionsQuery;
      if (!sessions || sessions.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ message: 'No completed interviews found for this project.' }),
          }],
        };
      }

      const sessionIds = sessions.map(s => s.id);

      const { data: responses } = await sb
        .from('interview_responses')
        .select('*')
        .in('session_id', sessionIds);

      const { data: roles } = await sb
        .from('interview_project_roles')
        .select('id, role_name, department')
        .eq('project_id', params.project_id);

      const roleMap = new Map((roles || []).map(r => [r.id, r]));

      const byRole: Record<string, {
        role_name: string;
        department: string | null;
        respondent_count: number;
        responses: typeof responses;
      }> = {};

      for (const session of sessions) {
        const role = roleMap.get(session.role_id);
        if (!role) continue;
        if (!byRole[session.role_id]) {
          byRole[session.role_id] = {
            role_name: role.role_name,
            department: role.department,
            respondent_count: 0,
            responses: [],
          };
        }
        byRole[session.role_id].respondent_count++;
        const sessionResponses = (responses || []).filter(r => r.session_id === session.id);
        byRole[session.role_id].responses!.push(...sessionResponses);
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: params.project_id,
            total_respondents: sessions.length,
            total_responses: (responses || []).length,
            by_role: byRole,
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
