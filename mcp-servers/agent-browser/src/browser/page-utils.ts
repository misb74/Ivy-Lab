import type { Page } from 'playwright';

export async function extractPageText(page: Page): Promise<string> {
  return page.evaluate(() => {
    // Remove script and style elements
    const clone = document.cloneNode(true) as Document;
    const removals = clone.querySelectorAll('script, style, noscript, svg, nav, footer, header');
    removals.forEach(el => el.remove());

    const body = clone.querySelector('body');
    if (!body) return document.title || '';

    // Get text content and clean up whitespace
    return body.innerText
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim()
      .slice(0, 50000); // Limit to ~50k chars
  });
}

export async function extractStructuredData(page: Page): Promise<{
  title: string;
  url: string;
  headings: string[];
  links: Array<{ text: string; href: string }>;
  meta: Record<string, string>;
}> {
  return page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .map(h => h.textContent?.trim() || '')
      .filter(Boolean)
      .slice(0, 20);

    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({
        text: a.textContent?.trim() || '',
        href: (a as HTMLAnchorElement).href,
      }))
      .filter(l => l.text && l.href.startsWith('http'))
      .slice(0, 50);

    const meta: Record<string, string> = {};
    document.querySelectorAll('meta[name], meta[property]').forEach(m => {
      const key = m.getAttribute('name') || m.getAttribute('property') || '';
      const value = m.getAttribute('content') || '';
      if (key && value) meta[key] = value.slice(0, 200);
    });

    return {
      title: document.title,
      url: window.location.href,
      headings,
      links,
      meta,
    };
  });
}

export async function waitForPageLoad(page: Page, timeout: number = 15000): Promise<void> {
  try {
    await page.waitForLoadState('domcontentloaded', { timeout });
  } catch {
    // Page may have loaded enough, continue
  }
}
