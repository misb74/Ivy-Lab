import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { assertableStages } from "./schema";
import type { GoldenCase } from "./schema";
import type {
  DecisionRecord,
  EvidencePacket,
  EvidenceRef,
  ReasoningTrace,
  ReqId,
  RoleId,
  SimulationId,
} from "../../src/contracts/index.js";
import { buildEvidencePacket } from "../../src/evidence-grammar/index.js";
import { buildReasoningTrace, draftDecisionRecord } from "../../src/orchestrator/index.js";
import { scan } from "../../src/scanner/index.js";
import { MockLLMAdapter } from "../../src/llm/index.js";

export type EvalPhase = "P0" | "P1" | "P2" | "P3" | "P4" | "P5";

export interface HarnessResult {
  phase: EvalPhase;
  casesLoaded: number;
  asserted: number;
  message: string;
}

const PHASES: readonly EvalPhase[] = ["P0", "P1", "P2", "P3", "P4", "P5"];

export function parsePhase(rawPhase = "P0"): EvalPhase {
  const normalizedPhase = rawPhase.startsWith("--phase=") ? rawPhase.slice("--phase=".length) : rawPhase;

  if (PHASES.includes(normalizedPhase as EvalPhase)) {
    return normalizedPhase as EvalPhase;
  }

  throw new Error(`Unsupported eval phase "${rawPhase}". Expected one of ${PHASES.join(", ")}.`);
}

export async function loadGoldenCases(casesDir = join(dirname(fileURLToPath(import.meta.url)), "cases")) {
  const caseFiles = readdirSync(casesDir)
    .filter((file) => file.endsWith(".ts"))
    .sort();

  const cases: GoldenCase[] = [];

  for (const file of caseFiles) {
    const moduleUrl = pathToFileURL(join(casesDir, file)).href;
    const caseModule = (await import(moduleUrl)) as { default?: GoldenCase };

    if (!caseModule.default) {
      throw new Error(`Golden case ${file} does not export a default GoldenCase.`);
    }

    cases.push(caseModule.default);
  }

  return cases;
}

export async function runGoldenHarness(rawPhase = "P0"): Promise<HarnessResult> {
  const phase = parsePhase(rawPhase);
  const cases = await loadGoldenCases();

  if (phase === "P0") {
    return {
      phase,
      casesLoaded: cases.length,
      asserted: 0,
      message: `Phase 0: ${cases.length} cases loaded, 0 asserted`,
    };
  }

  if (phase === "P1") {
    const case01 = cases.find((caseFile) => caseFile.id === "fin-analyst-full-coverage");
    const expected = case01?.expected.stage3_evidence_packet;

    if (!case01 || !expected) {
      throw new Error("Phase 1 expected case 01 stage3_evidence_packet to be present.");
    }

    const output = await buildEvidencePacket({
      tenant_id: case01.input.tenant_id,
      user_id: case01.input.user_id,
      role_title: case01.input.role_title,
      role_id: case01.input.role_id,
      req_id: case01.input.req_id,
      simulation_id: case01.input.simulation_id,
      purpose: "decision_support",
      source_mocks: case01.source_mocks,
      created_at: "2026-04-24T10:00:00Z",
    });

    const sourceSystems = new Set(output.source_evidence.map((source) => source.source_system));
    const missingSources = expected.required_sources.filter((source) => !sourceSystems.has(source));
    const coverageOk = output.packet.coverage_percent >= expected.coverage_percent_min
      && output.packet.coverage_percent <= expected.coverage_percent_max;
    const itemsOk = output.packet.items.length >= expected.items_min;
    const freshnessOk = expected.freshness !== "all_fresh"
      || output.source_evidence.every((source) => source.freshness === "fresh");

    if (!coverageOk || !itemsOk || missingSources.length > 0 || !freshnessOk) {
      throw new Error(
        [
          "case 01 stage3_evidence_packet failed",
          `coverage=${output.packet.coverage_percent}`,
          `items=${output.packet.items.length}`,
          `missing_sources=${missingSources.join(",") || "none"}`,
          `freshness_ok=${freshnessOk}`,
        ].join("; "),
      );
    }

    return {
      phase,
      casesLoaded: cases.length,
      asserted: 1,
      message: `Phase 1: ${cases.length} cases loaded, 1 asserted (case 01: stage3_evidence_packet PASS)`,
    };
  }

  if (phase === "P2") {
    return runPhase2(cases);
  }

  if (phase === "P3") {
    return runPhase3(cases);
  }

  const asserted = cases.reduce((count, caseFile) => {
    const stages = assertableStages(caseFile, phase);
    return count + (caseFile.phases_applicable.includes(phase) ? stages.length : 0);
  }, 0);

  return {
    phase,
    casesLoaded: cases.length,
    asserted,
    message: `Phase ${phase.slice(1)}: ${cases.length} cases loaded, ${asserted} stages would be asserted`,
  };
}

