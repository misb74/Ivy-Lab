import { z } from 'zod';
import { getDatabase } from '../db/database.js';
import { projectSkillsDemand } from '../engine/skills-projector.js';
import crypto from 'crypto';

export const predictSkillsDemandSchema = {
  skills: z.array(z.object({
    skill: z.string().describe('Skill name'),
    historical_demand: z.array(z.number()).min(2).describe('Historical demand values in chronological order'),
  })).min(1).describe('Skills with their historical demand data'),
  periods_forward: z.number().min(1).max(24).default(6).describe('Number of periods to forecast'),
  smoothing_alpha: z.number().min(0.01).max(0.99).default(0.3).describe('Exponential smoothing alpha'),
};

export async function handlePredictSkillsDemand(params: {
  skills: { skill: string; historical_demand: number[] }[];
  periods_forward: number;
  smoothing_alpha: number;
}) {
  try {
    const { skills, periods_forward, smoothing_alpha } = params;

    const skillDemandData = skills.map((s) => ({
      skill: s.skill,
      historicalDemand: s.historical_demand,
    }));

    const result = projectSkillsDemand(skillDemandData, periods_forward, smoothing_alpha);

    // Persist prediction
    const predictionId = crypto.randomUUID();
    const db = getDatabase();

    db.prepare(`
      INSERT INTO predictions (id, type, subject, input_data, result, confidence, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      predictionId,
      'skills_demand',
      skills.map((s) => s.skill).join(', '),
      JSON.stringify(params),
      JSON.stringify(result),
      result.projections.length > 0
        ? result.projections.reduce((sum, p) => sum + p.confidence, 0) / result.projections.length
        : 0,
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
