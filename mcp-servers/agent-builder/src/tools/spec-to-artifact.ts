import { getDb, getWorksimDb } from '../db/database.js';
import { buildAgentSpecArtifact } from '../engine/artifact-builder.js';
import { isGroundingAvailable } from '../engine/hr-grounding-match.js';
import {
  buildAgentSpecDataQualityStatus,
  type AgentSpecHydrationSignals,
} from '../engine/agent-spec-dq.js';

export async function specToArtifact(params: { spec_id: string }) {
  const db = getDb();

  const spec = db.prepare('SELECT * FROM agent_specs WHERE id = ?').get(params.spec_id) as any;
  if (!spec) throw new Error(`Spec "${params.spec_id}" not found`);

  const tools = db.prepare('SELECT * FROM spec_tools WHERE spec_id = ? ORDER BY tool_name').all(params.spec_id) as any[];
  const guardrails = db.prepare('SELECT * FROM spec_guardrails WHERE spec_id = ? ORDER BY priority DESC').all(params.spec_id) as any[];
  const tasks = db.prepare('SELECT * FROM spec_tasks WHERE spec_id = ? ORDER BY sequence_order').all(params.spec_id) as any[];
  const criteria = db.prepare('SELECT * FROM spec_success_criteria WHERE spec_id = ?').all(params.spec_id) as any[];

  // Enrich tasks with grounding labels for artifact display
  const groundingActive = isGroundingAvailable(db);
  if (groundingActive) {
    for (const task of tasks as any[]) {
      if (task.grounding_process_id) {
        const labels = db.prepare(
          'SELECT judgment_risk, data_sensitivity FROM hr_process_labels WHERE process_id = ?'
        ).get(task.grounding_process_id) as any;
        if (labels) {
          task.grounding_labels = {
            judgment_risk: labels.judgment_risk,
            data_sensitivity: labels.data_sensitivity,
          };
        }
      }
    }
  }

  // ── Gather Data Quality signals ────────────────────────────────────
  // (a) grounding coverage signals — pulled from the task rows we just loaded
  // (b) source-simulation passport — opens worksim.db read-only if present
  const grounded_tasks = tasks.filter((t: any) => t.grounding_source === 'hr_ontology').length;
  const tasks_with_risk_labels = tasks.filter((t: any) => {
    const labels = t.grounding_labels;
    return labels && (labels.judgment_risk || labels.data_sensitivity);
  }).length;

  const signals: AgentSpecHydrationSignals = {
    total_tasks: tasks.length,
    grounded_tasks,
    tasks_with_risk_labels,
    from_simulation: Boolean(spec.source_simulation_id),
    hr_grounding_available: groundingActive,
  };

  if (spec.source_simulation_id) {
    try {
      const wsDb = getWorksimDb();
      try {
        const sim = wsDb
          .prepare(
            'SELECT id, used_mock_data, degraded_sources FROM simulation WHERE id = ?'
          )
          .get(spec.source_simulation_id) as
          | { id: string; used_mock_data: number | null; degraded_sources: string | null }
          | undefined;
        if (!sim) {
          signals.source_simulation_missing = true;
        } else {
          const used_mock_data = Boolean(sim.used_mock_data);
          let degraded_sources: string[] = [];
          if (sim.degraded_sources) {
            try {
              const parsed = JSON.parse(sim.degraded_sources);
              if (Array.isArray(parsed)) degraded_sources = parsed.filter((s) => typeof s === 'string');
            } catch {
              // malformed JSON — treat as no degraded sources, but note the degraded state
              degraded_sources = [];
            }
          }
          if (used_mock_data) {
            signals.used_mock_data = true;
            signals.source_simulation_status = 'mock';
          } else if (degraded_sources.length > 0) {
            signals.source_simulation_status = 'degraded';
            signals.source_simulation_degraded_sources = degraded_sources;
          } else {
            signals.source_simulation_status = 'real';
          }
        }
      } finally {
        wsDb.close();
      }
    } catch {
      // worksim.db may not exist in test/local setups — mark the sim as missing
      // rather than crashing. The builder degrades gracefully in either case.
      signals.source_simulation_missing = true;
    }
  }

  const dataQualityStatus = buildAgentSpecDataQualityStatus(signals);

  const artifact = buildAgentSpecArtifact(spec, tasks, tools, guardrails, criteria, dataQualityStatus);

  return artifact;
}
