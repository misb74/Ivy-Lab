import { newPage } from '../browser/browser-manager.js';
import { checkUrl, checkField, checkButton, auditPageBeforeSubmit } from '../safety/safety-layer.js';
import { extractPageText, waitForPageLoad } from '../browser/page-utils.js';

export interface BrowseAction {
  action: 'goto' | 'click' | 'fill' | 'wait' | 'extract' | 'screenshot';
  selector?: string;
  value?: string;
  url?: string;
  timeout?: number;
}

export interface MultiStepParams {
  actions: BrowseAction[];
}

export async function multiStepBrowse(params: MultiStepParams): Promise<{
  steps_completed: number;
  total_steps: number;
  results: Array<{
    step: number;
    action: string;
    success: boolean;
    data?: string;
    error?: string;
  }>;
  final_url: string;
}> {
  const { actions } = params;
  const page = await newPage();
  const results: Array<{
    step: number;
    action: string;
    success: boolean;
    data?: string;
    error?: string;
  }> = [];

  let stepsCompleted = 0;

  try {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      try {
        switch (action.action) {
          case 'goto': {
            const url = action.url || action.value;
            if (!url) throw new Error('URL required for goto action');
            const violation = checkUrl(url);
            if (violation) throw new Error(`SAFETY BLOCK: ${violation.reason}`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: action.timeout || 30000 });
            await waitForPageLoad(page);
            results.push({ step: i + 1, action: 'goto', success: true, data: page.url() });
            break;
          }

          case 'click': {
            if (!action.selector) throw new Error('Selector required for click action');
            const btnViolation = await checkButton(page, action.selector);
            if (btnViolation) throw new Error(`SAFETY BLOCK: ${btnViolation.reason}`);
            await page.click(action.selector, { timeout: action.timeout || 10000 });
            await waitForPageLoad(page);
            results.push({ step: i + 1, action: 'click', success: true });
            break;
          }

          case 'fill': {
            if (!action.selector || action.value === undefined) {
              throw new Error('Selector and value required for fill action');
            }
            const fieldViolation = await checkField(page, action.selector);
            if (fieldViolation) throw new Error(`SAFETY BLOCK: ${fieldViolation.reason}`);
            await page.fill(action.selector, action.value);
            results.push({ step: i + 1, action: 'fill', success: true });
            break;
          }

          case 'wait': {
            if (action.selector) {
              await page.waitForSelector(action.selector, { timeout: action.timeout || 10000 });
            } else {
              await new Promise(resolve => setTimeout(resolve, (action.timeout || 2000)));
            }
            results.push({ step: i + 1, action: 'wait', success: true });
            break;
          }

          case 'extract': {
            const text = action.selector
              ? await page.evaluate((sel) => document.querySelector(sel)?.textContent?.trim() || '', action.selector)
              : await extractPageText(page);
            results.push({ step: i + 1, action: 'extract', success: true, data: text.slice(0, 5000) });
            break;
          }

          case 'screenshot': {
            const screenshot = await page.screenshot({ type: 'png' });
            results.push({
              step: i + 1,
              action: 'screenshot',
              success: true,
              data: `Screenshot captured (${screenshot.length} bytes)`,
            });
            break;
          }

          default:
            throw new Error(`Unknown action: ${action.action}`);
        }

        stepsCompleted++;
      } catch (error) {
        results.push({
          step: i + 1,
          action: action.action,
          success: false,
          error: (error as Error).message,
        });
        // Stop on safety blocks, continue on other errors
        if ((error as Error).message.startsWith('SAFETY BLOCK')) break;
      }
    }

    return {
      steps_completed: stepsCompleted,
      total_steps: actions.length,
      results,
      final_url: page.url(),
    };
  } finally {
    await page.close();
  }
}
