/**
 * Onboarding plan generation, org chart parsing, and RACI matrix tools.
 */

// ---------------------------------------------------------------------------
// Onboarding plan generator
// ---------------------------------------------------------------------------

export interface OnboardingPlan {
  role: string;
  department: string;
  start_date: string;
  phases: OnboardingPhase[];
  key_milestones: Milestone[];
  stakeholders: Stakeholder[];
  resources: string[];
}

export interface OnboardingPhase {
  phase: string;
  duration: string;
  start_offset_days: number;
  end_offset_days: number;
  activities: OnboardingActivity[];
}

export interface OnboardingActivity {
  activity: string;
  owner: string;
  timing: string;
  category: 'administrative' | 'orientation' | 'training' | 'social' | 'performance';
}

export interface Milestone {
  milestone: string;
  target_day: number;
  success_criteria: string;
}

export interface Stakeholder {
  role: string;
  responsibility: string;
}

const DEPARTMENT_SPECIFIC: Record<string, {
  training: string[];
  tools: string[];
  certifications: string[];
}> = {
  engineering: {
    training: ['Development environment setup', 'Code review process', 'CI/CD pipeline walkthrough', 'Architecture overview', 'Security practices'],
    tools: ['Git/GitHub', 'IDE', 'Jira', 'Confluence', 'Slack', 'CI/CD platform'],
    certifications: ['Security awareness', 'Code of conduct'],
  },
  sales: {
    training: ['Product training', 'Sales methodology', 'CRM training', 'Competitive landscape', 'Pricing and proposals'],
    tools: ['CRM (Salesforce/HubSpot)', 'LinkedIn Sales Navigator', 'Gong/Chorus', 'Proposal software'],
    certifications: ['Product certification', 'Sales methodology certification'],
  },
  marketing: {
    training: ['Brand guidelines', 'Marketing stack overview', 'Content strategy', 'Analytics and reporting', 'Campaign processes'],
    tools: ['Marketing automation', 'CMS', 'Analytics platform', 'Design tools', 'Social media tools'],
    certifications: ['Brand certification', 'Data privacy (GDPR/CCPA)'],
  },
  hr: {
    training: ['HRIS system training', 'Employment law basics', 'Benefits administration', 'Recruitment process', 'Employee relations'],
    tools: ['HRIS', 'ATS', 'Benefits platform', 'LMS', 'HR analytics'],
    certifications: ['Employment law compliance', 'Data privacy', 'Anti-harassment'],
  },
  finance: {
    training: ['Accounting systems', 'Financial reporting', 'Budget process', 'Expense policies', 'Audit procedures'],
    tools: ['ERP system', 'Excel/Sheets', 'BI tools', 'Expense management', 'AP/AR systems'],
    certifications: ['SOX compliance', 'Anti-fraud awareness'],
  },
  operations: {
    training: ['Process documentation', 'Quality standards', 'Safety protocols', 'Vendor management', 'Continuous improvement'],
    tools: ['Project management', 'Process mapping', 'Quality management', 'Inventory systems'],
    certifications: ['Safety certification', 'Quality certification'],
  },
};

/**
 * Generate an onboarding plan for a new hire.
 */
