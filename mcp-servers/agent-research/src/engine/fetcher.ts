export interface FetchedPage {
  url: string;
  title: string;
  content: string;
  success: boolean;
  error?: string;
}

export async function fetchPageContent(url: string): Promise<FetchedPage> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { url, title: '', content: '', success: false, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const title = extractTitle(html);
    const content = htmlToText(html);

    return { url, title, content: content.slice(0, 15000), success: true };
  } catch (error) {
    return {
      url,
      title: '',
      content: '',
      success: false,
      error: (error as Error).message,
    };
  }
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function htmlToText(html: string): string {
  return html
    // Remove scripts and styles
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    // Convert block elements to newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|br)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
