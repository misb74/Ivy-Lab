export interface WrsCompareParameterOverrides {
  viability_threshold_pct?: number;
  ranking_weights?: {
    net_annual_savings?: number;
    tasks_automated_pct?: number;
    resistance_risk?: number;
    investment_efficiency?: number;
  };
  [key: string]: unknown;
}

export interface ComparableScenarioDataQualityStatus {
  status?: 'real' | 'degraded' | 'mock';
  confidence?: number;
  sources?: Array<{
    name?: string;
    status?: 'real' | 'mock' | 'unavailable';
    used_in?: string;
    as_of?: string;
    stale?: boolean;
  }>;
  notes?: string[];
  computed_at?: string;
}

export interface ComparableScenarioInputCredibility {
  status?: 'verified' | 'inferred';
  headcount_source?: string;
  role_fte_source?: string;
  requires_confirmation?: boolean;
  warnings?: string[];
  evidence?: string;
  headcount_value?: number;
  roles_total_fte_before_rebalance?: number;
  roles_total_fte_after_rebalance?: number;
  roles_fte_rebalanced?: boolean;
}

export interface ComparableScenarioInput {
  id: string;
  name: string;
  metrics: Record<string, number>;
  roleResults: Array<{ title?: string; resistance_probability?: number }>;
  is_counterfactual?: boolean;
  dataQualityStatus?: ComparableScenarioDataQualityStatus;
  input_credibility?: ComparableScenarioInputCredibility;
  used_mock_data?: boolean;
}

export interface PersistedScenarioRow {
  id: string;
  name: string;
  summary_metrics: string;
  results: string;
}

export type RankingWeights = {
  net_annual_savings: number;
  tasks_automated_pct: number;
  resistance_risk: number;
  investment_efficiency: number;
};

export interface CompareCriterionDefinition {
  key: keyof RankingWeights;
  name: string;
  weight: number;
  higherIsBetter: boolean;
  value: (metrics: Record<string, number>) => number;
}

export interface CompareCriterionScore {
  criterion: CompareCriterionDefinition;
  rankByScenario: Map<string, number>;
  scoreByScenario: Map<string, number>;
  rawByScenario: Map<string, number>;
}

export interface ScenarioViabilityInfo {
  viable: boolean;
  non_viable_reason: string | null;
  maxRoleResistance: number;
}

export interface ScenarioComparisonArtifactScenario {
  id: string;
  name: string;
  description: string;
  metrics: {
    NetSavings: number;
    ProjectedFTE: number;
    AutomatedPct: number;
    Resistance: number;
  };
  investment: number;
  timeline: string;
  risk_level: string;
  viable: boolean;
  non_viable_reason: string | null;
  is_counterfactual?: true;
  note?: string;
  dataQualityStatus?: ComparableScenarioDataQualityStatus;
  used_mock_data?: boolean;
}

export interface ScenarioComparisonArtifact {
  type: 'scenario_comparison';
  title: string;
  scenarios: ScenarioComparisonArtifactScenario[];
  winner: string | null;
  criteria: Array<{ name: string; weight: number }>;
  dataSource: string;
  weight_notes?: string[];
}

export interface ScenarioComparisonCoreResult {
  scenarios: ComparableScenarioInput[];
  metricComparisons: Array<{
    metric: string;
    values: Array<{ scenario: string; value: number }>;
    best: string;
    worst: string;
    range: number;
    average: number;
  }>;
  rankings: Array<{
    scenario: string;
    overall_score: number;
    rank: number;
    metric_ranks: Array<{ metric: string; rank: number }>;
  }>;
  best_scenario: string;
  summary: string;
  winner: string | null;
  viableRankings: Array<{
    scenario: string;
    overall_score: number;
    rank: number;
    metric_ranks: Array<{ metric: string; rank: number }>;
  }>;
  criteria: CompareCriterionDefinition[];
  criterionScores: CompareCriterionScore[];
  viabilityByScenario: Map<string, ScenarioViabilityInfo>;
  comparisonScenarios: ScenarioComparisonArtifactScenario[];
  artifact: ScenarioComparisonArtifact;
  viabilityThreshold: number;
  resolvedWeights: RankingWeights;
  weightNotes: string[];
}

