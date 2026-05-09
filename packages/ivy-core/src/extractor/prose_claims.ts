/**
 * Prose Claim Extractor (Phase 3 v1, rule-based)
 *
 * Per scanner spec §3.2: walks prose blocks and identifies sentences making
 * factual assertions that should carry evidence. Phase 3 v1 is intentionally
 * RULE-BASED — no model calls, no classifier. The output is reconciled with
 * model-emitted claims by the reference check (D6 reconciliation, separate
 * file).
 *
 * Detection categories:
 *   - numeric:     a number with a unit/percent/currency in proximity to
 *                  factual phrasing ("X is N%", "$N per Y", "headcount of N").
 *   - comparative: contains "compared to", "vs.", "more than", "less than",
 *                  "above/below the average", etc.
 *   - causal:      contains "because", "due to", "drives", "leads to",
 *                  "as a result of", etc.
 *   - predictive:  future tense + numeric ("will reduce", "expected to grow",
 *                  "by 2027 we will").
 *
 * Edge cases handled:
 *   - Section headers (lines that are short + end without a period or look
 *     like titles) are not extracted from.
 *   - Citation-shaped parentheticals — "(BLS, 2023)", "(Source: ...)",
 *     "[item_xyz]" — are treated as inline_references, NOT as claims.
 *   - Multiple claims per sentence yield multiple ExtractedClaim entries.
 *   - Claims spanning multiple sentences extract just the first sentence.
 */

export interface ExtractedClaim {
  text: string;
  start_offset: number;
  end_offset: number;
  type: "numeric" | "comparative" | "causal" | "predictive";
  /** Strings that look like inline citations (e.g. "(BLS, 2023)", "[item_id]"). */
  inline_references?: string[];
}

// -----------------------------------------------------------------------------
// Patterns
// -----------------------------------------------------------------------------

const COMPARATIVE_TERMS = [
  "compared to",
  "vs.",
  " vs ",
  "more than",
  "less than",
  "above the average",
  "below the average",
  "above average",
  "below average",
  "well above",
  "well below",
  "higher than",
  "lower than",
  "greater than",
  // bare "average" with a qualifier nearby is comparative-ish; we keep the
  // strict check by also matching "industry average" / "national average"
  // — common in HR analyst prose.
  "industry average",
  "national average",
];

const CAUSAL_TERMS = [
  "because",
  "due to",
  "drives",
  "leads to",
  "leading to",
  "as a result of",
  "results in",
  "caused by",
];

const PREDICTIVE_TERMS = [
  "will reduce",
  "will increase",
  "will decrease",
  "will grow",
  "will shrink",
  "will save",
  "will cost",
  "expected to grow",
  "expected to shrink",
  "expected to reduce",
  "expected to increase",
  "projected to",
  "forecast to",
  "by 20", // "by 2027 we will..." — matches year prefix
];

// Numeric: matches integers/decimals optionally with thousands separators,
// plus optional unit/percent/currency markers in proximity. We capture the
// match span so we can emit the offsets.
//   $1,234     $1.5M     $4.2 million     22%      14 percent      3.5x
//   1,000      1234       1.5e6
const NUMERIC_REGEX =
  /(?:\$\s*[0-9][0-9,]*(?:\.[0-9]+)?\s*(?:[KkMmBb](?:illion|n|)|million|billion|thousand)?|[0-9][0-9,]*(?:\.[0-9]+)?\s*(?:%|percent|million|billion|thousand|USD|usd|FTE|fte|hrs|hours|x))/g;

// Citation-shaped tokens: "(BLS 2023)", "(Source: BLS, 2023)",
// "[item_xyz]", "[BLS-2023]". These are NOT claims.
const CITATION_REGEX =
  /\((?:source\s*[:\-]\s*)?[A-Z][A-Za-z .&-]*[,\s]+(?:19|20)\d{2}\)|\[[a-zA-Z0-9_.\-]+\]/g;

