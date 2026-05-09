import { newPage } from '../browser/browser-manager.js';
import { checkUrl, checkField, checkButton, auditPageBeforeSubmit } from '../safety/safety-layer.js';
import { waitForPageLoad } from '../browser/page-utils.js';

export interface FillSubmitParams {
  url: string;
  fields: Array<{
    selector: string;
    value: string;
  }>;
  submit_selector?: string;
}

export async function fillAndSubmitForm(params: FillSubmitParams): Promise<{
  success: boolean;
  url_before: string;
  url_after: string;
  fields_filled: number;
  submitted: boolean;
  screenshot_base64?: string;
}> {
  const { url, fields, submit_selector } = params;

  const urlViolation = checkUrl(url);
  if (urlViolation) {
    throw new Error(`SAFETY BLOCK: ${urlViolation.reason}`);
  }

  const page = await newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForPageLoad(page);

    // Fill each field with safety checks
    let fieldsFilled = 0;
    for (const field of fields) {
      const fieldViolation = await checkField(page, field.selector);
      if (fieldViolation) {
        throw new Error(`SAFETY BLOCK on field "${field.selector}": ${fieldViolation.reason}`);
      }

      await page.fill(field.selector, field.value);
      fieldsFilled++;
    }

    const urlBefore = page.url();
    let submitted = false;

    if (submit_selector) {
      // Check submit button
      const buttonViolation = await checkButton(page, submit_selector);
      if (buttonViolation) {
        throw new Error(`SAFETY BLOCK on button "${submit_selector}": ${buttonViolation.reason}`);
      }

      // Audit entire form for payment fields before submit
      const formViolation = await auditPageBeforeSubmit(page);
      if (formViolation) {
        throw new Error(`SAFETY BLOCK: ${formViolation.reason}`);
      }

      // Take screenshot before submit
      const screenshot = await page.screenshot({ type: 'png' });
      const screenshotBase64 = screenshot.toString('base64');

      // Submit
      await page.click(submit_selector);
      await waitForPageLoad(page);
      submitted = true;

      return {
        success: true,
        url_before: urlBefore,
        url_after: page.url(),
        fields_filled: fieldsFilled,
        submitted,
        screenshot_base64: screenshotBase64,
      };
    }

    return {
      success: true,
      url_before: urlBefore,
      url_after: page.url(),
      fields_filled: fieldsFilled,
      submitted: false,
    };
  } finally {
    await page.close();
  }
}
