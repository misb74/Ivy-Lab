/**
 * Agent Spec — Data Quality Passport builder
 *
 * Per-type builder for `agent_spec` artifacts. Lives inside the agent-builder
 * MCP server because the producer (`spec-to-artifact.ts`) has clean, direct
 * access to all the signals that matter:
 *
 *   1. HR ontology match coverage — `grounding_source` on each task row
 *      (311 canonical HR processes; high coverage means the spec's tasks are
 *      anchored to known HR work, not free-form guesses).
 *   2. Per-task risk labels — `grounding_labels.judgment_risk` and
 *      `grounding_labels.data_sensitivity` on the task row (populated from the
 *      HR ontology label table). Absent labels mean the grounding pass didn't
 *      attach risk signals — a weak but real signal of spec quality.
 *   3. Source simulation passport — if the spec was derived from a WRS run,
 *      its `source_simulation_id` lets us look up the simulation row in
 *      worksim.db and pull `used_mock_data` + `degraded_sources`. We propagate
 *      that signal directly (garbage-in, garbage-out — if the sim ran on
 *      mocks, the spec is mock-backed too).
 *   4. `used_mock_data` override — always clamps confidence to ≤ 25 and flips
 *      status to `mock`.
 *
 * This follows the "producer populates" pattern (option a) from wrs-run.ts's
 * `buildDataQualityStatus`. The alternative (option b, translator-attach) is
 * used for LLM-generated artifacts where the producer is a model, not code.
 * Here the producer is deterministic — it has the signals, so it builds the
 * passport.
 *
 * Status rules (standard; mirrors career-ladder-dq.ts / wrs-run.ts):
 *   used_mock_data OR source-sim was mock           → 'mock',     confidence ≤ 25
 *   source-sim degraded OR grounding coverage <50%
 *     OR no risk labels OR labels absent on >50%    → 'degraded', confidence 50-75
 *   grounding coverage ≥80% AND risk labels present
 *     AND source-sim was 'real' (or no sim)          → 'real',     confidence ≥ 85
 *
 * The builder is a pure function. `spec-to-artifact.ts` gathers the signals
 * from the DBs and passes them in.
 */

// ── Contract (must match frontend/src/components/renderers/shared/DataQualityPassport.tsx) ──

export interface AgentSpecDataQualityStatus {
  status: 'real' | 'degraded' | 'mock';
  /** 0-100. mock: 0-25, degraded: 50-75, real: 85-100. */
  confidence: number;
  sources: Array<{
    name: string;
    status: 'real' | 'mock' | 'unavailable';
    used_in: string;
    /** ISO date (YYYY-MM-DD) of the source's data snapshot, if known. */
    as_of?: string;
    /** True if `as_of` is past the source-type freshness threshold. */
    stale?: boolean;
  }>;
  notes: string[];
  computed_at: string;
}

export interface AgentSpecHydrationSignals {
  /** Total tasks on the spec. Denominator for grounding coverage. */
  total_tasks: number;
  /** Tasks with `grounding_source === 'hr_ontology'`. Numerator for coverage. */
  grounded_tasks: number;
  /**
   * Tasks with at least one risk label (automation / judgment / sensitivity)
   * populated. When the HR ontology match succeeds, labels come with it; this
   * can only lag `grounded_tasks` if the label table was partially populated.
   */
  tasks_with_risk_labels: number;
  /**
   * True if any upstream hydration fell back to mock data. Propagates from
   * the source simulation (if any) or from explicit caller-supplied signal.
   * A true value clamps the passport to `mock`.
   */
  used_mock_data?: boolean;
  /**
   * True if the spec was derived from a simulation but we could not locate
   * the simulation row (orphaned source_simulation_id). Degrades confidence
   * because we can't validate the upstream data.
   */
  source_simulation_missing?: boolean;
  /**
   * If the spec was derived from a WRS run, the simulation's own DQ status
   * and optional degraded sources list. These flow through as-is — if the
   * source sim was mock, the spec is mock.
   */
  source_simulation_status?: 'real' | 'degraded' | 'mock';
  source_simulation_degraded_sources?: string[];
  /** Was this spec derived from a simulation at all? */
  from_simulation: boolean;
  /** Grounding availability — is the HR ontology loaded at all? */
  hr_grounding_available: boolean;
  /** ISO timestamp override — defaults to new Date().toISOString(). */
  computed_at?: string;
}

/**
 * Build the Data Quality Passport for an agent_spec artifact.
 *
 * Pure function — no I/O. Caller (`spec-to-artifact.ts`) gathers signals from
 * the agent-builder DB and worksim.db.
 */
