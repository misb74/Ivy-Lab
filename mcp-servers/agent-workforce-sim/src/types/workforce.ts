/**
 * WorkVine Simulate — Workforce & Simulation Types
 * Ported from WorkLab's workforceSimulatorTypes.ts and agentPlannerTypes.ts,
 * adapted for deterministic MCP-based simulation (no LLM number generation).
 */

// ═══════════════════════════════════════════════════
// Organization & Role Structure
// ═══════════════════════════════════════════════════

export interface Organization {
  id: string;
  name: string;
  industry_naics?: string;
  headcount?: number;
}

export interface Department {
  id: string;
  org_id: string;
  name: string;
  parent_dept_id?: string;
  headcount?: number;
}

export interface Team {
  id: string;
  dept_id: string;
  name: string;
  manager_role_id?: string;
  headcount?: number;
  change_readiness_score?: number;
  trust_score?: number;
}

export interface TeamRole {
  id: string;
  team_id: string;
  title: string;
  onet_soc_code?: string;
  fte_count: number;
  annual_cost_per_fte?: number;
  level?: string;
  location?: string;
  // Denormalized aggregate scores
  automation_potential?: number;
  worker_desire_avg?: number;
  aei_exposure_score?: number;
  felten_aioe_score?: number;
  human_edge_avg?: number;
}

export interface RoleTask {
  id: string;
  role_id: string;
  onet_task_id?: string;
  task_statement: string;
  importance?: number;
  time_allocation?: number;
  // AI capability scores
  ai_capability_score?: number;
  worker_desire_score?: number;
  human_agency_scale?: number;
  aei_penetration_rate?: number;
  aei_autonomy?: number;
  aei_collaboration_pattern?: string;
  aei_time_savings_pct?: number;
  aei_success_rate?: number;
  // Human edge dimensions (1-5)
  human_edge_social_intelligence?: number;
  human_edge_creative_thinking?: number;
  human_edge_ethical_judgment?: number;
  human_edge_physical_dexterity?: number;
  human_edge_contextual_adaptation?: number;
  human_edge_stakeholder_trust?: number;
}

export type HRActionOwner = 'line_manager' | 'hrbp' | 'change_lead' | 'l_and_d' | 'executive_sponsor';

export interface AtomicHRAction {
  action: string;
  owner: HRActionOwner;
  week: string;
  priority: 'critical' | 'high' | 'medium';
  measurable_outcome: string;
}

export interface RoleSkill {
  id: string;
  role_id: string;
  skill_name: string;
  lightcast_skill_id?: string;
  level?: number;
  importance?: number;
  trend?: string;
}

// ═══════════════════════════════════════════════════
// Agent Capability & Maturation
// ═══════════════════════════════════════════════════

export interface AgentCapabilitySnapshot {
  id: string;
  snapshot_date: string;
  data_source: string;
  onet_task_id?: string;
  task_statement?: string;
  occupation_code?: string;
  capability_score: number;
  autonomy_level?: number;
  time_savings_pct?: number;
  collaboration_pattern?: string;
  success_rate?: number;
}

export type ComplexityType =
  | 'routine_cognitive'
  | 'complex_cognitive'
  | 'interpersonal'
  | 'physical'
  | 'creative';

export interface CeilingByComplexity {
  routine_cognitive: number;
  complex_cognitive: number;
  interpersonal: number;
  physical: number;
  creative: number;
}

export interface MaturationCurveConfig {
  id: string;
  name: string;
  base_growth_rate_k: number;
  ceiling_by_complexity: CeilingByComplexity;
  complexity_modifiers?: Record<string, number>;
  resistance_pace_multiplier?: number;
}

export interface TaskComplexityProfile {
  id: string;
  onet_task_id?: string;
  task_statement?: string;
  cognitive_load: number;
  judgment_required: number;
  creativity_required: number;
  interpersonal_req: number;
  physical_req: number;
  primary_complexity_type: ComplexityType;
}

// ═══════════════════════════════════════════════════
// Simulation
// ═══════════════════════════════════════════════════

