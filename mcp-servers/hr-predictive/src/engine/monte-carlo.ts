/**
 * Seeded PRNG using mulberry32 algorithm.
 */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform for normal distribution sampling.
 */
function normalSample(
  rng: () => number,
  mean: number,
  stdDev: number
): number {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Uniform distribution sampling.
 */
function uniformSample(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

export interface VariableDistribution {
  name: string;
  type: 'normal' | 'uniform';
  params: {
    mean?: number;
    stdDev?: number;
    min?: number;
    max?: number;
  };
}

export interface SimulationResult {
  variable: string;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
  stdDev: number;
}

export interface MonteCarloOutput {
  iterations: number;
  seed: number;
  results: SimulationResult[];
  rawOutcomes: number[][];
}

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

/**
 * Run a Monte Carlo simulation with the given variable distributions.
 */
export function runMonteCarlo(
  variables: VariableDistribution[],
  computeOutcome: (samples: Record<string, number>) => number,
  options: { iterations?: number; seed?: number } = {}
): MonteCarloOutput {
  const iterations = options.iterations ?? 1000;
  const seed = options.seed ?? 42;
  const rng = mulberry32(seed);

  const outcomes: number[] = [];
  const rawOutcomes: number[][] = [];

  for (let i = 0; i < iterations; i++) {
    const samples: Record<string, number> = {};
    const iterationValues: number[] = [];

    for (const v of variables) {
      let value: number;
      if (v.type === 'normal') {
        value = normalSample(rng, v.params.mean ?? 0, v.params.stdDev ?? 1);
      } else {
        value = uniformSample(rng, v.params.min ?? 0, v.params.max ?? 1);
      }
      samples[v.name] = value;
      iterationValues.push(value);
    }

    const outcome = computeOutcome(samples);
    outcomes.push(outcome);
    iterationValues.push(outcome);
    rawOutcomes.push(iterationValues);
  }

  const allVarNames = [...variables.map((v) => v.name), 'outcome'];
  const results: SimulationResult[] = allVarNames.map((name, colIdx) => {
    const colValues = rawOutcomes.map((row) => row[colIdx]).sort((a, b) => a - b);
    const mean = colValues.reduce((a, b) => a + b, 0) / colValues.length;
    const variance =
      colValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / colValues.length;

    return {
      variable: name,
      p10: round(percentile(colValues, 10)),
      p25: round(percentile(colValues, 25)),
      p50: round(percentile(colValues, 50)),
      p75: round(percentile(colValues, 75)),
      p90: round(percentile(colValues, 90)),
      mean: round(mean),
      stdDev: round(Math.sqrt(variance)),
    };
  });

  return { iterations, seed, results, rawOutcomes };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
