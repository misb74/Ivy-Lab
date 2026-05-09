/**
 * Semantic Scholar academic paper search.
 */

interface ScholarlyResult {
  query: string;
  total_results: number;
  papers: ScholarlyPaper[];
  source: string;
}

interface ScholarlyPaper {
  title: string;
  authors: string[];
  year: number | null;
  abstract: string | null;
  citation_count: number;
  doi: string | null;
  url: string | null;
}

const SEMANTIC_SCHOLAR_API = 'https://api.semanticscholar.org/graph/v1/paper/search';

// Simple in-memory cache with 15-min TTL
const cache = new Map<string, { data: ScholarlyResult; expiry: number }>();

export async function scholarlySearch(params: {
  query: string;
  num_results?: number;
  year_from?: number;
}): Promise<ScholarlyResult> {
  const { query, num_results = 10, year_from } = params;

  // Check cache
  const cacheKey = `${query}|${num_results}|${year_from || ''}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  const searchParams = new URLSearchParams({
    query,
    limit: String(Math.min(num_results, 100)),
    fields: 'title,authors,year,abstract,citationCount,externalIds',
  });

  if (year_from) {
    searchParams.set('year', `${year_from}-`);
  }

  const response = await fetch(`${SEMANTIC_SCHOLAR_API}?${searchParams}`, {
    headers: { 'User-Agent': 'Ivy-WorkVine/2.0' },
  });

  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  const papers: ScholarlyPaper[] = (data.data || []).map((paper: any) => ({
    title: paper.title || 'Untitled',
    authors: (paper.authors || []).map((a: any) => a.name),
    year: paper.year || null,
    abstract: paper.abstract || null,
    citation_count: paper.citationCount || 0,
    doi: paper.externalIds?.DOI || null,
    url: paper.externalIds?.DOI
      ? `https://doi.org/${paper.externalIds.DOI}`
      : null,
  }));

  const result: ScholarlyResult = {
    query,
    total_results: data.total || papers.length,
    papers,
    source: 'Semantic Scholar',
  };

  // Cache for 15 minutes
  cache.set(cacheKey, { data: result, expiry: Date.now() + 15 * 60 * 1000 });

  return result;
}
