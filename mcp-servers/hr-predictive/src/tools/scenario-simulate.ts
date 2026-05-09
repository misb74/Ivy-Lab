import { z } from 'zod';
import { getDatabase } from '../db/database.js';
import { runMonteCarlo, VariableDistribution } from '../engine/monte-carlo.js';
import { compareScenarios } from '../engine/scenario-comparator.js';
import crypto from 'crypto';

export const scenarioSimulateSchema = {
  scenario_name: z.string().describe('Name for this scenario'),
  description: z.string().optional().describe('Description of the scenario'),
  variables: z.array(z.object({
    name: z.string().describe('Variable name'),
    type: z.enum(['normal', 'uniform']).describe('Distribution type'),
    params: z.object({
      mean: z.number().optional().describe('Mean for normal distribution'),
      stdDev: z.number().optional().describe('Standard deviation for normal distribution'),
      min: z.number().optional().describe('Min for uniform distribution'),
      max: z.number().optional().describe('Max for uniform distribution'),
    }).describe('Distribution parameters'),
  })).min(1).describe('Variables with their distributions'),
  outcome_formula: z.enum([
    'sum', 'product', 'weighted_sum', 'headcount_forecast',
  ]).default('sum').describe('How to compute outcome from variables'),
  weights: z.record(z.string(), z.number()).optional().describe('Weights for weighted_sum formula'),
  iterations: z.number().min(100).max(100000).default(1000).describe('Number of Monte Carlo iterations'),
  seed: z.number().optional().describe('Random seed for reproducibility'),
  compare_with_scenario_ids: z.array(z.string()).optional().describe('IDs of previous scenarios to compare with'),
};

function buildOutcomeFunction(
  formula: string,
  weights?: Record<string, number>
): (samples: Record<string, number>) => number {
  switch (formula) {
    case 'sum':
      return (samples) => Object.values(samples).reduce((a, b) => a + b, 0);
    case 'product':
      return (samples) => Object.values(samples).reduce((a, b) => a * b, 1);
    case 'weighted_sum':
      return (samples) => {
        let total = 0;
        for (const [key, value] of Object.entries(samples)) {
          total += value * (weights?.[key] ?? 1);
        }
        return total;
      };
    case 'headcount_forecast':
      return (samples) => {
        const base = samples['base_headcount'] ?? 100;
        const growth = samples['growth_rate'] ?? 0.1;
        const attrition = samples['attrition_rate'] ?? 0.12;
        const hires = samples['new_hires'] ?? 0;
        return Math.round(base * (1 + growth - attrition) + hires);
      };
    default:
      return (samples) => Object.values(samples).reduce((a, b) => a + b, 0);
  }
}

export async function handleScenarioSimulate(params: {
  scenario_name: string;
  description?: string;
  variables: { name: string; type: 'normal' | 'uniform'; params: { mean?: number; stdDev?: number; min?: number; max?: number } }[];
  outcome_formula: string;
  weights?: Record<string, number>;
  iterations: number;
  seed?: number;
  compare_with_scenario_ids?: string[];
}) {
  try {
    const {
      scenario_name,
      description,
      variables,
      outcome_formula,
      weights,
      iterations,
      seed,
      compare_with_scenario_ids,
    } = params;

    const distributions: VariableDistribution[] = variables.map((v) => ({
      name: v.name,
      type: v.type,
      params: v.params,
    }));

    const outcomeFn = buildOutcomeFunction(outcome_formula, weights);
    const mcResult = runMonteCarlo(distributions, outcomeFn, {
      iterations,
      seed: seed ?? 42,
    });

    // Store scenario
    const scenarioId = crypto.randomUUID();
    const db = getDatabase();

    const scenarioResult = {
      simulation: {
        iterations: mcResult.iterations,
        seed: mcResult.seed,
        results: mcResult.results,
      },
      outcome_formula,
    };

    db.prepare(`
      INSERT INTO scenarios (id, name, description, variables, results, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      scenarioId,
      scenario_name,
      description || null,
      JSON.stringify(variables),
      JSON.stringify(scenarioResult),
      new Date().toISOString()
    );

    // Comparison if requested
    let comparison = null;
    if (compare_with_scenario_ids && compare_with_scenario_ids.length > 0) {
      const placeholders = compare_with_scenario_ids.map(() => '?').join(', ');
      const previousScenarios = db.prepare(
        `SELECT id, name, results FROM scenarios WHERE id IN (${placeholders})`
      ).all(...compare_with_scenario_ids) as { id: string; name: string; results: string }[];

      const scenariosForComparison = [
        {
          name: scenario_name,
          metrics: extractMetrics(mcResult.results),
        },
        ...previousScenarios.map((s) => {
          const parsed = JSON.parse(s.results);
          return {
            name: s.name,
            metrics: extractMetrics(parsed.simulation?.results ?? []),
          };
        }),
      ];

      comparison = compareScenarios(scenariosForComparison, ['stdDev']);
    }

    const output: Record<string, unknown> = {
      scenario_id: scenarioId,
      scenario_name,
      description,
      simulation: scenarioResult.simulation,
    };

    if (comparison) {
      output.comparison = comparison;
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(output, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
}

function extractMetrics(
  results: { variable: string; p50: number; mean: number; stdDev: number }[]
): Record<string, number> {
  const metrics: Record<string, number> = {};
  const outcome = results.find((r) => r.variable === 'outcome');
  if (outcome) {
    metrics['outcome_p50'] = outcome.p50;
    metrics['outcome_mean'] = outcome.mean;
    metrics['outcome_stdDev'] = outcome.stdDev;
  }
  return metrics;
}
