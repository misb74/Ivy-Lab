/**
 * Transformation modeling for workforce automation planning.
 * Models workforce transformation scenarios and maps processes for automation.
 */

// ---------------------------------------------------------------------------
// Workforce transformation modeling
// ---------------------------------------------------------------------------

export interface TransformationModelResult {
  roles: string[];
  scenario: string;
  role_impacts: RoleImpact[];
  aggregate_impact: AggregateImpact;
  timeline: TransformationPhase[];
  recommendations: string[];
}

export interface RoleImpact {
  role: string;
  current_fte_equivalent: number;
  projected_fte_equivalent: number;
  change_percent: number;
  impact_category: 'eliminated' | 'significantly_reduced' | 'moderately_reduced' | 'augmented' | 'expanded' | 'new_role';
  key_changes: string[];
  reskilling_needs: string[];
}

export interface AggregateImpact {
  total_roles_analyzed: number;
  roles_at_risk: number;
  roles_augmented: number;
  roles_expanded: number;
  estimated_fte_reduction_percent: number;
  estimated_productivity_gain_percent: number;
  estimated_reskilling_investment: string;
}

export interface TransformationPhase {
  phase: number;
  name: string;
  duration_months: number;
  activities: string[];
  roles_affected: string[];
}

/**
 * Role automation profiles for common roles.
 */
const ROLE_PROFILES: Record<string, {
  automation_potential: number;
  augmentation_potential: number;
  growth_potential: number;
  key_tasks_automated: string[];
  new_skills_needed: string[];
}> = {
  'data entry clerk': {
    automation_potential: 0.92,
    augmentation_potential: 0.05,
    growth_potential: -0.80,
    key_tasks_automated: ['Manual data entry', 'Form processing', 'Record updating', 'Document filing'],
    new_skills_needed: ['Data quality oversight', 'Exception handling', 'System administration'],
  },
  'customer service representative': {
    automation_potential: 0.55,
    augmentation_potential: 0.35,
    growth_potential: -0.20,
    key_tasks_automated: ['FAQ responses', 'Ticket routing', 'Status lookups', 'Basic troubleshooting'],
    new_skills_needed: ['Complex problem resolution', 'Emotional intelligence', 'AI tool management'],
  },
  'accountant': {
    automation_potential: 0.65,
    augmentation_potential: 0.30,
    growth_potential: -0.15,
    key_tasks_automated: ['Transaction recording', 'Report generation', 'Reconciliation', 'Basic tax calculations'],
    new_skills_needed: ['Data analytics', 'Strategic advisory', 'AI audit tools', 'Regulatory technology'],
  },
  'software engineer': {
    automation_potential: 0.25,
    augmentation_potential: 0.65,
    growth_potential: 0.20,
    key_tasks_automated: ['Boilerplate code generation', 'Test writing', 'Documentation', 'Code review (basic)'],
    new_skills_needed: ['AI/ML engineering', 'Prompt engineering', 'System design', 'AI oversight'],
  },
  'hr manager': {
    automation_potential: 0.35,
    augmentation_potential: 0.45,
    growth_potential: 0.05,
    key_tasks_automated: ['Benefits administration', 'Compliance reporting', 'Scheduling', 'Basic policy queries'],
    new_skills_needed: ['People analytics', 'AI ethics', 'Change management', 'Digital HR tools'],
  },
  'project manager': {
    automation_potential: 0.30,
    augmentation_potential: 0.50,
    growth_potential: 0.10,
    key_tasks_automated: ['Status reporting', 'Schedule tracking', 'Resource allocation', 'Risk flagging'],
    new_skills_needed: ['AI project tools', 'Agile leadership', 'Stakeholder management', 'Data-driven decisions'],
  },
  'marketing analyst': {
    automation_potential: 0.45,
    augmentation_potential: 0.45,
    growth_potential: 0.05,
    key_tasks_automated: ['Report generation', 'Data aggregation', 'Campaign tracking', 'A/B test analysis'],
    new_skills_needed: ['AI marketing tools', 'Creative strategy', 'Customer journey design', 'Predictive analytics'],
  },
  'nurse': {
    automation_potential: 0.15,
    augmentation_potential: 0.40,
    growth_potential: 0.25,
    key_tasks_automated: ['Documentation', 'Medication tracking', 'Vital sign monitoring', 'Scheduling'],
    new_skills_needed: ['Telehealth technology', 'AI diagnostic support', 'Patient data analytics', 'Remote monitoring'],
  },
  'teacher': {
    automation_potential: 0.15,
    augmentation_potential: 0.50,
    growth_potential: 0.15,
    key_tasks_automated: ['Grading objective tests', 'Attendance tracking', 'Progress reporting', 'Content curation'],
    new_skills_needed: ['EdTech integration', 'Personalized learning design', 'AI literacy', 'Digital assessment'],
  },
  'sales representative': {
    automation_potential: 0.40,
    augmentation_potential: 0.45,
    growth_potential: -0.05,
    key_tasks_automated: ['Lead scoring', 'CRM updates', 'Email sequencing', 'Pipeline reporting'],
    new_skills_needed: ['AI sales tools', 'Consultative selling', 'Data-driven prospecting', 'Digital relationship management'],
  },
};

