import { getDb, getWorksimDb } from '../db/database.js';
import { isGroundingAvailable, matchTasksBatch, type GroundingMatch } from './hr-grounding-match.js';
import { lookupToolsForDomains } from './hr-grounding-tool-map.js';
import type { ProcessLabels } from './hr-grounding-rules.js';

export interface SimulationExtraction {
  simulation_name: string;
  scenario_name: string;
  org_name: string;
  tasks: ExtractedTask[];
  guardrails: ExtractedGuardrail[];
  success_criteria: ExtractedCriterion[];
  suggested_tools: SuggestedTool[];
  summary: {
    total_roles: number;
    agent_eligible_roles: number;
    total_tasks: number;
    agent_tasks: number;
    hybrid_tasks: number;
    projected_fte_savings: number;
    projected_cost_savings: number;
  };
}

export interface ExtractedTask {
  task_description: string;
  source_role: string;
  source_task_id: string;
  automation_score: number;
  assignment: 'agent' | 'hybrid' | 'human';
  capability_at_t24: number;
  // HR grounding provenance
  grounding_process_id?: string;
  grounding_confidence?: number;
  grounding_source?: 'hr_ontology' | 'ungrounded';
  grounding_labels?: ProcessLabels;
  grounding_l2_domain?: string;
  grounding_l3_subdomain?: string;
  grounding_l4_process?: string;
}

export interface ExtractedGuardrail {
  guardrail_type: 'input' | 'output' | 'escalation' | 'constraint';
  condition: string;
  action: string;
  priority: number;
}

export interface ExtractedCriterion {
  metric_name: string;
  target_value: string;
  measurement_method: string;
}

export interface SuggestedTool {
  tool_name: string;
  server_name: string;
  description: string;
  reason: string;
}

/**
 * Extract agent-worthy data from a completed WorkVine simulation.
 * Opens worksim.db read-only. Does not modify any data.
 */
