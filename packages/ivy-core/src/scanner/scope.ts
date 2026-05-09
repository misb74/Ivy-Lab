/**
 * Scope Check (`scope.v1`)
 *
 * Per scanner spec §3.4: every cited EvidenceItem's originating packet's
 * `resource_scope` must be a subset of the active `ResourceScope`, and the
 * packet's `tenant_id` must match the active scope's tenant.
 *
 * Subset semantics:
 *   - tenant_id: exact match (carried on EvidencePacket.tenant_id, not on
 *     ResourceScope itself; we get the active tenant from the active
 *     ResourceScope's enclosing TenantScope, passed in via the contract).
 *     Spec note: scope check uses TenantScope.tenant_id; in this Phase 2
 *     surface we accept the full ResourceScope plus an explicit
 *     `active_tenant_id` paired via the caller. Where the caller passes a
 *     plain ResourceScope without a tenant, we still enforce the
 *     dimension subset rules.
 *   - company_id / function_ids / org_unit_ids / role_ids / req_ids /
 *     person_ids / scenario_ids / simulation_ids: subset checks
 *     (cited packet's set ⊆ active set when active set is specified).
 *   - data_classification: ordinal — public < tenant_internal <
 *     confidential < person_sensitive. Cited classification must be ≤
 *     active.
 *
 * Override: never. Cost: O(items × dimensions), microseconds.
 */

import type {
  CheckResult,
  DataClassification,
  DecisionRecord,
  EvidencePacket,
  EvidencePacketId,
  EvidenceRef,
  ResourceScope,
  TenantId,
} from "../contracts/types.js";

const CLASSIFICATION_ORDER: Record<DataClassification, number> = {
  public: 0,
  tenant_internal: 1,
  confidential: 2,
  person_sensitive: 3,
};

/**
 * Active scope passed into the scope check. Either:
 *  - a `ResourceScope` directly (when caller has only the scope), in which
 *    case tenant_id enforcement is delegated to the gateway and skipped here,
 *  - or an `ActiveScope` wrapper that carries the tenant_id.
 */
export type ActiveScopeInput =
  | (ResourceScope & { __isActiveScope?: never })
  | { tenant_id: TenantId; resource_scope: ResourceScope };

interface NormalizedActive {
  tenant_id?: TenantId;
  resource_scope: ResourceScope;
}

function normalizeActive(input: ActiveScopeInput): NormalizedActive {
  if ("resource_scope" in input && "tenant_id" in input) {
    return {
      tenant_id: input.tenant_id,
      resource_scope: input.resource_scope,
    };
  }
  return { resource_scope: input as ResourceScope };
}

function isSubsetOrUnconstrained<T>(
  citedValues: readonly T[] | undefined,
  activeValues: readonly T[] | undefined,
): boolean {
  // If active scope does not constrain this dimension, anything is allowed.
  if (!activeValues || activeValues.length === 0) return true;
  // If the cited side has nothing under this dimension, it is trivially a subset.
  if (!citedValues || citedValues.length === 0) return true;
  const activeSet = new Set<T>(activeValues);
  return citedValues.every((v) => activeSet.has(v));
}

function checkClassificationOrdering(
  cited: DataClassification | undefined,
  active: DataClassification | undefined,
): boolean {
  // If active has no max set (defensive), allow nothing above tenant_internal.
  const activeRank = active !== undefined ? CLASSIFICATION_ORDER[active] : 1;
  const citedRank = cited !== undefined ? CLASSIFICATION_ORDER[cited] : 0;
  return citedRank <= activeRank;
}

function collectCitedPacketIds(target: DecisionRecord): Set<EvidencePacketId> {
  const ids = new Set<EvidencePacketId>();
  if (target.evidence_packet_id) {
    ids.add(target.evidence_packet_id);
  }
  const collectFromRefs = (refs: EvidenceRef[] | undefined) => {
    if (!refs) return;
    for (const r of refs) {
      if (r.packet_id) ids.add(r.packet_id);
    }
  };

  // payload.evidence_refs (only present on req_decision payloads in Phase 2,
  // but we read defensively for any payload.evidence_refs[]).
  const payload = target.payload as { evidence_refs?: EvidenceRef[] } | undefined;
  collectFromRefs(payload?.evidence_refs);

  for (const opt of target.options ?? []) {
    collectFromRefs(opt.evidence_refs);
  }
  for (const risk of target.risks ?? []) {
    collectFromRefs(risk.evidence_refs);
  }
  return ids;
}

