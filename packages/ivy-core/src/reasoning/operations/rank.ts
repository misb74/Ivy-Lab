import type { EvidenceValue } from "../../contracts/index.js";
import {
  asNumber,
  fail,
  requireKind,
  requireNonEmpty,
  requireSharedUnit,
} from "./_util.js";
import type { ReasoningOperationImpl } from "./types.js";

/**
 * `rank` — ordered indices of numeric EvidenceValues.
 *
 * Spec §4.1: number[] → index[] (descending by default; `params.order`
 * overrides). Same unit required. Tolerance: exact ordering.
 *
 * Output is a `json` EvidenceValue carrying the integer index permutation
 * (0-based). Tie-breaking is stable: the lower input index wins so that
 * replays are deterministic.
 */
const rankOp: ReasoningOperationImpl = {
  name: "rank",
  version: "rank.v1",
  required_parameters: [],
  tolerance: { mode: "exact" },
  execute(
    inputs: EvidenceValue[],
    parameters: Record<string, unknown>,
  ): EvidenceValue {
    requireNonEmpty(inputs, "rank");
    inputs.forEach((value, idx) => requireKind(value, ["number", "range"], "rank", idx));
    requireSharedUnit(inputs, "rank");
    const orderRaw = parameters.order;
    let order: "asc" | "desc";
    if (orderRaw === undefined || orderRaw === "desc" || orderRaw === "descending") {
      order = "desc";
    } else if (orderRaw === "asc" || orderRaw === "ascending") {
      order = "asc";
    } else {
      fail(
        "SEM_OP_UNSUPPORTED",
        `rank parameters.order must be 'asc'|'desc'|'ascending'|'descending' (got ${String(orderRaw)})`,
      );
    }
    const numbers = inputs.map((v, i) => ({ value: asNumber(v, "rank", i), index: i }));
    numbers.sort((a, b) => {
      if (a.value === b.value) return a.index - b.index;
      return order === "desc" ? b.value - a.value : a.value - b.value;
    });
    return { kind: "json", value: numbers.map((n) => n.index) };
  },
};

export default rankOp;
