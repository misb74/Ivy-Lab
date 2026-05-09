import crypto from 'crypto';
import { Cron } from 'croner';
import { getDb } from '../db/database.js';
import { dispatch } from './dispatcher.js';
import type { ScheduledNotificationRow } from '../db/schema.js';

const activeJobs = new Map<string, Cron>();

export interface ScheduleParams {
  cron: string;
  channel: string;
  recipient: string;
  subject?: string;
  body: string;
}

export interface ScheduleResult {
  id: string;
  cron: string;
  channel: string;
  recipient: string;
  status: string;
  next_run_at: string | null;
  message: string;
}

export function scheduleNotification(params: ScheduleParams): ScheduleResult {
  const { cron: cronExpr, channel, recipient, subject, body } = params;

  const db = getDb();
  const id = crypto.randomUUID();

  // Validate the cron expression by creating a temporary job
  let nextRun: string | null = null;
  try {
    const testJob = new Cron(cronExpr);
    const nextDate = testJob.nextRun();
    nextRun = nextDate ? nextDate.toISOString() : null;
    testJob.stop();
  } catch (err) {
    throw new Error(`Invalid cron expression "${cronExpr}": ${(err as Error).message}`);
  }

  // Persist scheduled notification
  db.prepare(`
    INSERT INTO scheduled_notifications (id, cron, channel, recipient, subject, body, status, next_run_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(id, cronExpr, channel, recipient, subject ?? null, body, nextRun);

  // Start the cron job
  const job = new Cron(cronExpr, async () => {
    try {
      await dispatch({ channel, recipient, subject, body });

      const now = new Date().toISOString();
      const next = job.nextRun();
      const nextRunAt = next ? next.toISOString() : null;

      db.prepare(`
        UPDATE scheduled_notifications SET last_run_at = ?, next_run_at = ? WHERE id = ?
      `).run(now, nextRunAt, id);
    } catch (err) {
      console.error(`Scheduled notification ${id} failed:`, (err as Error).message);
    }
  });

  activeJobs.set(id, job);

  return {
    id,
    cron: cronExpr,
    channel,
    recipient,
    status: 'active',
    next_run_at: nextRun,
    message: `Notification scheduled successfully. Next run: ${nextRun ?? 'unknown'}`,
  };
}

export function stopScheduledNotification(id: string): { success: boolean; message: string } {
  const job = activeJobs.get(id);
  if (job) {
    job.stop();
    activeJobs.delete(id);
  }

  const db = getDb();
  db.prepare(`
    UPDATE scheduled_notifications SET status = 'paused' WHERE id = ?
  `).run(id);

  return { success: true, message: `Scheduled notification ${id} has been paused.` };
}

export function listScheduledNotifications(): ScheduledNotificationRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM scheduled_notifications ORDER BY created_at DESC
  `).all() as ScheduledNotificationRow[];
}

export function restoreScheduledJobs(): void {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM scheduled_notifications WHERE status = 'active'
  `).all() as ScheduledNotificationRow[];

  for (const row of rows) {
    try {
      const job = new Cron(row.cron, async () => {
        try {
          await dispatch({
            channel: row.channel,
            recipient: row.recipient,
            subject: row.subject ?? undefined,
            body: row.body,
          });

          const now = new Date().toISOString();
          const next = job.nextRun();
          const nextRunAt = next ? next.toISOString() : null;

          db.prepare(`
            UPDATE scheduled_notifications SET last_run_at = ?, next_run_at = ? WHERE id = ?
          `).run(now, nextRunAt, row.id);
        } catch (err) {
          console.error(`Scheduled notification ${row.id} failed:`, (err as Error).message);
        }
      });

      activeJobs.set(row.id, job);

      const next = job.nextRun();
      if (next) {
        db.prepare(`UPDATE scheduled_notifications SET next_run_at = ? WHERE id = ?`)
          .run(next.toISOString(), row.id);
      }
    } catch (err) {
      console.error(`Failed to restore scheduled notification ${row.id}:`, (err as Error).message);
    }
  }
}

export function stopAllJobs(): void {
  for (const [id, job] of activeJobs) {
    job.stop();
    activeJobs.delete(id);
  }
}
