import {
  DataPoint,
  ForecastPoint,
  linearRegression,
  projectForward,
  exponentialSmoothing,
} from './trend-extrapolator.js';

export interface SkillDemandData {
  skill: string;
  historicalDemand: number[]; // time-ordered demand values (e.g. job postings, headcount)
}

export type SkillTrend = 'emerging' | 'stable' | 'declining';

export interface SkillProjection {
  skill: string;
  trend: SkillTrend;
  currentDemand: number;
  growthRate: number;         // slope as percentage of mean
  forecast: ForecastPoint[];
  smoothedHistory: number[];
  confidence: number;         // rSquared from regression
}

export interface SkillsProjectionResult {
  projections: SkillProjection[];
  emerging: string[];
  stable: string[];
  declining: string[];
  periodsProjected: number;
}

function classifyTrend(growthRate: number): SkillTrend {
  if (growthRate > 5) return 'emerging';
  if (growthRate < -5) return 'declining';
  return 'stable';
}

/**
 * Projects future demand for a set of skills based on historical data.
 */
export function projectSkillsDemand(
  skills: SkillDemandData[],
  periodsForward: number = 6,
  smoothingAlpha: number = 0.3
): SkillsProjectionResult {
  const projections: SkillProjection[] = [];

  for (const skillData of skills) {
    const { skill, historicalDemand } = skillData;

    if (historicalDemand.length === 0) {
      projections.push({
        skill,
        trend: 'stable',
        currentDemand: 0,
        growthRate: 0,
        forecast: [],
        smoothedHistory: [],
        confidence: 0,
      });
      continue;
    }

    // Smooth the historical data
    const smoothed = exponentialSmoothing(historicalDemand, smoothingAlpha);

    // Convert to data points for regression
    const points: DataPoint[] = smoothed.map((y, i) => ({ x: i, y }));

    // Run linear regression
    const reg = linearRegression(points);

    // Calculate growth rate as percentage of mean
    const mean = smoothed.reduce((a, b) => a + b, 0) / smoothed.length;
    const growthRate = mean !== 0
      ? Math.round((reg.slope / mean) * 100 * 100) / 100
      : 0;

    // Project forward
    const forecast = projectForward(points, periodsForward);

    const currentDemand = smoothed[smoothed.length - 1];
    const trend = classifyTrend(growthRate);

    projections.push({
      skill,
      trend,
      currentDemand,
      growthRate,
      forecast,
      smoothedHistory: smoothed,
      confidence: Math.round(reg.rSquared * 100) / 100,
    });
  }

  // Sort by growth rate descending
  projections.sort((a, b) => b.growthRate - a.growthRate);

  const emerging = projections.filter((p) => p.trend === 'emerging').map((p) => p.skill);
  const stable = projections.filter((p) => p.trend === 'stable').map((p) => p.skill);
  const declining = projections.filter((p) => p.trend === 'declining').map((p) => p.skill);

  return {
    projections,
    emerging,
    stable,
    declining,
    periodsProjected: periodsForward,
  };
}
