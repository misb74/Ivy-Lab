import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { sendEmail } from './smtp.js';
import { readEmails, searchEmails } from './imap.js';
import { renderEmail } from './templates/render.js';
import type { JobType } from './templates/types.js';

const server = new McpServer({
  name: 'agent-email',
  version: '2.0.0',
  description: 'Email agent providing send, read, and search capabilities via SMTP and IMAP.',
});

// send_email
server.tool(
  'send_email',
  'Send an email via SMTP. Supports plain text and HTML bodies, with optional CC and BCC recipients.',
  {
    to: z.string().describe('Recipient email address (comma-separated for multiple)'),
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email body content (plain text or HTML depending on html flag)'),
    cc: z.string().optional().describe('CC recipients (comma-separated)'),
    bcc: z.string().optional().describe('BCC recipients (comma-separated)'),
    html: z.boolean().optional().describe('If true, body is sent as HTML. Default: false'),
  },
  async (params) => {
    try {
      const result = await sendEmail(params.to, params.subject, params.body, {
        cc: params.cc,
        bcc: params.bcc,
        html: params.html,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// read_email
server.tool(
  'read_email',
  'Read emails from a mailbox folder via IMAP. Returns subject, sender, date, body (truncated), and flags.',
  {
    folder: z.string().optional().describe('Mailbox folder to read from. Default: INBOX'),
    limit: z.number().optional().describe('Maximum number of emails to return. Default: 10'),
    unread_only: z.boolean().optional().describe('If true, only return unread emails. Default: true'),
  },
  async (params) => {
    try {
      const result = await readEmails(
        params.folder ?? 'INBOX',
        params.limit ?? 10,
        params.unread_only ?? true,
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// search_email
server.tool(
  'search_email',
  'Search emails by query string across subject, sender, and body text via IMAP.',
  {
    query: z.string().describe('Search query to match against subject, sender, and body text'),
    folder: z.string().optional().describe('Mailbox folder to search in. Default: INBOX'),
    limit: z.number().optional().describe('Maximum number of results to return. Default: 10'),
  },
  async (params) => {
    try {
      const result = await searchEmails(
        params.query,
        params.folder ?? 'INBOX',
        params.limit ?? 10,
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// send_templated_email
const VALID_TEMPLATES = ['talent-research', 'competitor-intel', 'swp-analysis', 'weekly-digest', 'insight-report'] as const;

server.tool(
  'send_templated_email',
  'Render an Ivy-branded email from a template and send it. Supports talent-research, competitor-intel, swp-analysis, weekly-digest, and insight-report templates. For insight-report, pass the full InsightArtifact JSON as variables.artifact. Use preview_only to inspect the rendered HTML without sending.',
  {
    to: z.string().describe('Recipient email address (comma-separated for multiple)'),
    template: z.enum(VALID_TEMPLATES).describe('Template to render'),
    variables: z.record(z.string(), z.any()).describe('Template-specific context variables (see template types for required fields)'),
    cc: z.string().optional().describe('CC recipients (comma-separated)'),
    bcc: z.string().optional().describe('BCC recipients (comma-separated)'),
    preview_only: z.boolean().optional().describe('If true, render and return HTML without sending. Default: false'),
    attachment_paths: z.array(z.string()).optional().describe('Absolute file paths to attach to the email'),
  },
  async (params) => {
    try {
      const rendered = renderEmail(params.template as JobType, params.variables);

      if (params.preview_only) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              preview: true,
              template: params.template,
              subject: rendered.subject,
              html: rendered.html,
              text: rendered.text,
            }, null, 2),
          }],
        };
      }

      const attachments = params.attachment_paths?.map(p => ({
        filename: path.basename(p),
        path: p,
      }));

      const result = await sendEmail(params.to, rendered.subject, rendered.html, {
        cc: params.cc,
        bcc: params.bcc,
        html: true,
        attachments,
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            ...result,
            template: params.template,
            subject: rendered.subject,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Email Agent MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