export const DEFAULT_VIABILITY_THRESHOLD_PCT = 75;
export const COUNTERFACTUAL_NAME = 'Do Nothing (counterfactual)';
export const COUNTERFACTUAL_NOTE = 'Status-quo reference line — no program, no change.';

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  net_annual_savings: 0.35,
  tasks_automated_pct: 0.25,
  resistance_risk: 0.2,
  investment_efficiency: 0.2,
};

export function resolveRankingWeights(
  overrides: WrsCompareParameterOverrides | undefined
): { weights: RankingWeights; notes: string[] } {
  const raw = overrides?.ranking_weights ?? {};
  const merged: RankingWeights = {
    net_annual_savings:
      typeof raw.net_annual_savings === 'number'
        ? raw.net_annual_savings
        : DEFAULT_RANKING_WEIGHTS.net_annual_savings,
    tasks_automated_pct:
      typeof raw.tasks_automated_pct === 'number'
        ? raw.tasks_automated_pct
        : DEFAULT_RANKING_WEIGHTS.tasks_automated_pct,
    resistance_risk:
      typeof raw.resistance_risk === 'number'
        ? raw.resistance_risk
        : DEFAULT_RANKING_WEIGHTS.resistance_risk,
    investment_efficiency:
      typeof raw.investment_efficiency === 'number'
        ? raw.investment_efficiency
        : DEFAULT_RANKING_WEIGHTS.investment_efficiency,
  };

  const entries = Object.entries(merged) as Array<[keyof RankingWeights, number]>;
  for (const [key, value] of entries) {
    if (!Number.isFinite(value)) {
      throw new Error(`ranking_weights.${key} must be a finite number`);
    }
    if (value < 0) {
      throw new Error(`ranking_weights.${key} must be non-negative (got ${value})`);
    }
  }

  const total = entries.reduce((acc, [, value]) => acc + value, 0);
  const notes: string[] = [];
  if (total <= 0) {
    throw new Error('ranking_weights must sum to a positive value');
  }

  let weights = merged;
  if (Math.abs(total - 1.0) > 1e-6) {
    weights = {
      net_annual_savings: merged.net_annual_savings / total,
      tasks_automated_pct: merged.tasks_automated_pct / total,
      resistance_risk: merged.resistance_risk / total,
      investment_efficiency: merged.investment_efficiency / total,
    };
    notes.push(
      `ranking_weights did not sum to 1.0 (sum=${round(total)}); normalized to unit weights.`
    );
  }

  return { weights, notes };
}

export function parseComparableScenarioRow(row: PersistedScenarioRow): ComparableScenarioInput {
  let metrics: Record<string, number> = {};
  try {
    metrics = JSON.parse(row.summary_metrics) as Record<string, number>;
  } catch {
    metrics = {};
  }

  let roleResults: Array<{ title?: string; resistance_probability?: number }> = [];
  let dataQualityStatus: ComparableScenarioDataQualityStatus | undefined;
  let input_credibility: ComparableScenarioInputCredibility | undefined;
  let used_mock_data: boolean | undefined;

  try {
    const parsed = JSON.parse(row.results) as {
      role_results?: unknown;
      artifacts?: {
        workforce_simulation_workbench?: {
          dataQualityStatus?: ComparableScenarioDataQualityStatus;
          input_credibility?: ComparableScenarioInputCredibility;
        };
      };
    };

    if (Array.isArray(parsed?.role_results)) {
      roleResults = parsed.role_results as Array<{ title?: string; resistance_probability?: number }>;
    }

    const workbench = parsed?.artifacts?.workforce_simulation_workbench;
    if (workbench?.dataQualityStatus && typeof workbench.dataQualityStatus === 'object') {
      dataQualityStatus = workbench.dataQualityStatus;
      if (workbench.dataQualityStatus.status === 'mock') {
        used_mock_data = true;
      }
    }
    if (workbench?.input_credibility && typeof workbench.input_credibility === 'object') {
      input_credibility = workbench.input_credibility;
    }
  } catch {
    roleResults = [];
  }

  return {
    id: row.id,
    name: row.name,
    metrics,
    roleResults,
    ...(dataQualityStatus ? { dataQualityStatus } : {}),
    ...(input_credibility ? { input_credibility } : {}),
    ...(used_mock_data !== undefined ? { used_mock_data } : {}),
  };
}

