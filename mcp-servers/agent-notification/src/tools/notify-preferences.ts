import { getPreferences, setPreferences, deletePreferences } from '../engine/preference-manager.js';

export interface NotifyPreferencesParams {
  action: string;
  user_id: string;
  channels?: string[];
  quiet_hours_start?: string;
  quiet_hours_end?: string;
}

export function notifyPreferences(params: NotifyPreferencesParams) {
  const { action, user_id } = params;

  switch (action) {
    case 'get': {
      const prefs = getPreferences(user_id);
      if (!prefs) {
        return {
          found: false,
          message: `No preferences found for user "${user_id}". Defaults will be used (channels: ["email"], no quiet hours).`,
          defaults: {
            channels: ['email'],
            quiet_hours_start: null,
            quiet_hours_end: null,
          },
        };
      }
      return { found: true, preferences: prefs };
    }

    case 'set': {
      const updated = setPreferences(user_id, {
        channels: params.channels,
        quiet_hours_start: params.quiet_hours_start,
        quiet_hours_end: params.quiet_hours_end,
      });
      return {
        message: `Preferences updated for user "${user_id}".`,
        preferences: updated,
      };
    }

    case 'delete': {
      return deletePreferences(user_id);
    }

    default:
      throw new Error(`Unknown action "${action}". Supported: get, set, delete.`);
  }
}
