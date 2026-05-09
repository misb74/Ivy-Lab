import { mergeEntities, findDuplicates } from '../engine/entity-merger.js';
import type { MergeSuggestion } from '../engine/entity-merger.js';

export interface MergeParams {
  primary_entity_id: string;
  secondary_entity_id: string;
}

export async function kgMerge(params: MergeParams): Promise<{
  merged: boolean;
  primaryId: string;
  secondaryId: string;
  relationsRedirected: number;
  duplicates_remaining: MergeSuggestion[];
  message: string;
}> {
  const { primary_entity_id, secondary_entity_id } = params;

  if (primary_entity_id === secondary_entity_id) {
    throw new Error('Cannot merge an entity with itself.');
  }

  const result = mergeEntities(primary_entity_id, secondary_entity_id);

  // After merge, check for remaining duplicates
  const duplicates = findDuplicates();

  return {
    merged: result.merged,
    primaryId: result.primaryId,
    secondaryId: result.secondaryId,
    relationsRedirected: result.relationsRedirected,
    duplicates_remaining: duplicates,
    message: result.message,
  };
}
