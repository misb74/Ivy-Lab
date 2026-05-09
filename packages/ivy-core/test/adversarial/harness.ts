import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  checkReference,
  checkScope,
  checkStructural,
  checkSemantic,
  checkConsistency,
  checkPlausibility,
  checkSemanticWithJudge,
} from "../../src/scanner/index.js";
import { MockLLMAdapter } from "../../src/llm/index.js";
import type { AdversarialCase } from "./schema";

export interface AdversarialResult {
  casesLoaded: number;
  detected: number;
  failed: string[]; // case ids that were NOT detected
  perCase: Array<{
    id: string;
    target_check: string;
    expected: string[];
    got: string[];
    detected: boolean;
  }>;
  message: string;
}

export async function loadAdversarialCases(
  casesDir = join(dirname(fileURLToPath(import.meta.url)), "cases"),
): Promise<AdversarialCase[]> {
  const files = readdirSync(casesDir)
    .filter((f) => f.endsWith(".ts"))
    .sort();

  const cases: AdversarialCase[] = [];
  for (const file of files) {
    const url = pathToFileURL(join(casesDir, file)).href;
    const mod = (await import(url)) as { default?: AdversarialCase };
    if (!mod.default) {
      throw new Error(`Adversarial case ${file} does not export default.`);
    }
    cases.push(mod.default);
  }
  return cases;
}

export async function runAdversarialHarness(): Promise<AdversarialResult> {
  const cases = await loadAdversarialCases();
  const perCase: AdversarialResult["perCase"] = [];
  const failed: string[] = [];
  let detected = 0;

  for (const c of cases) {
    const result = await runCase(c);
    perCase.push(result);
    if (result.detected) detected += 1;
    else failed.push(c.id);
  }

  const message = failed.length === 0
    ? `Adversarial: ${cases.length} cases loaded, ${detected} detected`
    : `Adversarial: ${cases.length} cases loaded, ${detected} detected — ${failed.length} NOT DETECTED: ${failed.join(", ")}`;

  return {
    casesLoaded: cases.length,
    detected,
    failed,
    perCase,
    message,
  };
}

async function runCase(c: AdversarialCase): Promise<AdversarialResult["perCase"][number]> {
  const expected = c.expected.expected_fail_codes;
  const target = c.target_check;
  let got: string[] = [];

  try {
    const checkResult = await invokeCheck(c);
    got = extractCodes(checkResult.details);
  } catch (err) {
    got = [`THREW: ${err instanceof Error ? err.message : String(err)}`];
  }

  // Detected = scanner emitted at least one of the expected fail codes
  const detected = expected.some((code) => got.includes(code));

  return {
    id: c.id,
    target_check: String(target),
    expected,
    got,
    detected,
  };
}

interface CheckLikeResult {
  status: string;
  error_count: number;
  details: string[];
}

