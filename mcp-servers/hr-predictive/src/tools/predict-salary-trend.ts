import { z } from 'zod';
import { getDatabase } from '../db/database.js';
import { projectForward, exponentialSmoothing, linearRegression, DataPoint } from '../engine/trend-extrapolator.js';
import crypto from 'crypto';

export const predictSalaryTrendSchema = {
  role: z.string().describe('Job role/title'),
  location: z.string().optional().describe('Geographic location'),
  historical_salaries: z.array(z.number()).min(2).describe('Historical salary data points in chronological order'),
  periods_forward: z.number().min(1).max(24).default(6).describe('Number of periods to forecast'),
  smoothing_alpha: z.number().min(0.01).max(0.99).default(0.3).describe('Exponential smoothing alpha parameter'),
};

export async function handlePredictSalaryTrend(params: {
  role: string;
  location?: string;
  historical_salaries: number[];
  periods_forward: number;
  smoothing_alpha: number;
}) {
  try {
    const { role, location, historical_salaries, periods_forward, smoothing_alpha } = params;

    // Smooth the historical data
    const smoothed = exponentialSmoothing(historical_salaries, smoothing_alpha);

    // Convert to data points
    const points: DataPoint[] = smoothed.map((y, i) => ({ x: i, y }));

    // Get regression stats
    const regression = linearRegression(points);

    // Project forward
    const forecast = projectForward(points, periods_forward);

    // Calculate annual growth rate
    const mean = smoothed.reduce((a, b) => a + b, 0) / smoothed.length;
    const growthRate = mean !== 0
      ? Math.round((regression.slope / mean) * 100 * 100) / 100
      : 0;

    const result = {
      role,
      location: location || 'unspecified',
      current_salary: smoothed[smoothed.length - 1],
      growth_rate_pct: growthRate,
      trend_direction: growthRate > 2 ? 'increasing' : growthRate < -2 ? 'decreasing' : 'stable',
      r_squared: Math.round(regression.rSquared * 1000) / 1000,
      smoothed_history: smoothed,
      forecast,
    };

    // Persist prediction
    const predictionId = crypto.randomUUID();
    const db = getDatabase();

    db.prepare(`
      INSERT INTO predictions (id, type, subject, input_data, result, confidence, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      predictionId,
      'salary_trend',
      `${role}${location ? ` (${location})` : ''}`,
      JSON.stringify(params),
      JSON.stringify(result),
      regression.rSquared,
      new Date().toISOString()
    );

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ prediction_id: predictionId, ...result }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
}