// Section-header heuristic: a line that's < 80 chars and doesn't end with
// sentence-terminal punctuation (".", "!", "?") AND has no embedded period
// AND has fewer than ~12 words. Used to skip over titles like "## Outlook".
function looksLikeHeader(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length > 120) return false;
  if (/[.!?]$/.test(trimmed)) return false;
  if (/^#{1,6}\s/.test(trimmed)) return true;
  // Heuristic: no internal sentence punctuation + short → header-y.
  const words = trimmed.split(/\s+/);
  if (words.length <= 8 && !trimmed.includes(".")) return true;
  return false;
}

// -----------------------------------------------------------------------------
// Sentence splitter
// -----------------------------------------------------------------------------

interface Sentence {
  text: string;
  start: number;
  end: number;
}

/**
 * Split text into sentences with offsets. Conservative: splits on
 * `[.!?]\s+` while keeping the trailing punctuation attached to the
 * previous sentence. Preserves byte offsets relative to the original text.
 */
function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  if (text.length === 0) return out;

  // We walk the text and emit a sentence whenever we hit `[.!?]` followed
  // by whitespace + an uppercase or digit (or end-of-string).
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "." || ch === "!" || ch === "?") {
      const next = text[i + 1];
      const nextNext = text[i + 2];
      const atEnd = i === text.length - 1;
      const followedByWS = next === " " || next === "\n" || next === "\t";
      // Don't split on "1.5" (decimal) or "Mr." style tokens — require
      // whitespace AFTER the terminator.
      if (atEnd) {
        out.push({ text: text.slice(start, i + 1), start, end: i + 1 });
        start = i + 1;
        continue;
      }
      if (!followedByWS) continue;
      // Peek the next non-space char; require uppercase / digit / hyphen
      // to start a new sentence (avoids splitting "etc. and").
      let k = i + 2;
      while (k < text.length && (text[k] === " " || text[k] === "\n" || text[k] === "\t")) {
        k += 1;
      }
      const startsLikeSentence = k < text.length && /[A-Z0-9-]/.test(text[k]);
      if (startsLikeSentence || nextNext === undefined) {
        out.push({ text: text.slice(start, i + 1), start, end: i + 1 });
        start = i + 2;
      }
    }
  }
  if (start < text.length) {
    const tail = text.slice(start);
    if (tail.trim().length > 0) {
      out.push({ text: tail, start, end: text.length });
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Claim detection per sentence
// -----------------------------------------------------------------------------

/**
 * Returns the set of inline reference strings present in `sentence` plus
 * a "redacted" version where each citation has been replaced by spaces of
 * equal length (so offsets are preserved when we run number detection on
 * the redacted text).
 */
function extractCitations(sentence: string): { references: string[]; redacted: string } {
  const references: string[] = [];
  let redacted = sentence;
  CITATION_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CITATION_REGEX.exec(sentence)) !== null) {
    references.push(m[0]);
  }
  // Replace each citation with same-length whitespace to preserve offsets.
  redacted = sentence.replace(CITATION_REGEX, (m2) => " ".repeat(m2.length));
  return { references, redacted };
}

interface SentenceFlags {
  hasNumeric: boolean;
  hasComparative: boolean;
  hasCausal: boolean;
  hasPredictive: boolean;
  numericMatchCount: number;
}

function classifySentence(redacted: string): SentenceFlags {
  const lower = redacted.toLowerCase();

  let numericMatchCount = 0;
  NUMERIC_REGEX.lastIndex = 0;
  while (NUMERIC_REGEX.exec(redacted) !== null) {
    numericMatchCount += 1;
  }

  const hasComparative = COMPARATIVE_TERMS.some((t) => lower.includes(t));
  const hasCausal = CAUSAL_TERMS.some((t) => lower.includes(t));
  const hasPredictive = PREDICTIVE_TERMS.some((t) => lower.includes(t));
  const hasNumeric = numericMatchCount > 0;

  return {
    hasNumeric,
    hasComparative,
    hasCausal,
    hasPredictive,
    numericMatchCount,
  };
}