async function invokeCheck(c: AdversarialCase): Promise<CheckLikeResult> {
  const target = c.target_check;
  const ctx = c.input.context as Record<string, unknown>;
  const artifact = c.input.artifact_under_test as Record<string, unknown>;

  if (target === "structural") {
    return checkStructural(artifact);
  }

  if (target === "reference") {
    // For reference: artifact is a DecisionRecord-shaped object; context
    // provides the cited packets and assumptions.
    const rawPackets = (ctx.packets as Array<Record<string, unknown>>) ?? [];
    const assumptions = (ctx.assumptions as never[]) ?? [];
    // Adversarial cases may carry packets with minimal shape; ensure all
    // packets have at least an empty items array so the reference check's
    // packet lookup doesn't throw.
    const packets = rawPackets.map((p) => ({
      items: [],
      resource_scope: { data_classification: "tenant_internal" },
      ...p,
    })) as never[];
    // Synthesize a packet from minimal context if the case provides it inline
    if (packets.length === 0 && ctx.packet_id) {
      const status = (ctx.packet_status as string) ?? "current";
      const synth = {
        id: ctx.packet_id,
        tenant_id: c.input.tenant_id,
        status,
        items: [],
        resource_scope: { data_classification: "tenant_internal" },
      } as never;
      packets.push(synth);
    }
    return checkReference(artifact as never, packets, assumptions);
  }

  if (target === "scope") {
    const activeScope = ctx.active_tenant_scope as Record<string, unknown>;
    const citedMeta = ctx.cited_packet_metadata as Record<string, unknown>;
    const packets = [
      {
        id: citedMeta.id,
        tenant_id: citedMeta.tenant_id,
        status: "current",
        items: [],
        resource_scope: {
          company_id: citedMeta.company_id,
          data_classification: "tenant_internal",
        },
      } as never,
    ];
    return checkScope(
      artifact as never,
      {
        tenant_id: activeScope.tenant_id as never,
        resource_scope: activeScope.resource_scope as never,
      },
      packets,
    );
  }

  if (target === "semantic.replay") {
    // A04 case provides the step under inspection + cited items
    const step = artifact as never;
    const citedItems = (ctx.cited_items as never[]) ?? [];
    // Build a minimal trace wrapping the single step
    const trace = {
      schema_version: "1.1.0",
      id: "rt_adversarial",
      target_type: "decision",
      target_id: "dr_adversarial",
      steps: [step],
      final_confidence: 0.5,
      final_claim_confidence: "low",
      contains_model_judgment: false,
    } as never;
    return checkSemantic(trace, citedItems);
  }

  if (target === "semantic") {
    // Phase 3 sub-checks: plausibility, cross-source consistency, and
    // LLM-judge. Dispatch by adversarial id since the cases carry
    // different shapes.
    if (c.id === "plausibility-wage-out-of-bounds") {
      const packet = artifact as { items: never[] };
      const baseline = ctx.plausibility_baseline as never;
      return checkPlausibility(packet.items, baseline);
    }
    if (c.id === "cross-source-wage-contradiction") {
      const packet = artifact as { items: never[] };
      const sameFactPatterns = ctx.same_fact_patterns as string[] | undefined;
      const result = checkConsistency(packet.items, {
        same_fact_patterns: sameFactPatterns,
      });
      // checkConsistency returns CheckResult & { contradictions: ... };
      // strip the contradictions field for harness comparability.
      return { status: result.status, error_count: result.error_count, details: result.details };
    }
    if (c.id === "llm-judge-unsupported-prose-claim") {
      // Build a minimal trace with one model_judgment step plus the
      // claim's cited items, then invoke the judge with a mock that
      // returns "unsupported" on fabrication-pattern inputs.
      const claimTextRaw = (artifact as { claim_text?: unknown }).claim_text;
      const claimText = typeof claimTextRaw === "string" ? claimTextRaw : "";
      const citedItemsRaw = (artifact as { cited_items?: unknown[] }).cited_items ?? [];
      const items = citedItemsRaw.map((it) => {
        const item = it as Record<string, unknown>;
        return {
          schema_version: "1.1.0",
          id: item.id,
          packet_id: "evpkt_a08",
          source_passport_id: "pass_a08",
          field_path: item.field_path,
          value: item.value,
          confidence: 0.9,
          is_normalized: false,
        };
      }) as never[];
      const trace = {
        schema_version: "1.1.0",
        id: "rt_adversarial_a08",
        target_type: "decision",
        target_id: "dr_adversarial_a08",
        steps: [
          {
            index: 0,
            operation: "model_judgment",
            inputs: [
              {
                packet_id: "evpkt_a08",
                item_ids: items.map((i: never) => (i as { id: string }).id) as never,
                support_type: "direct",
              },
            ],
            parameters: {},
            output_value: { kind: "text", value: claimText },
            output_summary: claimText,
            confidence: 0.5,
          },
        ],
        final_confidence: 0.5,
        final_claim_confidence: "low",
        contains_model_judgment: true,
      } as never;

      // Mock judge: any prompt containing "22%" or "attrition" → unsupported
      const mock = new MockLLMAdapter([
        {
          match: /attrition|22%/i,
          response: {
            content: JSON.stringify({
              verdict: "unsupported",
              rationale: "Cited Lightcast skill demand and BLS wage items contain no attrition data.",
              items_used: [],
              items_needed_but_missing: ["attrition rate", "industry attrition baseline"],
            }),
          },
        },
      ]);
      const judgeResult = await checkSemanticWithJudge(trace, items, {
        judge_options: { adapter: mock },
      });
      return {
        status: judgeResult.status,
        error_count: judgeResult.error_count,
        details: judgeResult.details,
      };
    }
    throw new Error(`Unknown semantic adversarial id: ${c.id}`);
  }

  throw new Error(`Unknown adversarial target_check: ${String(target)}`);
}

function extractCodes(details: string[]): string[] {
  const codes = new Set<string>();
  for (const d of details) {
    const match = d.match(/^([A-Z][A-Z0-9_]+):/);
    if (match) codes.add(match[1]);
  }
  return Array.from(codes);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  const result = await runAdversarialHarness();
  console.log(result.message);
  if (result.failed.length > 0) {
    for (const c of result.perCase.filter((c) => !c.detected)) {
      console.error(`  - ${c.id}: expected one of [${c.expected.join(", ")}], got [${c.got.join(", ")}]`);
    }
    process.exit(1);
  }
}
