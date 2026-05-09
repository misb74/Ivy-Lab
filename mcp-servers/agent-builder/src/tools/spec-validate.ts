import { getDb } from '../db/database.js';
import { isGroundingAvailable } from '../engine/hr-grounding-match.js';
import fs from 'fs';
import path from 'path';

export async function specValidate(params: { spec_id: string }) {
  const db = getDb();

  const spec = db.prepare('SELECT * FROM agent_specs WHERE id = ?').get(params.spec_id) as any;
  if (!spec) throw new Error(`Spec "${params.spec_id}" not found`);

  const tools = db.prepare('SELECT * FROM spec_tools WHERE spec_id = ?').all(params.spec_id) as any[];
  const guardrails = db.prepare('SELECT * FROM spec_guardrails WHERE spec_id = ?').all(params.spec_id) as any[];
  const tasks = db.prepare('SELECT * FROM spec_tasks WHERE spec_id = ?').all(params.spec_id) as any[];
  const criteria = db.prepare('SELECT * FROM spec_success_criteria WHERE spec_id = ?').all(params.spec_id) as any[];

  const issues: string[] = [];
  const warnings: string[] = [];

  // Check tasks
  if (tasks.length === 0) {
    issues.push('No tasks defined. Add at least one task with agent_spec_add_task.');
  }

  // Check tools
  if (tools.length === 0) {
    issues.push('No tools defined. Add at least one MCP tool with agent_spec_add_tool.');
  }

  // Check guardrails
  if (guardrails.length === 0) {
    issues.push('No guardrails defined. Add at least one guardrail with agent_spec_add_guardrail.');
  }

  const hasEscalation = guardrails.some((g: any) => g.guardrail_type === 'escalation');
  if (!hasEscalation && guardrails.length > 0) {
    warnings.push('No escalation guardrail. Consider adding one for tasks requiring human judgment.');
  }

  // Check success criteria
  if (criteria.length === 0) {
    warnings.push('No success criteria defined. Consider adding metrics to measure agent effectiveness.');
  }

  // Validate tool servers against .mcp.json
  const mcpConfigPath = path.resolve(process.cwd(), '.mcp.json');
  let knownServers = new Set<string>();
  try {
    const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
    knownServers = new Set(Object.keys(mcpConfig.mcpServers || {}));
  } catch {
    warnings.push('Could not read .mcp.json to validate tool servers.');
  }

  if (knownServers.size > 0) {
    for (const tool of tools) {
      if (!knownServers.has(tool.server_name)) {
        issues.push(`Tool "${tool.tool_name}" references unknown server "${tool.server_name}". Check .mcp.json.`);
      }
    }
  }

  // Check for duplicate task sequence orders
  const orders = tasks.map((t: any) => t.sequence_order);
  const dupeOrders = orders.filter((o: number, i: number) => orders.indexOf(o) !== i);
  if (dupeOrders.length > 0) {
    warnings.push(`Duplicate sequence_order values: ${[...new Set(dupeOrders)].join(', ')}`);
  }

  // ── HR Grounding Validation ──
  let groundingCoverage = 'n/a';
  if (isGroundingAvailable(db)) {
    const groundedTasks = tasks.filter((t: any) => t.grounding_source === 'hr_ontology');
    const ungroundedTasks = tasks.filter((t: any) => !t.grounding_source || t.grounding_source === 'ungrounded');

    if (tasks.length > 0) {
      groundingCoverage = `${groundedTasks.length}/${tasks.length}`;
    }

    if (ungroundedTasks.length > 0) {
      warnings.push(`${ungroundedTasks.length} of ${tasks.length} tasks are ungrounded (not matched to HR ontology). Consider reviewing for accuracy.`);
    }

    for (const task of groundedTasks) {
      if (!task.grounding_process_id) continue;

      const labels = db.prepare(
        'SELECT * FROM hr_process_labels WHERE process_id = ?'
      ).get(task.grounding_process_id) as any;
      if (!labels) continue;

      const riskTags: string[] = JSON.parse(labels.risk_tags || '[]');

      if (riskTags.includes('financial')) {
        const hasFinancialControl = guardrails.some((g: any) =>
          g.condition.toLowerCase().includes('financial') || g.condition.toLowerCase().includes('monetary')
        );
        if (!hasFinancialControl) {
          issues.push(`Task "${task.task_description.slice(0, 50)}..." is grounded to a financial HR process but has no financial control guardrail.`);
        }
      }

      if (riskTags.includes('pii') || labels.data_sensitivity === 'high') {
        const hasPiiControl = guardrails.some((g: any) =>
          g.condition.toLowerCase().includes('pii') ||
          g.condition.toLowerCase().includes('personal data') ||
          g.condition.toLowerCase().includes('sensitive')
        );
        if (!hasPiiControl) {
          issues.push(`Task "${task.task_description.slice(0, 50)}..." involves sensitive personal data but has no PII protection guardrail.`);
        }
      }

      if (labels.judgment_risk === 'high') {
        if (!hasEscalation) {
          issues.push(`Task "${task.task_description.slice(0, 50)}..." is a high-judgment HR process but spec has no escalation guardrail.`);
        }
      }
    }
  }

  const valid = issues.length === 0;
  const now = new Date().toISOString();

  if (valid) {
    db.prepare("UPDATE agent_specs SET status = 'validated', updated_at = ? WHERE id = ?").run(now, params.spec_id);
  }

  return {
    spec_id: params.spec_id,
    valid,
    issues,
    warnings,
    summary: {
      tasks: tasks.length,
      tools: tools.length,
      guardrails: guardrails.length,
      success_criteria: criteria.length,
      escalation_guardrails: guardrails.filter((g: any) => g.guardrail_type === 'escalation').length,
      grounding_coverage: groundingCoverage,
    },
    next_step: valid
      ? 'Spec is valid! Call agent_spec_compose to generate an agent configuration, or agent_spec_scaffold to generate a full Claude Agent SDK project.'
      : 'Fix the issues above, then call agent_spec_validate again.',
  };
}