// -----------------------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------------------

/**
 * Extract factual claims from prose text using rule-based detectors. Pure
 * function — no I/O, no model calls. Empty input returns an empty array.
 *
 * Each detected claim is the full sentence; numeric claims are emitted
 * once per numeric match in the sentence (so "22%, well below the 14%
 * average" yields two numeric claims AND a comparative claim).
 */
export function extractProseClaims(text: string): ExtractedClaim[] {
  if (typeof text !== "string" || text.length === 0) {
    return [];
  }

  const out: ExtractedClaim[] = [];

  // First, walk lines to skip header-shaped lines wholesale. Line offsets
  // are tracked so sentence offsets remain absolute to the source text.
  const lines: Array<{ text: string; start: number }> = [];
  let cursor = 0;
  for (const raw of text.split(/(\r?\n)/)) {
    if (raw === "\n" || raw === "\r\n") {
      cursor += raw.length;
      continue;
    }
    lines.push({ text: raw, start: cursor });
    cursor += raw.length;
  }

  for (const line of lines) {
    if (looksLikeHeader(line.text)) continue;

    const sentences = splitSentences(line.text);
    for (const s of sentences) {
      const trimmed = s.text.trim();
      if (trimmed.length === 0) continue;

      const { references, redacted } = extractCitations(s.text);

      // A sentence that, after stripping citations, has no factual surface
      // (no numbers, no comparative/causal/predictive cue) is not a claim.
      const flags = classifySentence(redacted);

      // Pure-citation sentences: e.g. "(Source: BLS 2023)". After redaction
      // there's nothing left worth reporting AND the sentence had a citation
      // → suppress.
      if (
        references.length > 0 &&
        redacted.replace(/\s/g, "").length === 0
      ) {
        continue;
      }

      const claimAbsoluteStart = line.start + s.start;
      const claimAbsoluteEnd = line.start + s.end;

      // Emit one claim entry per numeric match (so two numbers in one
      // sentence yield two claims). Comparative/causal/predictive cues
      // produce at most one claim each (they describe the sentence as a
      // whole, not specific numbers).
      let emittedAny = false;

      if (flags.hasNumeric) {
        // Re-walk numerics with offsets so future versions can include
        // per-number offsets. v1 emits the full sentence as the claim text
        // for each numeric match.
        NUMERIC_REGEX.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = NUMERIC_REGEX.exec(redacted)) !== null) {
          out.push({
            text: trimmed,
            start_offset: claimAbsoluteStart,
            end_offset: claimAbsoluteEnd,
            type: "numeric",
            ...(references.length > 0 ? { inline_references: references } : {}),
          });
          emittedAny = true;
        }
      }

      if (flags.hasComparative) {
        out.push({
          text: trimmed,
          start_offset: claimAbsoluteStart,
          end_offset: claimAbsoluteEnd,
          type: "comparative",
          ...(references.length > 0 ? { inline_references: references } : {}),
        });
        emittedAny = true;
      }

      if (flags.hasCausal) {
        out.push({
          text: trimmed,
          start_offset: claimAbsoluteStart,
          end_offset: claimAbsoluteEnd,
          type: "causal",
          ...(references.length > 0 ? { inline_references: references } : {}),
        });
        emittedAny = true;
      }

      if (flags.hasPredictive) {
        out.push({
          text: trimmed,
          start_offset: claimAbsoluteStart,
          end_offset: claimAbsoluteEnd,
          type: "predictive",
          ...(references.length > 0 ? { inline_references: references } : {}),
        });
        emittedAny = true;
      }

      // If the sentence had no numerics AND no cues, it's not a claim. We
      // intentionally do not extract bare assertions in v1 — too noisy.
      void emittedAny;
    }
  }

  return out;
}
