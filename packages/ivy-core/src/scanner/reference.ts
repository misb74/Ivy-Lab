/**
 * Reference Check (`reference.v1`)
 *
 * Per scanner spec §3.2: every "hard claim" must carry a valid evidence
 * reference or a reviewed AssumptionMarker.
 *
 * Phase 2 scope: structured-field walker only. Prose claim extraction
 * (Phase 3) is intentionally NOT implemented here, but the function
 * signature accepts a full DecisionRecord so it can be extended.
 *
 * For each hard claim, valid reference =
 *   - non-empty `EvidenceRef[]` AND every cited item_id exists in the
 *     referenced packet AND that packet has `status === "current"`
 *   OR
 *   - an `AssumptionMarker` with `review_status ∈ {"accepted","validated"}`
 *
 * Override: yes. Cost: O(claims × items per ref), ms.
 */

import type {
  AssumptionMarker,
  AssumptionMarkerId,
  CheckResult,
  DecisionRecord,
  EvidencePacket,
  EvidencePacketId,
  EvidenceRef,
  ReqDecisionPayload,
} from "../contracts/types.js";

interface HardClaim {
  /** Path within the DecisionRecord (for diagnostic display). */
  path: string;
  /** EvidenceRef[] attached to (or the closest enclosing context of) this claim. */
  refs: EvidenceRef[];
  /**
   * Optional AssumptionMarkerId(s) that may cover the claim. For Phase 2 we
   * fall back to the DecisionRecord-level `assumptions[]` when no
   * field-local refs exist.
   */
  fallback_assumptions: AssumptionMarkerId[];
}

function isReqDecisionPayload(
  payload: DecisionRecord["payload"],
): payload is ReqDecisionPayload {
  return (payload as { type?: string } | undefined)?.type === "req_decision";
}

/**
 * Walks a DecisionRecord's structured form and extracts every hard claim per
 * spec §3.2. Each claim records its enclosing evidence_refs[] and the
 * record-level assumption ids (used as a coarse fallback for claims with no
 * field-local refs).
 */
function extractHardClaims(target: DecisionRecord): HardClaim[] {
  const claims: HardClaim[] = [];
  const recordAssumptions = target.assumptions ?? [];

  // 1. recommendation — must cite ≥ 1 EvidenceRef. We attribute the
  //    DecisionRecord-level evidence_refs (from the payload) to it for now.
  const payloadRefs: EvidenceRef[] = isReqDecisionPayload(target.payload)
    ? target.payload.evidence_refs ?? []
    : [];

  if (
    typeof target.recommendation === "string" &&
    target.recommendation.trim().length > 0
  ) {
    claims.push({
      path: "recommendation",
      refs: payloadRefs,
      fallback_assumptions: recordAssumptions,
    });
  }

  // 2. rationale — every numeric/comparative clause. Phase 2 treats the
  //    rationale as a single atomic hard claim if it is non-empty.
  if (
    typeof target.rationale === "string" &&
    target.rationale.trim().length > 0
  ) {
    claims.push({
      path: "rationale",
      refs: payloadRefs,
      fallback_assumptions: recordAssumptions,
    });
  }

  // 3. payload.economics_summary.* — every numeric field
  if (isReqDecisionPayload(target.payload)) {
    const econ = target.payload.economics_summary ?? {};
    const numericFields: Array<keyof typeof econ> = [
      "current_cost",
      "projected_cost",
      "savings_or_delta",
      "fte_delta",
    ];
    for (const key of numericFields) {
      const value = econ[key];
      if (typeof value === "number") {
        claims.push({
          path: `payload.economics_summary.${String(key)}`,
          refs: payloadRefs,
          fallback_assumptions: recordAssumptions,
        });
      }
    }
  }

  // 4. options[].economics.* + 5. pros[]/cons[]
  const options = Array.isArray(target.options) ? target.options : [];
  options.forEach((opt, idx) => {
    const optRefs = opt.evidence_refs ?? [];
    const econ = opt.economics ?? {};
    const numericFields: Array<keyof typeof econ> = [
      "cost_delta",
      "fte_delta",
      "horizon_months",
    ];
    for (const key of numericFields) {
      const value = (econ as Record<string, unknown>)[String(key)];
      if (typeof value === "number") {
        claims.push({
          path: `options[${idx}].economics.${String(key)}`,
          refs: optRefs,
          fallback_assumptions: recordAssumptions,
        });
      }
    }
    (opt.pros ?? []).forEach((bullet, pIdx) => {
      if (typeof bullet === "string" && bullet.trim().length > 0) {
        claims.push({
          path: `options[${idx}].pros[${pIdx}]`,
          refs: optRefs,
          fallback_assumptions: recordAssumptions,
        });
      }
    });
    (opt.cons ?? []).forEach((bullet, cIdx) => {
      if (typeof bullet === "string" && bullet.trim().length > 0) {
        claims.push({
          path: `options[${idx}].cons[${cIdx}]`,
          refs: optRefs,
          fallback_assumptions: recordAssumptions,
        });
      }
    });
  });

  // 6. risks[] — description, likelihood, impact
  const risks = Array.isArray(target.risks) ? target.risks : [];
  risks.forEach((risk, idx) => {
    const riskRefs = risk.evidence_refs ?? [];
    if (
      typeof risk.description === "string" &&
      risk.description.trim().length > 0
    ) {
      claims.push({
        path: `risks[${idx}].description`,
        refs: riskRefs,
        fallback_assumptions: recordAssumptions,
      });
    }
    if (typeof risk.likelihood === "string") {
      claims.push({
        path: `risks[${idx}].likelihood`,
        refs: riskRefs,
        fallback_assumptions: recordAssumptions,
      });
    }
    if (typeof risk.impact === "string") {
      claims.push({
        path: `risks[${idx}].impact`,
        refs: riskRefs,
        fallback_assumptions: recordAssumptions,
      });
    }
  });

  return claims;
}

