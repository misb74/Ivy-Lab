interface SpecData {
  id: string;
  name: string;
  purpose: string;
  description?: string;
  model: string;
  status: string;
  version: number;
  source_simulation_id?: string;
}

interface TaskData {
  task_description: string;
  sequence_order: number;
  assignment: string;
  source_role?: string;
  automation_score?: number;
  grounding_source?: string;
  grounding_labels?: {
    judgment_risk: string;
    data_sensitivity: string;
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

interface InsightSection {
  kind: string;
  [key: string]: unknown;
}

import type { AgentSpecDataQualityStatus } from './agent-spec-dq.js';

export interface AgentSpecArtifact {
  type: 'agent_spec';
  title: string;
  pillLabel: string;
  subtitle: string;
  dataSources: string;
  sections: InsightSection[];
  /**
   * Rich Data Quality Passport — always present on the artifact. Populated
   * by `spec-to-artifact.ts` via `buildAgentSpecDataQualityStatus` using
   * grounding coverage + source-simulation signals. See agent-spec-dq.ts
   * for the rules.
   */
  dataQualityStatus?: AgentSpecDataQualityStatus;
}

export function buildAgentSpecArtifact(
  spec: SpecData,
  tasks: TaskData[],
  tools: ToolData[],
  guardrails: GuardrailData[],
  criteria: CriterionData[],
  dataQualityStatus?: AgentSpecDataQualityStatus,
): AgentSpecArtifact {
  const agentTasks = tasks.filter((t) => t.assignment === 'agent');
  const hybridTasks = tasks.filter((t) => t.assignment === 'hybrid');
  const escalations = guardrails.filter((g) => g.guardrail_type === 'escalation');
  const avgAutomation = tasks.length > 0
    ? tasks.reduce((s, t) => s + (t.automation_score || 0), 0) / tasks.length
    : 0;

  const uniqueServers = [...new Set(tools.map((t) => t.server_name))];

  // Section 1: Metrics
  const metricsSection: InsightSection = {
    kind: 'metrics',
    items: [
      {
        label: 'Agent Tasks',
        value: agentTasks.length,
        color: agentTasks.length > 0 ? 'green' : 'amber',
        delta: {
          value: `${hybridTasks.length} hybrid`,
          direction: 'up',
          sentiment: 'neutral',
        },
      },
      {
        label: 'MCP Tools',
        value: tools.length,
        color: 'blue',
        delta: {
          value: `${uniqueServers.length} servers`,
          direction: 'up',
          sentiment: 'positive',
        },
      },
      {
        label: 'Guardrails',
        value: guardrails.length,
        color: guardrails.length >= 3 ? 'green' : 'amber',
        delta: {
          value: `${escalations.length} escalation rules`,
          direction: 'up',
          sentiment: 'positive',
        },
      },
      {
        label: 'Automation Coverage',
        value: `${(avgAutomation * 100).toFixed(0)}%`,
        color: avgAutomation >= 0.7 ? 'green' : avgAutomation >= 0.5 ? 'amber' : 'red',
      },
    ],
  };

  // Section 2: Callout — agent purpose
  const calloutSection: InsightSection = {
    kind: 'callout',
    title: 'Agent Purpose',
    description: spec.purpose,
    variant: 'ivy-narrative',
    icon: '🤖',
  };

  // Section 2.5: Grounding coverage
  const groundedTasks = tasks.filter(t => t.grounding_source === 'hr_ontology');
  const ungroundedTasks = tasks.filter(t => !t.grounding_source || t.grounding_source === 'ungrounded');
  const highRiskTasks = tasks.filter(t => {
    const labels = t.grounding_labels;
    return labels && (labels.judgment_risk === 'high' || labels.data_sensitivity === 'high');
  });

  const groundingSection: InsightSection = {
    kind: 'metrics',
    items: [
      {
        label: 'Grounding Coverage',
        value: tasks.length > 0 ? `${((groundedTasks.length / tasks.length) * 100).toFixed(0)}%` : 'N/A',
        color: tasks.length > 0 && groundedTasks.length / tasks.length >= 0.8 ? 'green'
          : tasks.length > 0 && groundedTasks.length / tasks.length >= 0.5 ? 'amber' : 'red',
        delta: {
          value: `${groundedTasks.length} of ${tasks.length} matched`,
          direction: 'up',
          sentiment: groundedTasks.length > 0 ? 'positive' : 'negative',
        },
      },
      {
        label: 'High-Risk Tasks',
        value: highRiskTasks.length,
        color: highRiskTasks.length > 0 ? 'red' : 'green',
      },
      {
        label: 'Unmatched Tasks',
        value: ungroundedTasks.length,
        color: ungroundedTasks.length === 0 ? 'green' : 'amber',
      },
    ],
  };

  const groundingWarning: InsightSection | null = ungroundedTasks.length > 0 ? {
    kind: 'callout',
    title: 'Unmatched Tasks',
    description: `${ungroundedTasks.length} task(s) could not be matched to known HR processes. These may need manual review for appropriate guardrails.`,
    variant: 'warning',
    icon: 'warning',
  } : null;

  // Section 3: Task table
  const taskRows = tasks.map((t) => [
    String(t.sequence_order),
    t.task_description.length > 80 ? t.task_description.slice(0, 77) + '...' : t.task_description,
    t.source_role || '—',
    t.assignment.toUpperCase(),
    t.automation_score != null ? `${(t.automation_score * 100).toFixed(0)}%` : '—',
  ]);

  const taskTableSection: InsightSection = {
    kind: 'table',
    title: `Agent Tasks (${tasks.length})`,
    headers: ['#', 'Task', 'Source Role', 'Assignment', 'AI Score'],
    rows: taskRows,
    highlightColumn: 3,
  };

  // Section 4: Tools list
  const toolItems = tools.map((t) => ({
    text: `**${t.tool_name}** (${t.server_name})${t.description ? ' — ' + t.description : ''}`,
    priority: t.required ? 'high' : 'medium',
  }));

  const toolsSection: InsightSection = {
    kind: 'list',
    title: `MCP Tools (${tools.length})`,
    style: 'bullet',
    items: toolItems,
  };

  // Section 5: Guardrails table
  const guardrailRows = guardrails.map((g) => [
    g.guardrail_type.toUpperCase(),
    g.condition.length > 60 ? g.condition.slice(0, 57) + '...' : g.condition,
    g.action.length > 60 ? g.action.slice(0, 57) + '...' : g.action,
    String(g.priority),
  ]);

  const guardrailSection: InsightSection = {
    kind: 'table',
    title: `Guardrails (${guardrails.length})`,
    headers: ['Type', 'Condition', 'Action', 'Priority'],
    rows: guardrailRows,
    highlightColumn: 0,
  };

  // Section 6: Recommendations — next steps
  const recommendations = [];
  if (spec.status === 'validated' || spec.status === 'draft' || spec.status === 'tools_added') {
    recommendations.push({
      text: 'Run `agent_spec_compose` to generate a deployable agent configuration',
      priority: 'critical',
    });
  }
  if (spec.status !== 'scaffolded') {
    recommendations.push({
      text: 'Run `agent_spec_scaffold` to generate a full Claude Agent SDK Python project',
      priority: 'high',
    });
  }
  if (criteria.length > 0) {
    recommendations.push({
      text: `${criteria.length} success criteria defined — track these post-deployment`,
      priority: 'medium',
    });
  }
  recommendations.push({
    text: 'Review guardrails and customize escalation logic before deploying to production',
    priority: 'high',
  });

  const recommendationsSection: InsightSection = {
    kind: 'recommendations',
    title: 'Next Steps',
    items: recommendations,
  };

  return {
    type: 'agent_spec',
    title: spec.name,
    pillLabel: 'AGENT BUILDER',
    subtitle: `v${spec.version} · ${spec.model} · ${tasks.length} tasks · ${tools.length} tools · ${guardrails.length} guardrails`,
    dataSources: spec.source_simulation_id ? 'WorkVine Simulation' : 'Manual Configuration',
    sections: [
      metricsSection,
      calloutSection,
      groundingSection,
      ...(groundingWarning ? [groundingWarning] : []),
      taskTableSection,
      toolsSection,
      guardrailSection,
      recommendationsSection,
    ],
    ...(dataQualityStatus ? { dataQualityStatus } : {}),
  };
}
