import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { browseAndExtract } from './tools/browse-extract.js';
import { fillAndSubmitForm } from './tools/fill-submit.js';
import { monitorPage } from './tools/monitor-page.js';
import { multiStepBrowse } from './tools/multi-step.js';
import { screenshotAndAnalyze } from './tools/screenshot-analyze.js';
import { closeBrowser } from './browser/browser-manager.js';

const server = new McpServer({
  name: 'agent-browser',
  version: '2.0.0',
  description: 'Autonomous browser agent with Playwright. HARD RULES: never purchase/pay, never expose or enter passwords.',
});

// browse_and_extract
server.tool(
  'browse_and_extract',
  'Navigate to a URL and extract page content including text, headings, links, and metadata. Use for reading web pages, scraping data, and gathering information.',
  {
    url: z.string().url().describe('The URL to navigate to'),
    prompt: z.string().describe('What to look for or extract from the page'),
    wait_for: z.string().optional().describe('CSS selector to wait for before extracting'),
  },
  async (params) => {
    try {
      const result = await browseAndExtract(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// fill_and_submit_form
server.tool(
  'fill_and_submit_form',
  'Fill form fields and optionally submit. Takes a screenshot before submission. SAFETY: Blocks password fields and payment forms automatically.',
  {
    url: z.string().url().describe('The URL of the page with the form'),
    fields: z.array(z.object({
      selector: z.string().describe('CSS selector for the form field'),
      value: z.string().describe('Value to fill in'),
    })).describe('Fields to fill'),
    submit_selector: z.string().optional().describe('CSS selector for the submit button'),
  },
  async (params) => {
    try {
      const result = await fillAndSubmitForm(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// monitor_page
server.tool(
  'monitor_page',
  'Monitor a web page for changes by polling at a regular interval. Useful for tracking price changes, stock availability, or content updates.',
  {
    url: z.string().url().describe('The URL to monitor'),
    selector: z.string().optional().describe('CSS selector to monitor (default: entire page)'),
    interval_seconds: z.number().min(5).max(300).optional().describe('Seconds between checks (default 30)'),
    max_checks: z.number().min(1).max(20).optional().describe('Maximum number of checks (default 5)'),
  },
  async (params) => {
    try {
      const result = await monitorPage(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// multi_step_browse
server.tool(
  'multi_step_browse',
  'Execute a sequence of browser actions: goto, click, fill, wait, extract, screenshot. Each action is performed in order on the same page/tab.',
  {
    actions: z.array(z.object({
      action: z.enum(['goto', 'click', 'fill', 'wait', 'extract', 'screenshot']).describe('Action type'),
      selector: z.string().optional().describe('CSS selector (for click, fill, wait, extract)'),
      value: z.string().optional().describe('Value for fill or URL for goto'),
      url: z.string().optional().describe('URL for goto action'),
      timeout: z.number().optional().describe('Timeout in ms'),
    })).describe('Ordered list of browser actions'),
  },
  async (params) => {
    try {
      const result = await multiStepBrowse(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// screenshot_and_analyze
server.tool(
  'screenshot_and_analyze',
  'Take a screenshot of a web page and return structural analysis (headings, link count, forms, images, buttons, metadata).',
  {
    url: z.string().url().describe('The URL to screenshot'),
    full_page: z.boolean().optional().describe('Capture full scrollable page (default false)'),
    selector: z.string().optional().describe('CSS selector to screenshot specific element'),
  },
  async (params) => {
    try {
      const result = await screenshotAndAnalyze(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Browser Agent MCP server running on stdio');
}

process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
