import { topologicalSort, detectCycles, type GraphNode } from './dependency-graph.js';
import type { WorkflowStep, ExecutionPlan } from './step-executor.js';

export interface WorkflowDefinition {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  variables?: Record<string, string>;
}

export function validateWorkflow(workflow: WorkflowDefinition): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const stepIds = new Set(workflow.steps.map(s => s.id));

  if (!workflow.name) errors.push('Workflow name is required');
  if (workflow.steps.length === 0) errors.push('Workflow must have at least one step');

  // Check for duplicate IDs
  if (stepIds.size !== workflow.steps.length) {
    errors.push('Duplicate step IDs found');
  }

  // Check dependencies reference valid steps
  for (const step of workflow.steps) {
    for (const dep of step.depends_on) {
      if (!stepIds.has(dep)) {
        errors.push(`Step "${step.id}" depends on unknown step "${dep}"`);
      }
    }
    if (!step.tool) {
      errors.push(`Step "${step.id}" is missing a tool name`);
    }
  }

  // Check for cycles
  const nodes: GraphNode[] = workflow.steps.map(s => ({
    id: s.id,
    dependencies: s.depends_on,
  }));

  const cycle = detectCycles(nodes);
  if (cycle) {
    errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
  }

  return { valid: errors.length === 0, errors };
}

export function buildExecutionPlan(
  workflow: WorkflowDefinition,
  workflowId: string
): ExecutionPlan {
  const nodes: GraphNode[] = workflow.steps.map(s => ({
    id: s.id,
    dependencies: s.depends_on,
  }));

  const levels = topologicalSort(nodes);
  const stepMap = new Map(workflow.steps.map(s => [s.id, s]));

  const parallelGroups = levels.map((level, index) => ({
    group_index: index + 1,
    can_run_parallel: level.length > 1,
    steps: level.map(stepId => {
      const step = stepMap.get(stepId)!;
      return {
        step_id: step.id,
        tool: step.tool,
        params: step.params,
        description: step.description,
      };
    }),
  }));

  return {
    workflow_id: workflowId,
    name: workflow.name,
    parallel_groups: parallelGroups,
    total_steps: workflow.steps.length,
    instructions: buildInstructions(parallelGroups),
  };
}

function buildInstructions(
  groups: ExecutionPlan['parallel_groups']
): string {
  const lines: string[] = [
    'Execute this workflow by calling the tools in order:',
    '',
  ];

  for (const group of groups) {
    if (group.can_run_parallel) {
      lines.push(`Group ${group.group_index} (run in PARALLEL):`);
    } else {
      lines.push(`Group ${group.group_index}:`);
    }

    for (const step of group.steps) {
      lines.push(`  - Call "${step.tool}" with params: ${JSON.stringify(step.params)}`);
      if (step.description) lines.push(`    Purpose: ${step.description}`);
    }
    lines.push('');
  }

  lines.push('Use {{step_id.field}} in params to reference outputs from previous steps.');
  return lines.join('\n');
}
