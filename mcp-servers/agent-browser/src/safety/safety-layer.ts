import type { Page, ElementHandle } from 'playwright';
import {
  BLOCKED_URL_PATTERNS,
  BLOCKED_FIELD_PATTERNS,
  BLOCKED_BUTTON_PATTERNS,
  BLOCKED_INPUT_TYPES,
} from './blocked-patterns.js';

export interface SafetyViolation {
  blocked: true;
  reason: string;
  url: string;
  selector?: string;
  type: 'url' | 'field' | 'button' | 'form';
}

export function checkUrl(url: string): SafetyViolation | null {
  for (const pattern of BLOCKED_URL_PATTERNS) {
    if (pattern.test(url)) {
      return {
        blocked: true,
        reason: `URL matches blocked pattern: ${pattern.source}`,
        url,
        type: 'url',
      };
    }
  }
  return null;
}

export async function checkField(
  page: Page,
  selector: string
): Promise<SafetyViolation | null> {
  const attrs = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return {
      name: el.getAttribute('name') || '',
      id: el.getAttribute('id') || '',
      type: el.getAttribute('type') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      placeholder: el.getAttribute('placeholder') || '',
      autocomplete: el.getAttribute('autocomplete') || '',
    };
  }, selector);

  if (!attrs) return null;

  // Always block password type inputs
  if (BLOCKED_INPUT_TYPES.includes(attrs.type)) {
    return {
      blocked: true,
      reason: `Input type="${attrs.type}" is always blocked`,
      url: page.url(),
      selector,
      type: 'field',
    };
  }

  const attrValues = [
    attrs.name, attrs.id, attrs.ariaLabel,
    attrs.placeholder, attrs.autocomplete,
  ].join(' ');

  for (const pattern of BLOCKED_FIELD_PATTERNS) {
    if (pattern.test(attrValues)) {
      return {
        blocked: true,
        reason: `Field attributes match blocked pattern: ${pattern.source}`,
        url: page.url(),
        selector,
        type: 'field',
      };
    }
  }

  return null;
}

export async function checkButton(
  page: Page,
  selector: string
): Promise<SafetyViolation | null> {
  const buttonText = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el?.textContent?.trim() || '';
  }, selector);

  for (const pattern of BLOCKED_BUTTON_PATTERNS) {
    if (pattern.test(buttonText)) {
      return {
        blocked: true,
        reason: `Button text matches blocked payment pattern: "${buttonText}"`,
        url: page.url(),
        selector,
        type: 'button',
      };
    }
  }

  return null;
}

export async function auditPageBeforeSubmit(
  page: Page
): Promise<SafetyViolation | null> {
  const hasPaymentFields = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input, select, textarea');
    const dangerousPatterns = [
      /credit.?card/i, /card.?number/i, /cvv/i, /cvc/i,
      /expir/i, /billing/i, /payment/i,
    ];

    for (const input of inputs) {
      const attrs = [
        input.getAttribute('name'),
        input.getAttribute('id'),
        input.getAttribute('aria-label'),
        input.getAttribute('placeholder'),
        input.getAttribute('autocomplete'),
      ].filter(Boolean).join(' ');

      for (const pattern of dangerousPatterns) {
        if (pattern.test(attrs)) return attrs;
      }
    }
    return null;
  });

  if (hasPaymentFields) {
    return {
      blocked: true,
      reason: `Form contains payment-related fields: ${hasPaymentFields}`,
      url: page.url(),
      type: 'form',
    };
  }

  return null;
}
