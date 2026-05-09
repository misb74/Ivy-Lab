import { generateSubQuestions } from '../engine/planner.js';
import { searchDuckDuckGo } from '../engine/searcher.js';
import { fetchPageContent } from '../engine/fetcher.js';
import { synthesize } from '../engine/synthesizer.js';

export interface QuickResearchParams {
  query: string;
}

export async function quickResearch(params: QuickResearchParams): Promise<{
  query: string;
  summary: string;
  key_findings: string[];
  sources: Array<{ url: string; title: string; relevance: string }>;
  confidence: string;
  gaps: string[];
}> {
  const { query } = params;

  // Single-pass research: 1 search, fetch top 3 pages
  const subQuestions = generateSubQuestions(query, 'quick');
  const searchResults = await searchDuckDuckGo(query, 5);

  const topUrls = searchResults.slice(0, 3).map(r => r.url);
  const fetchedPages = await Promise.all(topUrls.map(url => fetchPageContent(url)));

  const report = synthesize(query, subQuestions, searchResults, fetchedPages);

  return {
    query,
    ...report,
  };
}
