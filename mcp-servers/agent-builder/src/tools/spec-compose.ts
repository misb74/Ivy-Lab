import { getDb } from '../db/database.js';
import { generateSystemPrompt } from '../engine/prompt-generator.js';
import { generateWorkflow } from '../engine/workflow-generator.js';
import { isGroundingAvailable } from '../engine/hr-grounding-match.js';

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function specCompose(params: { spec_id: string }) {
  const db = getDb();

  const spec = db.prepare('SELECT * FROM agent_specs WHERE id = ?').get(params.spec_id) as any;
  if (!spec) throw new Error(`Spec "${params.spec_id}" not found`);
  if (spec.status !== 'validated') {
    throw new Error(`Spec status is "${spec.status}" — must be "validated" before composing. Run agent_spec_validate first.`);
  }

  const tools = db.prepare('SELECT * FROM spec_tools WHERE spec_id = ? ORDER BY tool_name').all(params.spec_id) as any[];
  const guardrails = db.prepare('SELECT * FROM spec_guardrails WHERE spec_id = ? ORDER BY priority DESC').all(params.spec_id) as any[];
  const tasks = db.prepare('SELECT * FROM spec_tasks WHERE spec_id = ? ORDER BY sequence_order').all(params.spec_id) as any[];
  const criteria = db.prepare('SELECT * FROM spec_success_criteria WHERE spec_id = ?').all(params.spec_id) as any[];

  // Enrich tasks with grounding labels if available
  if (isGroundingAvailable(db)) {
    for (const task of tasks as any[]) {
      if (task.grounding_process_id) {
        const process = db.prepare(
          'SELECT l2_domain, l3_subdomain FROM hr_work_process WHERE id = ?'
        ).get(task.grounding_process_id) as any;
        const labels = db.prepare(
          'SELECT * FROM hr_process_labels WHERE process_id = ?'
        ).get(task.grounding_process_id) as any;
        if (process) {
          task.grounding_l2_domain = process.l2_domain;
          task.grounding_l3_subdomain = process.l3_subdomain;
        }
        if (labels) {
          task.grounding_labels = {
            risk_tags: JSON.parse(labels.risk_tags || '[]'),
            judgment_risk: labels.judgment_risk,
            data_sensitivity: labels.data_sensitivity,
            human_in_loop_required: !!labels.human_in_loop_required,
          };
        }
      }
    }
  }

  // Generate system prompt
  const systemPrompt = generateSystemPrompt(spec, tasks, tools, guardrails, criteria);

  // Generate workflow
  const workflow = generateWorkflow(spec.name, tasks, tools);

  // Build tool whitelist
  const toolWhitelist = tools.map((t: any) => ({
    tool_name: t.tool_name,
    server_name: t.server_name,
    required: !!t.required,
  }));

  // Build guardrail hooks
  const guardrailHooks = guardrails.map((g: any) => ({
    type: g.guardrail_type,
    condition: g.condition,
    action: g.action,
    priority: g.priority,
  }));

  // Compose the agent configuration
  const agentConfig = {
    name: spec.name,
    model: spec.model,
    system_prompt: systemPrompt,
    tools: toolWhitelist,
    workflow: workflow,
    guardrails: guardrailHooks,
    success_criteria: criteria.map((c: any) => ({
      metric: c.metric_name,
      target: c.target_value,
      method: c.measurement_method,
    })),
    grounding: {
      coverage: `${tasks.filter((t: any) => t.grounding_source === 'hr_ontology').length}/${tasks.length}`,
      domains: [...new Set(tasks.map((t: any) => t.grounding_l2_domain).filter(Boolean))],
      high_risk_tasks: tasks.filter((t: any) => t.grounding_labels?.judgment_risk === 'high').length,
    },
    metadata: {
      spec_id: spec.id,
      source_simulation_id: spec.source_simulation_id,
      source_scenario_id: spec.source_scenario_id,
      version: spec.version,
      composed_at: new Date().toISOString(),
    },
  };

  // Store the output
  const now = new Date().toISOString();
  const outputId = genId('output');
  db.prepare(`
    INSERT INTO spec_outputs (id, spec_id, output_type, content_json, generated_at)
    VALUES (?, ?, 'compose', ?, ?)
  `).run(outputId, params.spec_id, JSON.stringify(agentConfig), now);

  db.prepare("UPDATE agent_specs SET status = 'composed', updated_at = ? WHERE id = ?").run(now, params.spec_id);

  return {
    spec_id: params.spec_id,
    output_id: outputId,
    status: 'composed',
    agent_config: agentConfig,
    next_step: 'Agent configuration is ready. Call agent_spec_to_artifact to render it as a card, or agent_spec_scaffold to generate a full Claude Agent SDK project.',
  };
}
