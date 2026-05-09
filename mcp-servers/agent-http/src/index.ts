import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const MAX_BODY_LENGTH = 50000;

const server = new McpServer({
  name: 'agent-http',
  version: '2.0.0',
  description: 'Generic HTTP client for making web requests. Supports GET, POST, PUT, PATCH, DELETE with custom headers, JSON bodies, and form data.',
});

// http_request
server.tool(
  'http_request',
  'Make an HTTP request to any URL. Supports all common methods, custom headers, JSON bodies, and form-encoded data. Returns status, headers, and parsed body.',
  {
    url: z.string().describe('The URL to request'),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional().describe('HTTP method (default: GET)'),
    headers: z.string().optional().describe('Custom request headers as JSON object string, e.g. {"Authorization": "Bearer xxx"}'),
    body: z.string().optional().describe('Request body (for POST/PUT/PATCH). If no Content-Type header is set, defaults to application/json'),
    form_data: z.string().optional().describe('Form data as JSON object string, sent as application/x-www-form-urlencoded'),
  },
  async (params) => {
    try {
      const method = params.method ?? 'GET';
      const parsedHeaders: Record<string, string> = params.headers ? JSON.parse(params.headers) : {};
      const parsedFormData: Record<string, string> | null = params.form_data ? JSON.parse(params.form_data) : null;
      const reqHeaders: Record<string, string> = {
        'User-Agent': 'Ivy-WorkVine/2.0',
        ...parsedHeaders,
      };

      let reqBody: string | undefined;

      if (parsedFormData) {
        const encoded = new URLSearchParams(parsedFormData).toString();
        reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        reqBody = encoded;
      } else if (params.body) {
        if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }
        reqBody = params.body;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(params.url, {
          method,
          headers: reqHeaders,
          body: reqBody,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        const contentType = response.headers.get('content-type') ?? '';
        const rawBody = await response.text();

        let truncated = false;
        let bodyContent: string | unknown;

        if (rawBody.length > MAX_BODY_LENGTH) {
          truncated = true;
        }

        const trimmedBody = truncated ? rawBody.slice(0, MAX_BODY_LENGTH) : rawBody;

        if (contentType.includes('application/json')) {
          try {
            bodyContent = JSON.parse(trimmedBody);
          } catch {
            bodyContent = trimmedBody;
          }
        } else {
          bodyContent = trimmedBody;
        }

        const result = {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: bodyContent,
          truncated,
        };

        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const result = { error: message };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HTTP Agent MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
