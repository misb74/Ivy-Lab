import { scheduleNotification, stopScheduledNotification, listScheduledNotifications } from '../engine/scheduler.js';
import { validateChannel } from '../engine/dispatcher.js';

export interface NotifyScheduleParams {
  action: string;
  cron?: string;
  channel?: string;
  recipient?: string;
  subject?: string;
  body?: string;
  schedule_id?: string;
}

export function notifySchedule(params: NotifyScheduleParams) {
  const { action } = params;

  switch (action) {
    case 'create': {
      const { cron, channel, recipient, body, subject } = params;

      if (!cron) throw new Error('cron expression is required for creating a schedule.');
      if (!channel) throw new Error('channel is required for creating a schedule.');
      if (!recipient) throw new Error('recipient is required for creating a schedule.');
      if (!body) throw new Error('body is required for creating a schedule.');

      if (!validateChannel(channel)) {
        throw new Error(`Unsupported channel "${channel}". Supported: email, slack, teams.`);
      }

      return scheduleNotification({ cron, channel, recipient, subject, body });
    }

    case 'stop': {
      const { schedule_id } = params;
      if (!schedule_id) throw new Error('schedule_id is required to stop a schedule.');
      return stopScheduledNotification(schedule_id);
    }

    case 'list': {
      const schedules = listScheduledNotifications();
      return {
        count: schedules.length,
        schedules: schedules.map((s) => ({
          id: s.id,
          cron: s.cron,
          channel: s.channel,
          recipient: s.recipient,
          subject: s.subject,
          status: s.status,
          last_run_at: s.last_run_at,
          next_run_at: s.next_run_at,
          created_at: s.created_at,
        })),
      };
    }

    default:
      throw new Error(`Unknown action "${action}". Supported: create, stop, list.`);
  }
}
