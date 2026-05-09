import { z } from 'zod';
import { getDatabase } from '../db/database.js';
import { calculateAttritionRisk } from '../engine/attrition-model.js';
import crypto from 'crypto';

export const predictAttritionSchema = {
  employee_id: z.string().optional().describe('Employee identifier'),
  role: z.string().optional().describe('Job role/title'),
  tenure: z.number().min(0).describe('Years at company'),
  compensation_ratio: z.number().min(0).describe('Current salary / market median (e.g. 0.95)'),
  engagement_score: z.number().min(0).max(100).describe('Engagement score 0-100'),
  market_demand: z.number().min(0).max(100).describe('Market demand for this role 0-100'),
  team_size: z.number().min(1).describe('Size of immediate team'),
};

export async function handlePredictAttrition(params: {
  employee_id?: string;
  role?: string;
  tenure: number;
  compensation_ratio: number;
  engagement_score: number;
  market_demand: number;
  team_size: number;
}) {
  try {
    const result = calculateAttritionRisk({
      tenure: params.tenure,
      compensationRatio: params.compensation_ratio,
      engagementScore: params.engagement_score,
      marketDemand: params.market_demand,
      teamSize: params.team_size,
    });

    const predictionId = crypto.randomUUID();
    const db = getDatabase();

    db.prepare(`
      INSERT INTO predictions (id, type, subject, input_data, result, confidence, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      predictionId,
      'attrition',
      params.employee_id || params.role || 'unknown',
      JSON.stringify(params),
      JSON.stringify(result),
      result.riskScore / 100,
      new Date().toISOString()
    );

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          prediction_id: predictionId,
          employee_id: params.employee_id,
          role: params.role,
          ...result,
        }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
}
