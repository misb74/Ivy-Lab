import { newPage } from '../browser/browser-manager.js';
import { checkUrl } from '../safety/safety-layer.js';
import { extractStructuredData, waitForPageLoad } from '../browser/page-utils.js';

export interface ScreenshotAnalyzeParams {
  url: string;
  full_page?: boolean;
  selector?: string;
}

export async function screenshotAndAnalyze(params: ScreenshotAnalyzeParams): Promise<{
  url: string;
  title: string;
  screenshot_base64: string;
  page_description: {
    headings: string[];
    links_count: number;
    meta: Record<string, string>;
    forms_count: number;
    images_count: number;
    buttons_count: number;
  };
}> {
  const { url, full_page = false, selector } = params;

  const violation = checkUrl(url);
  if (violation) {
    throw new Error(`SAFETY BLOCK: ${violation.reason}`);
  }

  const page = await newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForPageLoad(page);

    let screenshot: Buffer;
    if (selector) {
      const element = await page.$(selector);
      if (!element) throw new Error(`Selector "${selector}" not found`);
      screenshot = await element.screenshot({ type: 'png' });
    } else {
      screenshot = await page.screenshot({ type: 'png', fullPage: full_page });
    }

    const structured = await extractStructuredData(page);

    const counts = await page.evaluate(() => ({
      forms_count: document.querySelectorAll('form').length,
      images_count: document.querySelectorAll('img').length,
      buttons_count: document.querySelectorAll('button, input[type="submit"], [role="button"]').length,
    }));

    return {
      url: page.url(),
      title: structured.title,
      screenshot_base64: screenshot.toString('base64'),
      page_description: {
        headings: structured.headings,
        links_count: structured.links.length,
        meta: structured.meta,
        ...counts,
      },
    };
  } finally {
    await page.close();
  }
}