export type SimulationStatus = 'draft' | 'hydrating' | 'ready' | 'running' | 'complete' | 'error';

export interface Simulation {
  id: string;
  org_id: string;
  name: string;
  status: SimulationStatus;
  time_horizon_months: number;
  maturation_curve_id?: string;
  monte_carlo_iterations: number;
  agent_cost_per_task_monthly: number;
  reskilling_cost_per_person: number;
  severance_months: number;
  degraded_sources?: string[];
}

export interface SimulationScenario {
  id: string;
  simulation_id: string;
  name: string;
  parameter_overrides?: Record<string, unknown>;
  results?: ScenarioResults;
  summary_metrics?: ScenarioSummaryMetrics;
  status: 'pending' | 'running' | 'complete' | 'error';
}

export interface ScenarioSummaryMetrics {
  total_current_fte: number;
  total_projected_fte: number;
  total_fte_delta: number;
  total_current_cost: number;
  total_projected_cost: number;
  total_agent_cost: number;
  total_reskilling_cost: number;
  net_annual_savings: number;
  tasks_automated_pct: number;
  tasks_augmented_pct: number;
  tasks_human_pct: number;
  avg_resistance_probability: number;
  p90_resistance_probability: number;
  max_resistance_probability: number;
  high_risk_roles: number;
}

export interface ScenarioResults {
  role_results: SimulationRoleResult[];
  summary: ScenarioSummaryMetrics;
  monte_carlo?: MonteCarloSummary;
}

export interface MonteCarloSummary {
  iterations: number;
  seed: number;
  net_savings_p10: number;
  net_savings_p50: number;
  net_savings_p90: number;
  fte_reduction_p10: number;
  fte_reduction_p50: number;
  fte_reduction_p90: number;
}

export interface SimulationRoleResult {
  id: string;
  scenario_id: string;
  role_id: string;
  current_fte: number;
  projected_fte: number;
  fte_delta: number;
  human_task_pct: number;
  agent_task_pct: number;
  hybrid_task_pct: number;
  current_annual_cost?: number;
  projected_annual_cost?: number;
  agent_cost?: number;
  reskilling_cost?: number;
  trust_impact_score?: number;
  resistance_probability?: number;
  base_resistance_probability?: number;
  resistance_amplification?: number;
  quadrant_distribution?: QuadrantDistribution;
  bbbob_recommendations?: BBBOBRecommendation[];
  task_results?: SimulationTaskResult[];
}

export interface SimulationTaskResult {
  id: string;
  role_result_id: string;
  role_task_id: string;
  assignment_t0: TaskAssignment;
  assignment_t6?: TaskAssignment;
  assignment_t12?: TaskAssignment;
  assignment_t24?: TaskAssignment;
  agent_capability_t0?: number;
  agent_capability_t6?: number;
  agent_capability_t12?: number;
  agent_capability_t24?: number;
  cultural_quadrant?: CulturalQuadrant;
  transition_risk?: string;
}

export type TaskAssignment = 'human' | 'agent' | 'hybrid';

export type CulturalQuadrant = 'green_light' | 'red_light' | 'rd_opportunity' | 'low_priority';

export interface QuadrantDistribution {
  green_light: number;
  red_light: number;
  rd_opportunity: number;
  low_priority: number;
}

// ═══════════════════════════════════════════════════
// BBBOB (Build/Buy/Borrow/Bot)
// ═══════════════════════════════════════════════════

export type BBBOBOption = 'build' | 'buy' | 'borrow' | 'bot';

export interface BBBOBRecommendation {
  task_cluster: string;
  recommended: BBBOBOption;
  scores: Record<BBBOBOption, number>;
  reasoning: string;
  cost_estimate: number;
  timeline_months: number;
}

// ═══════════════════════════════════════════════════
// Transition Planning
// ═══════════════════════════════════════════════════

export interface TransitionPlan {
  id: string;
  scenario_id: string;
  phases: TransitionPhase[];
  total_duration_months: number;
  total_cost: number;
  employees_affected: number;
  risk_hotspots?: RiskHotspot[];
}

