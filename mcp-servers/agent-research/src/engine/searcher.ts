export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

export async function searchDuckDuckGo(query: string, maxResults: number = 5): Promise<SearchResult[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${encoded}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const html = await response.text();
    return parseSearchResults(html, maxResults);
  } catch (error) {
    console.error(`Search error for "${query}":`, (error as Error).message);
    return [];
  }
}

function parseSearchResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];

  // Parse DuckDuckGo HTML results
  const resultPattern = /<a[^>]+class="result__a"[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetPattern = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  const links: Array<{ url: string; title: string }> = [];
  let match;

  while ((match = resultPattern.exec(html)) !== null) {
    const href = decodeURIComponent(match[1].replace(/.*uddg=/, '').replace(/&.*/, ''));
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    if (href.startsWith('http')) {
      links.push({ url: href, title });
    }
  }

  const snippets: string[] = [];
  while ((match = snippetPattern.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, '').trim());
  }

  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    results.push({
      url: links[i].url,
      title: links[i].title,
      snippet: snippets[i] || '',
    });
  }

  return results;
}