async function runPhase3(cases: GoldenCase[]): Promise<HarnessResult> {
  // Phase 3 exercises the Stage 3→6 golden path without live model calls:
  // evidence packet → reasoning trace → mocked draft DecisionRecord →
  // scanner aggregator → granted_mode.
  const fullCoverage = cases.filter((c) => c.category === "full-coverage");
  const lines: string[] = [];
  let asserted = 0;
  let failed = 0;

  for (const caseFile of fullCoverage) {
    const buildResult = await buildEvidencePacket({
      tenant_id: caseFile.input.tenant_id,
      user_id: caseFile.input.user_id,
      role_title: caseFile.input.role_title,
      role_id: caseFile.input.role_id,
      req_id: caseFile.input.req_id,
      simulation_id: caseFile.input.simulation_id,
      purpose: "decision_support",
      source_mocks: caseFile.source_mocks,
      created_at: "2026-04-25T10:00:00Z",
    });

    const trace = buildReasoningTrace(buildResult.packet, {
      decision_type: "req_decision",
      role_id: (caseFile.input.role_id ?? caseFile.input.role_title) as never,
      simulation_id: caseFile.input.simulation_id as never | undefined,
    });

    const expectedDecision = caseFile.expected.stage5_decision_record;
    const expectedValidation = caseFile.expected.stage6_validation;
    if (!expectedDecision || !expectedValidation) {
      continue;
    }

    const mockedDraft = buildGoldenDecisionRecord(caseFile, buildResult.packet, trace);
    const draftMock = new MockLLMAdapter([
      {
        match: /.*/s,
        response: {
          content: JSON.stringify(mockedDraft),
          parsed: mockedDraft,
        },
      },
    ]);

    const decisionRecord = await draftDecisionRecord({
      packet: buildResult.packet,
      trace,
      question: `What should we do for ${caseFile.input.role_title}?`,
      requested_mode: caseFile.input.requested_mode,
    }, {
      adapter: draftMock,
      max_retries: 0,
    });

    const recommended = decisionRecord.payload.type === "req_decision"
      ? decisionRecord.payload.decision
      : undefined;
    const stage5Failures = [
      recommended && expectedDecision.recommendation_one_of.includes(recommended)
        ? undefined
        : `recommendation=${recommended ?? "none"}`,
      decisionRecord.options.length >= expectedDecision.options_min &&
        decisionRecord.options.length <= expectedDecision.options_max
        ? undefined
        : `options=${decisionRecord.options.length}`,
      decisionRecord.risks.length >= expectedDecision.risks_min
        ? undefined
        : `risks=${decisionRecord.risks.length}`,
      decisionRecord.assumptions.length <= expectedDecision.assumptions_max
        ? undefined
        : `assumptions=${decisionRecord.assumptions.length}`,
    ].filter((failure): failure is string => failure !== undefined);

    const validation = scan(decisionRecord, {
      active_tenant_id: buildResult.packet.tenant_id,
      active_resource_scope: buildResult.packet.resource_scope,
      packets: [buildResult.packet],
      items: buildResult.packet.items,
      reasoning_trace: trace,
      assumptions: [],
    });

    const passCheckFailures = expectedValidation.expected_pass_checks
      .filter((check) => validation.checks[check].status !== "pass")
      .map((check) => `${check}=${validation.checks[check].status}`);
    const stage6Failures = [
      validation.overall === expectedValidation.overall
        ? undefined
        : `overall=${validation.overall}`,
      validation.granted_mode === expectedValidation.granted_mode
        ? undefined
        : `granted_mode=${validation.granted_mode}`,
      passCheckFailures.length === 0
        ? undefined
        : `checks=${passCheckFailures.join(",")}`,
    ].filter((failure): failure is string => failure !== undefined);

    if (stage5Failures.length === 0 && stage6Failures.length === 0) {
      asserted += 2;
      lines.push(
        `case ${caseFile.id}: stage5_decision_record PASS; stage6_validation PASS (granted_mode=${validation.granted_mode})`,
      );
    } else {
      failed += 1;
      lines.push(
        `case ${caseFile.id}: P3 FAIL (` +
          [
            stage5Failures.length > 0 ? `stage5 ${stage5Failures.join(",")}` : undefined,
            stage6Failures.length > 0 ? `stage6 ${stage6Failures.join(",")}` : undefined,
          ].filter(Boolean).join("; ") +
          ")",
      );
    }
  }

  if (failed > 0) {
    throw new Error(
      `Phase 3: ${failed} case(s) failed validation: ${lines.filter((l) => l.includes("FAIL")).join("; ")}`,
    );
  }

  return {
    phase: "P3",
    casesLoaded: cases.length,
    asserted,
    message: `Phase 3: ${cases.length} cases loaded, ${asserted} asserted (${lines.join("; ")})`,
  };
}

