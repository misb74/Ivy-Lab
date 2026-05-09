import type { EvidenceValue } from "../../contracts/index.js";
import type { ReasoningOperationImpl } from "./types.js";

/**
 * `model_judgment` — non-deterministic step intentionally NOT replayed.
 *
 * Per scanner spec §3.3.1, replay engines skip `model_judgment` entirely;
 * the LLM-as-judge protocol in semantic.v2 (Phase 3) is the verification
 * mechanism. Calling `execute` here is a programming error — we throw with
 * the SEM_OP_UNSUPPORTED prefix so misuse is loud and audit-traceable.
 */
const modelJudgmentOp: ReasoningOperationImpl = {
  name: "model_judgment",
  version: "model_judgment.v1",
  required_parameters: [],
  tolerance: { mode: "exact" },
  execute(_inputs: EvidenceValue[], _parameters: Record<string, unknown>): EvidenceValue {
    throw new Error(
      "SEM_OP_UNSUPPORTED: model_judgment is non-deterministic; replay handled by LLM-judge in Phase 3",
    );
  },
};

export default modelJudgmentOp;