export function generateOnboardingPlan(
  role: string,
  department?: string,
  startDate?: string
): OnboardingPlan {
  const dept = department?.toLowerCase() || 'general';
  const start = startDate || new Date().toISOString().split('T')[0];
  const deptConfig = DEPARTMENT_SPECIFIC[dept] || {
    training: ['Company overview', 'Department processes', 'Tools and systems', 'Role-specific training'],
    tools: ['Company email', 'Communication tools', 'Project management', 'Department-specific tools'],
    certifications: ['Code of conduct', 'Security awareness'],
  };

  const phases: OnboardingPhase[] = [
    {
      phase: 'Pre-boarding (Before Day 1)',
      duration: '1-2 weeks before start',
      start_offset_days: -14,
      end_offset_days: -1,
      activities: [
        { activity: 'Send welcome email with first-day logistics', owner: 'HR', timing: '2 weeks before', category: 'administrative' },
        { activity: 'Provision laptop and equipment', owner: 'IT', timing: '1 week before', category: 'administrative' },
        { activity: 'Set up email, accounts, and system access', owner: 'IT', timing: '3 days before', category: 'administrative' },
        { activity: 'Prepare workspace/desk', owner: 'Facilities', timing: '1 day before', category: 'administrative' },
        { activity: 'Assign onboarding buddy/mentor', owner: 'Hiring Manager', timing: '1 week before', category: 'social' },
        { activity: 'Share pre-reading materials and org chart', owner: 'HR', timing: '1 week before', category: 'orientation' },
      ],
    },
    {
      phase: 'Week 1: Foundation',
      duration: 'Days 1-5',
      start_offset_days: 0,
      end_offset_days: 5,
      activities: [
        { activity: 'Day 1 welcome and office tour', owner: 'HR / Hiring Manager', timing: 'Day 1 AM', category: 'orientation' },
        { activity: 'Complete new hire paperwork (I-9, tax forms, benefits)', owner: 'HR', timing: 'Day 1', category: 'administrative' },
        { activity: 'Company overview and values session', owner: 'HR / Leadership', timing: 'Day 1 PM', category: 'orientation' },
        { activity: 'Team introductions and lunch', owner: 'Hiring Manager', timing: 'Day 1-2', category: 'social' },
        { activity: 'IT setup and tool walkthroughs', owner: 'IT / Buddy', timing: 'Day 2', category: 'training' },
        { activity: `Department-specific orientation: ${dept}`, owner: 'Hiring Manager', timing: 'Day 2-3', category: 'orientation' },
        { activity: 'Review role expectations and 30/60/90 day goals', owner: 'Hiring Manager', timing: 'Day 3', category: 'performance' },
        { activity: 'Begin role-specific training modules', owner: 'L&D / Manager', timing: 'Day 4-5', category: 'training' },
        { activity: 'End-of-week check-in with manager', owner: 'Hiring Manager', timing: 'Day 5', category: 'performance' },
      ],
    },
    {
      phase: 'Weeks 2-4: Building',
      duration: 'Days 6-30',
      start_offset_days: 6,
      end_offset_days: 30,
      activities: [
        { activity: `Complete ${deptConfig.training[0]} training`, owner: 'L&D / Manager', timing: 'Week 2', category: 'training' },
        { activity: `Complete ${deptConfig.training[1]} training`, owner: 'L&D / Manager', timing: 'Week 2-3', category: 'training' },
        { activity: 'Shadow experienced team members', owner: 'Buddy / Team', timing: 'Week 2-3', category: 'training' },
        { activity: 'Begin first independent assignment', owner: 'Hiring Manager', timing: 'Week 3', category: 'performance' },
        { activity: 'Meet key cross-functional stakeholders', owner: 'Hiring Manager', timing: 'Week 3-4', category: 'social' },
        { activity: `Tool proficiency: ${deptConfig.tools.slice(0, 3).join(', ')}`, owner: 'IT / Buddy', timing: 'Week 2-4', category: 'training' },
        { activity: '30-day check-in and feedback session', owner: 'Hiring Manager', timing: 'Day 30', category: 'performance' },
      ],
    },
    {
      phase: 'Days 31-60: Contributing',
      duration: 'Days 31-60',
      start_offset_days: 31,
      end_offset_days: 60,
      activities: [
        { activity: 'Take on increasing responsibilities', owner: 'Hiring Manager', timing: 'Ongoing', category: 'performance' },
        { activity: `Complete ${deptConfig.certifications.join(', ')} certifications`, owner: 'L&D', timing: 'By Day 45', category: 'training' },
        { activity: 'Participate in team projects independently', owner: 'Team', timing: 'Ongoing', category: 'performance' },
        { activity: 'Provide feedback on onboarding experience', owner: 'HR', timing: 'Day 45', category: 'orientation' },
        { activity: '60-day review and goal adjustment', owner: 'Hiring Manager', timing: 'Day 60', category: 'performance' },
      ],
    },
    {
      phase: 'Days 61-90: Performing',
      duration: 'Days 61-90',
      start_offset_days: 61,
      end_offset_days: 90,
      activities: [
        { activity: 'Operate at near-full productivity', owner: 'Employee', timing: 'Ongoing', category: 'performance' },
        { activity: 'Complete all required training and certifications', owner: 'L&D / Employee', timing: 'By Day 75', category: 'training' },
        { activity: 'Present first project/deliverable to team', owner: 'Employee', timing: 'Day 75-80', category: 'performance' },
        { activity: 'Buddy/mentor relationship transition', owner: 'Buddy', timing: 'Day 80', category: 'social' },
        { activity: '90-day performance review', owner: 'Hiring Manager', timing: 'Day 90', category: 'performance' },
        { activity: 'Transition to ongoing performance management', owner: 'Hiring Manager', timing: 'Day 90', category: 'performance' },
      ],
    },
  ];

  const keyMilestones: Milestone[] = [
    { milestone: 'All administrative tasks complete', target_day: 3, success_criteria: 'I-9, tax forms, benefits enrollment, system access all confirmed' },
    { milestone: 'Week 1 orientation complete', target_day: 5, success_criteria: 'Company/department overview done, team met, goals set' },
    { milestone: '30-day checkpoint', target_day: 30, success_criteria: 'Core training complete, first assignment done, positive manager feedback' },
    { milestone: '60-day checkpoint', target_day: 60, success_criteria: 'Working independently, certifications complete, stakeholders met' },
    { milestone: '90-day review', target_day: 90, success_criteria: 'Full productivity, positive performance review, development plan set' },
  ];

  const stakeholders: Stakeholder[] = [
    { role: 'Hiring Manager', responsibility: 'Primary onboarding lead, goal setting, performance check-ins' },
    { role: 'HR Business Partner', responsibility: 'Administrative processing, compliance, policy questions' },
    { role: 'Onboarding Buddy', responsibility: 'Day-to-day guidance, culture integration, informal support' },
    { role: 'IT Support', responsibility: 'Equipment, system access, tool setup' },
    { role: 'L&D Team', responsibility: 'Training programs, certifications, development resources' },
    { role: 'Skip-level Manager', responsibility: 'Strategic context, career development conversation (week 4)' },
  ];

  const resources = [
    'Employee handbook',
    'Company org chart',
    'Department process documentation',
    `${dept} tool guides: ${deptConfig.tools.join(', ')}`,
    'Benefits summary and enrollment guide',
    'IT self-service portal',
    '30/60/90 day goal template',
    'Onboarding feedback survey',
  ];

  return {
    role,
    department: department || 'General',
    start_date: start,
    phases,
    key_milestones: keyMilestones,
    stakeholders,
    resources,
  };
}

