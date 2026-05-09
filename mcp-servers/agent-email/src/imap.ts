import { ImapFlow } from 'imapflow';

interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  flags: string[];
}

const MAX_BODY_LENGTH = 5000;

function createClient(): ImapFlow {
  if (!process.env.IMAP_HOST || !process.env.IMAP_USER || !process.env.IMAP_PASSWORD) {
    throw new Error('IMAP configuration missing. Required env vars: IMAP_HOST, IMAP_USER, IMAP_PASSWORD');
  }

  return new ImapFlow({
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: true,
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASSWORD,
    },
    logger: false,
  });
}

function formatAddress(addr: any): string {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  if (addr.address) return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
  if (Array.isArray(addr)) return addr.map(formatAddress).join(', ');
  if (addr.value && Array.isArray(addr.value)) return addr.value.map(formatAddress).join(', ');
  return String(addr);
}

function truncateBody(text: string): string {
  if (text.length <= MAX_BODY_LENGTH) return text;
  return text.slice(0, MAX_BODY_LENGTH) + '\n... [truncated]';
}

async function parseMessage(msg: any): Promise<EmailMessage> {
  const envelope = msg.envelope || {};
  const bodyPart = msg.source ? msg.source.toString() : '';

  let bodyText = '';
  if (msg.bodyParts) {
    for (const [, value] of msg.bodyParts) {
      bodyText = value.toString();
      break;
    }
  } else if (msg.text) {
    bodyText = typeof msg.text === 'string' ? msg.text : '';
  } else {
    bodyText = bodyPart;
  }

  return {
    from: formatAddress(envelope.from),
    to: formatAddress(envelope.to),
    subject: envelope.subject || '(no subject)',
    date: envelope.date ? new Date(envelope.date).toISOString() : '',
    body: truncateBody(bodyText),
    flags: msg.flags ? Array.from(msg.flags) : [],
  };
}

export async function readEmails(
  folder: string,
  limit: number,
  unreadOnly: boolean,
): Promise<EmailMessage[]> {
  const client = createClient();
  const emails: EmailMessage[] = [];

  try {
    await client.connect();

    const lock = await client.getMailboxLock(folder);
    try {
      const searchCriteria: any = unreadOnly ? { seen: false } : { all: true };
      const uids = await client.search(searchCriteria, { uid: true });

      if (uids.length === 0) {
        return [];
      }

      // Take the most recent messages up to the limit
      const selectedUids = uids.slice(-limit);
      const uidRange = selectedUids.join(',');

      for await (const msg of client.fetch(uidRange, {
        envelope: true,
        bodyParts: ['1'],
        flags: true,
        uid: true,
      })) {
        emails.push(await parseMessage(msg));
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return emails.reverse();
}

export async function searchEmails(
  query: string,
  folder: string,
  limit: number,
): Promise<EmailMessage[]> {
  const client = createClient();
  const emails: EmailMessage[] = [];

  try {
    await client.connect();

    const lock = await client.getMailboxLock(folder);
    try {
      // Search by OR across subject, from, and body text
      const searchCriteria = {
        or: [
          { subject: query },
          { from: query },
          { body: query },
        ],
      };

      const uids = await client.search(searchCriteria, { uid: true });

      if (uids.length === 0) {
        return [];
      }

      // Take the most recent results up to the limit
      const selectedUids = uids.slice(-limit);
      const uidRange = selectedUids.join(',');

      for await (const msg of client.fetch(uidRange, {
        envelope: true,
        bodyParts: ['1'],
        flags: true,
        uid: true,
      })) {
        emails.push(await parseMessage(msg));
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return emails.reverse();
}