export function extractFromSimulation(
  simulationId: string,
  scenarioId: string,
  automationThreshold: number = 0.7,
): SimulationExtraction {
  const wsDb = getWorksimDb();

  try {
    // Get simulation metadata
    const sim = wsDb.prepare('SELECT * FROM simulation WHERE id = ?').get(simulationId) as any;
    if (!sim) throw new Error(`Simulation "${simulationId}" not found in worksim.db`);

    const scenario = wsDb.prepare('SELECT * FROM simulation_scenario WHERE id = ?').get(scenarioId) as any;
    if (!scenario) throw new Error(`Scenario "${scenarioId}" not found`);

    const org = wsDb.prepare('SELECT * FROM organization WHERE id = ?').get(sim.org_id) as any;

    // Get role results for this scenario
    const roleResults = wsDb.prepare(`
      SELECT rr.*, tr.title AS role_title, tr.onet_soc_code, tr.fte_count AS original_fte,
             tr.automation_potential, tr.human_edge_avg
      FROM simulation_role_result rr
      JOIN team_role tr ON tr.id = rr.role_id
      WHERE rr.scenario_id = ?
    `).all(scenarioId) as any[];

    const tasks: ExtractedTask[] = [];
    const guardrailSet = new Map<string, ExtractedGuardrail>();
    let totalTasks = 0;
    let agentTasks = 0;
    let hybridTasks = 0;
    let agentEligibleRoles = 0;
    let totalFteSavings = 0;
    let totalCostSavings = 0;

    for (const rr of roleResults) {
      const roleHasAgentTasks = rr.task_percent_agent > 0;
      if (roleHasAgentTasks) agentEligibleRoles++;

      totalFteSavings += (rr.current_fte || 0) - (rr.projected_fte || 0);
      totalCostSavings += (rr.current_cost || 0) - (rr.projected_cost || 0);

      // Get task-level results
      const taskResults = wsDb.prepare(`
        SELECT tr.*, rt.task_statement, rt.ai_capability_score, rt.worker_desire_score,
               rt.human_edge_stakeholder_trust, rt.human_edge_social_intelligence,
               rt.human_edge_creativity, rt.human_edge_ethics, rt.human_edge_judgment,
               rt.human_edge_physical_presence
        FROM simulation_task_result tr
        JOIN role_task rt ON rt.id = tr.role_task_id
        WHERE tr.role_result_id = ?
      `).all(rr.id) as any[];

      for (const task of taskResults) {
        totalTasks++;
        const finalAssignment = task.assignment_t24 || task.assignment_t12 || task.assignment_t0;
        const capScore = task.ai_capability_score || 0;
        const cap24 = task.capability_t24 || capScore;

        if (finalAssignment === 'agent' && capScore >= automationThreshold) {
          agentTasks++;
          tasks.push({
            task_description: task.task_statement,
            source_role: rr.role_title,
            source_task_id: task.role_task_id,
            automation_score: capScore,
            assignment: 'agent',
            capability_at_t24: cap24,
          });
        } else if (finalAssignment === 'hybrid' || (finalAssignment === 'agent' && capScore < automationThreshold)) {
          hybridTasks++;
          tasks.push({
            task_description: task.task_statement,
            source_role: rr.role_title,
            source_task_id: task.role_task_id,
            automation_score: capScore,
            assignment: 'hybrid',
            capability_at_t24: cap24,
          });
        }

        // Auto-generate guardrails from human edge scores (0-1 scale in DB)
        const ethicsScore = task.human_edge_ethics || 0;
        const judgmentScore = task.human_edge_judgment || 0;
        const socialScore = task.human_edge_social_intelligence || 0;
        const trustScore = task.human_edge_stakeholder_trust || 0;

        if (ethicsScore > 0.6) {
          const key = `ethics_${rr.role_title}`;
          if (!guardrailSet.has(key)) {
            guardrailSet.set(key, {
              guardrail_type: 'escalation',
              condition: `Task involves ethical judgment (score: ${(ethicsScore * 100).toFixed(0)}%) for role "${rr.role_title}"`,
              action: 'Escalate to human reviewer before executing. Flag for compliance review.',
              priority: 9,
            });
          }
        }

        if (judgmentScore > 0.6) {
          const key = `judgment_${rr.role_title}`;
          if (!guardrailSet.has(key)) {
            guardrailSet.set(key, {
              guardrail_type: 'escalation',
              condition: `Task requires high judgment (score: ${(judgmentScore * 100).toFixed(0)}%) for role "${rr.role_title}"`,
              action: 'Require human approval for decisions exceeding defined thresholds.',
              priority: 8,
            });
          }
        }

        if (socialScore > 0.6 || trustScore > 0.6) {
          const key = `social_${rr.role_title}`;
          if (!guardrailSet.has(key)) {
            guardrailSet.set(key, {
              guardrail_type: 'constraint',
              condition: `Task involves stakeholder interaction (social: ${(socialScore * 100).toFixed(0)}%, trust: ${(trustScore * 100).toFixed(0)}%) for role "${rr.role_title}"`,
              action: 'Agent drafts communication; human reviews and sends. No direct stakeholder contact.',
              priority: 7,
            });
          }
        }
      }

      // High resistance roles get human-in-the-loop (resistance_probability is 0-100 in DB)
      if ((rr.resistance_probability || 0) > 30) {
        const key = `resistance_${rr.role_title}`;
        if (!guardrailSet.has(key)) {
          guardrailSet.set(key, {
            guardrail_type: 'constraint',
            condition: `High change resistance (${(rr.resistance_probability || 0).toFixed(0)}%) for role "${rr.role_title}"`,
            action: 'Implement gradual rollout with human oversight. Weekly check-ins with affected team members.',
            priority: 6,
          });
        }
      }
    }

    // ── HR Grounding Pass ──
    const abDb = getDb();
    const groundingActive = isGroundingAvailable(abDb);
    if (groundingActive) {
      const matches = matchTasksBatch(abDb, tasks);
      for (const task of tasks) {
        const taskMatches = matches.get(task.task_description);
        if (taskMatches && taskMatches.length > 0) {
          const best = taskMatches[0];
          task.grounding_process_id = best.process_id;
          task.grounding_confidence = best.confidence;
          task.grounding_source = 'hr_ontology';
          task.grounding_labels = best.labels;
          task.grounding_l2_domain = best.l2_domain;
          task.grounding_l3_subdomain = best.l3_subdomain;
          task.grounding_l4_process = best.l4_process;
        } else {
          task.grounding_source = 'ungrounded';
        }
      }

      // Grounding-based guardrails (additive to human-edge-score guardrails)
      for (const task of tasks) {
        if (!task.grounding_labels) continue;
        const labels = task.grounding_labels;

        if (labels.risk_tags.includes('financial')) {
          const key = `financial_grounded_${task.grounding_l2_domain}`;
          if (!guardrailSet.has(key)) {
            guardrailSet.set(key, {
              guardrail_type: 'constraint',
              condition: `Task involves financial data (${task.grounding_l2_domain})`,
              action: 'Require dual approval for any monetary changes. Log all financial calculations with audit trail.',
              priority: 9,
            });
          }
        }

        if (labels.risk_tags.includes('pii') || labels.data_sensitivity === 'high') {
          const key = `pii_grounded_${task.grounding_l2_domain}`;
          if (!guardrailSet.has(key)) {
            guardrailSet.set(key, {
              guardrail_type: 'input',
              condition: `Task processes sensitive personal data (${task.grounding_l2_domain})`,
              action: 'Mask PII in logs. Encrypt data at rest. Limit data retention to minimum necessary.',
              priority: 9,
            });
          }
        }

        if (labels.judgment_risk === 'high') {
          const key = `judgment_grounded_${task.grounding_l3_subdomain}`;
          if (!guardrailSet.has(key)) {
            guardrailSet.set(key, {
              guardrail_type: 'escalation',
              condition: `High-judgment HR process: ${task.grounding_l3_subdomain}`,
              action: 'Escalate to senior HR reviewer. Agent provides recommendation but does not execute.',
              priority: 9,
            });
          }
        }

        if (labels.risk_tags.includes('legal')) {
          const key = `legal_grounded_${task.grounding_l2_domain}`;
          if (!guardrailSet.has(key)) {
            guardrailSet.set(key, {
              guardrail_type: 'escalation',
              condition: `Task touches legal/regulatory domain (${task.grounding_l2_domain})`,
              action: 'Flag for legal review. Do not proceed with employment-impacting actions without HR sign-off.',
              priority: 10,
            });
          }
        }
      }
    }

    // Always add baseline guardrails
    guardrailSet.set('baseline_input', {
      guardrail_type: 'input',
      condition: 'All incoming data and requests',
      action: 'Validate input format and check for PII/sensitive data before processing.',
      priority: 10,
    });
    guardrailSet.set('baseline_output', {
      guardrail_type: 'output',
      condition: 'All agent outputs and decisions',
      action: 'Log all decisions with reasoning. Ensure outputs are auditable and traceable.',
      priority: 10,
    });

    // Suggest tools: grounding-based first, regex fallback for ungrounded
    const suggestedTools = inferTools(tasks, abDb, groundingActive);

    // Generate success criteria from simulation metrics
    const criteria: ExtractedCriterion[] = [
      {
        metric_name: 'Tasks Automated',
        target_value: `${agentTasks} tasks fully automated`,
        measurement_method: 'Count of tasks running without human intervention for 30+ days',
      },
      {
        metric_name: 'FTE Savings',
        target_value: `${totalFteSavings.toFixed(1)} FTE reduction`,
        measurement_method: 'Compare actual headcount allocation vs. pre-deployment baseline',
      },
    ];

    if (totalCostSavings > 0) {
      criteria.push({
        metric_name: 'Cost Savings',
        target_value: `$${(totalCostSavings / 1000).toFixed(0)}K annual savings`,
        measurement_method: 'Compare actual labor costs vs. simulation projections quarterly',
      });
    }

    return {
      simulation_name: sim.name,
      scenario_name: scenario.name,
      org_name: org?.name || 'Unknown',
      tasks,
      guardrails: Array.from(guardrailSet.values()),
      success_criteria: criteria,
      suggested_tools: suggestedTools,
      summary: {
        total_roles: roleResults.length,
        agent_eligible_roles: agentEligibleRoles,
        total_tasks: totalTasks,
        agent_tasks: agentTasks,
        hybrid_tasks: hybridTasks,
        projected_fte_savings: Math.round(totalFteSavings * 10) / 10,
        projected_cost_savings: Math.round(totalCostSavings),
      },
    };
  } finally {
    wsDb.close();
  }
}