// ---------------------------------------------------------------------------
// Org chart parser
// ---------------------------------------------------------------------------

export interface OrgChartResult {
  total_nodes: number;
  hierarchy: OrgNode[];
  statistics: OrgStatistics;
  issues: string[];
}

export interface OrgNode {
  name: string;
  title?: string;
  department?: string;
  reports_to?: string;
  direct_reports: string[];
  level: number;
}

export interface OrgStatistics {
  total_employees: number;
  total_managers: number;
  max_depth: number;
  avg_span_of_control: number;
  departments: string[];
  top_of_org: string[];
}

/**
 * Parse org chart data from a text representation.
 * Supports formats like:
 *  - "Name, Title, Department, Reports To" (CSV-like)
 *  - "Name -> Manager" (arrow notation)
 *  - Indented hierarchy
 */
export function parseOrgChart(orgData: string): OrgChartResult {
  const lines = orgData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const nodes: Map<string, OrgNode> = new Map();
  const issues: string[] = [];

  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('//')) continue; // Skip comments

    // Try CSV format: Name, Title, Department, Reports To
    if (line.includes(',')) {
      const parts = line.split(',').map(p => p.trim());
      const name = parts[0];
      if (!name) continue;

      const existing = nodes.get(name) || {
        name,
        direct_reports: [],
        level: 0,
      };

      existing.title = parts[1] || existing.title;
      existing.department = parts[2] || existing.department;
      existing.reports_to = parts[3] || existing.reports_to;

      nodes.set(name, existing);

      // Ensure manager exists
      if (existing.reports_to && !nodes.has(existing.reports_to)) {
        nodes.set(existing.reports_to, {
          name: existing.reports_to,
          direct_reports: [],
          level: 0,
        });
      }
      if (existing.reports_to) {
        const manager = nodes.get(existing.reports_to)!;
        if (!manager.direct_reports.includes(name)) {
          manager.direct_reports.push(name);
        }
      }
      continue;
    }

    // Try arrow format: Name -> Manager
    if (line.includes('->') || line.includes('→')) {
      const parts = line.split(/->|→/).map(p => p.trim());
      const name = parts[0];
      const manager = parts[1];
      if (!name) continue;

      const existing = nodes.get(name) || {
        name,
        direct_reports: [],
        level: 0,
      };
      existing.reports_to = manager;
      nodes.set(name, existing);

      if (manager && !nodes.has(manager)) {
        nodes.set(manager, {
          name: manager,
          direct_reports: [],
          level: 0,
        });
      }
      if (manager) {
        const managerNode = nodes.get(manager)!;
        if (!managerNode.direct_reports.includes(name)) {
          managerNode.direct_reports.push(name);
        }
      }
      continue;
    }

    // Try indented hierarchy
    const indent = line.length - line.trimStart().length;
    const name = line.trim();
    if (name) {
      nodes.set(name, nodes.get(name) || {
        name,
        direct_reports: [],
        level: Math.floor(indent / 2),
      });
    }
  }

  // Calculate levels
  const roots = [...nodes.values()].filter(n => !n.reports_to);
  function setLevel(node: OrgNode, level: number) {
    node.level = level;
    for (const reportName of node.direct_reports) {
      const report = nodes.get(reportName);
      if (report) setLevel(report, level + 1);
    }
  }
  for (const root of roots) {
    setLevel(root, 0);
  }

  // Statistics
  const allNodes = [...nodes.values()];
  const managers = allNodes.filter(n => n.direct_reports.length > 0);
  const departments = [...new Set(allNodes.map(n => n.department).filter(Boolean))] as string[];
  const maxDepth = allNodes.reduce((max, n) => Math.max(max, n.level), 0);
  const avgSpan = managers.length > 0
    ? Math.round((managers.reduce((sum, m) => sum + m.direct_reports.length, 0) / managers.length) * 10) / 10
    : 0;

  // Issues
  if (roots.length === 0) {
    issues.push('No root node found (everyone reports to someone). Possible circular reporting.');
  }
  if (roots.length > 1) {
    issues.push(`Multiple top-level nodes found: ${roots.map(r => r.name).join(', ')}. Verify org structure.`);
  }
  const wideSpan = managers.filter(m => m.direct_reports.length > 10);
  if (wideSpan.length > 0) {
    issues.push(`${wideSpan.length} manager(s) with span of control > 10: ${wideSpan.map(m => `${m.name} (${m.direct_reports.length})`).join(', ')}.`);
  }
  const narrowSpan = managers.filter(m => m.direct_reports.length === 1);
  if (narrowSpan.length > 0) {
    issues.push(`${narrowSpan.length} manager(s) with only 1 direct report. Consider whether management layer is needed.`);
  }

  return {
    total_nodes: nodes.size,
    hierarchy: allNodes,
    statistics: {
      total_employees: allNodes.length,
      total_managers: managers.length,
      max_depth: maxDepth,
      avg_span_of_control: avgSpan,
      departments,
      top_of_org: roots.map(r => r.name),
    },
    issues,
  };
}

