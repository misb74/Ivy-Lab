export interface DataPoint {
  x: number;
  y: number;
}

export interface ForecastPoint {
  x: number;
  y: number;
  lower: number;
  upper: number;
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

/**
 * Simple linear regression: calculates slope and intercept from data points.
 */
export function linearRegression(points: DataPoint[]): RegressionResult {
  const n = points.length;
  if (n < 2) {
    return { slope: 0, intercept: points[0]?.y ?? 0, rSquared: 0 };
  }

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return { slope: 0, intercept: sumY / n, rSquared: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const yMean = sumY / n;
  let ssRes = 0, ssTot = 0;
  for (const p of points) {
    const predicted = slope * p.x + intercept;
    ssRes += (p.y - predicted) ** 2;
    ssTot += (p.y - yMean) ** 2;
  }
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared };
}

/**
 * Projects forward using linear regression with confidence intervals.
 */
export function projectForward(
  points: DataPoint[],
  periods: number
): ForecastPoint[] {
  const reg = linearRegression(points);
  const n = points.length;

  let residualVariance = 0;
  for (const p of points) {
    const predicted = reg.slope * p.x + reg.intercept;
    residualVariance += (p.y - predicted) ** 2;
  }
  residualVariance = n > 2 ? residualVariance / (n - 2) : residualVariance;
  const stdError = Math.sqrt(residualVariance);

  const lastX = points.length > 0 ? points[points.length - 1].x : 0;
  const forecast: ForecastPoint[] = [];

  for (let i = 1; i <= periods; i++) {
    const x = lastX + i;
    const y = reg.slope * x + reg.intercept;
    const margin = 1.96 * stdError * Math.sqrt(1 + 1 / n + (i * i) / n);
    forecast.push({
      x,
      y: Math.round(y * 100) / 100,
      lower: Math.round((y - margin) * 100) / 100,
      upper: Math.round((y + margin) * 100) / 100,
    });
  }

  return forecast;
}

/**
 * Exponential smoothing: smooths noisy time series data.
 */
export function exponentialSmoothing(
  values: number[],
  alpha: number = 0.3
): number[] {
  if (values.length === 0) return [];

  const smoothed: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
  }
  return smoothed.map((v) => Math.round(v * 100) / 100);
}

/**
 * Convenience: smooth then project forward.
 */
export function smoothAndProject(
  values: number[],
  alpha: number,
  periods: number
): ForecastPoint[] {
  const smoothed = exponentialSmoothing(values, alpha);
  const points: DataPoint[] = smoothed.map((y, i) => ({ x: i, y }));
  return projectForward(points, periods);
}