/**
 * Model workforce transformation for a set of roles.
 */
export function modelTransformation(
  roles: string[],
  scenario?: string
): TransformationModelResult {
  const selectedScenario = scenario || 'moderate_adoption';

  // Scenario multipliers
  const scenarioMultipliers: Record<string, { automation: number; growth: number; timeline: number }> = {
    conservative: { automation: 0.6, growth: 0.5, timeline: 1.5 },
    moderate_adoption: { automation: 1.0, growth: 1.0, timeline: 1.0 },
    aggressive_adoption: { automation: 1.4, growth: 1.3, timeline: 0.7 },
    disruption: { automation: 1.8, growth: 1.5, timeline: 0.5 },
  };

  const multiplier = scenarioMultipliers[selectedScenario] || scenarioMultipliers.moderate_adoption;

  const roleImpacts: RoleImpact[] = roles.map(role => {
    const normalized = role.toLowerCase();
    const profile = ROLE_PROFILES[normalized] || {
      automation_potential: 0.40,
      augmentation_potential: 0.40,
      growth_potential: 0.0,
      key_tasks_automated: ['Routine tasks', 'Data processing', 'Report generation'],
      new_skills_needed: ['Digital literacy', 'AI tool proficiency', 'Adaptive thinking'],
    };

    const adjustedAutomation = Math.min(profile.automation_potential * multiplier.automation, 0.95);
    const adjustedGrowth = profile.growth_potential * multiplier.growth;
    const currentFte = 100;
    const projectedFte = Math.round(currentFte * (1 + adjustedGrowth));
    const changePct = Math.round(adjustedGrowth * 100);

    let impactCategory: RoleImpact['impact_category'];
    if (changePct <= -60) impactCategory = 'eliminated';
    else if (changePct <= -30) impactCategory = 'significantly_reduced';
    else if (changePct <= -10) impactCategory = 'moderately_reduced';
    else if (changePct <= 10) impactCategory = 'augmented';
    else impactCategory = 'expanded';

    return {
      role,
      current_fte_equivalent: currentFte,
      projected_fte_equivalent: projectedFte,
      change_percent: changePct,
      impact_category: impactCategory,
      key_changes: profile.key_tasks_automated.map(t => `Automate: ${t}`),
      reskilling_needs: profile.new_skills_needed,
    };
  });

  // Aggregate impact
  const atRisk = roleImpacts.filter(r =>
    r.impact_category === 'eliminated' || r.impact_category === 'significantly_reduced'
  ).length;
  const augmented = roleImpacts.filter(r =>
    r.impact_category === 'augmented' || r.impact_category === 'moderately_reduced'
  ).length;
  const expanded = roleImpacts.filter(r => r.impact_category === 'expanded').length;

  const avgChange = roleImpacts.reduce((s, r) => s + r.change_percent, 0) / roleImpacts.length;
  const productivityGain = Math.round(
    roleImpacts.reduce((s, r) => {
      const profile = ROLE_PROFILES[r.role.toLowerCase()];
      return s + (profile ? profile.augmentation_potential * multiplier.automation * 100 : 30);
    }, 0) / roleImpacts.length
  );

  // Timeline
  const baseMonths = 6;
  const timeline: TransformationPhase[] = [
    {
      phase: 1,
      name: 'Assessment & Planning',
      duration_months: Math.round(baseMonths * multiplier.timeline),
      activities: [
        'Conduct detailed task-level automation analysis',
        'Identify technology requirements and vendors',
        'Develop change management strategy',
        'Design reskilling programs',
      ],
      roles_affected: roles,
    },
    {
      phase: 2,
      name: 'Pilot Implementation',
      duration_months: Math.round(baseMonths * multiplier.timeline),
      activities: [
        'Deploy automation for highest-impact tasks',
        'Begin reskilling programs for affected employees',
        'Monitor and adjust based on pilot results',
        'Establish AI governance framework',
      ],
      roles_affected: roleImpacts.filter(r => r.change_percent <= -10).map(r => r.role),
    },
    {
      phase: 3,
      name: 'Scaled Deployment',
      duration_months: Math.round(9 * multiplier.timeline),
      activities: [
        'Roll out automation across all identified tasks',
        'Complete reskilling programs',
        'Restructure teams and reporting lines',
        'Optimize human-AI workflows',
      ],
      roles_affected: roles,
    },
    {
      phase: 4,
      name: 'Optimization & Monitoring',
      duration_months: Math.round(6 * multiplier.timeline),
      activities: [
        'Measure productivity gains and cost savings',
        'Refine AI systems based on performance data',
        'Address emerging skill gaps',
        'Plan next wave of transformation',
      ],
      roles_affected: roles,
    },
  ];

  const recommendations: string[] = [
    `Under the ${selectedScenario} scenario, ${atRisk} of ${roles.length} roles face significant headcount changes.`,
    `Invest in reskilling programs covering: ${[...new Set(roleImpacts.flatMap(r => r.reskilling_needs))].slice(0, 5).join(', ')}.`,
    `Expected productivity gain of ~${productivityGain}% through AI augmentation.`,
    'Establish clear communication plan to manage employee anxiety and maintain engagement.',
    'Create internal mobility pathways for employees in roles with declining headcount.',
  ];

  return {
    roles,
    scenario: selectedScenario,
    role_impacts: roleImpacts,
    aggregate_impact: {
      total_roles_analyzed: roles.length,
      roles_at_risk: atRisk,
      roles_augmented: augmented,
      roles_expanded: expanded,
      estimated_fte_reduction_percent: Math.round(Math.abs(avgChange)),
      estimated_productivity_gain_percent: productivityGain,
      estimated_reskilling_investment: `$${Math.round(roles.length * 5000 * multiplier.automation).toLocaleString()} - $${Math.round(roles.length * 15000 * multiplier.automation).toLocaleString()} per affected employee`,
    },
    timeline,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Process mapping for automation
// ---------------------------------------------------------------------------

export interface ProcessMapResult {
  process_name: string;
  steps: ProcessStep[];
  automation_summary: {
    total_steps: number;
    automatable_steps: number;
    augmentable_steps: number;
    human_essential_steps: number;
    overall_automation_percent: number;
  };
  bottlenecks: string[];
  recommendations: string[];
}

export interface ProcessStep {
  step_number: number;
  description: string;
  automation_potential: 'high' | 'medium' | 'low';
  automation_score: number;
  current_duration_estimate: string;
  automated_duration_estimate: string;
  technology_suggestion: string;
}

/**
 * Default process steps for common HR processes.
 */
const DEFAULT_PROCESSES: Record<string, Array<{
  description: string;
  automation_score: number;
  current_duration: string;
  automated_duration: string;
  tech: string;
}>> = {
  'hiring': [
    { description: 'Post job opening to job boards', automation_score: 90, current_duration: '2 hours', automated_duration: '5 minutes', tech: 'ATS multi-posting' },
    { description: 'Screen resumes and applications', automation_score: 80, current_duration: '8 hours', automated_duration: '30 minutes', tech: 'AI resume screening' },
    { description: 'Schedule interviews', automation_score: 92, current_duration: '2 hours', automated_duration: '5 minutes', tech: 'AI scheduling assistant' },
    { description: 'Conduct interviews', automation_score: 15, current_duration: '4 hours', automated_duration: '4 hours', tech: 'Video platform with AI note-taking' },
    { description: 'Evaluate candidates and make decisions', automation_score: 20, current_duration: '3 hours', automated_duration: '2 hours', tech: 'Structured scorecard with AI summary' },
    { description: 'Run background checks', automation_score: 85, current_duration: '3-5 days', automated_duration: '1-2 days', tech: 'Automated background check platform' },
    { description: 'Generate and send offer letter', automation_score: 88, current_duration: '2 hours', automated_duration: '10 minutes', tech: 'Offer letter automation' },
    { description: 'Process new hire paperwork', automation_score: 85, current_duration: '3 hours', automated_duration: '20 minutes', tech: 'Digital onboarding platform' },
  ],
  'onboarding': [
    { description: 'Send welcome email and pre-boarding materials', automation_score: 95, current_duration: '1 hour', automated_duration: '0 minutes', tech: 'Automated email workflow' },
    { description: 'Provision IT accounts and equipment', automation_score: 82, current_duration: '4 hours', automated_duration: '30 minutes', tech: 'ITSM automation' },
    { description: 'Complete I-9 and tax forms', automation_score: 88, current_duration: '2 hours', automated_duration: '15 minutes', tech: 'E-verify integration' },
    { description: 'Conduct orientation session', automation_score: 30, current_duration: '4 hours', automated_duration: '3 hours', tech: 'LMS with AI-personalized content' },
    { description: 'Assign mentor/buddy', automation_score: 60, current_duration: '1 hour', automated_duration: '10 minutes', tech: 'AI-based mentor matching' },
    { description: 'Set 30/60/90 day goals', automation_score: 25, current_duration: '2 hours', automated_duration: '1.5 hours', tech: 'Goal template with AI suggestions' },
  ],
  'performance review': [
    { description: 'Distribute self-assessment forms', automation_score: 95, current_duration: '2 hours', automated_duration: '5 minutes', tech: 'HRIS workflow' },
    { description: 'Collect peer feedback', automation_score: 85, current_duration: '4 hours', automated_duration: '30 minutes', tech: 'Automated 360 feedback platform' },
    { description: 'Analyze performance data', automation_score: 70, current_duration: '3 hours', automated_duration: '30 minutes', tech: 'People analytics AI' },
    { description: 'Write performance summaries', automation_score: 50, current_duration: '3 hours', automated_duration: '1 hour', tech: 'AI writing assistant with performance data' },
    { description: 'Conduct review conversations', automation_score: 10, current_duration: '1 hour', automated_duration: '1 hour', tech: 'AI-generated talking points' },
    { description: 'Calibrate ratings across teams', automation_score: 35, current_duration: '4 hours', automated_duration: '2 hours', tech: 'AI-assisted calibration analytics' },
    { description: 'Process compensation adjustments', automation_score: 75, current_duration: '4 hours', automated_duration: '30 minutes', tech: 'Comp automation with merit matrix' },
  ],
  'offboarding': [
    { description: 'Initiate separation workflow', automation_score: 90, current_duration: '1 hour', automated_duration: '5 minutes', tech: 'HRIS workflow automation' },
    { description: 'Calculate final pay and benefits', automation_score: 85, current_duration: '3 hours', automated_duration: '15 minutes', tech: 'Payroll automation' },
    { description: 'Revoke system access', automation_score: 92, current_duration: '2 hours', automated_duration: '5 minutes', tech: 'Identity management automation' },
    { description: 'Conduct exit interview', automation_score: 25, current_duration: '1 hour', automated_duration: '45 minutes', tech: 'AI-assisted exit survey with follow-up' },
    { description: 'Process COBRA notifications', automation_score: 90, current_duration: '1 hour', automated_duration: '5 minutes', tech: 'Benefits administration platform' },
    { description: 'Knowledge transfer', automation_score: 20, current_duration: '8 hours', automated_duration: '6 hours', tech: 'Knowledge management with AI extraction' },
  ],
};

/**
 * Map a process for automation potential.
 */
export function mapProcess(processName: string, steps?: string[]): ProcessMapResult {
  const normalized = processName.toLowerCase();

  let processSteps: ProcessStep[];

  if (steps && steps.length > 0) {
    // Score provided steps
    processSteps = steps.map((step, idx) => {
      const stepLower = step.toLowerCase();
      let score = 50;
      let tech = 'Evaluate automation tools';

      // Simple keyword scoring
      if (/data|entry|form|filing|copy|record/.test(stepLower)) {
        score = 85;
        tech = 'RPA / workflow automation';
      } else if (/schedul|route|send|notif|email|alert/.test(stepLower)) {
        score = 88;
        tech = 'Workflow automation / AI assistant';
      } else if (/review|analyz|evaluat|assess/.test(stepLower)) {
        score = 55;
        tech = 'AI analytics with human oversight';
      } else if (/meet|interview|convers|discuss|negotiat/.test(stepLower)) {
        score = 20;
        tech = 'AI note-taking and preparation tools';
      } else if (/creat|design|strateg|plan/.test(stepLower)) {
        score = 35;
        tech = 'AI co-creation / generative tools';
      } else if (/approv|sign|decision/.test(stepLower)) {
        score = 40;
        tech = 'Digital approval workflow';
      } else if (/report|generat|compil/.test(stepLower)) {
        score = 80;
        tech = 'Automated reporting / BI tools';
      }

      return {
        step_number: idx + 1,
        description: step,
        automation_potential: score >= 70 ? 'high' as const : score >= 40 ? 'medium' as const : 'low' as const,
        automation_score: score,
        current_duration_estimate: 'varies',
        automated_duration_estimate: 'varies',
        technology_suggestion: tech,
      };
    });
  } else {
    // Use default process mappings
    const defaultProcess = DEFAULT_PROCESSES[normalized] ||
      Object.entries(DEFAULT_PROCESSES).find(([key]) => normalized.includes(key))?.[1] ||
      DEFAULT_PROCESSES['hiring'];

    processSteps = defaultProcess.map((step, idx) => ({
      step_number: idx + 1,
      description: step.description,
      automation_potential: step.automation_score >= 70 ? 'high' as const : step.automation_score >= 40 ? 'medium' as const : 'low' as const,
      automation_score: step.automation_score,
      current_duration_estimate: step.current_duration,
      automated_duration_estimate: step.automated_duration,
      technology_suggestion: step.tech,
    }));
  }

  // Compute summary
  const automatable = processSteps.filter(s => s.automation_potential === 'high');
  const augmentable = processSteps.filter(s => s.automation_potential === 'medium');
  const humanEssential = processSteps.filter(s => s.automation_potential === 'low');
  const overallPct = Math.round(
    processSteps.reduce((s, step) => s + step.automation_score, 0) / processSteps.length
  );

  // Identify bottlenecks
  const bottlenecks = humanEssential.map(
    s => `Step ${s.step_number}: "${s.description}" — low automation potential, may become a bottleneck in automated workflow.`
  );

  // Recommendations
  const recommendations: string[] = [];
  if (automatable.length > 0) {
    recommendations.push(
      `${automatable.length} of ${processSteps.length} steps are highly automatable. Start with these for quick wins.`
    );
  }
  if (augmentable.length > 0) {
    recommendations.push(
      `${augmentable.length} steps can be augmented with AI. Deploy co-pilot tools for these activities.`
    );
  }
  if (humanEssential.length > 0) {
    recommendations.push(
      `${humanEssential.length} steps require significant human involvement. Focus on supporting tools, not replacement.`
    );
  }
  recommendations.push(`Overall process automation potential: ${overallPct}%.`);

  return {
    process_name: processName,
    steps: processSteps,
    automation_summary: {
      total_steps: processSteps.length,
      automatable_steps: automatable.length,
      augmentable_steps: augmentable.length,
      human_essential_steps: humanEssential.length,
      overall_automation_percent: overallPct,
    },
    bottlenecks,
    recommendations,
  };
}