export function normalizeScore(
  value: number,
  min: number,
  max: number,
  higherIsBetter: boolean
): number {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) return 1;
  const normalized = higherIsBetter
    ? (value - min) / (max - min)
    : (max - value) / (max - min);
  return Math.max(0, Math.min(1, normalized));
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getResistanceRiskMetric(metrics: Record<string, number>): number {
  const maxResistance = metrics.max_resistance_probability;
  if (Number.isFinite(maxResistance)) return maxResistance;

  const p90Resistance = metrics.p90_resistance_probability;
  if (Number.isFinite(p90Resistance)) return p90Resistance;

  const averageResistance = metrics.avg_resistance_probability;
  if (Number.isFinite(averageResistance)) return averageResistance;

  return 0;
}

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function buildCounterfactualScenario(scenarios: ComparableScenarioInput[]): ComparableScenarioInput | null {
  if (scenarios.length === 0) return null;
  const firstMetrics = scenarios[0].metrics;
  const baselineFte =
    Number.isFinite(firstMetrics.total_current_fte) && (firstMetrics.total_current_fte as number) > 0
      ? firstMetrics.total_current_fte
      : firstMetrics.total_projected_fte ?? 0;

  return {
    id: 'counterfactual-do-nothing',
    name: COUNTERFACTUAL_NAME,
    metrics: {
      net_annual_savings: 0,
      tasks_automated_pct: 0,
      tasks_augmented_pct: 0,
      avg_resistance_probability: 0,
      max_resistance_probability: 0,
      p90_resistance_probability: 0,
      total_agent_cost: 0,
      total_reskilling_cost: 0,
      total_projected_fte: baselineFte,
      total_current_fte: baselineFte,
      high_risk_roles: 0,
    },
    roleResults: [],
    is_counterfactual: true,
  };
}