type ReqDecision = Extract<DecisionRecord["payload"], { type: "req_decision" }>["decision"];

function buildGoldenDecisionRecord(
  caseFile: GoldenCase,
  packet: EvidencePacket,
  trace: ReasoningTrace,
): DecisionRecord {
  const expectedDecision = caseFile.expected.stage5_decision_record;
  if (!expectedDecision) {
    throw new Error(`case ${caseFile.id} lacks stage5_decision_record expectations`);
  }

  const decision = recommendedDecision(trace, expectedDecision.recommendation_one_of);
  const evidenceRef = fullPacketEvidenceRef(packet);
  const sim = caseFile.input.simulation_summary;
  const horizonMonths = sim?.horizon_months ?? 24;
  const fteDelta = sim ? sim.projected_fte - sim.current_fte : undefined;

  return {
    schema_version: "1.1.0",
    id: trace.target_id as DecisionRecord["id"],
    tenant_id: packet.tenant_id,
    resource_scope: packet.resource_scope,
    question: `What should we do for ${caseFile.input.role_title}?`,
    recommendation: `${capitalize(decision)} for ${caseFile.input.role_title} based on the cited role, market, automation, and simulation evidence.`,
    rationale: `The reasoning trace supports ${decision} using ${packet.items.length} cited evidence items across fresh source systems.`,
    payload: {
      type: "req_decision",
      decision,
      req_id: caseFile.input.req_id as ReqId | undefined,
      role_id: caseFile.input.role_id as RoleId | undefined,
      simulation_id: caseFile.input.simulation_id as SimulationId | undefined,
      economics_summary: {
        savings_or_delta: sim?.projected_cost_delta_usd,
        fte_delta: fteDelta,
        horizon_months: horizonMonths,
        currency: "usd",
      },
      evidence_refs: [evidenceRef],
    },
    options: [
      optionFor(decision, "Recommended path", horizonMonths, fteDelta, [evidenceRef]),
      optionFor("hire", "Increase staffing capacity", horizonMonths, sim ? Math.max(1, sim.projected_fte - sim.current_fte) : 1, [evidenceRef]),
      optionFor("blend", "Combine targeted hiring with automation", horizonMonths, fteDelta, [evidenceRef]),
    ],
    risks: [
      {
        description: "Source coverage may miss local market variance.",
        likelihood: "medium",
        impact: "medium",
        mitigation: "Review local compensation and demand signals before approval.",
        evidence_refs: [evidenceRef],
      },
      {
        description: "Automation potential may vary by team workflow.",
        likelihood: "medium",
        impact: "high",
        mitigation: "Validate the automation assumptions with the role owner.",
        evidence_refs: [evidenceRef],
      },
      {
        description: "Hiring timing could change projected capacity needs.",
        likelihood: "low",
        impact: "medium",
        mitigation: "Refresh the WRS simulation before final export.",
        evidence_refs: [evidenceRef],
      },
    ],
    assumptions: [],
    what_would_change_answer: [
      "A material change in automation potential.",
      "A refreshed simulation with different projected FTE demand.",
    ],
    evidence_packet_id: packet.id,
    reasoning_trace_id: trace.id,
    requested_mode: caseFile.input.requested_mode,
    status: "draft",
    human_overrides: [],
    created_at: packet.created_at,
    created_by: packet.created_by,
  };
}