interface PacketLookup {
  byId: Map<EvidencePacketId, EvidencePacket>;
  itemSetByPacket: Map<EvidencePacketId, Set<string>>;
}

function buildPacketLookup(packets: EvidencePacket[]): PacketLookup {
  const byId = new Map<EvidencePacketId, EvidencePacket>();
  const itemSetByPacket = new Map<EvidencePacketId, Set<string>>();
  for (const p of packets) {
    byId.set(p.id, p);
    const ids = new Set<string>(p.items.map((i) => String(i.id)));
    itemSetByPacket.set(p.id, ids);
  }
  return { byId, itemSetByPacket };
}

interface AssumptionLookup {
  byId: Map<AssumptionMarkerId, AssumptionMarker>;
}

function buildAssumptionLookup(
  assumptions: AssumptionMarker[],
): AssumptionLookup {
  const byId = new Map<AssumptionMarkerId, AssumptionMarker>();
  for (const a of assumptions) {
    byId.set(a.id, a);
  }
  return { byId };
}

interface ClaimVerdict {
  ok: boolean;
  /** Codes contributed by this claim's evaluation (may be empty on ok=true). */
  codes: string[];
  /** Diagnostic strings (one per emitted code). */
  details: string[];
}

function evaluateRefs(
  claim: HardClaim,
  packetLookup: PacketLookup,
): { hasValid: boolean; codes: string[]; details: string[] } {
  let hasValid = false;
  const codes: string[] = [];
  const details: string[] = [];

  for (const ref of claim.refs) {
    if (!Array.isArray(ref.item_ids) || ref.item_ids.length === 0) {
      // Empty item list is treated as if no ref was given for this entry; we
      // continue to the next ref. The overall "uncited" verdict is decided
      // afterwards in evaluateClaim.
      continue;
    }
    const packet = packetLookup.byId.get(ref.packet_id);
    if (!packet) {
      // Per Phase 2 the orchestrator is expected to pass every cited packet
      // in `packets`. A missing packet means the citation is unresolvable —
      // surface as REF_ITEM_NOT_FOUND (the items in the missing packet
      // cannot be confirmed to exist).
      codes.push("REF_ITEM_NOT_FOUND");
      details.push(
        `REF_ITEM_NOT_FOUND: ${claim.path} cites packet_id=${String(ref.packet_id)} which was not provided to the scanner`,
      );
      continue;
    }
    if (packet.status !== "current") {
      codes.push("REF_STALE_EVIDENCE");
      details.push(
        `REF_STALE_EVIDENCE: ${claim.path} cites packet_id=${String(ref.packet_id)} with status=${packet.status}`,
      );
      continue;
    }
    const itemSet = packetLookup.itemSetByPacket.get(ref.packet_id);
    let allItemsFound = true;
    for (const itemId of ref.item_ids) {
      if (!itemSet || !itemSet.has(String(itemId))) {
        allItemsFound = false;
        codes.push("REF_ITEM_NOT_FOUND");
        details.push(
          `REF_ITEM_NOT_FOUND: ${claim.path} cites item_id=${String(itemId)} not present in packet ${String(ref.packet_id)}`,
        );
      }
    }
    if (allItemsFound) {
      hasValid = true;
    }
  }

  return { hasValid, codes, details };
}

