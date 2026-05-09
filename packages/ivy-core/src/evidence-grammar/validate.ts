import type { SourcePassport, SourcePassportId, ValidationStatusLite } from "../contracts/index.js";
import type { SourceEvidence, SourceMockItem } from "./types.js";

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function passportIdForSource(source: SourceEvidence): SourcePassportId {
  return `sp_${slug(source.source_system)}_${slug(source.source_version)}` as SourcePassportId;
}

function itemHasValidValue(item: SourceMockItem): boolean {
  if (item.confidence < 0 || item.confidence > 1) {
    return false;
  }

  switch (item.value.kind) {
    case "number":
      return Number.isFinite(item.value.value);
    case "range":
      return Number.isFinite(item.value.lower) && Number.isFinite(item.value.upper) && item.value.lower <= item.value.upper;
    case "text":
    case "enum":
    case "date":
      return item.value.value.length > 0;
    case "json":
      return item.value.value !== undefined;
  }
}

function validationStatusForSource(source: SourceEvidence): ValidationStatusLite {
  if (source.error) {
    return "invalid";
  }

  if (source.items.length === 0) {
    return "missing";
  }

  if (!source.items.every(itemHasValidValue)) {
    return "partial";
  }

  return "valid";
}

export function validateSourceEvidence(sources: SourceEvidence[]): SourcePassport[] {
  return sources.map((source) => ({
    schema_version: "1.1.0",
    id: passportIdForSource(source),
    source_system: source.source_system,
    source_version: source.source_version,
    retrieved_at: source.retrieved_at,
    confidence_score: source.confidence_score,
    freshness_status: source.freshness,
    validation_status: validationStatusForSource(source),
    raw_payload_ref: `mock://${source.source_system}/${source.source_version}`,
    transformation_lineage: [
      "fetch_source_evidence",
      "validate",
    ],
  }));
}
