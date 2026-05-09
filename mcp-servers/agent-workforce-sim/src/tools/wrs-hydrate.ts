import crypto from 'crypto';
import { getDatabase } from '../db/database.js';
import {
  buildMockConnectorExecutor,
  hydrateRoleWithPolicy,
  type HydratorExecutor,
  type HydratedRoleTask,
} from '../hydrators/role-hydrator.js';

/**
 * Pre-fetched results keyed by tool name.
 * For `workbank_human_edge`, the value must be an array of per-task objects
 * each containing a `task_statement` field so the executor can look up by
 * normalized task statement.
 * `degraded_sources` is an optional list of source names that already failed
 * upstream and should be merged into the degraded set returned by hydration.
 */
export interface PrefetchedSources {
  role_decompose?: unknown;
  workbank_occupation_automation?: unknown;
  workbank_gap_analysis?: unknown;
  /** Array of per-task human-edge objects, each with a `task_statement` field. */
  workbank_human_edge?: unknown[];
  aei_task_penetration?: unknown;
  aei_task_collaboration?: unknown;
  bls_occupation_wages?: unknown;
  atlas_get_occupation?: unknown;
  lightcast_search_skills?: unknown;
  aioe_occupation_exposure?: unknown;
  jobhop_transition_probability?: unknown;
  /** Sources that failed upstream and should be reported as degraded. */
  degraded_sources?: string[];
  [key: string]: unknown;
}

export interface WrsHydrateInput {
  simulation_id: string;
  role_id?: string;
  use_mock_data?: boolean;
  prefetched_sources?: PrefetchedSources;
}

/**
 * Builds a HydratorExecutor that returns pre-fetched results by tool name.
 * For `workbank_human_edge`, performs a lookup by normalized task_statement
 * across the supplied array of per-task objects.
 */
function buildPrefetchedExecutor(sources: PrefetchedSources): HydratorExecutor {
  function normalizeText(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Build a statement → object map for workbank_human_edge lookups.
  const humanEdgeMap = new Map<string, unknown>();
  if (Array.isArray(sources.workbank_human_edge)) {
    for (const item of sources.workbank_human_edge) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        const stmt = String(record.task_statement ?? '').trim();
        if (stmt) {
          humanEdgeMap.set(normalizeText(stmt), item);
        }
      }
    }
  }

  return async (toolName: string, input: Record<string, unknown>): Promise<unknown> => {
    if (toolName === 'workbank_human_edge') {
      const requestedStatement = String(input.task_statement ?? '').trim();
      const key = normalizeText(requestedStatement);
      const found = humanEdgeMap.get(key);
      if (found !== undefined) {
        return found;
      }
      throw new Error(`workbank_human_edge: no prefetched data for task "${requestedStatement}"`);
    }

    if (Object.prototype.hasOwnProperty.call(sources, toolName)) {
      const result = sources[toolName];
      if (result !== undefined) {
        return result;
      }
    }

    throw new Error(`prefetched executor: no data provided for tool "${toolName}"`);
  };
}

interface RoleRow {
  role_id: string;
  title: string;
  onet_soc_code: string;
}

