import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { scaffoldProject } from './tools/scaffold.js';
import { deployLocal } from './tools/deploy-local.js';
import { deployNgrok } from './tools/deploy-ngrok.js';
import { stopDeployment } from './tools/stop-deployment.js';
import { listDeploymentsHandler } from './tools/list-deployments.js';
import { createGithubRepo } from './tools/create-repo.js';
import { runCommand } from './tools/run-command.js';
import { stopAllDeployments } from './deploy/process-manager.js';

const server = new McpServer({
  name: 'agent-codeops',
  version: '2.0.0',
  description: 'Code scaffolding and deployment agent. Create projects from templates, deploy locally, expose via ngrok, and manage deployments.',
});

// scaffold_project
server.tool(
  'scaffold_project',
  'Create a new project from a template. Available templates: react-app (React + Vite), api-server (Express), static-site (HTML/CSS/JS), python-script (Flask).',
  {
    name: z.string().describe('Project name (alphanumeric, hyphens, underscores)'),
    template: z.enum(['react-app', 'api-server', 'static-site', 'python-script']).describe('Project template to use'),
  },
  async (params) => {
    try {
      const result = await scaffoldProject(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// deploy_local
server.tool(
  'deploy_local',
  'Start a local dev server for a scaffolded project. Auto-installs npm dependencies if needed. Returns localhost URL.',
  {
    project_name: z.string().describe('Name of the project to deploy'),
    port: z.number().min(1024).max(65535).optional().describe('Port number (default 3000)'),
    command: z.string().optional().describe('Custom start command (overrides package.json scripts)'),
  },
  async (params) => {
    try {
      const result = await deployLocal(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// deploy_ngrok
server.tool(
  'deploy_ngrok',
  'Expose a running local deployment to the internet via ngrok tunnel. Requires NGROK_AUTHTOKEN env var.',
  {
    deployment_id: z.string().describe('ID of the local deployment to expose'),
  },
  async (params) => {
    try {
      const result = await deployNgrok(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// stop_deployment
server.tool(
  'stop_deployment',
  'Stop a running deployment and its ngrok tunnel (if any). Kills the dev server process.',
  {
    deployment_id: z.string().describe('ID of the deployment to stop'),
  },
  async (params) => {
    try {
      const result = await stopDeployment(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// list_deployments
server.tool(
  'list_deployments',
  'List all active deployments with their local and public URLs.',
  {},
  async () => {
    try {
      const result = await listDeploymentsHandler();
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// create_github_repo
server.tool(
  'create_github_repo',
  'Initialize a git repo for a project and push to GitHub using the gh CLI.',
  {
    project_name: z.string().describe('Name of the project'),
    description: z.string().optional().describe('Repository description'),
    private_repo: z.boolean().optional().describe('Create private repo (default true)'),
  },
  async (params) => {
    try {
      const result = await createGithubRepo(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// run_command
server.tool(
  'run_command',
  'Run a sandboxed shell command in a project directory. Only allowlisted commands: npm, npx, node, python3, git, ls, mkdir, cp.',
  {
    project_name: z.string().describe('Name of the project'),
    command: z.string().describe('Command to run'),
    timeout: z.number().min(1000).max(120000).optional().describe('Timeout in ms (default 30000)'),
  },
  async (params) => {
    try {
      const result = await runCommand(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Code & Deploy Agent MCP server running on stdio');
}

process.on('SIGINT', () => {
  stopAllDeployments();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAllDeployments();
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
