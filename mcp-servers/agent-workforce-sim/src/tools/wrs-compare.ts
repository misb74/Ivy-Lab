import { getDatabase } from '../db/database.js';
import {
  buildScenarioComparisonCore,
  parseComparableScenarioRow,
  type ComparableScenarioInput,
  type ComparableScenarioDataQualityStatus,
  type ComparableScenarioInputCredibility,
  type WrsCompareParameterOverrides,
} from './wrs-compare-core.js';

export interface WrsCompareInput {
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
  include_counterfactual?: boolean;
  parameter_overrides?: WrsCompareParameterOverrides;
}

interface ScenarioRow {
  id: string;
  name: string;
  summary_metrics: string;
  results: string;
}

export function handleWrsCompare(input: WrsCompareInput) {
  let time_horizon_months: number;
  let scenarios: ComparableScenarioInput[];

  if (Array.isArray(input.scenarios) && input.scenarios.length > 0) {
    time_horizon_months = input.time_horizon_months ?? 18;
    scenarios = input.scenarios.map((scenario) => {
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
  } else {
    const db = getDatabase();
    const simulation = db
      .prepare('SELECT time_horizon_months FROM simulation WHERE id = ?')
      .get(input.simulation_id) as { time_horizon_months: number } | undefined;

    time_horizon_months = simulation?.time_horizon_months ?? input.time_horizon_months ?? 18;
    const ids = input.scenario_ids ?? [];
    scenarios = ids.map((scenarioId) => {
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
  }

  const result = buildScenarioComparisonCore({
    scenarios,
    time_horizon_months,
    include_counterfactual: input.include_counterfactual,
    parameter_overrides: input.parameter_overrides,
  });

  return {
    simulation_id: input.simulation_id,
    scenarios: result.scenarios.map((scenario) => scenario.name),
    metric_comparisons: result.metricComparisons,
    rankings: result.rankings,
    best_scenario: result.best_scenario,
    summary: result.summary,
    artifacts: {
      scenario_comparison: result.artifact,
    },
  };
}