// ---------------------------------------------------------------------------
// RACI matrix generator
// ---------------------------------------------------------------------------

export interface RaciMatrix {
  process: string;
  roles: string[];
  activities: RaciActivity[];
  summary: RaciSummary;
}

export interface RaciActivity {
  activity: string;
  assignments: Record<string, 'R' | 'A' | 'C' | 'I'>;
}

export interface RaciSummary {
  total_activities: number;
  role_load: Record<string, { responsible: number; accountable: number; consulted: number; informed: number }>;
  issues: string[];
}

/**
 * Process templates for RACI generation.
 */
const RACI_TEMPLATES: Record<string, Array<{ activity: string; rolePattern: Record<number, 'R' | 'A' | 'C' | 'I'> }>> = {
  'hiring': [
    { activity: 'Define job requirements', rolePattern: { 0: 'A', 1: 'R', 2: 'C', 3: 'I' } },
    { activity: 'Write job description', rolePattern: { 0: 'C', 1: 'R', 2: 'A', 3: 'I' } },
    { activity: 'Post job opening', rolePattern: { 0: 'I', 1: 'R', 2: 'A', 3: 'I' } },
    { activity: 'Screen resumes', rolePattern: { 0: 'I', 1: 'R', 2: 'C', 3: 'I' } },
    { activity: 'Conduct interviews', rolePattern: { 0: 'R', 1: 'R', 2: 'C', 3: 'I' } },
    { activity: 'Evaluate candidates', rolePattern: { 0: 'A', 1: 'R', 2: 'C', 3: 'I' } },
    { activity: 'Make hiring decision', rolePattern: { 0: 'A', 1: 'C', 2: 'C', 3: 'I' } },
    { activity: 'Extend offer', rolePattern: { 0: 'A', 1: 'R', 2: 'C', 3: 'I' } },
    { activity: 'Negotiate compensation', rolePattern: { 0: 'A', 1: 'R', 2: 'C', 3: 'I' } },
    { activity: 'Onboard new hire', rolePattern: { 0: 'C', 1: 'R', 2: 'A', 3: 'R' } },
  ],
  'performance review': [
    { activity: 'Set review timeline', rolePattern: { 0: 'I', 1: 'A', 2: 'R', 3: 'I' } },
    { activity: 'Distribute self-assessments', rolePattern: { 0: 'I', 1: 'R', 2: 'A', 3: 'I' } },
    { activity: 'Collect peer feedback', rolePattern: { 0: 'I', 1: 'R', 2: 'A', 3: 'I' } },
    { activity: 'Write performance reviews', rolePattern: { 0: 'R', 1: 'A', 2: 'C', 3: 'I' } },
    { activity: 'Calibrate ratings', rolePattern: { 0: 'R', 1: 'A', 2: 'C', 3: 'I' } },
    { activity: 'Deliver performance feedback', rolePattern: { 0: 'R', 1: 'A', 2: 'I', 3: 'I' } },
    { activity: 'Set development goals', rolePattern: { 0: 'R', 1: 'A', 2: 'C', 3: 'I' } },
    { activity: 'Process merit increases', rolePattern: { 0: 'C', 1: 'A', 2: 'R', 3: 'I' } },
  ],
  'onboarding': [
    { activity: 'Pre-boarding communications', rolePattern: { 0: 'I', 1: 'R', 2: 'A', 3: 'I' } },
    { activity: 'Provision equipment', rolePattern: { 0: 'I', 1: 'I', 2: 'C', 3: 'R' } },
    { activity: 'Day 1 orientation', rolePattern: { 0: 'C', 1: 'R', 2: 'A', 3: 'I' } },
    { activity: 'New hire paperwork', rolePattern: { 0: 'I', 1: 'A', 2: 'R', 3: 'I' } },
    { activity: 'Department orientation', rolePattern: { 0: 'R', 1: 'A', 2: 'I', 3: 'I' } },
    { activity: 'Training program', rolePattern: { 0: 'C', 1: 'R', 2: 'A', 3: 'I' } },
    { activity: 'Buddy assignment', rolePattern: { 0: 'R', 1: 'A', 2: 'C', 3: 'I' } },
    { activity: '30/60/90 day check-ins', rolePattern: { 0: 'R', 1: 'A', 2: 'I', 3: 'I' } },
  ],
};