function evaluatePacketAgainstScope(
  packet: EvidencePacket,
  active: NormalizedActive,
): { codes: string[]; details: string[] } {
  const codes: string[] = [];
  const details: string[] = [];
  const activeScope = active.resource_scope;
  const packetId = String(packet.id);

  // tenant_id — exact match when caller provided one.
  if (active.tenant_id !== undefined && packet.tenant_id !== active.tenant_id) {
    codes.push("SCOPE_TENANT_MISMATCH");
    details.push(
      `SCOPE_TENANT_MISMATCH: packet ${packetId} has tenant_id=${String(packet.tenant_id)}, active=${String(active.tenant_id)}`,
    );
  }

  const pkt = packet.resource_scope;

  // company_id — single-valued on ResourceScope. Active may name one company,
  // in which case the packet's company_id must equal it.
  if (
    activeScope.company_id !== undefined &&
    pkt.company_id !== undefined &&
    pkt.company_id !== activeScope.company_id
  ) {
    codes.push("SCOPE_COMPANY_VIOLATION");
    details.push(
      `SCOPE_COMPANY_VIOLATION: packet ${packetId} company_id=${String(pkt.company_id)} not in active scope company=${String(activeScope.company_id)}`,
    );
  }

  if (!isSubsetOrUnconstrained(pkt.function_ids, activeScope.function_ids)) {
    codes.push("SCOPE_FUNCTION_VIOLATION");
    details.push(
      `SCOPE_FUNCTION_VIOLATION: packet ${packetId} function_ids=${JSON.stringify(pkt.function_ids)} not subset of active=${JSON.stringify(activeScope.function_ids)}`,
    );
  }
  if (!isSubsetOrUnconstrained(pkt.org_unit_ids, activeScope.org_unit_ids)) {
    codes.push("SCOPE_ORG_VIOLATION");
    details.push(
      `SCOPE_ORG_VIOLATION: packet ${packetId} org_unit_ids=${JSON.stringify(pkt.org_unit_ids)} not subset of active=${JSON.stringify(activeScope.org_unit_ids)}`,
    );
  }
  if (!isSubsetOrUnconstrained(pkt.role_ids, activeScope.role_ids)) {
    codes.push("SCOPE_ROLE_VIOLATION");
    details.push(
      `SCOPE_ROLE_VIOLATION: packet ${packetId} role_ids=${JSON.stringify(pkt.role_ids)} not subset of active=${JSON.stringify(activeScope.role_ids)}`,
    );
  }
  if (!isSubsetOrUnconstrained(pkt.req_ids, activeScope.req_ids)) {
    codes.push("SCOPE_REQ_VIOLATION");
    details.push(
      `SCOPE_REQ_VIOLATION: packet ${packetId} req_ids=${JSON.stringify(pkt.req_ids)} not subset of active=${JSON.stringify(activeScope.req_ids)}`,
    );
  }
  if (!isSubsetOrUnconstrained(pkt.person_ids, activeScope.person_ids)) {
    codes.push("SCOPE_PERSON_VIOLATION");
    details.push(
      `SCOPE_PERSON_VIOLATION: packet ${packetId} person_ids=${JSON.stringify(pkt.person_ids)} not subset of active=${JSON.stringify(activeScope.person_ids)}`,
    );
  }
  if (!isSubsetOrUnconstrained(pkt.scenario_ids, activeScope.scenario_ids)) {
    codes.push("SCOPE_SCENARIO_VIOLATION");
    details.push(
      `SCOPE_SCENARIO_VIOLATION: packet ${packetId} scenario_ids=${JSON.stringify(pkt.scenario_ids)} not subset of active=${JSON.stringify(activeScope.scenario_ids)}`,
    );
  }
  if (!isSubsetOrUnconstrained(pkt.simulation_ids, activeScope.simulation_ids)) {
    codes.push("SCOPE_SIMULATION_VIOLATION");
    details.push(
      `SCOPE_SIMULATION_VIOLATION: packet ${packetId} simulation_ids=${JSON.stringify(pkt.simulation_ids)} not subset of active=${JSON.stringify(activeScope.simulation_ids)}`,
    );
  }

  if (
    !checkClassificationOrdering(
      pkt.data_classification,
      activeScope.data_classification,
    )
  ) {
    codes.push("SCOPE_CLASSIFICATION_ESCALATION");
    details.push(
      `SCOPE_CLASSIFICATION_ESCALATION: packet ${packetId} classification=${pkt.data_classification} exceeds active max=${activeScope.data_classification}`,
    );
  }

  return { codes, details };
}

export function checkScope(
  target: DecisionRecord,
  activeScope: ActiveScopeInput,
  packets: EvidencePacket[],
): CheckResult {
  const active = normalizeActive(activeScope);
  const citedIds = collectCitedPacketIds(target);
  const packetById = new Map<EvidencePacketId, EvidencePacket>();
  for (const p of packets) packetById.set(p.id, p);

  const allDetails: string[] = [];
  let errorCount = 0;

  for (const pid of citedIds) {
    const packet = packetById.get(pid);
    if (!packet) {
      // We cannot evaluate scope for packets we weren't given. The reference
      // check surfaces missing-packet errors; scope is silent here so we do
      // not duplicate diagnostics across checks.
      continue;
    }
    const { codes, details } = evaluatePacketAgainstScope(packet, active);
    if (codes.length > 0) {
      errorCount += codes.length;
      for (const d of details) allDetails.push(d);
    }
  }

  if (errorCount === 0) {
    return { status: "pass", error_count: 0, details: [] };
  }
  return { status: "fail", error_count: errorCount, details: allDetails };
}