export function buildScenarioComparisonCore(input: {
  scenarios: ComparableScenarioInput[];
  time_horizon_months: number;
  include_counterfactual?: boolean;
  parameter_overrides?: WrsCompareParameterOverrides;
}): ScenarioComparisonCoreResult {
  const viabilityThreshold =
    typeof input.parameter_overrides?.viability_threshold_pct === 'number'
      ? input.parameter_overrides.viability_threshold_pct
      : DEFAULT_VIABILITY_THRESHOLD_PCT;

  const { weights: resolvedWeights, notes: weightNotes } = resolveRankingWeights(
    input.parameter_overrides
  );

  const includeCounterfactual = input.include_counterfactual !== false;
  const scenarios = input.scenarios.map((scenario) => ({
    ...scenario,
    metrics: { ...scenario.metrics },
    roleResults: Array.isArray(scenario.roleResults) ? [...scenario.roleResults] : [],
  }));

  if (includeCounterfactual) {
    const counterfactual = buildCounterfactualScenario(scenarios);
    if (counterfactual) scenarios.push(counterfactual);
  }

  const allMetrics = new Set<string>();
  for (const scenario of scenarios) {
    for (const key of Object.keys(scenario.metrics)) {
      allMetrics.add(key);
    }
  }

  const lowerIsBetter = new Set([
    'total_projected_fte',
    'total_projected_cost',
    'total_agent_cost',
    'total_reskilling_cost',
    'avg_resistance_probability',
    'p90_resistance_probability',
    'max_resistance_probability',
    'high_risk_roles',
  ]);

  const metricComparisons = [...allMetrics].map((metric) => {
    const values = scenarios.map((scenario) => ({
      scenario: scenario.name,
      value: scenario.metrics[metric] ?? 0,
    }));

    const sorted = [...values].sort((a, b) => a.value - b.value);
    const isLower = lowerIsBetter.has(metric);

    return {
      metric,
      values,
      best: isLower ? sorted[0].scenario : sorted[sorted.length - 1].scenario,
      worst: isLower ? sorted[sorted.length - 1].scenario : sorted[0].scenario,
      range: sorted[sorted.length - 1].value - sorted[0].value,
      average: round(values.reduce((sumValue, entry) => sumValue + entry.value, 0) / values.length),
    };
  });

  const criteria: CompareCriterionDefinition[] = [
    {
      key: 'net_annual_savings',
      name: 'Net Annual Savings',
      weight: resolvedWeights.net_annual_savings,
      higherIsBetter: true,
      value: (metrics) => metrics.net_annual_savings ?? 0,
    },
    {
      key: 'tasks_automated_pct',
      name: 'Task Automation Coverage',
      weight: resolvedWeights.tasks_automated_pct,
      higherIsBetter: true,
      value: (metrics) => metrics.tasks_automated_pct ?? 0,
    },
    {
      key: 'resistance_risk',
      name: 'Resistance Risk',
      weight: resolvedWeights.resistance_risk,
      higherIsBetter: false,
      value: (metrics) => getResistanceRiskMetric(metrics),
    },
    {
      key: 'investment_efficiency',
      name: 'Investment Efficiency',
      weight: resolvedWeights.investment_efficiency,
      higherIsBetter: true,
      value: (metrics) => {
        const investment = (metrics.total_agent_cost ?? 0) + (metrics.total_reskilling_cost ?? 0);
        const safeInvestment = investment > 0 ? investment : 1;
        return (metrics.net_annual_savings ?? 0) / safeInvestment;
      },
    },
  ];

  const criterionScores = criteria.map((criterion): CompareCriterionScore => {
    const values = scenarios.map((scenario) => ({
      scenario: scenario.name,
      raw: criterion.value(scenario.metrics),
    }));
    const min = Math.min(...values.map((value) => value.raw));
    const max = Math.max(...values.map((value) => value.raw));

    const normalized = values.map((entry) => ({
      scenario: entry.scenario,
      score: normalizeScore(entry.raw, min, max, criterion.higherIsBetter),
    }));

    const ranked = [...normalized].sort((a, b) => b.score - a.score);
    return {
      criterion,
      rankByScenario: new Map(ranked.map((entry, index) => [entry.scenario, index + 1])),
      scoreByScenario: new Map(normalized.map((entry) => [entry.scenario, entry.score])),
      rawByScenario: new Map(values.map((entry) => [entry.scenario, round(entry.raw)])),
    };
  });

  const viabilityByScenario = new Map<string, ScenarioViabilityInfo>();
  for (const scenario of scenarios) {
    const roleValues = scenario.roleResults
      .map((role) =>
        typeof role?.resistance_probability === 'number' && Number.isFinite(role.resistance_probability)
          ? role.resistance_probability
          : null
      )
      .filter((value): value is number => value !== null);
    const maxFromRoles = roleValues.length > 0 ? Math.max(...roleValues) : null;
    const maxFromMetrics = Number.isFinite(scenario.metrics.max_resistance_probability)
      ? scenario.metrics.max_resistance_probability
      : null;
    const maxRoleResistance = maxFromRoles ?? maxFromMetrics ?? 0;
    const viable = maxRoleResistance <= viabilityThreshold;
    viabilityByScenario.set(scenario.name, {
      viable,
      non_viable_reason: viable
        ? null
        : `max role resistance ${round(maxRoleResistance)}% exceeds viability threshold ${viabilityThreshold}%`,
      maxRoleResistance,
    });
  }

  const rankings = scenarios
    .map((scenario) => {
      const overall_score = round(
        sum(
          criterionScores.map(
            (entry) => (entry.scoreByScenario.get(scenario.name) ?? 0) * entry.criterion.weight
          )
        )
      );
      return {
        scenario: scenario.name,
        overall_score,
        rank: 0,
        metric_ranks: criterionScores.map((entry) => ({
          metric: entry.criterion.name,
          rank: entry.rankByScenario.get(scenario.name) ?? scenarios.length,
        })),
      };
    })
    .sort((a, b) => b.overall_score - a.overall_score);

  rankings.forEach((ranking, index) => {
    ranking.rank = index + 1;
  });

  const viableRankings = rankings.filter((ranking) => viabilityByScenario.get(ranking.scenario)?.viable);
  const winner = viableRankings[0]?.scenario ?? null;
  const counterfactualWon = includeCounterfactual && winner === COUNTERFACTUAL_NAME;

  const comparisonScenarios: ScenarioComparisonArtifactScenario[] = scenarios.map((scenario) => {
    const metrics = scenario.metrics;
    const investment = (metrics.total_agent_cost ?? 0) + (metrics.total_reskilling_cost ?? 0);
    const resistance = getResistanceRiskMetric(metrics);
    const risk_level = resistance >= 60 ? 'high' : resistance >= 40 ? 'medium' : 'low';
    const viabilityInfo = viabilityByScenario.get(scenario.name);

    return {
      id: scenario.id,
      name: scenario.name,
      description: `${(metrics.tasks_automated_pct ?? 0).toFixed(1)}% automated, ${(metrics.tasks_augmented_pct ?? 0).toFixed(1)}% hybrid`,
      metrics: {
        NetSavings: metrics.net_annual_savings ?? 0,
        ProjectedFTE: metrics.total_projected_fte ?? 0,
        AutomatedPct: metrics.tasks_automated_pct ?? 0,
        Resistance: resistance,
      },
      investment: round(investment),
      timeline: `${input.time_horizon_months} months`,
      risk_level,
      viable: viabilityInfo?.viable ?? true,
      non_viable_reason: viabilityInfo?.non_viable_reason ?? null,
      ...(scenario.is_counterfactual
        ? { is_counterfactual: true as const, note: COUNTERFACTUAL_NOTE }
        : {}),
      ...(scenario.dataQualityStatus ? { dataQualityStatus: scenario.dataQualityStatus } : {}),
      ...(scenario.used_mock_data !== undefined ? { used_mock_data: scenario.used_mock_data } : {}),
    };
  });

  const artifact: ScenarioComparisonArtifact = {
    type: 'scenario_comparison',
    title: `Scenario Comparison (${comparisonScenarios.length} scenarios)`,
    scenarios: comparisonScenarios,
    winner,
    criteria: criteria.map((criterion) => ({ name: criterion.name, weight: round(criterion.weight) })),
    dataSource: 'WRS scenario comparator + deterministic run summaries',
    ...(weightNotes.length > 0 ? { weight_notes: weightNotes } : {}),
  };

  let summary: string;
  if (rankings.length === 0) {
    summary = 'Unable to determine rankings.';
  } else if (viableRankings.length === 0) {
    summary = `No viable scenario — all ${scenarios.length} scenarios exceed resistance threshold ${viabilityThreshold}%`;
  } else if (counterfactualWon) {
    summary = `Do Nothing recommended — no proposed scenario clears the baseline (weighted score ${viableRankings[0].overall_score}).`;
  } else {
    summary = `Best overall: "${viableRankings[0].scenario}" (weighted score ${viableRankings[0].overall_score}) across ${criteria.length} criteria`;
  }

  return {
    scenarios,
    metricComparisons,
    rankings,
    best_scenario: winner ?? 'N/A',
    summary,
    winner,
    viableRankings,
    criteria,
    criterionScores,
    viabilityByScenario,
    comparisonScenarios,
    artifact,
    viabilityThreshold,
    resolvedWeights,
    weightNotes,
  };
}