function fullPacketEvidenceRef(packet: EvidencePacket): EvidenceRef {
  if (packet.items.length === 0) {
    throw new Error(`packet ${String(packet.id)} has no items to cite`);
  }
  return {
    packet_id: packet.id,
    item_ids: packet.items.map((item) => item.id),
    support_type: "direct",
  };
}

function recommendedDecision(
  trace: ReasoningTrace,
  allowed: ReqDecision[],
): ReqDecision {
  const judgment = trace.steps.find((step) => step.operation === "model_judgment");
  const value = judgment?.output_value;
  if (value?.kind === "enum" && allowed.includes(value.value as ReqDecision)) {
    return value.value as ReqDecision;
  }
  return allowed[0];
}

function optionFor(
  decision: ReqDecision,
  description: string,
  horizonMonths: number,
  fteDelta: number | undefined,
  evidenceRefs: EvidenceRef[],
): DecisionRecord["options"][number] {
  return {
    name: decision,
    description,
    pros: [`${description} is supported by the cited evidence packet.`],
    cons: ["Requires review if the simulation or source freshness changes."],
    economics: {
      fte_delta: fteDelta,
      horizon_months: horizonMonths,
      currency: "usd",
    },
    evidence_refs: evidenceRefs,
  };
}

function capitalize(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

async function runPhase2(cases: GoldenCase[]): Promise<HarnessResult> {
  // Phase 2 asserts stage4_reasoning_trace shape on full-coverage cases
  // (cases 01 and 04). Cases 02 (partial-coverage) and 03 (failure) do
  // not have authoritative trace expectations; they assert later phases.
  const fullCoverage = cases.filter((c) => c.category === "full-coverage");
  const lines: string[] = [];
  let asserted = 0;
  let failed = 0;

  for (const caseFile of fullCoverage) {
    const expectedTrace = caseFile.expected.stage4_reasoning_trace;
    if (!expectedTrace) continue;

    // Build the packet first (Phase 1 path).
    const buildResult = await buildEvidencePacket({
      tenant_id: caseFile.input.tenant_id,
      user_id: caseFile.input.user_id,
      role_title: caseFile.input.role_title,
      role_id: caseFile.input.role_id,
      req_id: caseFile.input.req_id,
      simulation_id: caseFile.input.simulation_id,
      purpose: "decision_support",
      source_mocks: caseFile.source_mocks,
      created_at: "2026-04-25T10:00:00Z",
    });

    // Build the trace from the packet.
    const trace = buildReasoningTrace(
      buildResult.packet,
      {
        decision_type: "req_decision",
        role_id: (caseFile.input.role_id ?? caseFile.input.role_title) as never,
        simulation_id: caseFile.input.simulation_id as never | undefined,
      },
    );

    const stepCount = trace.steps.length;
    const modelJudgmentCount = trace.steps.filter((s) => s.operation === "model_judgment").length;
    const operations = new Set(trace.steps.map((s) => s.operation));
    const requiredOps = expectedTrace.required_operations ?? [];
    const missingOps = requiredOps.filter((op) => !operations.has(op as never));

    const stepsOk = stepCount >= expectedTrace.min_steps && stepCount <= expectedTrace.max_steps;
    const judgmentOk = modelJudgmentCount <= expectedTrace.max_model_judgment_steps;
    const opsOk = missingOps.length === 0;

    if (stepsOk && judgmentOk && opsOk) {
      asserted += 1;
      lines.push(`case ${caseFile.id}: stage4_reasoning_trace PASS`);
    } else {
      failed += 1;
      lines.push(
        `case ${caseFile.id}: stage4_reasoning_trace FAIL (steps=${stepCount} bounds=${expectedTrace.min_steps}-${expectedTrace.max_steps}; model_judgment=${modelJudgmentCount} max=${expectedTrace.max_model_judgment_steps}; missing=${missingOps.join(",") || "none"})`,
      );
    }
  }

  if (failed > 0) {
    throw new Error(
      `Phase 2: ${failed} stage assertion(s) failed: ${lines.filter((l) => l.includes("FAIL")).join("; ")}`,
    );
  }

  return {
    phase: "P2",
    casesLoaded: cases.length,
    asserted,
    message: `Phase 2: ${cases.length} cases loaded, ${asserted} asserted (${lines.join("; ")})`,
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  const result = await runGoldenHarness(process.argv[2]);
  console.log(result.message);
}
