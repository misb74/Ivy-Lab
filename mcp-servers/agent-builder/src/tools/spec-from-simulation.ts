import { getDb } from '../db/database.js';
import { extractFromSimulation } from '../engine/simulation-bridge.js';

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function specFromSimulation(params: {
  simulation_id: string;
  scenario_id: string;
  spec_name?: string;
  automation_threshold?: number;
}) {
  const threshold = params.automation_threshold ?? 0.7;

  // Extract data from worksim.db
  const extraction = extractFromSimulation(
    params.simulation_id,
    params.scenario_id,
    threshold,
  );

  if (extraction.tasks.length === 0) {
    return {
      error: 'No agent-eligible tasks found in this simulation.',
      summary: extraction.summary,
      hint: `Try lowering the automation_threshold (current: ${threshold}). The simulation has ${extraction.summary.total_tasks} total tasks but none meet the threshold for agent assignment.`,
    };
  }

  // Create the spec with all child records in a single transaction
  const db = getDb();
  const now = new Date().toISOString();
  const specId = genId('spec');
  const specName = params.spec_name || `${extraction.org_name} — Agent from ${extraction.simulation_name}`;

  const insertSpec = db.prepare(`
    INSERT INTO agent_specs (id, name, description, purpose, status, source_simulation_id, source_scenario_id, model, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'tools_added', ?, ?, 'sonnet', ?, ?)
  `);

  const insertTask = db.prepare(`
    INSERT INTO spec_tasks (id, spec_id, task_description, source_role, source_task_id, automation_score, sequence_order, assignment, grounding_process_id, grounding_confidence, grounding_source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTool = db.prepare(`
    INSERT INTO spec_tools (id, spec_id, tool_name, server_name, description, required, params_schema_json, created_at)
    VALUES (?, ?, ?, ?, ?, 1, NULL, ?)
  `);

  const insertGuardrail = db.prepare(`
    INSERT INTO spec_guardrails (id, spec_id, guardrail_type, condition, action, priority, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCriterion = db.prepare(`
    INSERT INTO spec_success_criteria (id, spec_id, metric_name, target_value, measurement_method, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const purpose = `Automate ${extraction.summary.agent_tasks} tasks across ${extraction.summary.agent_eligible_roles} roles identified by WorkVine simulation "${extraction.simulation_name}" (scenario: ${extraction.scenario_name}). Target: ${extraction.summary.projected_fte_savings.toFixed(1)} FTE savings.`;

  const description = `Agent specification auto-generated from WorkVine workforce simulation. Source org: ${extraction.org_name}. ${extraction.summary.total_roles} roles analyzed, ${extraction.summary.agent_eligible_roles} with agent-eligible tasks. Automation threshold: ${(threshold * 100).toFixed(0)}%.`;

  const txn = db.transaction(() => {
    insertSpec.run(specId, specName, description, purpose, params.simulation_id, params.scenario_id, now, now);

    // Insert tasks
    for (let i = 0; i < extraction.tasks.length; i++) {
      const t = extraction.tasks[i];
      insertTask.run(genId('task'), specId, t.task_description, t.source_role, t.source_task_id, t.automation_score, i + 1, t.assignment, t.grounding_process_id || null, t.grounding_confidence ?? null, t.grounding_source || null, now);
    }

    // Insert suggested tools
    for (const tool of extraction.suggested_tools) {
      insertTool.run(genId('tool'), specId, tool.tool_name, tool.server_name, tool.description, now);
    }

    // Insert guardrails
    for (const g of extraction.guardrails) {
      insertGuardrail.run(genId('guard'), specId, g.guardrail_type, g.condition, g.action, g.priority, now);
    }

    // Insert success criteria
    for (const c of extraction.success_criteria) {
      insertCriterion.run(genId('crit'), specId, c.metric_name, c.target_value, c.measurement_method, now);
    }
  });

  txn();

  return {
    spec_id: specId,
    name: specName,
    purpose,
    status: 'tools_added',
    source: {
      simulation_id: params.simulation_id,
      scenario_id: params.scenario_id,
      simulation_name: extraction.simulation_name,
      scenario_name: extraction.scenario_name,
      org_name: extraction.org_name,
    },
    extraction_summary: extraction.summary,
    counts: {
      tasks: extraction.tasks.length,
      tools: extraction.suggested_tools.length,
      guardrails: extraction.guardrails.length,
      success_criteria: extraction.success_criteria.length,
    },
    next_step: 'Review the spec with agent_spec_get, add more tools/guardrails if needed, then call agent_spec_validate to check completeness.',
  };
}
