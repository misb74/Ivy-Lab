import type { EvidenceValue } from "../../contracts/index.js";
import {
  asNumber,
  fail,
  requireKind,
  requireNonEmpty,
  requireParam,
  requireSharedUnit,
} from "./_util.js";
import type { ReasoningOperationImpl } from "./types.js";

/**
 * `aggregate_by_group` — reduce numeric inputs grouped by labels.
 *
 * Spec §4.1: number[] + parameters.groups[] → number[] keyed by group.
 * `parameters.groups` is a string[] of length === inputs.length assigning
 * each input to a group. `parameters.reducer` ∈ {"sum", "mean"} (default
 * "sum"). Output is a `json` EvidenceValue carrying a `Record<string, number>`
 * — group label → reduced value — for stable JSON comparison.
 *
 * Same unit required across inputs. Tolerance: ≤ 0.01 relative on each
 * group value (json-deep replay performs the per-key check).
 */
const REDUCERS = new Set(["sum", "mean"]);

const aggregateByGroupOp: ReasoningOperationImpl = {
  name: "aggregate_by_group",
  version: "aggregate_by_group.v1",
  required_parameters: ["groups"],
  tolerance: { mode: "relative", epsilon: 0.01 },
  execute(
    inputs: EvidenceValue[],
    parameters: Record<string, unknown>,
  ): EvidenceValue {
    requireNonEmpty(inputs, "aggregate_by_group");
    inputs.forEach((value, idx) =>
      requireKind(value, ["number", "range"], "aggregate_by_group", idx),
    );
    requireSharedUnit(inputs, "aggregate_by_group");
    const groupsRaw = requireParam<unknown>(parameters, "groups", "aggregate_by_group");
    if (!Array.isArray(groupsRaw)) {
      fail("SEM_OP_UNSUPPORTED", "aggregate_by_group parameters.groups must be an array of strings");
    }
    const groups = groupsRaw as unknown[];
    if (groups.length !== inputs.length) {
      fail(
        "SEM_OP_UNSUPPORTED",
        `aggregate_by_group groups length ${groups.length} does not match inputs length ${inputs.length}`,
      );
    }
    if (!groups.every((g) => typeof g === "string" && g.length > 0)) {
      fail(
        "SEM_OP_UNSUPPORTED",
        "aggregate_by_group parameters.groups must be non-empty strings",
      );
    }
    const reducerRaw = parameters.reducer ?? "sum";
    if (typeof reducerRaw !== "string" || !REDUCERS.has(reducerRaw)) {
      fail(
        "SEM_OP_UNSUPPORTED",
        `aggregate_by_group parameters.reducer must be 'sum' or 'mean' (got ${String(reducerRaw)})`,
      );
    }
    const reducer = reducerRaw as "sum" | "mean";
    const numbers = inputs.map((v, i) => asNumber(v, "aggregate_by_group", i));
    const buckets = new Map<string, number[]>();
    (groups as string[]).forEach((group, idx) => {
      const arr = buckets.get(group) ?? [];
      arr.push(numbers[idx]);
      buckets.set(group, arr);
    });
    const result: Record<string, number> = {};
    for (const [group, values] of buckets) {
      const sum = values.reduce((acc, n) => acc + n, 0);
      result[group] = reducer === "sum" ? sum : sum / values.length;
    }
    return { kind: "json", value: result };
  },
};

export default aggregateByGroupOp;
