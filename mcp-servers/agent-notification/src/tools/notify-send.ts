import { dispatch } from '../engine/dispatcher.js';
import { isInQuietHours } from '../engine/preference-manager.js';

export interface NotifySendParams {
  channel: string;
  recipient: string;
  subject?: string;
  body: string;
  user_id?: string;
  force?: boolean;
}

export async function notifySend(params: NotifySendParams) {
  const { channel, recipient, subject, body, user_id, force } = params;

  // Check quiet hours if user_id is provided
  if (user_id && !force && isInQuietHours(user_id)) {
    return {
      sent: false,
      reason: `User "${user_id}" is currently in quiet hours. Set force=true to override.`,
    };
  }

  const result = await dispatch({ channel, recipient, subject, body });

  return {
    sent: result.status === 'sent',
    notification_id: result.id,
    channel: result.channel,
    recipient: result.recipient,
    status: result.status,
    ...(result.messageId && { message_id: result.messageId }),
    ...(result.error && { error: result.error }),
    ...(result.sent_at && { sent_at: result.sent_at }),
  };
}
