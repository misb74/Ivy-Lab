/**
 * Automation assessment using O*NET/WORKBank data patterns.
 * Evaluates roles and tasks for automation potential, augmentation opportunities,
 * and human-essential characteristics.
 */

// ---------------------------------------------------------------------------
// Task automation scoring
// ---------------------------------------------------------------------------

export interface TaskScore {
  task: string;
  automation_score: number;
  category: 'automatable' | 'augmentable' | 'human_essential';
  rationale: string;
}

export interface AutomationAssessmentResult {
  role: string;
  overall_automation_potential: number;
  breakdown: {
    automatable: TaskScore[];
    augmentable: TaskScore[];
    human_essential: TaskScore[];
  };
  risk_factors: string[];
  opportunities: string[];
  recommendation: string;
  methodology: string;
}

/**
 * Keywords that indicate high automation potential.
 */
const AUTOMATION_KEYWORDS: Array<{ keyword: string; score: number }> = [
  { keyword: 'data entry', score: 95 },
  { keyword: 'filing', score: 90 },
  { keyword: 'sorting', score: 88 },
  { keyword: 'scheduling', score: 85 },
  { keyword: 'routing', score: 85 },
  { keyword: 'copying', score: 90 },
  { keyword: 'calculating', score: 85 },
  { keyword: 'processing', score: 80 },
  { keyword: 'compiling', score: 82 },
  { keyword: 'recording', score: 80 },
  { keyword: 'monitoring', score: 75 },
  { keyword: 'verifying', score: 78 },
  { keyword: 'checking', score: 75 },
  { keyword: 'tracking', score: 78 },
  { keyword: 'updating records', score: 85 },
  { keyword: 'generating reports', score: 82 },
  { keyword: 'invoice', score: 85 },
  { keyword: 'payroll', score: 80 },
  { keyword: 'inventory', score: 78 },
  { keyword: 'transcribing', score: 88 },
  { keyword: 'formatting', score: 82 },
  { keyword: 'tabulating', score: 88 },
];

/**
 * Keywords that indicate augmentation (human + AI collaboration).
 */
const AUGMENTATION_KEYWORDS: Array<{ keyword: string; score: number }> = [
  { keyword: 'analyzing', score: 60 },
  { keyword: 'reviewing', score: 55 },
  { keyword: 'evaluating', score: 55 },
  { keyword: 'researching', score: 58 },
  { keyword: 'planning', score: 50 },
  { keyword: 'designing', score: 48 },
  { keyword: 'drafting', score: 60 },
  { keyword: 'recommending', score: 55 },
  { keyword: 'interpreting', score: 50 },
  { keyword: 'diagnosing', score: 45 },
  { keyword: 'assessing', score: 55 },
  { keyword: 'writing', score: 55 },
  { keyword: 'presenting', score: 45 },
  { keyword: 'coordinating', score: 50 },
  { keyword: 'organizing', score: 55 },
  { keyword: 'summarizing', score: 65 },
  { keyword: 'translating', score: 60 },
  { keyword: 'forecasting', score: 58 },
  { keyword: 'prioritizing', score: 50 },
  { keyword: 'testing', score: 55 },
];

/**
 * Keywords that indicate human-essential tasks.
 */
const HUMAN_ESSENTIAL_KEYWORDS: Array<{ keyword: string; score: number }> = [
  { keyword: 'negotiating', score: 20 },
  { keyword: 'counseling', score: 15 },
  { keyword: 'mentoring', score: 15 },
  { keyword: 'coaching', score: 18 },
  { keyword: 'mediating', score: 15 },
  { keyword: 'empathizing', score: 10 },
  { keyword: 'leading', score: 22 },
  { keyword: 'inspiring', score: 12 },
  { keyword: 'persuading', score: 20 },
  { keyword: 'motivating', score: 15 },
  { keyword: 'building relationships', score: 12 },
  { keyword: 'resolving conflicts', score: 15 },
  { keyword: 'managing people', score: 20 },
  { keyword: 'ethical', score: 15 },
  { keyword: 'judgment', score: 20 },
  { keyword: 'creative', score: 22 },
  { keyword: 'innovating', score: 20 },
  { keyword: 'physical', score: 18 },
  { keyword: 'manual', score: 25 },
  { keyword: 'operating machinery', score: 22 },
  { keyword: 'safety', score: 20 },
  { keyword: 'emergency', score: 15 },
  { keyword: 'patient care', score: 12 },
  { keyword: 'emotional support', score: 10 },
];

