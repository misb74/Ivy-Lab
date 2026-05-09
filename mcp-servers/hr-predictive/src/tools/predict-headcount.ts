import { z } from 'zod';
import { getDatabase } from '../db/database.js';
import { projectForward, DataPoint } from '../engine/trend-extrapolator.js';
import crypto from 'crypto';

export const predictHeadcountSchema = {
  current_headcount: z.number().min(0).describe('Current total headcount'),
  historical_headcounts: z.array(z.number()).min(2).optional().describe('Historical headcount data points'),
  annual_growth_rate: z.number().optional().describe('Expected annual growth rate as decimal (e.g. 0.15 for 15%)'),
  annual_attrition_rate: z.number().min(0).max(1).default(0.12).describe('Expected annual attrition rate (e.g. 0.12 for 12%)'),
  planned_hires: z.number().min(0).default(0).describe('Number of planned hires in next period'),
  periods_forward: z.number().min(1).max(24).default(6).describe('Number of periods to forecast'),
  department: z.string().optional().describe('Department name for context'),
};

export async function handlePredictHeadcount(params: {
  current_headcount: number;
  historical_headcounts?: number[];
  annual_growth_rate?: number;
  annual_attrition_rate: number;
  planned_hires: number;
  periods_forward: number;
  department?: string;
}) {
  try {
    const {
      current_headcount,
      historical_headcounts,
      annual_growth_rate,
      annual_attrition_rate,
      planned_hires,
      periods_forward,
      department,
    } = params;

    let forecast;
    let method: string;

    if (historical_headcounts && historical_headcounts.length >= 2) {
      // Use historical data for trend-based projection
      const points: DataPoint[] = historical_headcounts.map((y, i) => ({ x: i, y }));
      forecast = projectForward(points, periods_forward);
      method = 'trend_extrapolation';
    } else {
      // Use growth/attrition model for projection
      const monthlyAttrition = annual_attrition_rate / 12;
      const monthlyGrowth = (annual_growth_rate ?? 0) / 12;
      const hiresPerPeriod = planned_hires / Math.max(periods_forward, 1);

      forecast = [];
      let headcount = current_headcount;

      for (let i = 1; i <= periods_forward; i++) {
        const departures = Math.round(headcount * monthlyAttrition);
        const growth = Math.round(headcount * monthlyGrowth);
        headcount = headcount - departures + growth + Math.round(hiresPerPeriod);

        const uncertainty = Math.round(headcount * 0.05 * Math.sqrt(i));
        forecast.push({
          x: i,
          y: headcount,
          lower: headcount - uncertainty,
          upper: headcount + uncertainty,
        });
      }

      method = 'growth_attrition_model';
    }

    const finalHeadcount = forecast[forecast.length - 1]?.y ?? current_headcount;
    const netChange = finalHeadcount - current_headcount;
    const netChangePercent = current_headcount > 0
      ? Math.round((netChange / current_headcount) * 100 * 100) / 100
      : 0;

    const result = {
      department: department || 'all',
      current_headcount,
      method,
      annual_attrition_rate,
      annual_growth_rate: annual_growth_rate ?? null,
      planned_hires,
      forecast,
      summary: {
        final_headcount: finalHeadcount,
        net_change: netChange,
        net_change_percent: netChangePercent,
        periods_projected: periods_forward,
      },
    };

    // Persist prediction
    const predictionId = crypto.randomUUID();
    const db = getDatabase();

    db.prepare(`
      INSERT INTO predictions (id, type, subject, input_data, result, confidence, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      predictionId,
      'headcount',
      department || 'all',
      JSON.stringify(params),
      JSON.stringify(result),
      method === 'trend_extrapolation' ? 0.8 : 0.6,
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