export function buildAgentSpecDataQualityStatus(
  signals: AgentSpecHydrationSignals,
): AgentSpecDataQualityStatus {
  const computed_at = signals.computed_at ?? new Date().toISOString();
  const notes: string[] = [];

  const coverage =
    signals.total_tasks > 0 ? signals.grounded_tasks / signals.total_tasks : 0;
  const labelCoverage =
    signals.total_tasks > 0
      ? signals.tasks_with_risk_labels / signals.total_tasks
      : 0;

  // ── Build per-source trace ───────────────────────────────────────────
  // Three "sources" contribute to an agent_spec:
  //   - HR Work Ontology (311 canonical HR processes — grounding signal)
  //   - Risk Labels (judgment / sensitivity labels from ontology — guardrail signal)
  //   - WorkVine Simulation (only present if spec was derived from one)
  const sources: AgentSpecDataQualityStatus['sources'] = [];

  // HR Work Ontology — the primary source.
  if (!signals.hr_grounding_available) {
    sources.push({
      name: 'HR Work Ontology',
      status: 'unavailable',
      used_in: 'task_grounding',
    });
  } else if (coverage >= 0.5) {
    sources.push({
      name: 'HR Work Ontology',
      status: 'real',
      used_in: 'task_grounding',
    });
  } else {
    sources.push({
      name: 'HR Work Ontology',
      status: 'unavailable',
      used_in: 'task_grounding',
    });
  }

  // Risk Labels — only "real" if labels are present on most tasks.
  if (!signals.hr_grounding_available) {
    sources.push({
      name: 'HR Risk Labels',
      status: 'unavailable',
      used_in: 'guardrails',
    });
  } else if (labelCoverage >= 0.5) {
    sources.push({
      name: 'HR Risk Labels',
      status: 'real',
      used_in: 'guardrails',
    });
  } else {
    sources.push({
      name: 'HR Risk Labels',
      status: 'unavailable',
      used_in: 'guardrails',
    });
  }

  // WorkVine Simulation — only listed when the spec is derived from one.
  if (signals.from_simulation) {
    if (signals.source_simulation_missing) {
      sources.push({
        name: 'WorkVine Simulation',
        status: 'unavailable',
        used_in: 'tasks_and_assignments',
      });
    } else if (signals.source_simulation_status === 'mock' || signals.used_mock_data) {
      sources.push({
        name: 'WorkVine Simulation',
        status: 'mock',
        used_in: 'tasks_and_assignments',
      });
    } else if (signals.source_simulation_status === 'degraded') {
      sources.push({
        name: 'WorkVine Simulation',
        status: 'unavailable',
        used_in: 'tasks_and_assignments',
      });
    } else {
      sources.push({
        name: 'WorkVine Simulation',
        status: 'real',
        used_in: 'tasks_and_assignments',
      });
    }
  }

  // ── No real source at all → mock ─────────────────────────────────────
  // Signal: used_mock_data forced true OR source simulation was mock.
  if (signals.used_mock_data || signals.source_simulation_status === 'mock') {
    const mockSources = sources.map((s) => ({ ...s, status: 'mock' as const }));
    if (signals.source_simulation_status === 'mock') {
      notes.push(
        'Source simulation ran on mock data — agent tasks, assignments, and scope are derived from synthetic hydration.'
      );
    } else {
      notes.push(
        'Upstream hydration fell back to mock data — spec claims are not backed by real workforce signals.'
      );
    }
    notes.push(
      'Do not deploy this agent spec to production without re-running on real data.'
    );
    // Spread within the 0-25 band so additional degradation still moves the needle.
    const confidence = Math.max(0, 20 - Math.min(20, (signals.source_simulation_degraded_sources?.length ?? 0) * 2));
    return {
      status: 'mock',
      confidence,
      sources: mockSources,
      notes,
      computed_at,
    };
  }

  // ── Real signals on all three axes → real ────────────────────────────
  const simHealthy =
    !signals.from_simulation ||
    (signals.source_simulation_status === 'real' &&
      !signals.source_simulation_missing &&
      (signals.source_simulation_degraded_sources?.length ?? 0) === 0);

  const groundingHealthy =
    signals.hr_grounding_available &&
    signals.total_tasks > 0 &&
    coverage >= 0.8 &&
    labelCoverage >= 0.8;

  if (groundingHealthy && simHealthy) {
    return {
      status: 'real',
      confidence: 90,
      sources,
      notes,
      computed_at,
    };
  }

  // ── Otherwise → degraded ─────────────────────────────────────────────
  const reasons: string[] = [];
  if (!signals.hr_grounding_available) {
    reasons.push('HR ontology not loaded — tasks could not be grounded');
  } else if (signals.total_tasks === 0) {
    reasons.push('No tasks on spec — grounding coverage undefined');
  } else {
    if (coverage < 0.8) {
      reasons.push(
        `Only ${Math.round(coverage * 100)}% of tasks matched to the HR ontology (${signals.grounded_tasks}/${signals.total_tasks})`
      );
    }
    if (labelCoverage < 0.8 && labelCoverage < coverage) {
      reasons.push(
        `Risk labels present on only ${Math.round(labelCoverage * 100)}% of tasks — some matched processes lack label data`
      );
    }
  }
  if (signals.from_simulation) {
    if (signals.source_simulation_missing) {
      reasons.push('Source simulation row not found — cannot verify upstream data quality');
    } else if (signals.source_simulation_status === 'degraded') {
      const ds = signals.source_simulation_degraded_sources ?? [];
      reasons.push(
        ds.length > 0
          ? `Source simulation degraded (${ds.join(', ')})`
          : 'Source simulation is in a degraded state'
      );
    }
  }

  notes.push(
    reasons.length > 0
      ? `Partial data: ${reasons.join('; ')}.`
      : 'Partial data detected.'
  );

  // Penalty ladder — slide 75 → 50 as degradation compounds.
  let penalty = 0;
  if (!signals.hr_grounding_available) penalty += 15;
  if (signals.total_tasks === 0) penalty += 10;
  if (signals.total_tasks > 0 && coverage < 0.8) penalty += Math.min(10, Math.round((0.8 - coverage) * 20));
  if (signals.total_tasks > 0 && labelCoverage < 0.8 && labelCoverage < coverage) {
    penalty += Math.min(5, Math.round((0.8 - labelCoverage) * 10));
  }
  if (signals.source_simulation_missing) penalty += 10;
  if (signals.source_simulation_status === 'degraded') {
    penalty += Math.min(
      10,
      5 + (signals.source_simulation_degraded_sources?.length ?? 0) * 2
    );
  }
  const confidence = Math.max(50, 75 - Math.min(25, penalty));

  return {
    status: 'degraded',
    confidence,
    sources,
    notes,
    computed_at,
  };
}