function evaluateAssumptions(
  claim: HardClaim,
  assumptionLookup: AssumptionLookup,
): { hasValid: boolean; codes: string[]; details: string[] } {
  let hasValid = false;
  const codes: string[] = [];
  const details: string[] = [];

  for (const id of claim.fallback_assumptions) {
    const marker = assumptionLookup.byId.get(id);
    if (!marker) continue; // unknown id is silently skipped — covered by other checks
    if (
      marker.review_status === "accepted" ||
      marker.review_status === "validated"
    ) {
      hasValid = true;
    } else if (marker.review_status === "pending_review") {
      codes.push("REF_ASSUMPTION_PENDING");
      details.push(
        `REF_ASSUMPTION_PENDING: ${claim.path} relies on AssumptionMarker ${String(id)} with review_status=pending_review`,
      );
    } else if (marker.review_status === "rejected") {
      codes.push("REF_ASSUMPTION_REJECTED");
      details.push(
        `REF_ASSUMPTION_REJECTED: ${claim.path} relies on AssumptionMarker ${String(id)} with review_status=rejected`,
      );
    }
  }

  return { hasValid, codes, details };
}

function evaluateClaim(
  claim: HardClaim,
  packetLookup: PacketLookup,
  assumptionLookup: AssumptionLookup,
): ClaimVerdict {
  const refResult = evaluateRefs(claim, packetLookup);
  const assumptionResult = evaluateAssumptions(claim, assumptionLookup);

  const valid = refResult.hasValid || assumptionResult.hasValid;

  if (valid) {
    // Spec: a claim with at least one valid path passes. We do NOT surface
    // sibling REF_STALE / REF_ITEM_NOT_FOUND on the same claim because the
    // operator already has a clean ref. Stale-only paths are caught when
    // they are the only path available.
    return { ok: true, codes: [], details: [] };
  }

  const codes: string[] = [...refResult.codes, ...assumptionResult.codes];
  const details: string[] = [...refResult.details, ...assumptionResult.details];

  // No refs at all (none of them produced a code) AND no fallback assumptions.
  const noFieldRefs =
    claim.refs.length === 0 ||
    claim.refs.every(
      (r) => !Array.isArray(r.item_ids) || r.item_ids.length === 0,
    );
  const noAssumptions = claim.fallback_assumptions.length === 0;

  if (noFieldRefs && noAssumptions) {
    codes.push("REF_UNCITED_CLAIM");
    details.push(
      `REF_UNCITED_CLAIM: ${claim.path} has no evidence_refs and no covering assumption`,
    );
  } else if (codes.length === 0) {
    // Refs exist but none yielded a valid item set, and no assumption
    // resolved them — fall back to UNCITED.
    codes.push("REF_UNCITED_CLAIM");
    details.push(
      `REF_UNCITED_CLAIM: ${claim.path} carries refs but none resolve to a current packet with present items`,
    );
  }

  return { ok: false, codes, details };
}

export function checkReference(
  target: DecisionRecord,
  packets: EvidencePacket[],
  assumptions: AssumptionMarker[],
): CheckResult {
  const packetLookup = buildPacketLookup(packets);
  const assumptionLookup = buildAssumptionLookup(assumptions);

  const claims = extractHardClaims(target);
  const allDetails: string[] = [];
  let errorCount = 0;

  for (const claim of claims) {
    const verdict = evaluateClaim(claim, packetLookup, assumptionLookup);
    if (!verdict.ok) {
      errorCount += verdict.codes.length;
      for (const detail of verdict.details) {
        allDetails.push(detail);
      }
    }
  }

  if (errorCount === 0) {
    return { status: "pass", error_count: 0, details: [] };
  }
  return { status: "fail", error_count: errorCount, details: allDetails };
}
