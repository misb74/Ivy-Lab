/**
 * Ported baseline contracts from WorkLab.
 * Gate A intentionally keeps these types close to the source shape so Gate B engines can adopt them incrementally.
 */

export interface WorkforceRole {
  id: string;
  title: string;
  department: string;
  headcount: number;
  avgSalary?: number;
  skills: string[];
  automationRisk: number;
}

export interface TransformationScenario {
  id: string;
  name: string;
  type: 'automation' | 'ai-augmentation' | 'consolidation' | 'outsourcing' | 'growth' | 'custom';
  description: string;
  parameters: Record<string, unknown>;
}

export interface FinancialImpact {
  currentCost: number;
  projectedCost: number;
  annualSavings: number;
  implementationCost: number;
}

export interface TransitionPath {
  sourceRoleId: string;
  targetRoleId: string;
  probability: number;
  requiredSkills: string[];
  durationMonths: number;
}

export interface SimulationResult {
  id: string;
  scenarioId: string;
  timestamp: string;
  financialImpact: FinancialImpact;
  transitionPaths: TransitionPath[];
}

export interface AgentCapability {
  id: string;
  name: string;
  category: 'document' | 'communication' | 'data' | 'decision' | 'integration' | 'analysis';
  maturityLevel: 'experimental' | 'stable' | 'production';
}

export interface AgentTask {
  id: string;
  name: string;
  automationLevel: 'autonomous' | 'human-in-loop' | 'supervised' | 'human-only';
  automationConfidence: number;
}

export interface AgentGuardrails {
  requiresApprovalFor: string[];
  prohibitedActions: string[];
  auditLogging: boolean;
  rollbackCapable: boolean;
  humanReviewPercentage: number;
}

export interface AgentCosts {
  infrastructureMonthly: number;
  apiCostsMonthly: number;
  maintenanceMonthly: number;
  implementationOneTime: number;
}

export interface AgentMetrics {
  tasksPerDay: number;
  accuracyRate: number;
  escalationRate: number;
  avgProcessingTimeMs: number;
  errorRate: number;
  uptimePercentage: number;
}

export interface AIAgent {
  id: string;
  name: string;
  type: 'autonomous' | 'human-in-loop' | 'supervised';
  capabilities: AgentCapability[];
  tasks: AgentTask[];
  guardrails: AgentGuardrails;
  costs: AgentCosts;
  metrics: AgentMetrics;
}
