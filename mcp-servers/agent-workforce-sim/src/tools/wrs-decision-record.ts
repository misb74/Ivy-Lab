import crypto from 'crypto';
import { getDatabase } from '../db/database.js';
import {
  buildScenarioComparisonCore,
  parseComparableScenarioRow,
  round,
  type ComparableScenarioDataQualityStatus,
  type ComparableScenarioInput,
  type ComparableScenarioInputCredibility,
  type RankingWeights,
  type WrsCompareParameterOverrides,
} from './wrs-compare-core.js';

export interface WrsDecisionRecordInput {
  simulation_id: string;
  scenario_ids?: string[];
  scenarios?: Array<{
    id: string;
    simulation_id?: string;
    name: string;
    results?: {
      role_results?: Array<{ title?: string; resistance_probability?: number }>;
      artifacts?: {
        workforce_simulation_workbench?: {
          dataQualityStatus?: ComparableScenarioDataQualityStatus;
          input_credibility?: ComparableScenarioInputCredibility;
        };
      };
    };
    summary_metrics?: Record<string, number>;
    dataQualityStatus?: ComparableScenarioDataQualityStatus;
    input_credibility?: ComparableScenarioInputCredibility;
    used_mock_data?: boolean;
  }>;
  time_horizon_months?: number;
  parameter_overrides?: WrsCompareParameterOverrides;
  monitor_ids?: string[];
  context?: {
    org_name?: string;
    function_name?: string;
    headcount?: number;
  };
}

interface ScenarioRow {
  id: string;
  name: string;
  summary_metrics: string;
  results: string;
}

interface SimulationDecisionRow {
  time_horizon_months: number;
  cost_params: string;
  degraded_sources: string;
  used_mock_data: number | null;
  org_name: string | null;
  headcount: number | null;
}

interface DecisionDataQualityStatus {
  status: 'real' | 'degraded' | 'mock';
  confidence: number;
  sources: Array<{
    name: string;
    status: 'real' | 'mock' | 'unavailable';
    used_in: string;
  }>;
  notes: string[];
  computed_at: string;
}

