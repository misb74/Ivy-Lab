export interface TeamsResult {
  success: boolean;
  error?: string;
}

function getWebhookUrl(): string {
  const url = process.env.TEAMS_WEBHOOK_URL;
  if (!url) {
    throw new Error('TEAMS_WEBHOOK_URL environment variable is not set.');
  }
  return url;
}

export async function sendTeams(
  recipient: string,
  subject: string | undefined,
  body: string,
): Promise<TeamsResult> {
  try {
    const webhookUrl = getWebhookUrl();

    const card = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          contentUrl: null,
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              ...(subject
                ? [
                    {
                      type: 'TextBlock',
                      size: 'Large',
                      weight: 'Bolder',
                      text: subject,
                      wrap: true,
                    },
                  ]
                : []),
              {
                type: 'TextBlock',
                text: body,
                wrap: true,
              },
              {
                type: 'TextBlock',
                text: `Recipient: ${recipient}`,
                isSubtle: true,
                size: 'Small',
                wrap: true,
              },
            ],
            actions: [],
          },
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });

    if (!response.ok) {
      const responseText = await response.text();
      return {
        success: false,
        error: `Teams API error: ${response.status} — ${responseText}`,
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
