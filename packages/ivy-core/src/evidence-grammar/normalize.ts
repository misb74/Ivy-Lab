import type { EvidenceItem, EvidenceItemId, EvidencePacketId } from "../contracts/index.js";
import type { ResolvedEntity, SourceEvidence } from "./types.js";
import { passportIdForSource } from "./validate.js";

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function normalizeSourceEvidence(
  sources: SourceEvidence[],
  packetId: EvidencePacketId,
  resolvedEntity: ResolvedEntity,
): EvidenceItem[] {
  return sources.flatMap((source) =>
    source.items.map((item, index) => {
      const lineage = [
        `source:${source.source_system}`,
        `soc:${resolvedEntity.soc_code}`,
        `onet:${resolvedEntity.onet_code}`,
      ];

      if (source.source_system === "lightcast") {
        lineage.push("taxonomy:lightcast_to_soc");
      }

      return {
        schema_version: "1.1.0",
        id: `evitem_${slug(source.source_system)}_${index + 1}` as EvidenceItemId,
        packet_id: packetId,
        source_passport_id: passportIdForSource(source),
        field_path: item.field_path,
        value: item.value,
        as_of_date: item.as_of_date,
        confidence: item.confidence,
        is_normalized: item.is_normalized ?? source.source_system === "lightcast",
        normalization_lineage: lineage,
      };
    }),
  );
}