/**
 * Generate a RACI matrix for a process and set of roles.
 */
export function generateRaciMatrix(process: string, roles: string[]): RaciMatrix {
  const normalizedProcess = process.toLowerCase();

  // Find matching template or use generic
  let templateKey = Object.keys(RACI_TEMPLATES).find(k => normalizedProcess.includes(k));
  const template = templateKey ? RACI_TEMPLATES[templateKey] : null;

  let activities: RaciActivity[];

  if (template) {
    activities = template.map(item => {
      const assignments: Record<string, 'R' | 'A' | 'C' | 'I'> = {};
      for (let i = 0; i < roles.length; i++) {
        const patternIdx = Math.min(i, Object.keys(item.rolePattern).length - 1);
        assignments[roles[i]] = item.rolePattern[patternIdx] || 'I';
      }
      return { activity: item.activity, assignments };
    });
  } else {
    // Generate generic activities based on process name
    const genericActivities = [
      `Initiate ${process}`,
      `Plan ${process} approach`,
      `Execute ${process} tasks`,
      `Review ${process} progress`,
      `Approve ${process} outcomes`,
      `Communicate ${process} results`,
      `Document ${process} learnings`,
    ];

    activities = genericActivities.map((activity, idx) => {
      const assignments: Record<string, 'R' | 'A' | 'C' | 'I'> = {};
      for (let i = 0; i < roles.length; i++) {
        // Assign based on position: first role = mostly A, second = R, rest = C/I
        if (i === 0) assignments[roles[i]] = idx % 3 === 0 ? 'A' : 'R';
        else if (i === 1) assignments[roles[i]] = idx % 2 === 0 ? 'R' : 'C';
        else if (i === 2) assignments[roles[i]] = 'C';
        else assignments[roles[i]] = 'I';
      }
      return { activity, assignments };
    });
  }

  // Compute summary
  const roleLoad: Record<string, { responsible: number; accountable: number; consulted: number; informed: number }> = {};
  for (const role of roles) {
    roleLoad[role] = { responsible: 0, accountable: 0, consulted: 0, informed: 0 };
  }

  for (const act of activities) {
    for (const [role, assignment] of Object.entries(act.assignments)) {
      if (!roleLoad[role]) continue;
      switch (assignment) {
        case 'R': roleLoad[role].responsible++; break;
        case 'A': roleLoad[role].accountable++; break;
        case 'C': roleLoad[role].consulted++; break;
        case 'I': roleLoad[role].informed++; break;
      }
    }
  }

  // Check for issues
  const issues: string[] = [];
  for (const act of activities) {
    const values = Object.values(act.assignments);
    const accountableCount = values.filter(v => v === 'A').length;
    const responsibleCount = values.filter(v => v === 'R').length;
    if (accountableCount === 0) {
      issues.push(`"${act.activity}" has no Accountable (A) role assigned.`);
    }
    if (accountableCount > 1) {
      issues.push(`"${act.activity}" has ${accountableCount} Accountable (A) roles — should be exactly 1.`);
    }
    if (responsibleCount === 0) {
      issues.push(`"${act.activity}" has no Responsible (R) role assigned.`);
    }
  }

  // Check for overloaded roles
  for (const [role, load] of Object.entries(roleLoad)) {
    if (load.responsible + load.accountable > activities.length * 0.6) {
      issues.push(`"${role}" is responsible or accountable for >${Math.round(60)}% of activities. Consider redistributing.`);
    }
  }

  return {
    process,
    roles,
    activities,
    summary: {
      total_activities: activities.length,
      role_load: roleLoad,
      issues,
    },
  };
}

// ---------------------------------------------------------------------------
// Careers visual scanner (full implementation)
// ---------------------------------------------------------------------------

export { careersVisualScan } from './careers-scanner.js';
export type { CareersVisualScanResult } from './careers-scanner.js';
