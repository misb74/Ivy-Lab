import { getNotifications } from '../engine/dispatcher.js';

export interface NotifyListParams {
  status?: string;
  channel?: string;
  limit?: number;
}

export function notifyList(params: NotifyListParams) {
  const notifications = getNotifications({
    status: params.status,
    channel: params.channel,
    limit: params.limit,
  });

  return {
    count: notifications.length,
    filters: {
      status: params.status ?? 'all',
      channel: params.channel ?? 'all',
      limit: params.limit ?? 50,
    },
    notifications: notifications.map((n) => ({
      id: n.id,
      channel: n.channel,
      recipient: n.recipient,
      subject: n.subject,
      status: n.status,
      sent_at: n.sent_at,
      error: n.error,
      created_at: n.created_at,
    })),
  };
}
