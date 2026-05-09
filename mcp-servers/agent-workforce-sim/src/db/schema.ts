import { getDatabase } from './database.js';

export function initializeSchema(): void {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS organization (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry_naics TEXT,
      headcount INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS department (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      parent_dept_id TEXT,
      headcount INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (org_id) REFERENCES organization(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_dept_id) REFERENCES department(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS team (
      id TEXT PRIMARY KEY,
      dept_id TEXT NOT NULL,
      name TEXT NOT NULL,
      manager_role_id TEXT,
      headcount INTEGER,
      change_readiness_score REAL,
      trust_score REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (dept_id) REFERENCES department(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_role (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      title TEXT NOT NULL,
      onet_soc_code TEXT NOT NULL,
      fte_count REAL NOT NULL,
      annual_cost_per_fte REAL,
      level TEXT,
      location TEXT,
      automation_potential REAL,
      worker_desire_avg REAL,
      aei_exposure_score REAL,
      felten_aioe_score REAL,
      human_edge_avg REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (team_id) REFERENCES team(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS role_task (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      onet_task_id INTEGER NOT NULL,
      task_statement TEXT NOT NULL,
      importance REAL,
      time_allocation REAL,
      ai_capability_score REAL,
      worker_desire_score REAL,
      human_agency_scale REAL,
      aei_penetration_rate REAL,
      aei_autonomy REAL,
      aei_collaboration_pattern TEXT,
      human_edge_stakeholder_trust REAL,
      human_edge_social_intelligence REAL,
      human_edge_creativity REAL,
      human_edge_ethics REAL,
      human_edge_physical_presence REAL,
      human_edge_judgment REAL,
      linked_skills_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (role_id) REFERENCES team_role(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS role_skill (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      skill_name TEXT NOT NULL,
      lightcast_skill_id TEXT,
      level REAL,
      importance REAL,
      trend REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (role_id) REFERENCES team_role(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_capability_snapshot (
      id TEXT PRIMARY KEY,
      snapshot_date TEXT NOT NULL,
      data_source TEXT NOT NULL,
      onet_task_id INTEGER NOT NULL,
      capability_score REAL,
      autonomy_level REAL,
      time_savings_pct REAL,
      collaboration_pattern TEXT,
      success_rate REAL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS maturation_curve_config (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      base_growth_rate_k REAL NOT NULL,
      ceiling_by_complexity TEXT NOT NULL,
      complexity_modifiers TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_complexity_profile (
      id TEXT PRIMARY KEY,
      onet_task_id INTEGER NOT NULL UNIQUE,
      cognitive_load REAL,
      judgment_required REAL,
      creativity_required REAL,
      interpersonal_req REAL,
      physical_req REAL,
      primary_complexity_type TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS simulation (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      time_horizon_months INTEGER NOT NULL,
      maturation_curve_id TEXT,
      monte_carlo_iterations INTEGER NOT NULL,
      cost_params TEXT NOT NULL,
      degraded_sources TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (org_id) REFERENCES organization(id) ON DELETE CASCADE,
      FOREIGN KEY (maturation_curve_id) REFERENCES maturation_curve_config(id)
    );

    CREATE TABLE IF NOT EXISTS simulation_scenario (
      id TEXT PRIMARY KEY,
      simulation_id TEXT NOT NULL,
      name TEXT NOT NULL,
      parameter_overrides TEXT NOT NULL,
      results TEXT NOT NULL,
      summary_metrics TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (simulation_id) REFERENCES simulation(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS simulation_role_result (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      current_fte REAL,
      projected_fte REAL,
      fte_trajectory TEXT,
      task_percent_human REAL,
      task_percent_agent REAL,
      task_percent_hybrid REAL,
      current_cost REAL,
      projected_cost REAL,
      trust_impact_score REAL,
      resistance_probability REAL,
      quadrant_distribution TEXT,
      bbbob_recommendations TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (scenario_id) REFERENCES simulation_scenario(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES team_role(id)
    );

    CREATE TABLE IF NOT EXISTS simulation_task_result (
      id TEXT PRIMARY KEY,
      role_result_id TEXT NOT NULL,
      role_task_id TEXT NOT NULL,
      assignment_t0 TEXT,
      assignment_t6 TEXT,
      assignment_t12 TEXT,
      assignment_t24 TEXT,
      capability_t0 REAL,
      capability_t6 REAL,
      capability_t12 REAL,
      capability_t24 REAL,
      cultural_quadrant TEXT,
      transition_risk REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (role_result_id) REFERENCES simulation_role_result(id) ON DELETE CASCADE,
      FOREIGN KEY (role_task_id) REFERENCES role_task(id)
    );

    CREATE TABLE IF NOT EXISTS simulation_transition_plan (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      phases TEXT NOT NULL,
      total_duration INTEGER,
      total_cost REAL,
      employees_affected INTEGER,
      risk_hotspots TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (scenario_id) REFERENCES simulation_scenario(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reskilling_path (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      employee_role_id TEXT,
      target_role_id TEXT,
      transition_probability REAL,
      skill_overlap_pct REAL,
      skill_gaps TEXT,
      development_plan TEXT,
      duration_months INTEGER,
      cost REAL,
      success_probability REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (scenario_id) REFERENCES simulation_scenario(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS run_record (
      run_id TEXT PRIMARY KEY,
      simulation_id TEXT NOT NULL,
      scenario_id TEXT NOT NULL,
      seed INTEGER NOT NULL,
      maturation_params TEXT NOT NULL,
      snapshot_ids TEXT NOT NULL,
      source_versions TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      output_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (simulation_id) REFERENCES simulation(id) ON DELETE CASCADE,
      FOREIGN KEY (scenario_id) REFERENCES simulation_scenario(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_department_org ON department(org_id);
    CREATE INDEX IF NOT EXISTS idx_team_dept ON team(dept_id);
    CREATE INDEX IF NOT EXISTS idx_team_role_team ON team_role(team_id);
    CREATE INDEX IF NOT EXISTS idx_team_role_soc ON team_role(onet_soc_code);
    CREATE INDEX IF NOT EXISTS idx_role_task_role ON role_task(role_id);
    CREATE INDEX IF NOT EXISTS idx_role_task_onet_task ON role_task(onet_task_id);
    CREATE INDEX IF NOT EXISTS idx_role_skill_role ON role_skill(role_id);
    CREATE INDEX IF NOT EXISTS idx_snapshot_task_date ON agent_capability_snapshot(onet_task_id, snapshot_date);
    CREATE INDEX IF NOT EXISTS idx_simulation_org ON simulation(org_id);
    CREATE INDEX IF NOT EXISTS idx_simulation_status ON simulation(status);
    CREATE INDEX IF NOT EXISTS idx_scenario_simulation ON simulation_scenario(simulation_id);
    CREATE INDEX IF NOT EXISTS idx_role_result_scenario ON simulation_role_result(scenario_id);
    CREATE INDEX IF NOT EXISTS idx_task_result_role_result ON simulation_task_result(role_result_id);
    CREATE INDEX IF NOT EXISTS idx_transition_scenario ON simulation_transition_plan(scenario_id);
    CREATE INDEX IF NOT EXISTS idx_reskilling_scenario ON reskilling_path(scenario_id);
    CREATE INDEX IF NOT EXISTS idx_run_record_simulation ON run_record(simulation_id);
    CREATE INDEX IF NOT EXISTS idx_run_record_contract ON run_record(simulation_id, scenario_id, input_hash, seed, snapshot_ids);
  `);

  // Safe migration — add tenant_id column (auth tenant, separate from org_id business domain)
  try {
    db.exec("ALTER TABLE organization ADD COLUMN tenant_id TEXT DEFAULT 'default'");
    db.exec("CREATE INDEX IF NOT EXISTS idx_organization_tenant ON organization(tenant_id)");
  } catch {} // Column already exists — ignore
  try {
    db.exec("ALTER TABLE simulation ADD COLUMN tenant_id TEXT DEFAULT 'default'");
    db.exec("CREATE INDEX IF NOT EXISTS idx_simulation_tenant ON simulation(tenant_id)");
  } catch {} // Column already exists — ignore
  try {
    db.exec("ALTER TABLE simulation_scenario ADD COLUMN tenant_id TEXT DEFAULT 'default'");
    db.exec("CREATE INDEX IF NOT EXISTS idx_simulation_scenario_tenant ON simulation_scenario(tenant_id)");
  } catch {} // Column already exists — ignore
  try {
    // Data Quality Passport: tracks whether hydration fell back to mock data.
    // 0 = real (or prefetched from orchestrator), 1 = mock fallback.
    db.exec("ALTER TABLE simulation ADD COLUMN used_mock_data INTEGER NOT NULL DEFAULT 0");
  } catch {} // Column already exists — ignore

  ensureDefaultMaturationCurves();
}

function ensureDefaultMaturationCurves(): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  const defaults = [
    { name: 'conservative', k: 0.08 },
    { name: 'moderate', k: 0.12 },
    { name: 'aggressive', k: 0.18 },
  ];

  const ceilingByComplexity = JSON.stringify({
    routine_cognitive: 95,
    complex_cognitive: 80,
    interpersonal: 45,
    physical: 30,
    creative: 60,
  });

  const complexityModifiers = JSON.stringify({
    cognitive_load: -0.2,
    judgment_required: -0.3,
    creativity_required: -0.35,
    interpersonal_req: -0.4,
    physical_req: -0.45,
  });

  const upsert = db.prepare(`
    INSERT INTO maturation_curve_config (
      id, name, base_growth_rate_k, ceiling_by_complexity, complexity_modifiers, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      base_growth_rate_k = excluded.base_growth_rate_k,
      ceiling_by_complexity = excluded.ceiling_by_complexity,
      complexity_modifiers = excluded.complexity_modifiers
  `);

  for (const preset of defaults) {
    upsert.run(`curve-${preset.name}`, preset.name, preset.k, ceilingByComplexity, complexityModifiers, now);
  }
}
