import crypto from 'crypto';
import { getDb } from '../db/database.js';
import type { NotificationPreferenceRow } from '../db/schema.js';

export interface PreferenceData {
  channels?: string[];
  quiet_hours_start?: string;
  quiet_hours_end?: string;
}

export interface UserPreferences {
  user_id: string;
  channels: string[];
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  created_at: string;
  updated_at: string;
}

export function getPreferences(userId: string): UserPreferences | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM notification_preferences WHERE user_id = ?
  `).get(userId) as NotificationPreferenceRow | undefined;

  if (!row) return null;

  return {
    user_id: row.user_id,
    channels: JSON.parse(row.channels) as string[],
    quiet_hours_start: row.quiet_hours_start,
    quiet_hours_end: row.quiet_hours_end,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function setPreferences(userId: string, data: PreferenceData): UserPreferences {
  const db = getDb();
  const existing = db.prepare(`
    SELECT * FROM notification_preferences WHERE user_id = ?
  `).get(userId) as NotificationPreferenceRow | undefined;

  const now = new Date().toISOString();

  if (existing) {
    const channels = data.channels ? JSON.stringify(data.channels) : existing.channels;
    const quietStart = data.quiet_hours_start !== undefined ? data.quiet_hours_start : existing.quiet_hours_start;
    const quietEnd = data.quiet_hours_end !== undefined ? data.quiet_hours_end : existing.quiet_hours_end;

    db.prepare(`
      UPDATE notification_preferences
      SET channels = ?, quiet_hours_start = ?, quiet_hours_end = ?, updated_at = ?
      WHERE user_id = ?
    `).run(channels, quietStart, quietEnd, now, userId);

    return {
      user_id: userId,
      channels: JSON.parse(channels) as string[],
      quiet_hours_start: quietStart,
      quiet_hours_end: quietEnd,
      created_at: existing.created_at,
      updated_at: now,
    };
  }

  const id = crypto.randomUUID();
  const channels = data.channels ? JSON.stringify(data.channels) : '["email"]';
  const quietStart = data.quiet_hours_start ?? null;
  const quietEnd = data.quiet_hours_end ?? null;

  db.prepare(`
    INSERT INTO notification_preferences (id, user_id, channels, quiet_hours_start, quiet_hours_end, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, channels, quietStart, quietEnd, now, now);

  return {
    user_id: userId,
    channels: JSON.parse(channels) as string[],
    quiet_hours_start: quietStart,
    quiet_hours_end: quietEnd,
    created_at: now,
    updated_at: now,
  };
}

export function getPreferredChannels(userId: string): string[] {
  const prefs = getPreferences(userId);
  return prefs ? prefs.channels : ['email'];
}

export function isInQuietHours(userId: string): boolean {
  const prefs = getPreferences(userId);
  if (!prefs || !prefs.quiet_hours_start || !prefs.quiet_hours_end) {
    return false;
  }

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const start = prefs.quiet_hours_start;
  const end = prefs.quiet_hours_end;

  // Handle overnight quiet hours (e.g., 22:00 to 07:00)
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }

  return currentTime >= start && currentTime < end;
}

export function deletePreferences(userId: string): { success: boolean; message: string } {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM notification_preferences WHERE user_id = ?
  `).run(userId);

  if (result.changes === 0) {
    return { success: false, message: `No preferences found for user "${userId}".` };
  }

  return { success: true, message: `Preferences for user "${userId}" have been deleted.` };
}
