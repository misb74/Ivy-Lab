export interface ScenarioMetrics {
  [key: string]: number;
}

export interface Scenario {
  name: string;
  description?: string;
  metrics: ScenarioMetrics;
}

export interface MetricComparison {
  metric: string;
  values: { scenario: string; value: number }[];
  best: string;
  worst: string;
  range: number;
  average: number;
}

export interface ScenarioRanking {
  scenario: string;
  overallScore: number;
  rank: number;
  metricRanks: { metric: string; rank: number }[];
}

export interface ComparisonResult {
  scenarios: string[];
  metricComparisons: MetricComparison[];
  rankings: ScenarioRanking[];
  summary: string;
}

/**
 * Compare multiple scenario results side by side.
 * Higher metric values are assumed to be better by default.
 * Prefix a metric key with '-' in the first scenario to indicate lower-is-better.
 */
export function compareScenarios(
  scenarios: Scenario[],
  lowerIsBetter: string[] = []
): ComparisonResult {
  if (scenarios.length === 0) {
    return {
      scenarios: [],
      metricComparisons: [],
      rankings: [],
      summary: 'No scenarios provided for comparison.',
    };
  }

  // Collect all unique metrics
  const allMetrics = new Set<string>();
  for (const s of scenarios) {
    for (const key of Object.keys(s.metrics)) {
      allMetrics.add(key);
    }
  }

  const metricComparisons: MetricComparison[] = [];
  const lowerSet = new Set(lowerIsBetter);

  for (const metric of allMetrics) {
    const values = scenarios.map((s) => ({
      scenario: s.name,
      value: s.metrics[metric] ?? 0,
    }));

    const sorted = [...values].sort((a, b) => a.value - b.value);
    const isLowerBetter = lowerSet.has(metric);

    const best = isLowerBetter ? sorted[0].scenario : sorted[sorted.length - 1].scenario;
    const worst = isLowerBetter ? sorted[sorted.length - 1].scenario : sorted[0].scenario;
    const range = sorted[sorted.length - 1].value - sorted[0].value;
    const average =
      Math.round(
        (values.reduce((sum, v) => sum + v.value, 0) / values.length) * 100
      ) / 100;

    metricComparisons.push({ metric, values, best, worst, range, average });
  }

  // Rank scenarios: for each metric, assign rank 1..N
  const metricNames = [...allMetrics];
  const scenarioScores: Record<string, { total: number; ranks: { metric: string; rank: number }[] }> = {};

  for (const s of scenarios) {
    scenarioScores[s.name] = { total: 0, ranks: [] };
  }

  for (const metric of metricNames) {
    const isLowerBetter = lowerSet.has(metric);
    const vals = scenarios.map((s) => ({
      name: s.name,
      value: s.metrics[metric] ?? 0,
    }));

    vals.sort((a, b) =>
      isLowerBetter ? a.value - b.value : b.value - a.value
    );

    vals.forEach((v, idx) => {
      const rank = idx + 1;
      scenarioScores[v.name].total += rank;
      scenarioScores[v.name].ranks.push({ metric, rank });
    });
  }

  // Overall rankings (lower total rank = better)
  const rankings: ScenarioRanking[] = Object.entries(scenarioScores)
    .map(([scenario, data]) => ({
      scenario,
      overallScore: Math.round((data.total / metricNames.length) * 100) / 100,
      rank: 0,
      metricRanks: data.ranks,
    }))
    .sort((a, b) => a.overallScore - b.overallScore);

  rankings.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  const topScenario = rankings[0];
  const summary =
    rankings.length > 0
      ? `Best overall scenario: "${topScenario.scenario}" (avg rank ${topScenario.overallScore}) across ${metricNames.length} metrics and ${scenarios.length} scenarios.`
      : 'Unable to determine rankings.';

  return {
    scenarios: scenarios.map((s) => s.name),
    metricComparisons,
    rankings,
    summary,
  };
}
