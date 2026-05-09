import fs from 'fs';
import path from 'path';

interface SpecData {
  id: string;
  name: string;
  purpose: string;
  description?: string;
  model: string;
  source_simulation_id?: string;
}

interface TaskData {
  task_description: string;
  sequence_order: number;
  assignment: string;
  source_role?: string;
  automation_score?: number;
}

interface ToolData {
  tool_name: string;
  server_name: string;
  description?: string;
}

interface GuardrailData {
  guardrail_type: string;
  condition: string;
  action: string;
  priority: number;
}

interface CriterionData {
  metric_name: string;
  target_value: string;
  measurement_method?: string;
}

interface McpServerConfig {
  type: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Generate a comprehensive build brief for Claude Code.
 * This is NOT a template — it's real instructions that Claude Code
 * will follow using its full toolset (Write, Bash, Edit, Read, etc.)
 */
export function generateBuildBrief(
  spec: SpecData,
  tasks: TaskData[],
  tools: ToolData[],
  guardrails: GuardrailData[],
  criteria: CriterionData[],
  outputDir: string,
  ivyRoot: string,
): string {
  const agentTasks = tasks.filter((t) => t.assignment === 'agent');
  const hybridTasks = tasks.filter((t) => t.assignment === 'hybrid');
  const escalations = guardrails.filter((g) => g.guardrail_type === 'escalation');
  const constraints = guardrails.filter((g) => g.guardrail_type === 'constraint');
  const inputGuards = guardrails.filter((g) => g.guardrail_type === 'input');
  const outputGuards = guardrails.filter((g) => g.guardrail_type === 'output');

  // Resolve MCP server configs from .mcp.json
  const mcpConfigs = resolveMcpConfigs(tools, ivyRoot);

  const sections: string[] = [];

  // ── Identity ──
  sections.push(`# Build Instructions: ${spec.name}

You are building a production-quality Python agent using the Claude Agent SDK.
Your job is to create a WORKING, TESTED, DEPLOYABLE agent — not a template with TODO stubs.

**Output directory:** \`${outputDir}\`
**Do not modify any files outside this directory.**`);

  // ── Purpose ──
  sections.push(`## What This Agent Does

${spec.purpose}

${spec.description || ''}`);

  // ── Tasks ──
  sections.push(`## Tasks to Implement

The agent must handle these tasks in order:`);

  if (agentTasks.length > 0) {
    sections.push(`### Fully Automated Tasks (agent handles autonomously)`);
    for (const t of agentTasks) {
      const role = t.source_role ? ` — from role: ${t.source_role}` : '';
      const score = t.automation_score != null ? ` (AI capability: ${(t.automation_score * 100).toFixed(0)}%)` : '';
      sections.push(`${t.sequence_order}. ${t.task_description}${role}${score}`);
    }
  }

  if (hybridTasks.length > 0) {
    sections.push(`### Hybrid Tasks (agent does the work, human reviews before finalizing)`);
    for (const t of hybridTasks) {
      const role = t.source_role ? ` — from role: ${t.source_role}` : '';
      sections.push(`${t.sequence_order}. ${t.task_description}${role} — **must pause for human approval**`);
    }
  }

  // ── MCP Server Configs ──
  sections.push(`## MCP Servers to Wire Up

These are the actual MCP server configurations. Use these exact paths in your ClaudeAgentOptions.mcp_servers dict.`);

  for (const [serverName, config] of Object.entries(mcpConfigs)) {
    const toolsForServer = tools.filter((t) => t.server_name === serverName);
    const toolNames = toolsForServer.map((t) => `\`${t.tool_name}\``).join(', ');
    sections.push(`### ${serverName}
- **Command:** \`${config.command}\`
- **Args:** \`${JSON.stringify(config.args)}\`
- **Tools used:** ${toolNames}
- **Python config:**
\`\`\`python
"${serverName}": {
    "type": "stdio",
    "command": "${config.command}",
    "args": ${JSON.stringify(config.args)},
}
\`\`\``);
  }

  // ── Guardrails ──
  sections.push(`## Guardrails to Implement

These are REAL safety rules. Implement them as actual code in \`src/guardrails.py\`, not placeholder comments.`);

  if (escalations.length > 0) {
    sections.push(`### Escalation Rules (MUST stop execution and alert human)
Implement these as PreToolUse hooks that return a deny decision.`);
    for (const g of escalations) {
      sections.push(`- **When:** ${g.condition}
  **Action:** ${g.action}
  **Priority:** ${g.priority}/10
  **Implementation:** Write a function that checks the tool input/context for this condition. If triggered, return a deny result with the reason. This is a hard stop — the agent must not proceed.`);
    }
  }

  if (constraints.length > 0) {
    sections.push(`### Constraints (limit agent behavior)
Implement these as checks within the agent's workflow logic.`);
    for (const g of constraints) {
      sections.push(`- **When:** ${g.condition}
  **Action:** ${g.action}`);
    }
  }

  if (inputGuards.length > 0) {
    sections.push(`### Input Validation`);
    for (const g of inputGuards) {
      sections.push(`- ${g.action}`);
    }
  }

  if (outputGuards.length > 0) {
    sections.push(`### Output Rules`);
    for (const g of outputGuards) {
      sections.push(`- ${g.action}`);
    }
  }

  // ── Success Criteria ──
  if (criteria.length > 0) {
    sections.push(`## Success Criteria

The agent will be measured against these metrics. Embed them in the agent's logging and reporting.`);
    for (const c of criteria) {
      const method = c.measurement_method ? ` — measured by: ${c.measurement_method}` : '';
      sections.push(`- **${c.metric_name}:** ${c.target_value}${method}`);
    }
  }

  // ── Build Instructions ──
  sections.push(`## Exact Build Steps

Create these files at \`${outputDir}\`:

### 1. \`pyproject.toml\`
- Project name derived from the agent name
- Dependency: \`claude-agent-sdk>=0.1.19\`
- Entry point: \`src.agent:main\`

### 2. \`CLAUDE.md\`
- Full agent spec documentation so future Claude Code sessions understand this project
- Include all tasks, tools, guardrails, and success criteria

### 3. \`src/__init__.py\`
- Empty init file

### 4. \`src/agent.py\`
- Import \`claude_agent_sdk\` (query, ClaudeAgentOptions)
- Define \`SYSTEM_PROMPT\` — a well-structured prompt that tells the agent its identity, tasks, and rules
- Define \`OPTIONS\` as \`ClaudeAgentOptions\` with:
  - model = "${spec.model}"
  - system_prompt = SYSTEM_PROMPT
  - mcp_servers = dict with the exact configs from the MCP Servers section above
  - permission_mode = "bypassPermissions"
  - max_turns = 50
- Define \`async def run(task: str)\` that calls \`query()\` and prints results
- Define \`def main()\` as CLI entry point

### 5. \`src/guardrails.py\`
- Implement REAL guardrail functions — not TODO stubs
- Each escalation rule becomes a function that checks specific conditions
- Each constraint becomes a validation function
- Export lists: \`ESCALATION_CHECKS\`, \`CONSTRAINT_CHECKS\`

### 6. \`tests/test_agent.py\`
- Test that SYSTEM_PROMPT is not empty and contains key sections
- Test that OPTIONS has correct model and MCP servers
- Test that guardrail functions exist and are callable
- Test that guardrail functions return correct types

### 7. \`README.md\`
- Quick start instructions
- Architecture overview
- MCP server list
- Guardrail summary

### 8. Run tests
After creating all files, run:
\`\`\`bash
cd ${outputDir} && pip install -e . 2>/dev/null; pytest tests/ -v
\`\`\`
Fix any test failures before finishing.

## Important Rules

- Write REAL implementations, not TODO stubs
- Every guardrail function must have actual logic, even if simplified
- All tests must pass
- Do not access the internet
- Do not modify files outside \`${outputDir}\`
- Use the exact MCP server paths provided above`);

  return sections.join('\n\n');
}

/**
 * Read .mcp.json and extract configs for referenced servers.
 */
function resolveMcpConfigs(
  tools: ToolData[],
  ivyRoot: string,
): Record<string, McpServerConfig> {
  const mcpPath = path.join(ivyRoot, '.mcp.json');
  const configs: Record<string, McpServerConfig> = {};

  try {
    const raw = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
    const allServers = raw.mcpServers || {};
    const neededServers = new Set(tools.map((t) => t.server_name));

    for (const name of neededServers) {
      if (allServers[name]) {
        configs[name] = allServers[name];
      }
    }
  } catch {
    // If .mcp.json can't be read, return empty — Claude Code will handle it
  }

  return configs;
}

/**
 * Generate a scoped .mcp.json containing only the servers referenced by the spec.
 */
export function generateScopedMcpConfig(
  tools: ToolData[],
  ivyRoot: string,
): string {
  const configs = resolveMcpConfigs(tools, ivyRoot);
  return JSON.stringify({ mcpServers: configs }, null, 2);
}
