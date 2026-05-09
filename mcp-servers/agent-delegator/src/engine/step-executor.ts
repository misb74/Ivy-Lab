export interface WorkflowStep {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  depends_on: string[];
  description?: string;
}

export interface ExecutionPlan {
  workflow_id: string;
  name: string;
  parallel_groups: Array<{
    group_index: number;
    can_run_parallel: boolean;
    steps: Array<{
      step_id: string;
      tool: string;
      params: Record<string, unknown>;
      description?: string;
    }>;
  }>;
  total_steps: number;
  instructions: string;
}

export function resolveParameterTemplates(
  params: Record<string, unknown>,
  context: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      resolved[key] = resolveStringTemplate(value, context);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      resolved[key] = resolveParameterTemplates(value as Record<string, unknown>, context);
    } else if (Array.isArray(value)) {
      resolved[key] = value.map(v =>
        typeof v === 'string' ? resolveStringTemplate(v, context) : v
      );
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

function resolveStringTemplate(
  template: string,
  context: Record<string, Record<string, unknown>>
): string {
  return template.replace(/\{\{(\w+)\.(\w+)\}\}/g, (match, stepId, field) => {
    const stepResult = context[stepId];
    if (!stepResult) return match;
    const value = stepResult[field];
    if (value === undefined) return match;
    return String(value);
  });
}
