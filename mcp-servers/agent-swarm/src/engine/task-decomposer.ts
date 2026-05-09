export interface SubTask {
  title: string;
  description: string;
  priority: number;
  depends_on: string[];
}

/**
 * Decomposes an objective string into an array of sub-tasks.
 * Uses simple heuristics: splits by numbered steps, paragraphs, or semicolons.
 * Assigns priority based on order and infers sequential dependencies.
 */
export function decomposeObjective(objective: string): SubTask[] {
  const raw = objective.trim();
  if (!raw) {
    return [];
  }

  let segments: string[] = [];

  // Strategy 1: Numbered steps (e.g., "1. Do X  2. Do Y" or "1) Do X  2) Do Y")
  const numberedPattern = /(?:^|\n)\s*\d+[\.\)]\s+/;
  if (numberedPattern.test(raw)) {
    segments = raw
      .split(/(?:^|\n)\s*\d+[\.\)]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Strategy 2: Paragraphs (double newlines)
  if (segments.length <= 1) {
    const paragraphs = raw
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (paragraphs.length > 1) {
      segments = paragraphs;
    }
  }

  // Strategy 3: Semicolons
  if (segments.length <= 1) {
    const semicolonParts = raw
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    if (semicolonParts.length > 1) {
      segments = semicolonParts;
    }
  }

  // Strategy 4: Sentences (split on ". " but keep meaningful chunks)
  if (segments.length <= 1) {
    const sentences = raw
      .split(/\.\s+/)
      .map((s) => s.trim().replace(/\.$/, ''))
      .filter((s) => s.length > 10);
    if (sentences.length > 1) {
      segments = sentences;
    }
  }

  // Fallback: single task
  if (segments.length === 0) {
    segments = [raw];
  }

  const tasks: SubTask[] = segments.map((segment, index) => {
    // Clean up the segment text for title generation
    const title =
      segment.length > 80 ? segment.substring(0, 77) + '...' : segment;

    return {
      title,
      description: segment,
      priority: segments.length - index, // Higher priority for earlier tasks
      depends_on: index > 0 ? [`__INDEX_${index - 1}`] : [], // Sequential dependency placeholder
    };
  });

  return tasks;
}
