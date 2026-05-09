export const CREATE_NOTIFICATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    sent_at TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_NOTIFICATION_PREFERENCES_TABLE = `
  CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    channels TEXT DEFAULT '["email"]',
    quiet_hours_start TEXT,
    quiet_hours_end TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_SCHEDULED_NOTIFICATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id TEXT PRIMARY KEY,
    cron TEXT NOT NULL,
    channel TEXT NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    last_run_at TEXT,
    next_run_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_NOTIFICATIONS_CHANNEL_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(channel)
`;

export const CREATE_NOTIFICATIONS_STATUS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status)
`;

export const CREATE_NOTIFICATION_PREFERENCES_USER_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id)
`;

export interface NotificationRow {
  id: string;
  channel: string;
  recipient: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
  error: string | null;
  created_at: string;
}

export interface NotificationPreferenceRow {
  id: string;
  user_id: string;
  channels: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledNotificationRow {
  id: string;
  cron: string;
  channel: string;
  recipient: string;
  subject: string | null;
  body: string;
  status: string;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}
