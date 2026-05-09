interface SpecData {
  name: string;
  purpose: string;
  description?: string;
  model: string;
}

interface TaskData {
  task_description: string;
  sequence_order: number;
  assignment: string;
  source_role?: string;
  automation_score?: number;
  grounding_source?: string;
  grounding_l2_domain?: string;
  grounding_l3_subdomain?: string;
  grounding_labels?: {
    risk_tags: string[];
    judgment_risk: string;
    data_sensitivity: string;
    human_in_loop_required: boolean;
  };
}

interface ToolData {
  tool_name: string;
  server_name: string;
  description?: string;
  required: number;
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

export function generateSystemPrompt(
  spec: SpecData,
  tasks: TaskData[],
  tools: ToolData[],
  guardrails: GuardrailData[],
  criteria: CriterionData[],
): string {
  const sections: string[] = [];

  // Identity
  sections.push(`# ${spec.name}\n\nYou are an AI agent built by WorkVine.ai. ${spec.purpose}`);
  if (spec.description) {
    sections.push(spec.description);
  }

  // Tasks
  sections.push('## Tasks\n\nExecute the following tasks in order:');
  const agentTasks = tasks.filter((t) => t.assignment === 'agent');
  const hybridTasks = tasks.filter((t) => t.assignment === 'hybrid');

  if (agentTasks.length > 0) {
    sections.push('### Fully Automated Tasks');
    for (const t of agentTasks) {
      const roleSuffix = t.source_role ? ` (from: ${t.source_role})` : '';
      sections.push(`${t.sequence_order}. ${t.task_description}${roleSuffix}`);
    }
  }

  if (hybridTasks.length > 0) {
    sections.push('### Hybrid Tasks (require human review)');
    for (const t of hybridTasks) {
      const roleSuffix = t.source_role ? ` (from: ${t.source_role})` : '';
      sections.push(`${t.sequence_order}. ${t.task_description}${roleSuffix} — **Requires human approval before finalizing**`);
    }
  }

  // HR Domain Context (only if grounded tasks exist)
  const groundedTasks = tasks.filter(t => t.grounding_source === 'hr_ontology');
  if (groundedTasks.length > 0) {
    const domains = [...new Set(groundedTasks.map(t => t.grounding_l2_domain).filter(Boolean))];
    sections.push(`## HR Domain Context\n\nThis agent operates in the following HR domains: ${domains.join(', ')}.\n\n**Important:** These are regulated HR processes. Follow all applicable labor laws, data protection regulations, and organizational policies.`);

    const highJudgment = groundedTasks.filter(t => t.grounding_labels?.judgment_risk === 'high');
    if (highJudgment.length > 0) {
      sections.push(`### High-Judgment Processes\nThe following tasks require careful human oversight:\n${highJudgment.map(t => `- ${t.task_description}`).join('\n')}\n\nFor these tasks: present options and recommendations but do NOT make final decisions autonomously.`);
    }

    const sensitiveData = groundedTasks.filter(t => t.grounding_labels?.data_sensitivity === 'high');
    if (sensitiveData.length > 0) {
      sections.push(`### Data Sensitivity\nThese tasks handle sensitive personal or financial data:\n${sensitiveData.map(t => `- ${t.task_description}`).join('\n')}\n\nAlways minimize data exposure. Never log PII. Encrypt sensitive outputs.`);
    }
  }

  // Available tools
  sections.push('## Available Tools\n\nYou have access to the following MCP tools:');
  const byServer = new Map<string, ToolData[]>();
  for (const t of tools) {
    const list = byServer.get(t.server_name) || [];
    list.push(t);
    byServer.set(t.server_name, list);
  }
  for (const [server, serverTools] of byServer) {
    sections.push(`### ${server}`);
    for (const t of serverTools) {
      const req = t.required ? '' : ' (optional)';
      const desc = t.description ? ` — ${t.description}` : '';
      sections.push(`- \`${t.tool_name}\`${desc}${req}`);
    }
  }

  // Guardrails
  const escalations = guardrails.filter((g) => g.guardrail_type === 'escalation');
  const constraints = guardrails.filter((g) => g.guardrail_type === 'constraint');
  const inputs = guardrails.filter((g) => g.guardrail_type === 'input');
  const outputs = guardrails.filter((g) => g.guardrail_type === 'output');

  sections.push('## Guardrails\n\n**You MUST follow these rules. They are non-negotiable.**');

  if (escalations.length > 0) {
    sections.push('### Escalation Rules (STOP and escalate to human)');
    for (const g of escalations) {
      sections.push(`- **When:** ${g.condition}\n  **Action:** ${g.action}`);
    }
  }

  if (constraints.length > 0) {
    sections.push('### Constraints');
    for (const g of constraints) {
      sections.push(`- **When:** ${g.condition}\n  **Action:** ${g.action}`);
    }
  }

  if (inputs.length > 0) {
    sections.push('### Input Validation');
    for (const g of inputs) {
      sections.push(`- ${g.action}`);
    }
  }

  if (outputs.length > 0) {
    sections.push('### Output Rules');
    for (const g of outputs) {
      sections.push(`- ${g.action}`);
    }
  }

  // Success criteria
  if (criteria.length > 0) {
    sections.push('## Success Criteria\n\nYour performance is measured against:');
    for (const c of criteria) {
      const method = c.measurement_method ? ` (${c.measurement_method})` : '';
      sections.push(`- **${c.metric_name}:** ${c.target_value}${method}`);
    }
  }

  return sections.join('\n\n');
}
