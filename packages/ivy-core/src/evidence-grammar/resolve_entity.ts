import type { ResolvedEntity } from "./types.js";

interface SocEntry {
  soc: string;
  title: string;
  aliases: string[];
}

const SOC_ENTRIES: SocEntry[] = [
  {
    soc: "13-2051.00",
    title: "Financial Analysts",
    aliases: ["Financial Analyst", "Senior Financial Analyst", "FP&A Analyst", "Finance Analyst"],
  },
  {
    soc: "13-1041.00",
    title: "Compliance Officers",
    aliases: ["Compliance Officer", "Compliance Analyst", "AI Ethics Officer"],
  },
  {
    soc: "15-2051.00",
    title: "Data Scientists",
    aliases: ["Data Scientist", "Machine Learning Engineer", "Data Analyst"],
  },
  {
    soc: "15-1252.00",
    title: "Software Developers",
    aliases: [
      "Software Developer",
      "Software Engineer",
      "Senior Software Engineer",
      "Backend Engineer",
      "Frontend Engineer",
      "Full Stack Engineer",
      "SWE",
    ],
  },
];

const NOISE_TOKENS = new Set([
  "and",
  "of",
  "the",
  "for",
  "to",
  "senior",
  "sr",
  "lead",
  "principal",
  "staff",
  "analyst",
  "officer",
]);

function normalizeTitle(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text: string): Set<string> {
  const raw = normalizeTitle(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/s$/, ""));
  const filtered = raw.filter((token) => token.length > 1 && !NOISE_TOKENS.has(token));
  return new Set(filtered.length > 0 ? filtered : raw);
}

function tokenOverlap(input: string, candidate: string): number {
  const inputTokens = tokenize(input);
  const candidateTokens = tokenize(candidate);
  let matches = 0;

  for (const token of inputTokens) {
    if (candidateTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.max(inputTokens.size, candidateTokens.size, 1);
}

export function resolveEntity(roleTitle: string): ResolvedEntity {
  const normalized = normalizeTitle(roleTitle);

  for (const entry of SOC_ENTRIES) {
    const aliases = [entry.title, ...entry.aliases];
    const exact = aliases.find((alias) => normalizeTitle(alias) === normalized);

    if (exact) {
      return {
        role_title: roleTitle,
        soc_code: entry.soc.slice(0, 7),
        onet_code: entry.soc,
        soc_title: entry.title,
        confidence: 1,
        matched_via: "exact_alias",
      };
    }
  }

  const best = SOC_ENTRIES.flatMap((entry) =>
    [entry.title, ...entry.aliases].map((alias) => ({
      entry,
      score: tokenOverlap(roleTitle, alias),
    })),
  ).sort((a, b) => b.score - a.score)[0];

  if (!best || best.score < 0.5) {
    throw new Error(`Unable to resolve role title "${roleTitle}" to a SOC/O*NET entity.`);
  }

  return {
    role_title: roleTitle,
    soc_code: best.entry.soc.slice(0, 7),
    onet_code: best.entry.soc,
    soc_title: best.entry.title,
    confidence: Number(best.score.toFixed(2)),
    matched_via: "token_overlap",
  };
}
