import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { notifySend } from './tools/notify-send.js';
import { notifySchedule } from './tools/notify-schedule.js';
import { notifyList } from './tools/notify-list.js';
import { notifyPreferences } from './tools/notify-preferences.js';
import { restoreScheduledJobs, stopAllJobs } from './engine/scheduler.js';
import { closeDb } from './db/database.js';

const server = new McpServer({
  name: 'agent-notification',
  version: '2.0.0',
  description: 'Multi-channel notification agent supporting email, Slack, and Teams with scheduling and user preferences.',
});

// notify_send
server.tool(
  'notify_send',
  'Send an immediate notification via a specified channel (email, slack, or teams). Optionally respects user quiet hours.',
  {
    channel: z.enum(['email', 'slack', 'teams']).describe('Notification channel to use'),
    recipient: z.string().describe('Recipient address — email address, Slack channel/user, or Teams channel'),
    subject: z.string().optional().describe('Notification subject line (used as header in Slack/Teams)'),
    body: z.string().describe('Notification body content'),
    user_id: z.string().optional().describe('User ID to check quiet hours preferences against'),
    force: z.boolean().optional().describe('If true, send even during quiet hours. Default: false'),
  },
  async (params) => {
    try {
      const result = await notifySend(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// notify_schedule
server.tool(
  'notify_schedule',
  'Schedule a recurring notification with a cron expression. Supports creating, stopping, and listing scheduled notifications.',
  {
    action: z.enum(['create', 'stop', 'list']).describe('Action to perform: create a schedule, stop a schedule, or list all schedules'),
    cron: z.string().optional().describe('Cron expression for the schedule (required for create). Example: "0 9 * * 1" for every Monday at 9am'),
    channel: z.enum(['email', 'slack', 'teams']).optional().describe('Notification channel (required for create)'),
    recipient: z.string().optional().describe('Recipient address (required for create)'),
    subject: z.string().optional().describe('Notification subject line'),
    body: z.string().optional().describe('Notification body content (required for create)'),
    schedule_id: z.string().optional().describe('Schedule ID to stop (required for stop action)'),
  },
  async (params) => {
    try {
      const result = notifySchedule(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// notify_list
server.tool(
  'notify_list',
  'List sent and pending notifications with optional filters by status and channel.',
  {
    status: z.enum(['pending', 'sent', 'failed']).optional().describe('Filter by notification status'),
    channel: z.enum(['email', 'slack', 'teams']).optional().describe('Filter by notification channel'),
    limit: z.number().optional().describe('Maximum number of notifications to return. Default: 50'),
  },
  async (params) => {
    try {
      const result = notifyList(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// notify_preferences
server.tool(
  'notify_preferences',
  'Get or set notification preferences for a user, including preferred channels and quiet hours.',
  {
    action: z.enum(['get', 'set', 'delete']).describe('Action: get current preferences, set/update preferences, or delete preferences'),
    user_id: z.string().describe('User ID to manage preferences for'),
    channels: z.array(z.enum(['email', 'slack', 'teams'])).optional().describe('Preferred notification channels (for set action)'),
    quiet_hours_start: z.string().optional().describe('Quiet hours start time in HH:MM format, e.g. "22:00" (for set action)'),
    quiet_hours_end: z.string().optional().describe('Quiet hours end time in HH:MM format, e.g. "07:00" (for set action)'),
  },
  async (params) => {
    try {
      const result = notifyPreferences(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

async function main() {
  // Restore any previously scheduled notifications from the database
  restoreScheduledJobs();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Notification Agent MCP server running on stdio');
}

// Graceful shutdown
process.on('SIGINT', () => {
  stopAllJobs();
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAllJobs();
  closeDb();
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