interface DecisionRecordArtifact {
  type: 'decision_record';
  id: string;
  title: string;
  decision_type: 'finance_transformation';
  status: 'recommended' | 'review_required';
  context: {
    org_name?: string;
    function_name: string;
    time_horizon_months: number;
    headcount?: number;
    simulation_id?: string;
  };
  recommendation: {
    winner: string | null;
    summary: string;
    why_this_wins: string[];
    why_not_others: Array<{ option: string; reason: string }>;
    top_flip_drivers: string[];
  };
  options: Array<{
    name: string;
    rank: number;
    overall_score: number;
    viable: boolean;
    key_metrics: Record<string, number | string>;
  }>;
  assumptions: Array<{
    statement: string;
    source: 'verified' | 'estimated' | 'policy' | 'fallback';
    impact: 'high' | 'medium' | 'low';
  }>;
  trust_contract: {
    decision_grade: 'decision_grade' | 'review_required';
    data_quality_status: DecisionDataQualityStatus;
    input_credibility?: ComparableScenarioInputCredibility;
    blocking_issues: string[];
    export_policy: 'normal' | 'degraded_watermark' | 'mock_blocked';
  };
  monitors: {
    attached: boolean;
    ids: string[];
  };
  review_hook: {
    outcome_review_status: 'not_built_yet';
  };
  dataQualityStatus: DecisionDataQualityStatus;
  dataSource: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseInputCredibilityFromCostParams(raw: string): ComparableScenarioInputCredibility | undefined {
  try {
    const parsed = JSON.parse(raw) as { input_credibility?: ComparableScenarioInputCredibility };
    if (parsed?.input_credibility && typeof parsed.input_credibility === 'object') {
      return parsed.input_credibility;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function parseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

function buildDecisionDataQualityStatus(scenarios: ComparableScenarioInput[]): DecisionDataQualityStatus {
  const computed_at = new Date().toISOString();
  const realScenarios = scenarios.filter((scenario) => !scenario.is_counterfactual);
  if (realScenarios.length === 0) {
    return {
      status: 'degraded',
      confidence: 50,
      sources: [],
      notes: ['No underlying simulation scenarios were supplied to the decision record.'],
      computed_at,
    };
  }

  const childPassports = realScenarios.map((scenario) => ({
    name: scenario.name,
    status: scenario.used_mock_data === true ? 'mock' : scenario.dataQualityStatus?.status,
    confidence: scenario.dataQualityStatus?.confidence,
  }));

  const anyMock = childPassports.some((passport) => passport.status === 'mock');
  const anyDegraded = childPassports.some((passport) => passport.status === 'degraded' || !passport.status);
  const realConfidences = childPassports
    .map((passport) => passport.confidence)
    .filter((confidence): confidence is number => typeof confidence === 'number' && Number.isFinite(confidence));

  const sources = childPassports.map((passport) => ({
    name: passport.name,
    status:
      passport.status === 'mock'
        ? ('mock' as const)
        : passport.status === 'real'
          ? ('real' as const)
          : ('unavailable' as const),
    used_in: 'decision_record',
  }));

  if (anyMock) {
    const mockNames = childPassports
      .filter((passport) => passport.status === 'mock')
      .map((passport) => passport.name);
    return {
      status: 'mock',
      confidence: clamp(realConfidences.length > 0 ? Math.min(...realConfidences, 25) : 20, 0, 25),
      sources,
      notes: [
        `Mock-data contamination across compared scenarios: ${mockNames.join(', ')}.`,
        'This recommendation is directional only until the mocked scenarios are rehydrated with real source data.',
      ],
      computed_at,
    };
  }

  if (anyDegraded) {
    const degradedNames = childPassports
      .filter((passport) => passport.status !== 'real')
      .map((passport) => passport.name);
    return {
      status: 'degraded',
      confidence: clamp(realConfidences.length > 0 ? Math.min(...realConfidences) : 65, 50, 75),
      sources,
      notes: [
        degradedNames.length > 0
          ? `Some compared scenarios do not carry full real-data passports: ${degradedNames.join(', ')}.`
          : 'Compared scenarios are missing full data-quality passports.',
      ],
      computed_at,
    };
  }

  return {
    status: 'real',
    confidence: clamp(realConfidences.length > 0 ? Math.min(...realConfidences) : 90, 85, 95),
    sources,
    notes: ['All compared scenarios carry real-data passports.'],
    computed_at,
  };
}

function formatCriterionValue(
  criterionName: string,
  value: number | undefined,
  higherIsBetter: boolean
): string {
  if (value === undefined || !Number.isFinite(value)) return 'n/a';
  if (criterionName === 'Net Annual Savings') return `$${Math.round(value).toLocaleString()}`;
  if (criterionName === 'Resistance Risk') return `${round(value)}%`;
  if (criterionName === 'Investment Efficiency') return `${round(value)}x`;
  return `${round(value)}%`;
}

function buildWhyThisWins(result: ReturnType<typeof buildScenarioComparisonCore>): string[] {
  if (!result.winner) {
    return ['No scenario cleared the viability gate, so Ivy cannot make a decision-grade recommendation yet.'];
  }

  const winnerRanking = result.rankings.find((ranking) => ranking.scenario === result.winner);
  const runnerUp = result.viableRankings.find((ranking) => ranking.scenario !== result.winner) ?? null;
  const winnerViability = result.viabilityByScenario.get(result.winner);

  if (!winnerRanking) {
    return [`${result.winner} is the only viable option surfaced by the comparator.`];
  }

  if (result.winner === 'Do Nothing (counterfactual)') {
    const strongestAlternative = result.rankings.find((ranking) => ranking.scenario !== result.winner) ?? null;
    return [
      'The modeled interventions did not beat the status-quo baseline once risk and viability gates were applied.',
      strongestAlternative
        ? `${strongestAlternative.scenario} trails the counterfactual at ${strongestAlternative.overall_score} overall score.`
        : 'No modeled alternative cleared the bar.',
    ];
  }

  const reasons: string[] = [
    runnerUp
      ? `${result.winner} is the highest-scoring viable option at ${winnerRanking.overall_score}, ahead of ${runnerUp.scenario} at ${runnerUp.overall_score}.`
      : `${result.winner} is the highest-scoring viable option at ${winnerRanking.overall_score}.`,
  ];

  if (winnerViability) {
    reasons.push(
      `${result.winner} stays inside the resistance viability gate at ${round(winnerViability.maxRoleResistance)}% versus a ${result.viabilityThreshold}% threshold.`
    );
  }

  if (runnerUp) {
    const criterionEdges = result.criterionScores
      .map((entry) => {
        const winnerScore = entry.scoreByScenario.get(result.winner ?? '') ?? 0;
        const runnerScore = entry.scoreByScenario.get(runnerUp.scenario) ?? 0;
        return {
          criterion: entry.criterion,
          delta: winnerScore - runnerScore,
          winnerRaw: entry.rawByScenario.get(result.winner ?? ''),
          runnerRaw: entry.rawByScenario.get(runnerUp.scenario),
        };
      })
      .filter((entry) => entry.delta > 0)
      .sort((a, b) => b.delta - a.delta);

    for (const entry of criterionEdges.slice(0, 2)) {
      reasons.push(
        entry.criterion.higherIsBetter
          ? `${entry.criterion.name} is stronger than ${runnerUp.scenario}: ${formatCriterionValue(entry.criterion.name, entry.winnerRaw, true)} versus ${formatCriterionValue(entry.criterion.name, entry.runnerRaw, true)}.`
          : `${entry.criterion.name} is lower than ${runnerUp.scenario}: ${formatCriterionValue(entry.criterion.name, entry.winnerRaw, false)} versus ${formatCriterionValue(entry.criterion.name, entry.runnerRaw, false)}.`
      );
    }
  }

  return reasons;
}

function buildWhyNotOthers(result: ReturnType<typeof buildScenarioComparisonCore>): Array<{ option: string; reason: string }> {
  const winner = result.winner;
  return result.rankings
    .filter((ranking) => ranking.scenario !== winner)
    .map((ranking) => {
      const viability = result.viabilityByScenario.get(ranking.scenario);
      if (viability && !viability.viable) {
        return {
          option: ranking.scenario,
          reason: `Rejected because ${viability.non_viable_reason}.`,
        };
      }

      if (!winner) {
        return {
          option: ranking.scenario,
          reason: `Directional score ${ranking.overall_score}, but no scenario cleared the viability gate.`,
        };
      }

      const winnerRanking = result.rankings.find((entry) => entry.scenario === winner);
      const mostNegativeCriterion = result.criterionScores
        .map((entry) => {
          const optionScore = entry.scoreByScenario.get(ranking.scenario) ?? 0;
          const winnerScore = entry.scoreByScenario.get(winner) ?? 0;
          return {
            criterion: entry.criterion,
            delta: optionScore - winnerScore,
            optionRaw: entry.rawByScenario.get(ranking.scenario),
            winnerRaw: entry.rawByScenario.get(winner),
          };
        })
        .sort((a, b) => a.delta - b.delta)[0];

      const scoreDelta = winnerRanking ? round((winnerRanking.overall_score ?? 0) - ranking.overall_score) : null;
      return {
        option: ranking.scenario,
        reason: mostNegativeCriterion
          ? `${ranking.scenario} trails ${winner}${scoreDelta !== null ? ` by ${scoreDelta} weighted points` : ''} and underperforms on ${mostNegativeCriterion.criterion.name} (${formatCriterionValue(mostNegativeCriterion.criterion.name, mostNegativeCriterion.optionRaw, mostNegativeCriterion.criterion.higherIsBetter)} versus ${formatCriterionValue(mostNegativeCriterion.criterion.name, mostNegativeCriterion.winnerRaw, mostNegativeCriterion.criterion.higherIsBetter)}).`
          : `${ranking.scenario} does not beat ${winner} on the active weighting mix.`,
      };
    });
}

function buildWeightEmphasis(
  base: RankingWeights,
  target: keyof RankingWeights
): RankingWeights {
  const boosted = { ...base };
  boosted[target] = boosted[target] * 1.75;
  const total = Object.values(boosted).reduce((sum, value) => sum + value, 0);
  return {
    net_annual_savings: boosted.net_annual_savings / total,
    tasks_automated_pct: boosted.tasks_automated_pct / total,
    resistance_risk: boosted.resistance_risk / total,
    investment_efficiency: boosted.investment_efficiency / total,
  };
}

function resolveWinnerMargin(result: ReturnType<typeof buildScenarioComparisonCore>): {
  margin: number;
  runnerUp: string | null;
} {
  if (!result.winner) return { margin: 0, runnerUp: null };
  const winnerRanking = result.viableRankings[0];
  const runnerUp = result.viableRankings[1];
  if (!winnerRanking || !runnerUp) return { margin: winnerRanking?.overall_score ?? 0, runnerUp: null };
  return {
    margin: round(winnerRanking.overall_score - runnerUp.overall_score),
    runnerUp: runnerUp.scenario,
  };
}

function buildTopFlipDrivers(input: {
  baseResult: ReturnType<typeof buildScenarioComparisonCore>;
  scenarios: ComparableScenarioInput[];
  time_horizon_months: number;
  parameter_overrides?: WrsCompareParameterOverrides;
}): string[] {
  const baselineWinner = input.baseResult.winner;
  const baselineMargin = resolveWinnerMargin(input.baseResult);
  const candidates: Array<{ priority: number; text: string; impact: number }> = [];

  const pushCandidate = (
    label: string,
    nextResult: ReturnType<typeof buildScenarioComparisonCore>,
    impactBasis: number
  ) => {
    const nextWinner = nextResult.winner;
    const nextMargin = resolveWinnerMargin(nextResult);
    if (nextWinner !== baselineWinner) {
      if (!nextWinner) {
        candidates.push({
          priority: 0,
          impact: Math.abs(impactBasis),
          text: `${label}: the current winner drops out and no scenario remains viable.`,
        });
        return;
      }
      candidates.push({
        priority: 0,
        impact: Math.abs(impactBasis),
        text: `${label}: the recommendation flips from ${baselineWinner ?? 'no winner'} to ${nextWinner}.`,
      });
      return;
    }

    if (baselineWinner && nextWinner === baselineWinner && baselineMargin.margin > 0) {
      const tightenedMargin = round(nextMargin.margin);
      if (tightenedMargin <= Math.max(0.03, round(baselineMargin.margin * 0.4))) {
        candidates.push({
          priority: 1,
          impact: Math.abs(baselineMargin.margin - tightenedMargin),
          text: `${label}: ${baselineWinner} stays on top, but the margin compresses from ${baselineMargin.margin} to ${tightenedMargin}${nextMargin.runnerUp ? ` against ${nextMargin.runnerUp}` : ''}.`,
        });
      }
    }
  };

  const activeWeights = input.baseResult.resolvedWeights;
  const weightVariants = [
    {
      label: `If resistance-risk weight rises to ${Math.round(buildWeightEmphasis(activeWeights, 'resistance_risk').resistance_risk * 100)}%`,
      overrides: { ...input.parameter_overrides, ranking_weights: buildWeightEmphasis(activeWeights, 'resistance_risk') },
      impactBasis: activeWeights.resistance_risk,
    },
    {
      label: `If net-savings weight rises to ${Math.round(buildWeightEmphasis(activeWeights, 'net_annual_savings').net_annual_savings * 100)}%`,
      overrides: { ...input.parameter_overrides, ranking_weights: buildWeightEmphasis(activeWeights, 'net_annual_savings') },
      impactBasis: activeWeights.net_annual_savings,
    },
    {
      label: `If automation-coverage weight rises to ${Math.round(buildWeightEmphasis(activeWeights, 'tasks_automated_pct').tasks_automated_pct * 100)}%`,
      overrides: { ...input.parameter_overrides, ranking_weights: buildWeightEmphasis(activeWeights, 'tasks_automated_pct') },
      impactBasis: activeWeights.tasks_automated_pct,
    },
  ];

  for (const variant of weightVariants) {
    const nextResult = buildScenarioComparisonCore({
      scenarios: input.scenarios,
      time_horizon_months: input.time_horizon_months,
      include_counterfactual: true,
      parameter_overrides: variant.overrides,
    });
    pushCandidate(variant.label, nextResult, variant.impactBasis);
  }

  const baseThreshold = input.baseResult.viabilityThreshold;
  const thresholdVariants = [
    Math.max(40, baseThreshold - 10),
    Math.min(95, baseThreshold + 10),
  ].filter((threshold, index, array) => array.indexOf(threshold) === index && threshold !== baseThreshold);

  for (const threshold of thresholdVariants) {
    const nextResult = buildScenarioComparisonCore({
      scenarios: input.scenarios,
      time_horizon_months: input.time_horizon_months,
      include_counterfactual: true,
      parameter_overrides: {
        ...input.parameter_overrides,
        viability_threshold_pct: threshold,
      },
    });
    pushCandidate(
      `If the resistance viability threshold moves from ${baseThreshold}% to ${threshold}%`,
      nextResult,
      threshold - baseThreshold
    );
  }

  candidates.sort((a, b) => a.priority - b.priority || b.impact - a.impact);
  const unique = candidates.filter(
    (candidate, index, array) => array.findIndex((entry) => entry.text === candidate.text) === index
  );

  if (unique.length >= 2) {
    return unique.slice(0, 2).map((candidate) => candidate.text);
  }

  const fallback: string[] = [];
  if (baselineWinner) {
    fallback.push(
      baselineMargin.runnerUp
        ? `${baselineWinner} remained the winner across the tested perturbations; the closest pressure point is the ${baselineMargin.runnerUp} gap at ${baselineMargin.margin} weighted points.`
        : `${baselineWinner} remained the winner across the tested perturbations and no second viable option came close.`
    );

    const closestThresholdRisk = input.baseResult.scenarios
      .filter((scenario) => !scenario.is_counterfactual && scenario.name !== baselineWinner)
      .map((scenario) => ({
        name: scenario.name,
        resistance: input.baseResult.viabilityByScenario.get(scenario.name)?.maxRoleResistance ?? 0,
      }))
      .sort((a, b) => Math.abs(a.resistance - baseThreshold) - Math.abs(b.resistance - baseThreshold))[0];

    if (closestThresholdRisk) {
      fallback.push(
        `${closestThresholdRisk.name} is the nearest threshold challenger with max role resistance at ${round(closestThresholdRisk.resistance)}% against the ${baseThreshold}% gate.`
      );
    }
  } else {
    fallback.push('No viable winner emerged in the tested perturbations.');
    fallback.push(`The active resistance viability gate is ${baseThreshold}%.`);
  }

  return [...unique.map((candidate) => candidate.text), ...fallback].slice(0, 2);
}

function buildAssumptions(input: {
  inputCredibility?: ComparableScenarioInputCredibility;
  resolvedWeights: RankingWeights;
  viabilityThreshold: number;
  decisionDataQualityStatus: DecisionDataQualityStatus;
  degradedSources: string[];
  usedMockData: boolean;
}): DecisionRecordArtifact['assumptions'] {
  const assumptions: DecisionRecordArtifact['assumptions'] = [];

  if (input.inputCredibility) {
    assumptions.push({
      statement:
        input.inputCredibility.status === 'verified'
          ? `Baseline headcount and role mix are verified from ${input.inputCredibility.headcount_source ?? 'provided sources'}.`
          : `Baseline headcount or role mix is inferred from ${input.inputCredibility.headcount_source ?? 'model inputs'} and still needs confirmation.`,
      source: input.inputCredibility.status === 'verified' ? 'verified' : 'estimated',
      impact: 'high',
    });
  }

  assumptions.push({
    statement: `The resistance viability gate is set to ${input.viabilityThreshold}%.`,
    source: 'policy',
    impact: 'high',
  });
  assumptions.push({
    statement: `Ranking weights prioritize net savings ${Math.round(input.resolvedWeights.net_annual_savings * 100)}%, automation ${Math.round(input.resolvedWeights.tasks_automated_pct * 100)}%, resistance ${Math.round(input.resolvedWeights.resistance_risk * 100)}%, and investment efficiency ${Math.round(input.resolvedWeights.investment_efficiency * 100)}%.`,
    source: 'policy',
    impact: 'medium',
  });

  if (input.usedMockData || input.decisionDataQualityStatus.status === 'mock') {
    assumptions.push({
      statement: 'At least one compared scenario still depends on mock hydration.',
      source: 'fallback',
      impact: 'high',
    });
  } else if (input.degradedSources.length > 0 || input.decisionDataQualityStatus.status === 'degraded') {
    assumptions.push({
      statement: `Some upstream sources were unavailable or partial: ${input.degradedSources.join(', ') || 'see trust contract notes'}.`,
      source: 'fallback',
      impact: 'medium',
    });
  }

  return assumptions;
}

function buildDecisionId(input: {
  simulation_id: string;
  scenario_ids: string[];
  parameter_overrides?: WrsCompareParameterOverrides;
  monitor_ids: string[];
  function_name: string;
}): string {
  const digest = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        simulation_id: input.simulation_id,
        scenario_ids: [...input.scenario_ids].sort(),
        parameter_overrides: input.parameter_overrides ?? {},
        monitor_ids: [...input.monitor_ids].sort(),
        function_name: input.function_name,
      })
    )
    .digest('hex')
    .slice(0, 12);
  return `decision-${digest}`;
}

function loadComparableScenarios(
  input: WrsDecisionRecordInput
): { scenarios: ComparableScenarioInput[]; time_horizon_months: number; simulationRow?: SimulationDecisionRow } {
  if (Array.isArray(input.scenarios) && input.scenarios.length > 0) {
    const scenarios = input.scenarios.map((scenario) => {
      const workbench = scenario.results?.artifacts?.workforce_simulation_workbench;
      return {
        id: scenario.id,
        name: scenario.name,
        metrics: (scenario.summary_metrics ?? {}) as Record<string, number>,
        roleResults: Array.isArray(scenario.results?.role_results) ? scenario.results.role_results : [],
        ...(scenario.dataQualityStatus
          ? { dataQualityStatus: scenario.dataQualityStatus }
          : workbench?.dataQualityStatus
            ? { dataQualityStatus: workbench.dataQualityStatus }
            : {}),
        ...(scenario.input_credibility
          ? { input_credibility: scenario.input_credibility }
          : workbench?.input_credibility
            ? { input_credibility: workbench.input_credibility }
            : {}),
        ...(scenario.used_mock_data !== undefined ? { used_mock_data: scenario.used_mock_data } : {}),
      };
    });
    return {
      scenarios,
      time_horizon_months: input.time_horizon_months ?? 18,
    };
  }

  const scenario_ids = input.scenario_ids ?? [];
  if (scenario_ids.length === 0) {
    throw new Error('scenario_ids are required when direct scenarios are not provided');
  }

  const db = getDatabase();
  const simulationRow = db
    .prepare(
      `
      SELECT
        s.time_horizon_months,
        s.cost_params,
        s.degraded_sources,
        s.used_mock_data,
        o.name AS org_name,
        o.headcount
      FROM simulation s
      JOIN organization o ON o.id = s.org_id
      WHERE s.id = ?
      `
    )
    .get(input.simulation_id) as SimulationDecisionRow | undefined;

  if (!simulationRow) {
    throw new Error(`Simulation not found: ${input.simulation_id}`);
  }

  const scenarios = scenario_ids.map((scenarioId) => {
    const row = db
      .prepare(
        'SELECT id, name, summary_metrics, results FROM simulation_scenario WHERE id = ? AND simulation_id = ?'
      )
      .get(scenarioId, input.simulation_id) as ScenarioRow | undefined;

    if (!row) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    return parseComparableScenarioRow(row);
  });

  return {
    scenarios,
    time_horizon_months: simulationRow.time_horizon_months ?? input.time_horizon_months ?? 18,
    simulationRow,
  };
}

export function handleWrsDecisionRecord(input: WrsDecisionRecordInput) {
  const { scenarios, time_horizon_months, simulationRow } = loadComparableScenarios(input);
  const compareResult = buildScenarioComparisonCore({
    scenarios,
    time_horizon_months,
    include_counterfactual: true,
    parameter_overrides: input.parameter_overrides,
  });

  const decisionDataQualityStatus = buildDecisionDataQualityStatus(compareResult.scenarios);
  const simulationInputCredibility =
    simulationRow?.cost_params ? parseInputCredibilityFromCostParams(simulationRow.cost_params) : undefined;
  const scenarioInputCredibility =
    compareResult.scenarios.find((scenario) => scenario.input_credibility)?.input_credibility;
  const inputCredibility = scenarioInputCredibility ?? simulationInputCredibility;
  const degradedSources = simulationRow?.degraded_sources ? parseStringArray(simulationRow.degraded_sources) : [];
  const usedMockData =
    Boolean(simulationRow?.used_mock_data) ||
    compareResult.scenarios.some((scenario) => scenario.used_mock_data === true);

  const blockingIssues: string[] = [];
  if (!compareResult.winner) {
    blockingIssues.push('No viable scenario cleared the active resistance threshold.');
  }
  if (decisionDataQualityStatus.status === 'mock') {
    blockingIssues.push('Compared scenarios still include mock hydration.');
  } else if (decisionDataQualityStatus.status === 'degraded') {
    blockingIssues.push('Compared scenarios do not all carry full real-data passports.');
  }
  if (usedMockData && !blockingIssues.includes('Compared scenarios still include mock hydration.')) {
    blockingIssues.push('The simulation is flagged as using mock data.');
  }
  if (degradedSources.length > 0) {
    blockingIssues.push(`Upstream sources degraded during hydration: ${degradedSources.join(', ')}.`);
  }
  if (inputCredibility?.status !== 'verified' || inputCredibility?.requires_confirmation) {
    blockingIssues.push('Baseline headcount or role mix is not fully verified.');
  }

  const decisionGrade =
    compareResult.winner &&
    decisionDataQualityStatus.status === 'real' &&
    inputCredibility?.status === 'verified' &&
    inputCredibility.requires_confirmation !== true &&
    !usedMockData &&
    degradedSources.length === 0
      ? 'decision_grade'
      : 'review_required';

  const monitor_ids = Array.isArray(input.monitor_ids)
    ? input.monitor_ids.filter((monitorId): monitorId is string => typeof monitorId === 'string' && monitorId.trim().length > 0)
    : [];
  const optionScenarioOrder = [
    ...compareResult.viableRankings.map((ranking) => ranking.scenario),
    ...compareResult.rankings
      .filter((ranking) => !compareResult.viabilityByScenario.get(ranking.scenario)?.viable)
      .map((ranking) => ranking.scenario),
  ];

  const function_name = input.context?.function_name?.trim() || 'Finance';
  const decisionId = buildDecisionId({
    simulation_id: input.simulation_id,
    scenario_ids: compareResult.scenarios.filter((scenario) => !scenario.is_counterfactual).map((scenario) => scenario.id),
    parameter_overrides: input.parameter_overrides,
    monitor_ids,
    function_name,
  });

  const artifact: DecisionRecordArtifact = {
    type: 'decision_record',
    id: decisionId,
    title: `${function_name} Transformation Decision Record`,
    decision_type: 'finance_transformation',
    status: decisionGrade === 'decision_grade' ? 'recommended' : 'review_required',
    context: {
      ...(input.context?.org_name || simulationRow?.org_name
        ? { org_name: input.context?.org_name ?? simulationRow?.org_name ?? undefined }
        : {}),
      function_name,
      time_horizon_months,
      ...(typeof input.context?.headcount === 'number'
        ? { headcount: input.context.headcount }
        : typeof simulationRow?.headcount === 'number'
          ? { headcount: simulationRow.headcount }
          : {}),
      simulation_id: input.simulation_id,
    },
    recommendation: {
      winner: compareResult.winner,
      summary: compareResult.summary,
      why_this_wins: buildWhyThisWins(compareResult),
      why_not_others: buildWhyNotOthers(compareResult),
      top_flip_drivers: buildTopFlipDrivers({
        baseResult: compareResult,
        scenarios,
        time_horizon_months,
        parameter_overrides: input.parameter_overrides,
      }),
    },
    options: optionScenarioOrder.map((scenarioName, index) => {
      const ranking = compareResult.rankings.find((entry) => entry.scenario === scenarioName)
      const scenario = compareResult.scenarios.find((entry) => entry.name === scenarioName);
      const viability = compareResult.viabilityByScenario.get(scenarioName);
      return {
        name: scenarioName,
        rank: index + 1,
        overall_score: ranking?.overall_score ?? 0,
        viable: viability?.viable ?? true,
        key_metrics: {
          net_annual_savings: round(scenario?.metrics.net_annual_savings ?? 0),
          tasks_automated_pct: round(scenario?.metrics.tasks_automated_pct ?? 0),
          max_resistance_probability: round(viability?.maxRoleResistance ?? 0),
          total_projected_fte: round(scenario?.metrics.total_projected_fte ?? 0),
        },
      };
    }),
    assumptions: buildAssumptions({
      inputCredibility,
      resolvedWeights: compareResult.resolvedWeights,
      viabilityThreshold: compareResult.viabilityThreshold,
      decisionDataQualityStatus,
      degradedSources,
      usedMockData,
    }),
    trust_contract: {
      decision_grade: decisionGrade,
      data_quality_status: decisionDataQualityStatus,
      ...(inputCredibility ? { input_credibility: inputCredibility } : {}),
      blocking_issues: blockingIssues,
      export_policy:
        decisionDataQualityStatus.status === 'mock'
          ? 'mock_blocked'
          : decisionGrade === 'decision_grade'
            ? 'normal'
            : 'degraded_watermark',
    },
    monitors: {
      attached: monitor_ids.length > 0,
      ids: monitor_ids,
    },
    review_hook: {
      outcome_review_status: 'not_built_yet',
    },
    dataQualityStatus: decisionDataQualityStatus,
    dataSource: 'WRS decision record synthesizer + deterministic scenario comparator',
  };

  return {
    simulation_id: input.simulation_id,
    status: artifact.status,
    best_scenario: compareResult.winner ?? 'N/A',
    summary: compareResult.summary,
    artifacts: {
      decision_record: artifact,
    },
  };
}