/**
 * Infer MCP tools: grounding-based first, regex fallback for ungrounded tasks.
 */
function inferTools(
  tasks: ExtractedTask[],
  abDb: import('better-sqlite3').Database,
  groundingActive: boolean,
): SuggestedTool[] {
  const tools: SuggestedTool[] = [];
  const added = new Set<string>();

  // Stage 1: Grounding-based tool inference
  if (groundingActive) {
    const domains = new Set<string>();
    const subdomains = new Map<string, Set<string>>();

    for (const t of tasks) {
      if (t.grounding_l2_domain) {
        domains.add(t.grounding_l2_domain);
        if (t.grounding_l3_subdomain) {
          if (!subdomains.has(t.grounding_l2_domain)) {
            subdomains.set(t.grounding_l2_domain, new Set());
          }
          subdomains.get(t.grounding_l2_domain)!.add(t.grounding_l3_subdomain);
        }
      }
    }

    if (domains.size > 0) {
      const groundedTools = lookupToolsForDomains(abDb, domains, subdomains);
      for (const tool of groundedTools) {
        if (!added.has(tool.tool_name)) {
          tools.push({
            tool_name: tool.tool_name,
            server_name: tool.server_name,
            description: tool.description,
            reason: tool.reason,
          });
          added.add(tool.tool_name);
        }
      }
    }
  }

  // Stage 2: Regex fallback for ungrounded tasks
  const ungroundedTasks = tasks.filter(t => t.grounding_source !== 'hr_ontology');
  if (ungroundedTasks.length > 0 || !groundingActive) {
    const fallbackTasks = groundingActive ? ungroundedTasks : tasks;
    const regexTools = inferToolsFromRegex(fallbackTasks);
    for (const tool of regexTools) {
      if (!added.has(tool.tool_name)) {
        tools.push(tool);
        added.add(tool.tool_name);
      }
    }
  }

  return tools;
}