export interface TransitionPhase {
  phase_number: number;
  name: string;
  description: string;
  start_month: number;
  end_month: number;
  actions: string[];
  roles_affected: string[];
  priority_score: number;
  quarterly_cost: number;
  decision_gates: string[];
}

export interface RiskHotspot {
  role_id: string;
  role_title: string;
  risk_type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  mitigation: string;
}

export interface ReskillingPath {
  id: string;
  scenario_id: string;
  employee_role_id: string;
  target_role_id?: string;
  target_role_title: string;
  transition_probability?: number;
  skill_overlap_pct?: number;
  skill_gaps?: SkillGapItem[];
  development_plan?: DevelopmentPlanItem[];
  duration_months?: number;
  cost?: number;
  success_probability?: number;
}

export interface SkillGapItem {
  skill: string;
  current_level: number;
  required_level: number;
  gap: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface DevelopmentPlanItem {
  skill: string;
  action: string;
  resource_type: 'course' | 'mentoring' | 'project' | 'certification';
  duration_weeks: number;
  cost: number;
}

// ═══════════════════════════════════════════════════
// Run Contract (Reproducibility)
// ═══════════════════════════════════════════════════

export interface RunRecord {
  run_id: string;
  simulation_id: string;
  scenario_id: string;
  seed: number;
  maturation_params: MaturationCurveConfig;
  snapshot_ids: string[];
  source_versions: Record<string, string>;
  input_hash: string;
  output_hash: string;
  duration_ms?: number;
  created_at: string;
}

// ═══════════════════════════════════════════════════
// Connector Reliability Policy (A4)
// ═══════════════════════════════════════════════════

export type SourceClassification = 'required' | 'optional';

export interface ConnectorPolicy {
  source: string;
  tool_name: string;
  classification: SourceClassification;
  timeout_ms: number;
  retries: number;
  fallback_description?: string;
}

export const CONNECTOR_POLICIES: ConnectorPolicy[] = [
  { source: 'O*NET', tool_name: 'role_decompose', classification: 'required', timeout_ms: 15000, retries: 2 },
  { source: 'WorkBank', tool_name: 'workbank_occupation_automation', classification: 'required', timeout_ms: 10000, retries: 2 },
  { source: 'AEI', tool_name: 'aei_task_penetration', classification: 'required', timeout_ms: 15000, retries: 2 },
  { source: 'BLS', tool_name: 'bls_occupation_wages', classification: 'optional', timeout_ms: 10000, retries: 1, fallback_description: 'Use O*NET median wage estimate; flag as degraded' },
  { source: 'Lightcast', tool_name: 'lightcast_search_skills', classification: 'optional', timeout_ms: 10000, retries: 1, fallback_description: 'Use O*NET skills only; flag as degraded' },
  { source: 'Felten AIOE', tool_name: 'aioe_occupation_exposure', classification: 'optional', timeout_ms: 10000, retries: 1, fallback_description: 'Use AEI + WorkBank only for exposure; flag as degraded' },
  { source: 'JobHop', tool_name: 'jobhop_transition_probability', classification: 'optional', timeout_ms: 10000, retries: 1, fallback_description: 'Skip career transition data; flag in transition plan' },
];

// ═══════════════════════════════════════════════════
// Visualization (Sankey)
// ═══════════════════════════════════════════════════

export interface SankeyNode {
  id: string;
  name: string;
  category: 'current' | 'future' | 'transition';
  value: number;
  color?: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  type: 'direct' | 'upskill' | 'reskill' | 'exit';
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

// ═══════════════════════════════════════════════════
// Financial Impact
// ═══════════════════════════════════════════════════

export interface FinancialImpact {
  current_annual_cost: number;
  projected_annual_cost: number;
  agent_annual_cost: number;
  reskilling_total_cost: number;
  severance_total_cost: number;
  net_annual_savings: number;
  implementation_cost: number;
  roi_pct: number;
  payback_months: number;
}