/**
 * Score a single task for automation potential (0-100, where 100 = fully automatable).
 */
function scoreTask(task: string): TaskScore {
  const normalized = task.toLowerCase();
  let bestScore = 50; // Default middle score
  let bestCategory: TaskScore['category'] = 'augmentable';
  let matchedKeyword = '';

  // Check automation keywords (high scores = automatable)
  for (const { keyword, score } of AUTOMATION_KEYWORDS) {
    if (normalized.includes(keyword)) {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = 'automatable';
        matchedKeyword = keyword;
      }
    }
  }

  // Check augmentation keywords (medium scores)
  for (const { keyword, score } of AUGMENTATION_KEYWORDS) {
    if (normalized.includes(keyword)) {
      if (bestCategory !== 'automatable' || score > bestScore) {
        if (bestCategory !== 'automatable') {
          bestScore = score;
          bestCategory = 'augmentable';
          matchedKeyword = keyword;
        }
      }
    }
  }

  // Check human-essential keywords (low scores = not automatable)
  for (const { keyword, score } of HUMAN_ESSENTIAL_KEYWORDS) {
    if (normalized.includes(keyword)) {
      if (score < bestScore) {
        bestScore = score;
        bestCategory = 'human_essential';
        matchedKeyword = keyword;
      }
    }
  }

  let rationale: string;
  if (bestCategory === 'automatable') {
    rationale = `Task involves "${matchedKeyword}" — routine/repetitive activity well-suited for automation.`;
  } else if (bestCategory === 'augmentable') {
    rationale = matchedKeyword
      ? `Task involves "${matchedKeyword}" — can be enhanced with AI but requires human oversight.`
      : 'Task has mixed characteristics — AI can assist but human judgment is still needed.';
  } else {
    rationale = `Task involves "${matchedKeyword}" — requires uniquely human capabilities.`;
  }

  return {
    task,
    automation_score: bestScore,
    category: bestCategory,
    rationale,
  };
}

/**
 * Assess automation potential of a role.
 *
 * v1.0: Synthetic DEFAULT_TASKS fallback removed — the staged runner (Phase 4–5)
 * sources tasks deterministically from O*NET via the retrieve stage. Callers that
 * hit this tool directly MUST pass a non-empty `tasks` array. See plan:
 * docs/superpowers/plans/2026-04-16-soc-disambiguation-primitive.md Task 9.3.
 */
export function assessAutomation(role: string, tasks?: string[]): AutomationAssessmentResult {
  if (!tasks || tasks.length === 0) {
    throw new Error(
      "automation_assess: tasks array is required. The synthetic DEFAULT_TASKS fallback was removed in v1.0; " +
      "the staged runner now sources tasks from O*NET via the retrieve stage. " +
      "Pass an explicit non-empty `tasks` parameter, or invoke the staged automation-assessment flow instead."
    );
  }
  const taskList = tasks;

  // Score each task
  const taskScores = taskList.map(scoreTask);

  // Categorize
  const automatable = taskScores.filter(t => t.category === 'automatable');
  const augmentable = taskScores.filter(t => t.category === 'augmentable');
  const humanEssential = taskScores.filter(t => t.category === 'human_essential');

  // Overall score (weighted average)
  const overallScore = taskScores.length > 0
    ? Math.round(taskScores.reduce((sum, t) => sum + t.automation_score, 0) / taskScores.length)
    : 50;

  // Risk factors
  const riskFactors: string[] = [];
  if (automatable.length > taskScores.length * 0.6) {
    riskFactors.push('High proportion of automatable tasks — role may be significantly transformed or eliminated.');
  }
  if (humanEssential.length === 0) {
    riskFactors.push('No clearly human-essential tasks identified — role is at risk of full automation.');
  }
  if (overallScore > 75) {
    riskFactors.push('Overall automation potential exceeds 75% — workforce planning should account for this role.');
  }

  // Opportunities
  const opportunities: string[] = [];
  if (automatable.length > 0) {
    opportunities.push(`${automatable.length} task(s) can be automated to free up capacity for higher-value work.`);
  }
  if (augmentable.length > 0) {
    opportunities.push(`${augmentable.length} task(s) can be augmented with AI tools to increase productivity.`);
  }
  if (humanEssential.length > 0) {
    opportunities.push(`${humanEssential.length} task(s) represent unique human value — invest in developing these capabilities.`);
  }

  // Recommendation
  let recommendation: string;
  if (overallScore >= 75) {
    recommendation = `High automation potential (${overallScore}%). Prioritize automation of routine tasks and reskill employees toward human-essential activities. Consider role redesign.`;
  } else if (overallScore >= 50) {
    recommendation = `Moderate automation potential (${overallScore}%). Implement AI augmentation for applicable tasks while preserving human oversight. Focus on upskilling.`;
  } else {
    recommendation = `Low automation potential (${overallScore}%). This role relies heavily on human capabilities. Invest in supporting tools rather than replacement automation.`;
  }

  return {
    role,
    overall_automation_potential: overallScore,
    breakdown: {
      automatable,
      augmentable,
      human_essential: humanEssential,
    },
    risk_factors: riskFactors,
    opportunities,
    recommendation,
    methodology: 'Task-level keyword analysis scoring each task on a 0-100 automation potential scale. ' +
      'Tasks are categorized as automatable (>70), augmentable (30-70), or human-essential (<30). ' +
      'Overall score is the mean of individual task scores.',
  };
}