function inferToolsFromRegex(tasks: ExtractedTask[]): SuggestedTool[] {
  const tools: SuggestedTool[] = [];
  const added = new Set<string>();
  const taskText = tasks.map(t => t.task_description.toLowerCase()).join(' ');

  const toolPatterns: Array<{ pattern: RegExp; tool: SuggestedTool }> = [
    { pattern: /data|analys|report|statistic|metric/, tool: { tool_name: 'multi_search', server_name: 'agent-multi-search', description: 'Federated cross-source data search', reason: 'Tasks involve data analysis and reporting' } },
    { pattern: /skill|competenc|capability|training|upskill|reskill/, tool: { tool_name: 'get_skills_for_occupation', server_name: 'hr-skills', description: 'Retrieve skills taxonomy for occupations', reason: 'Tasks involve skills assessment or training' } },
    { pattern: /role|job|position|hire|recruit|candidate/, tool: { tool_name: 'get_role_details', server_name: 'hr-roles', description: 'Retrieve role requirements and details', reason: 'Tasks involve role management or hiring' } },
    { pattern: /automat|ai capab|machine|model/, tool: { tool_name: 'assess_automation_potential', server_name: 'hr-automation', description: 'Assess task automation potential', reason: 'Tasks involve automation assessment' } },
    { pattern: /wage|salary|compensation|pay|cost/, tool: { tool_name: 'get_occupation_wages', server_name: 'data-bls', description: 'Bureau of Labor Statistics wage data', reason: 'Tasks involve compensation or cost analysis' } },
    { pattern: /market|demand|supply|trend|forecast/, tool: { tool_name: 'get_occupation_outlook', server_name: 'data-bls', description: 'Labor market outlook data', reason: 'Tasks involve market or trend analysis' } },
    { pattern: /complian|regulat|policy|audit|legal/, tool: { tool_name: 'check_compliance', server_name: 'hr-compliance', description: 'Compliance and regulatory checks', reason: 'Tasks involve compliance or policy' } },
    { pattern: /email|notify|send|communicat|message/, tool: { tool_name: 'send_email', server_name: 'agent-email', description: 'Email communication', reason: 'Tasks involve communication or notifications' } },
    { pattern: /document|write|draft|summar|brief/, tool: { tool_name: 'render_mermaid', server_name: 'doc-generator', description: 'Generate diagrams and charts', reason: 'Tasks involve document generation' } },
    { pattern: /research|investigat|deep dive|explor/, tool: { tool_name: 'deep_research_create', server_name: 'agent-deep-research', description: 'Deep multi-source research', reason: 'Tasks involve research or investigation' } },
  ];

  for (const { pattern, tool } of toolPatterns) {
    if (pattern.test(taskText) && !added.has(tool.tool_name)) {
      tools.push(tool);
      added.add(tool.tool_name);
    }
  }
  return tools;
}
