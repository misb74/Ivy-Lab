import { newPage } from '../browser/browser-manager.js';
import { extractPageText, extractStructuredData, waitForPageLoad } from '../browser/page-utils.js';
import { checkUrl } from '../safety/safety-layer.js';

export interface BrowseExtractParams {
  url: string;
  prompt: string;
  wait_for?: string;
}

export async function browseAndExtract(params: BrowseExtractParams): Promise<{
  url: string;
  title: string;
  content: string;
  headings: string[];
  links: Array<{ text: string; href: string }>;
  meta: Record<string, string>;
}> {
  const { url, prompt, wait_for } = params;

  const violation = checkUrl(url);
  if (violation) {
    throw new Error(`SAFETY BLOCK: ${violation.reason}`);
  }

  const page = await newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForPageLoad(page);

    if (wait_for) {
      try {
        await page.waitForSelector(wait_for, { timeout: 10000 });
      } catch {
        // Selector not found, continue with what we have
      }
    }

    const [content, structured] = await Promise.all([
      extractPageText(page),
      extractStructuredData(page),
    ]);

    return {
      url: page.url(),
      title: structured.title,
      content,
      headings: structured.headings,
      links: structured.links,
      meta: structured.meta,
    };
  } finally {
    await page.close();
  }
}
