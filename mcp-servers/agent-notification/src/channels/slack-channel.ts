export interface SlackResult {
  success: boolean;
  error?: string;
}

function getWebhookUrl(): string {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    throw new Error('SLACK_WEBHOOK_URL environment variable is not set.');
  }
  return url;
}

export async function sendSlack(
  recipient: string,
  subject: string | undefined,
  body: string,
): Promise<SlackResult> {
  try {
    const webhookUrl = getWebhookUrl();

    const blocks: Record<string, unknown>[] = [];

    if (subject) {
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: subject,
          emoji: true,
        },
      });
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: body,
      },
    });

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Sent to: ${recipient} | via Ivy Notification Agent`,
        },
      ],
    });

    const payload = {
      channel: recipient,
      blocks,
      text: subject || body.substring(0, 150),
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text();
      return {
        success: false,
        error: `Slack API error: ${response.status} — ${responseText}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
