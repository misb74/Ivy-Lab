interface TaskData {
  id: string;
  task_description: string;
  sequence_order: number;
  assignment: string;
  source_role?: string;
  automation_score?: number;
  grounding_source?: string;
  grounding_labels?: {
    human_in_loop_required: boolean;
    risk_tags: string[];
  };
}

interface ToolData {
  tool_name: string;
  server_name: string;
  description?: string;
}

export interface WorkflowStep {
  step: number;
  task: string;
  assignment: string;
  source_role: string | null;
  suggested_tools: string[];
  requires_human_review: boolean;
  grounding_flags?: {
    human_in_loop_required: boolean;
    risk_tags: string[];
  };
}

export interface Workflow {
  name: string;
  steps: WorkflowStep[];
  total_steps: number;
  automated_steps: number;
  hybrid_steps: number;
}

export function generateWorkflow(
  specName: string,
  tasks: TaskData[],
  tools: ToolData[],
): Workflow {
  const toolDescriptions = tools.map((t) => ({
    name: t.tool_name,
    server: t.server_name,
    text: `${t.tool_name} ${t.description || ''} ${t.server_name}`.toLowerCase(),
  }));

  const steps: WorkflowStep[] = tasks
    .sort((a, b) => a.sequence_order - b.sequence_order)
    .map((task) => {
      const taskWords = task.task_description.toLowerCase();

      // Match tools by keyword overlap with task description
      const matched = toolDescriptions
        .filter((t) => {
          const toolWords = t.text.split(/\s+/);
          return toolWords.some((w) => w.length > 3 && taskWords.includes(w));
        })
        .map((t) => t.name);

      return {
        step: task.sequence_order,
        task: task.task_description,
        assignment: task.assignment,
        source_role: task.source_role || null,
        suggested_tools: matched.length > 0 ? matched : ['(manual or custom tool needed)'],
        requires_human_review: task.assignment === 'hybrid' ||
          (task.grounding_labels?.human_in_loop_required ?? false),
        grounding_flags: task.grounding_labels ? {
          human_in_loop_required: task.grounding_labels.human_in_loop_required,
          risk_tags: task.grounding_labels.risk_tags,
        } : undefined,
      };
    });

  return {
    name: specName,
    steps,
    total_steps: steps.length,
    automated_steps: steps.filter((s) => s.assignment === 'agent').length,
    hybrid_steps: steps.filter((s) => s.assignment === 'hybrid').length,
  };
}