// ---------------------------------------------------------------------------
// Automation gap analysis
// ---------------------------------------------------------------------------

export interface AutomationGapResult {
  role: string;
  current_automation: string[];
  all_automatable_tasks: string[];
  gaps: AutomationGapItem[];
  gap_score: number;
  priority_actions: string[];
}

export interface AutomationGapItem {
  task: string;
  automation_score: number;
  status: 'automated' | 'not_automated';
  priority: 'high' | 'medium' | 'low';
}

/**
 * Identify automation gaps — tasks that could be automated but are not yet.
 */
export function identifyAutomationGaps(
  role: string,
  tasks: string[],
  currentAutomation?: string[]
): AutomationGapResult {
  // tasks is required — assessAutomation throws on missing tasks as of v1.0
  // (DEFAULT_TASKS fallback removed; staged runner sources tasks from O*NET).
  const automated = new Set((currentAutomation || []).map(a => a.toLowerCase()));
  const assessment = assessAutomation(role, tasks);

  const allAutomatable = [
    ...assessment.breakdown.automatable,
    ...assessment.breakdown.augmentable,
  ];

  const gaps: AutomationGapItem[] = allAutomatable.map(task => {
    const isAutomated = automated.has(task.task.toLowerCase()) ||
      [...automated].some(a => task.task.toLowerCase().includes(a) || a.includes(task.task.toLowerCase()));

    let priority: 'high' | 'medium' | 'low';
    if (task.automation_score >= 80) priority = 'high';
    else if (task.automation_score >= 60) priority = 'medium';
    else priority = 'low';

    return {
      task: task.task,
      automation_score: task.automation_score,
      status: isAutomated ? 'automated' as const : 'not_automated' as const,
      priority: isAutomated ? 'low' : priority,
    };
  });

  const notAutomated = gaps.filter(g => g.status === 'not_automated');
  const gapScore = allAutomatable.length > 0
    ? Math.round((notAutomated.length / allAutomatable.length) * 100)
    : 0;

  const priorityActions: string[] = [];
  const highPriority = notAutomated.filter(g => g.priority === 'high');
  const medPriority = notAutomated.filter(g => g.priority === 'medium');
  if (highPriority.length > 0) {
    priorityActions.push(
      `Automate ${highPriority.length} high-priority task(s): ${highPriority.map(g => g.task).join('; ')}.`
    );
  }
  if (medPriority.length > 0) {
    priorityActions.push(
      `Evaluate AI augmentation for ${medPriority.length} medium-priority task(s).`
    );
  }
  if (notAutomated.length === 0) {
    priorityActions.push('All automatable tasks are currently automated. Focus on optimization and monitoring.');
  }

  return {
    role,
    current_automation: currentAutomation || [],
    all_automatable_tasks: allAutomatable.map(t => t.task),
    gaps,
    gap_score: gapScore,
    priority_actions: priorityActions,
  };
}

// ---------------------------------------------------------------------------
// Human edge scoring (ported from WORKBankLoader.get_human_edge)
// ---------------------------------------------------------------------------

