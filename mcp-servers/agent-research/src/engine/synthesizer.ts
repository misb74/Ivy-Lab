import type { SearchResult } from './searcher.js';
import type { FetchedPage } from './fetcher.js';

export interface SynthesizedReport {
  summary: string;
  key_findings: string[];
  sources: Array<{
    url: string;
    title: string;
    relevance: string;
  }>;
  confidence: 'high' | 'medium' | 'low';
  gaps: string[];
}

export function synthesize(
  query: string,
  subQuestions: string[],
  searchResults: SearchResult[],
  fetchedPages: FetchedPage[]
): SynthesizedReport {
  const successfulPages = fetchedPages.filter(p => p.success && p.content.length > 100);
  const allSnippets = searchResults.map(r => r.snippet).filter(Boolean);

  // Build key findings from search snippets and page content
  const keyFindings: string[] = [];
  const seenTopics = new Set<string>();

  // Extract findings from snippets
  for (const snippet of allSnippets) {
    const normalized = snippet.toLowerCase().trim();
    const key = normalized.slice(0, 50);
    if (!seenTopics.has(key) && snippet.length > 20) {
      seenTopics.add(key);
      keyFindings.push(snippet);
    }
    if (keyFindings.length >= 8) break;
  }

  // Add findings from fetched page content (first few paragraphs)
  for (const page of successfulPages) {
    const paragraphs = page.content
      .split('\n\n')
      .filter(p => p.trim().length > 50)
      .slice(0, 3);

    for (const para of paragraphs) {
      const key = para.toLowerCase().trim().slice(0, 50);
      if (!seenTopics.has(key)) {
        seenTopics.add(key);
        keyFindings.push(para.trim().slice(0, 300));
      }
      if (keyFindings.length >= 12) break;
    }
    if (keyFindings.length >= 12) break;
  }

  // Build summary
  const summary = buildSummary(query, keyFindings, successfulPages.length, searchResults.length);

  // Build sources with relevance
  const sources = searchResults.slice(0, 10).map(r => ({
    url: r.url,
    title: r.title || r.url,
    relevance: r.snippet ? 'direct' : 'indirect',
  }));

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low';
  if (successfulPages.length >= 3 && keyFindings.length >= 5) {
    confidence = 'high';
  } else if (successfulPages.length >= 1 && keyFindings.length >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Identify gaps
  const gaps: string[] = [];
  if (successfulPages.length === 0) {
    gaps.push('No pages could be fetched for deep content analysis');
  }
  if (keyFindings.length < 3) {
    gaps.push('Limited information found - consider refining the query');
  }
  for (const sq of subQuestions) {
    const hasRelevant = searchResults.some(
      r => r.snippet.toLowerCase().includes(sq.toLowerCase().split(' ').slice(-2).join(' '))
    );
    if (!hasRelevant) {
      gaps.push(`Limited coverage for sub-question: "${sq}"`);
    }
  }

  return {
    summary,
    key_findings: keyFindings.slice(0, 10),
    sources,
    confidence,
    gaps: gaps.slice(0, 5),
  };
}

function buildSummary(
  query: string,
  findings: string[],
  pagesCount: number,
  resultsCount: number
): string {
  const parts = [
    `Research on "${query}" analyzed ${resultsCount} search results and ${pagesCount} full pages.`,
  ];

  if (findings.length > 0) {
    parts.push(`Key findings include: ${findings.slice(0, 3).join(' | ')}`);
  } else {
    parts.push('Limited information was found for this query.');
  }

  return parts.join(' ');
}
