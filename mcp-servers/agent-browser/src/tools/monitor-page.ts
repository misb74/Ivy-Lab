import { newPage } from '../browser/browser-manager.js';
import { checkUrl } from '../safety/safety-layer.js';
import { extractPageText, waitForPageLoad } from '../browser/page-utils.js';

export interface MonitorPageParams {
  url: string;
  selector?: string;
  interval_seconds?: number;
  max_checks?: number;
}

export async function monitorPage(params: MonitorPageParams): Promise<{
  url: string;
  checks_performed: number;
  changes_detected: boolean;
  initial_content: string;
  final_content: string;
  changed_at_check?: number;
}> {
  const { url, selector, interval_seconds = 30, max_checks = 5 } = params;

  const violation = checkUrl(url);
  if (violation) {
    throw new Error(`SAFETY BLOCK: ${violation.reason}`);
  }

  const page = await newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForPageLoad(page);

    const getContent = async (): Promise<string> => {
      if (selector) {
        const el = await page.$(selector);
        if (el) return (await el.textContent()) || '';
        return '';
      }
      return extractPageText(page);
    };

    const initialContent = await getContent();
    let previousContent = initialContent;
    let changedAtCheck: number | undefined;

    for (let i = 1; i < max_checks; i++) {
      await new Promise(resolve => setTimeout(resolve, interval_seconds * 1000));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForPageLoad(page);

      const currentContent = await getContent();
      if (currentContent !== previousContent) {
        changedAtCheck = i + 1;
        previousContent = currentContent;
        break;
      }
      previousContent = currentContent;
    }

    return {
      url: page.url(),
      checks_performed: changedAtCheck || max_checks,
      changes_detected: !!changedAtCheck,
      initial_content: initialContent.slice(0, 2000),
      final_content: previousContent.slice(0, 2000),
      changed_at_check: changedAtCheck,
    };
  } finally {
    await page.close();
  }
}