export interface HumanEdgeResult {
  task_or_role: string;
  human_edge_score: number;
  social_intelligence: number;
  creative_thinking: number;
  ethical_judgment: number;
  physical_dexterity: number;
  contextual_adaptation: number;
  stakeholder_trust: number;
  key_human_advantages: string[];
  data_source: string;
}

const HUMAN_EDGE_KEYWORDS: Record<string, string[]> = {
  social_intelligence: [
    'negotiat', 'counsel', 'mentor', 'coach', 'mediat', 'empathiz',
    'persuad', 'motivat', 'relationship', 'collaborat', 'communicat',
    'listen', 'conflict', 'team', 'interpersonal', 'rapport',
    'emotional', 'social', 'diplomacy', 'influence',
  ],
  creative_thinking: [
    'creat', 'innovat', 'design', 'invent', 'brainstorm', 'ideate',
    'imagin', 'conceptualiz', 'original', 'novel', 'artistic',
    'vision', 'strategic', 'pioneer', 'experiment', 'prototype',
  ],
  ethical_judgment: [
    'ethic', 'moral', 'fair', 'justice', 'integrity', 'compliance',
    'governance', 'accountability', 'transparency', 'trust',
    'confidential', 'privacy', 'rights', 'equit', 'bias',
    'discrimination', 'regulat',
  ],
  physical_dexterity: [
    'physical', 'manual', 'hands-on', 'dexterity', 'motor',
    'assembl', 'repair', 'construct', 'operat', 'lift',
    'carry', 'manipulat', 'fine motor', 'surgical', 'craft',
  ],
  contextual_adaptation: [
    'adapt', 'improvise', 'crisis', 'emergency', 'ambiguity',
    'uncertain', 'dynamic', 'unpredictable', 'complex', 'nuance',
    'context', 'judgment call', 'discretion', 'situational',
    'exception', 'edge case', 'triage',
  ],
  stakeholder_trust: [
    'trust', 'credibility', 'reputation', 'authority', 'leadership',
    'accountability', 'represent', 'advocate', 'steward',
    'fiduciary', 'patient', 'client', 'customer', 'public',
    'communit', 'governance',
  ],
};

const DIMENSION_WEIGHTS: Record<string, number> = {
  social_intelligence: 0.22,
  creative_thinking: 0.18,
  ethical_judgment: 0.18,
  physical_dexterity: 0.12,
  contextual_adaptation: 0.15,
  stakeholder_trust: 0.15,
};

/**
 * Score a task or role statement for human-edge dimensions.
 * Uses keyword-based scoring similar to WORKBankLoader.get_human_edge.
 */
export function assessHumanEdge(taskStatement: string): HumanEdgeResult {
  const normalized = taskStatement.toLowerCase();

  const dimensionScores: Record<string, number> = {};
  const keyAdvantages: string[] = [];

  for (const [dimension, keywords] of Object.entries(HUMAN_EDGE_KEYWORDS)) {
    let matches = 0;
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        matches++;
      }
    }
    // Score 0-100 based on proportion of keywords matched, with diminishing returns
    const rawScore = Math.min(matches / 3, 1.0) * 100;
    dimensionScores[dimension] = Math.round(rawScore);

    if (rawScore >= 50) {
      const readableName = dimension.replace(/_/g, ' ');
      keyAdvantages.push(
        `Strong ${readableName} requirement (${Math.round(rawScore)}%) — ${matches} indicator(s) detected.`
      );
    }
  }

  // Compute weighted human edge score
  let weightedSum = 0;
  for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    weightedSum += (dimensionScores[dim] || 0) * weight;
  }
  const humanEdgeScore = Math.round(weightedSum);

  if (keyAdvantages.length === 0) {
    keyAdvantages.push('No strong human-edge indicators detected. Task may be suitable for automation.');
  }

  return {
    task_or_role: taskStatement,
    human_edge_score: humanEdgeScore,
    social_intelligence: dimensionScores.social_intelligence,
    creative_thinking: dimensionScores.creative_thinking,
    ethical_judgment: dimensionScores.ethical_judgment,
    physical_dexterity: dimensionScores.physical_dexterity,
    contextual_adaptation: dimensionScores.contextual_adaptation,
    stakeholder_trust: dimensionScores.stakeholder_trust,
    key_human_advantages: keyAdvantages,
    data_source: 'keyword_analysis',
  };
}
