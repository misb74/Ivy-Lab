import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { sandboxManager } from './sandbox-manager.js';
import { checkAction } from './safety.js';

const server = new McpServer({
  name: 'agent-computer-use',
  version: '1.0.0',
  description: 'E2B Desktop Sandbox manager for Anthropic Computer Use. Provides per-session virtual desktops with Chromium browser. HARD RULES: never purchase/pay, never enter passwords or credentials.',
});

// computer_sandbox_create
server.tool(
  'computer_sandbox_create',
  'Create a new E2B Desktop Sandbox (virtual Ubuntu desktop with Chromium) for the given session. Returns sandbox ID, stream URL, and display dimensions. Only one sandbox per session.',
  {
    session_id: z.string().describe('The gateway session ID for sandbox isolation'),
  },
  async ({ session_id }) => {
    try {
      const info = await sandboxManager.createSandbox(session_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// computer_sandbox_screenshot
server.tool(
  'computer_sandbox_screenshot',
  'Take a screenshot of the current sandbox display. Returns base64-encoded PNG image.',
  {
    session_id: z.string().describe('The gateway session ID'),
  },
  async ({ session_id }) => {
    try {
      const result = await sandboxManager.screenshot(session_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// computer_sandbox_action
server.tool(
  'computer_sandbox_action',
  'Execute a computer use action (click, type, key, scroll, drag, move, wait) on the sandbox. SAFETY: Blocks credential input and dangerous commands.',
  {
    session_id: z.string().describe('The gateway session ID'),
    action: z.enum([
      'left_click', 'right_click', 'middle_click', 'double_click', 'triple_click',
      'type', 'key', 'mouse_move', 'scroll', 'left_click_drag', 'wait',
    ]).describe('The action to execute'),
    coordinate: z.tuple([z.number(), z.number()]).optional().describe('Screen coordinates [x, y]'),
    text: z.string().optional().describe('Text to type or key combo to press'),
    scroll_direction: z.enum(['up', 'down', 'left', 'right']).optional().describe('Scroll direction'),
    scroll_amount: z.number().optional().describe('Scroll amount (default 3)'),
    start_coordinate: z.tuple([z.number(), z.number()]).optional().describe('Start coordinates for drag'),
    duration: z.number().optional().describe('Duration in seconds for wait action'),
  },
  async (params) => {
    try {
      // Safety check
      const violation = checkAction(params.action, params);
      if (violation) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: `SAFETY BLOCK: ${violation.reason}` }) }],
          isError: true,
        };
      }

      const result = await sandboxManager.executeAction(params.session_id, params.action, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// computer_sandbox_destroy
server.tool(
  'computer_sandbox_destroy',
  'Destroy the sandbox for a session, freeing resources. Called automatically on idle timeout, mode switch, or session cleanup.',
  {
    session_id: z.string().describe('The gateway session ID'),
  },
  async ({ session_id }) => {
    try {
      const destroyed = await sandboxManager.destroySandbox(session_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: destroyed }) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// computer_sandbox_status
server.tool(
  'computer_sandbox_status',
  'Get the status of a sandbox including uptime, idle time, and estimated cost.',
  {
    session_id: z.string().describe('The gateway session ID'),
  },
  async ({ session_id }) => {
    try {
      const status = sandboxManager.getStatus(session_id);
      if (!status) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ status: 'stopped', error: 'No active sandbox for this session' }) }] };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Computer Use MCP server running on stdio');
}

process.on('SIGINT', async () => {
  await sandboxManager.destroyAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await sandboxManager.destroyAll();
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
