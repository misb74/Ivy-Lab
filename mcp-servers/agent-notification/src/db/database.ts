import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  CREATE_NOTIFICATIONS_TABLE,
  CREATE_NOTIFICATION_PREFERENCES_TABLE,
  CREATE_SCHEDULED_NOTIFICATIONS_TABLE,
  CREATE_NOTIFICATIONS_CHANNEL_INDEX,
  CREATE_NOTIFICATIONS_STATUS_INDEX,
  CREATE_NOTIFICATION_PREFERENCES_USER_INDEX,
} from './schema.js';

const DB_DIR = path.resolve(process.cwd(), 'data', 'notifications');
const DB_PATH = path.join(DB_DIR, 'notifications.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(CREATE_NOTIFICATIONS_TABLE);
    db.exec(CREATE_NOTIFICATION_PREFERENCES_TABLE);
    db.exec(CREATE_SCHEDULED_NOTIFICATIONS_TABLE);
    db.exec(CREATE_NOTIFICATIONS_CHANNEL_INDEX);
    db.exec(CREATE_NOTIFICATIONS_STATUS_INDEX);
    db.exec(CREATE_NOTIFICATION_PREFERENCES_USER_INDEX);

    // Safe migration — add tenant_id column
    try {
      db.exec("ALTER TABLE notifications ADD COLUMN tenant_id TEXT DEFAULT 'default'");
      db.exec("CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id)");
    } catch {} // Column already exists — ignore
    try {
      db.exec("ALTER TABLE scheduled_notifications ADD COLUMN tenant_id TEXT DEFAULT 'default'");
      db.exec("CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_tenant ON scheduled_notifications(tenant_id)");
    } catch {} // Column already exists — ignore
    try {
      db.exec("ALTER TABLE notification_preferences ADD COLUMN tenant_id TEXT DEFAULT 'default'");
      db.exec("CREATE INDEX IF NOT EXISTS idx_notification_preferences_tenant ON notification_preferences(tenant_id)");
    } catch {} // Column already exists — ignore
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
