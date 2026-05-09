import { getDb } from '../db/database.js';
import { synthesizeResults } from '../engine/result-synthesizer.js';
import type { SwarmRow, SwarmTaskRow } from '../db/schema.js';

export interface SwarmSynthesizeParams {
  swarm_id: string;
}

/**
 * Synthesizes results from all completed tasks into a unified output.
 */
export async function swarmSynthesize(params: SwarmSynthesizeParams) {
  const { swarm_id } = params;
  const db = getDb();

  // Fetch swarm
  const swarm = db
    .prepare('SELECT * FROM swarms WHERE id = ?')
    .get(swarm_id) as SwarmRow | undefined;

  if (!swarm) {
    throw new Error(`Swarm not found: ${swarm_id}`);
  }

  // Fetch all tasks
  const tasks = db
    .prepare('SELECT * FROM swarm_tasks WHERE swarm_id = ? ORDER BY priority DESC')
    .all(swarm_id) as SwarmTaskRow[];

  if (tasks.length === 0) {
    throw new Error(`Swarm "${swarm.name}" has no tasks to synthesize.`);
  }

  const synthesis = synthesizeResults(swarm_id, tasks);

  return {
    swarm: {
      id: swarm.id,
      name: swarm.name,
      objective: swarm.objective,
      status: swarm.status,
    },
    synthesis,
    message: `Synthesized results for swarm "${swarm.name}": ${synthesis.completion_percentage}% complete.`,
  };
}
