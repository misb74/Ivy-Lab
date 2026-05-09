import crypto from 'crypto';
import { getDb } from '../db/database.js';
import { sendEmail } from '../channels/email-channel.js';
import { sendSlack } from '../channels/slack-channel.js';
import { sendTeams } from '../channels/teams-channel.js';
import type { NotificationRow } from '../db/schema.js';

const SUPPORTED_CHANNELS = ['email', 'slack', 'teams'] as const;
export type Channel = (typeof SUPPORTED_CHANNELS)[number];

export interface DispatchParams {
  channel: string;
  recipient: string;
  subject?: string;
  body: string;
}

export interface DispatchResult {
  id: string;
  channel: string;
  recipient: string;
  status: string;
  messageId?: string;
  error?: string;
  sent_at?: string;
}

export function validateChannel(channel: string): channel is Channel {
  return SUPPORTED_CHANNELS.includes(channel as Channel);
}

export async function dispatch(params: DispatchParams): Promise<DispatchResult> {
  const { channel, recipient, subject, body } = params;

  if (!validateChannel(channel)) {
    throw new Error(`Unsupported channel "${channel}". Supported channels: ${SUPPORTED_CHANNELS.join(', ')}`);
  }

  const db = getDb();
  const id = crypto.randomUUID();

  // Insert pending notification
  db.prepare(`
    INSERT INTO notifications (id, channel, recipient, subject, body, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(id, channel, recipient, subject ?? null, body);

  let status = 'sent';
  let messageId: string | undefined;
  let error: string | undefined;

  try {
    switch (channel) {
      case 'email': {
        const result = await sendEmail(recipient, subject, body);
        if (!result.success) {
          status = 'failed';
          error = result.error;
        } else {
          messageId = result.messageId;
        }
        break;
      }
      case 'slack': {
        const result = await sendSlack(recipient, subject, body);
        if (!result.success) {
          status = 'failed';
          error = result.error;
        }
        break;
      }
      case 'teams': {
        const result = await sendTeams(recipient, subject, body);
        if (!result.success) {
          status = 'failed';
          error = result.error;
        }
        break;
      }
    }
  } catch (err) {
    status = 'failed';
    error = (err as Error).message;
  }

  const sentAt = status === 'sent' ? new Date().toISOString() : null;

  // Update notification status
  db.prepare(`
    UPDATE notifications SET status = ?, sent_at = ?, error = ? WHERE id = ?
  `).run(status, sentAt, error ?? null, id);

  return {
    id,
    channel,
    recipient,
    status,
    ...(messageId && { messageId }),
    ...(error && { error }),
    ...(sentAt && { sent_at: sentAt }),
  };
}

export function getNotifications(filters: {
  status?: string;
  channel?: string;
  limit?: number;
}): NotificationRow[] {
  const db = getDb();
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.status) {
    conditions.push('status = ?');
    values.push(filters.status);
  }

  if (filters.channel) {
    conditions.push('channel = ?');
    values.push(filters.channel);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ?? 50;

  const stmt = db.prepare(`
    SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ?
  `);

  return stmt.all(...values, limit) as NotificationRow[];
}