export async function handleWrsHydrate(input: WrsHydrateInput) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const role_rows = db
    .prepare(
      `
      SELECT tr.id AS role_id, tr.title AS title, tr.onet_soc_code AS onet_soc_code
      FROM simulation s
      JOIN organization o ON o.id = s.org_id
      JOIN department d ON d.org_id = o.id
      JOIN team t ON t.dept_id = d.id
      JOIN team_role tr ON tr.team_id = t.id
      WHERE s.id = ?
        AND (? IS NULL OR tr.id = ?)
      ORDER BY tr.title ASC
      `
    )
    .all(input.simulation_id, input.role_id ?? null, input.role_id ?? null) as RoleRow[];

  if (role_rows.length === 0) {
    throw new Error(`No roles found for simulation ${input.simulation_id}`);
  }

  let executor: HydratorExecutor | undefined;
  if (input.prefetched_sources !== undefined) {
    executor = buildPrefetchedExecutor(input.prefetched_sources);
  } else if (input.use_mock_data === true) {
    executor = buildMockConnectorExecutor();
  } else {
    throw new Error(
      'wrs_hydrate requires either prefetched_sources or use_mock_data=true. ' +
      'Pass prefetched_sources from the gateway orchestrator, or set use_mock_data=true for development.'
    );
  }

  const degraded_source_set = new Set<string>();

  // Merge any upstream-degraded sources from prefetched_sources
  if (input.prefetched_sources?.degraded_sources) {
    for (const src of input.prefetched_sources.degraded_sources) {
      degraded_source_set.add(src);
    }
  }
  const hydrated_samples: Array<HydratedRoleTask & { role_id: string }> = [];
  let total_tasks = 0;

  for (const role of role_rows) {
    const hydrated = await hydrateRoleWithPolicy({
      role_title: role.title,
      onet_soc_code: role.onet_soc_code,
      execute: executor,
    });

    for (const source of hydrated.degraded_sources) {
      degraded_source_set.add(source);
    }

    db.prepare(`
      UPDATE team_role
      SET automation_potential = ?,
          worker_desire_avg = ?,
          aei_exposure_score = ?,
          felten_aioe_score = ?,
          human_edge_avg = ?,
          annual_cost_per_fte = COALESCE(annual_cost_per_fte, ?)
      WHERE id = ?
    `).run(
      hydrated.automation_potential,
      hydrated.worker_desire_avg,
      hydrated.aei_exposure_score,
      hydrated.felten_aioe_score,
      hydrated.human_edge_avg,
      hydrated.annual_cost_per_fte,
      role.role_id
    );

    db.prepare('DELETE FROM role_task WHERE role_id = ?').run(role.role_id);
    db.prepare('DELETE FROM role_skill WHERE role_id = ?').run(role.role_id);

    // Build task_hash lookup from provenance (atlas returns task_hash → skills)
    // We need to match task statements to their task_hashes to link provenance
    const provenance = hydrated.task_skill_provenance ?? {};

    const task_insert = db.prepare(`
      INSERT INTO role_task (
        id, role_id, onet_task_id, task_statement, importance, time_allocation,
        ai_capability_score, worker_desire_score, human_agency_scale,
        aei_penetration_rate, aei_autonomy, aei_collaboration_pattern,
        human_edge_stakeholder_trust, human_edge_social_intelligence,
        human_edge_creativity, human_edge_ethics, human_edge_physical_presence,
        human_edge_judgment, linked_skills_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const task of hydrated.tasks) {
      // Look up linked skills from provenance by matching task_hash
      // The provenance keys are task_hashes; find the matching one for this task
      const taskHash = String(task.onet_task_id ?? '');
      const linkedSkills = provenance[taskHash]
        ?? Object.entries(provenance).find(([_, skills]) =>
          skills.some(s => task.task_statement.toLowerCase().includes(s.skill_name.toLowerCase().slice(0, 10)))
        )?.[1]
        ?? [];
      const linkedSkillsJson = linkedSkills.length > 0
        ? JSON.stringify(linkedSkills.map(s => s.skill_name))
        : null;

      task_insert.run(
        crypto.randomUUID(),
        role.role_id,
        task.onet_task_id,
        task.task_statement,
        task.importance,
        task.time_allocation,
        task.ai_capability_score,
        task.worker_desire_score,
        task.human_agency_scale,
        task.aei_penetration_rate,
        task.aei_autonomy,
        task.aei_collaboration_pattern,
        task.human_edge_stakeholder_trust,
        task.human_edge_social_intelligence,
        task.human_edge_creativity,
        task.human_edge_ethics,
        task.human_edge_physical_presence,
        task.human_edge_judgment,
        linkedSkillsJson,
        now
      );

      if (hydrated_samples.length < 12) {
        hydrated_samples.push({ role_id: role.role_id, ...task });
      }
    }

    const skill_insert = db.prepare(`
      INSERT INTO role_skill (id, role_id, skill_name, lightcast_skill_id, level, importance, trend, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const skill of hydrated.skills) {
      skill_insert.run(
        crypto.randomUUID(),
        role.role_id,
        skill.skill_name,
        skill.lightcast_skill_id,
        skill.level,
        skill.importance,
        skill.trend,
        now
      );
    }

    total_tasks += hydrated.tasks.length;
  }

  const used_mock_data = input.prefetched_sources === undefined && input.use_mock_data === true;

  db.prepare(`
    UPDATE simulation
    SET status = ?, degraded_sources = ?, used_mock_data = ?, updated_at = ?
    WHERE id = ?
  `).run(
    'hydrated',
    JSON.stringify(Array.from(degraded_source_set)),
    used_mock_data ? 1 : 0,
    now,
    input.simulation_id
  );

  return {
    simulation_id: input.simulation_id,
    roles_hydrated: role_rows.length,
    role_ids: role_rows.map((role) => role.role_id),
    total_tasks,
    degraded_sources: Array.from(degraded_source_set),
    hydrated_role_task_samples: hydrated_samples,
    used_mock_data,
    generated_at: now,
  };
}
