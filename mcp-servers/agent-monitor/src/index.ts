import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initializeSchema } from './db/schema.js';
import { monitorCreate } from './tools/monitor-create.js';
import { monitorList } from './tools/monitor-list.js';
import { monitorCheck } from './tools/monitor-check.js';
import { monitorHistory } from './tools/monitor-history.js';
import { monitorDelete } from './tools/monitor-delete.js';

const server = new McpServer({
  name: 'agent-monitor',
  version: '2.0.0',
});

// Initialize database schema
initializeSchema();

// Tool: monitor_create
server.tool(
  'monitor_create',
  'Create a new market monitor with name, type, target, and threshold configuration',
  {
    name: z.string().describe('Name of the monitor'),
    type: z.enum(['salary', 'demand', 'jobs', 'skills']).describe('Type of market monitor'),
    target: z.string().describe('Target to monitor (e.g., role, skill, market)'),
    config: z
      .object({
        thresholds: z
          .record(
            z.object({
              min: z.number().optional(),
              max: z.number().optional(),
              changePercent: z.number().optional(),
            })
          )
          .optional(),
        checkInterval: z.number().optional(),
      })
      .optional()
      .describe('Monitor configuration with thresholds and check interval'),
  },
  async (params) => {
    try {
      const result = monitorCreate(params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// Tool: monitor_list
server.tool(
  'monitor_list',
  'List all monitors with their status and latest snapshot summary',
  {
    status: z.string().optional().describe('Filter by status (e.g., active, paused)'),
    type: z.string().optional().describe('Filter by monitor type'),
  },
  async (params) => {
    try {
      const result = monitorList(params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// Tool: monitor_check
server.tool(
  'monitor_check',
  'Run a check on a specific monitor, capture snapshot, calculate delta, and generate alerts',
  {
    monitor_id: z.string().describe('ID of the monitor to check'),
    data: z.record(z.unknown()).describe('Current data snapshot to record'),
  },
  async (params) => {
    try {
      const result = monitorCheck(params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// Tool: monitor_history
server.tool(
  'monitor_history',
  'Return snapshot history for a monitor with delta trends',
  {
    monitor_id: z.string().describe('ID of the monitor'),
    limit: z.number().optional().describe('Maximum number of snapshots to return (default: 20)'),
  },
  async (params) => {
    try {
      const result = monitorHistory(params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// Tool: monitor_delete
server.tool(
  'monitor_delete',
  'Delete a monitor and all its snapshots',
  {
    monitor_id: z.string().describe('ID of the monitor to delete'),
  },
  async (params) => {
    try {
      const result = monitorDelete(params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: monitor_auto_check ──
server.tool(
  'monitor_auto_check',
  'Run automated checks on all active monitors. Returns an execution manifest so the gateway can process all monitor checks in parallel. Designed for scheduled/cron execution.',
  {},
  async () => {
    try {
      const { getDatabase } = await import('./db/database.js');
      const db = getDatabase();
      const monitors = db.prepare("SELECT * FROM monitors WHERE status = 'active'").all() as any[];

      if (monitors.length === 0) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ message: 'No active monitors to check', complete: true }) }],
        };
      }

      const stepGroups = monitors.map((monitor: any, index: number) => ({
        group_index: index,
        parallel: true,
        actions: [{
          action_id: `check_${monitor.id}`,
          tool_name: 'monitor_check',
          params: { monitor_id: monitor.id },
          description: `Check monitor: ${monitor.name}`,
        }],
      }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            __ivy_execution_manifest: true,
            type: 'plan',
            source_server: 'agent-monitor',
            step_groups: stepGroups,
          }),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: monitor_brief ──
server.tool(
  'monitor_brief',
  'Generate a proactive briefing summarizing all recent monitor changes since last check. Designed to surface at session start so users see important market changes immediately. Inspired by Claude Code\'s Kairos proactive agent pattern.',
  {
    since_hours: z.number().min(1).max(720).optional().describe('Look back period in hours (default: 24)'),
    include_no_change: z.boolean().optional().describe('Include monitors with no changes (default: false)'),
  },
  async (params) => {
    try {
      const { getDatabase } = await import('./db/database.js');
      const db = getDatabase();
      const sinceHours = params.since_hours ?? 24;
      const includeNoChange = params.include_no_change ?? false;

      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - sinceHours);
      const cutoffISO = cutoff.toISOString();

      // Get all active monitors
      const monitors = db.prepare("SELECT * FROM monitors WHERE status = 'active'").all() as any[];
      if (monitors.length === 0) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            brief: 'No active monitors configured.',
            monitors: [],
            period: `${sinceHours}h`,
          }, null, 2) }],
        };
      }

      // Get recent snapshots for each monitor
      const briefItems: Array<{
        monitor_name: string;
        monitor_type: string;
        target: string;
        has_changes: boolean;
        alerts: any[];
        latest_snapshot: any;
        delta: any;
      }> = [];

      for (const monitor of monitors) {
        const snapshots = db.prepare(`
          SELECT * FROM snapshots
          WHERE monitor_id = ? AND created_at > ?
          ORDER BY created_at DESC LIMIT 2
        `).all(monitor.id, cutoffISO) as any[];

        const alerts = db.prepare(`
          SELECT * FROM alerts
          WHERE monitor_id = ? AND created_at > ?
          ORDER BY created_at DESC
        `).all(monitor.id, cutoffISO) as any[];

        const hasChanges = snapshots.length > 0 || alerts.length > 0;
        if (!hasChanges && !includeNoChange) continue;

        let delta = null;
        if (snapshots.length >= 2) {
          try {
            const current = JSON.parse(snapshots[0].data);
            const previous = JSON.parse(snapshots[1].data);
            delta = computeDelta(current, previous);
          } catch { /* ignore parse errors */ }
        }

        briefItems.push({
          monitor_name: monitor.name,
          monitor_type: monitor.type,
          target: monitor.target,
          has_changes: hasChanges,
          alerts: alerts.map((a: any) => {
            try { return JSON.parse(a.data || '{}'); } catch { return {}; }
          }),
          latest_snapshot: snapshots[0] ? (() => {
            try { return JSON.parse(snapshots[0].data); } catch { return null; }
          })() : null,
          delta,
        });
      }

      // Build narrative summary
      const alertCount = briefItems.reduce((sum, item) => sum + item.alerts.length, 0);
      const changedCount = briefItems.filter(item => item.has_changes).length;

      const summary = alertCount > 0
        ? `${alertCount} alert(s) across ${changedCount} monitor(s) in the last ${sinceHours}h.`
        : changedCount > 0
          ? `${changedCount} monitor(s) recorded new data in the last ${sinceHours}h. No alerts triggered.`
          : `All ${monitors.length} monitors quiet — no changes in the last ${sinceHours}h.`;

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          brief: summary,
          period: `${sinceHours}h`,
          total_monitors: monitors.length,
          monitors_with_changes: changedCount,
          total_alerts: alertCount,
          items: briefItems,
        }, null, 2) }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

function computeDelta(current: any, previous: any): Record<string, { before: any; after: any; change: string }> {
  const delta: Record<string, { before: any; after: any; change: string }> = {};
  for (const key of new Set([...Object.keys(current || {}), ...Object.keys(previous || {})])) {
    const cur = current?.[key];
    const prev = previous?.[key];
    if (cur === prev) continue;
    if (typeof cur === 'number' && typeof prev === 'number') {
      const pctChange = prev !== 0 ? ((cur - prev) / prev * 100).toFixed(1) + '%' : 'new';
      delta[key] = { before: prev, after: cur, change: pctChange };
    } else if (cur !== prev) {
      delta[key] = { before: prev, after: cur, change: 'changed' };
    }
  }
  return delta;
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Agent Monitor MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
