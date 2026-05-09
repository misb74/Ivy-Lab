/**
 * Safety layer for computer use sandbox actions.
 * Blocks payment URLs, credential input, and dangerous shell commands.
 * Mirrors patterns from agent-browser's safety-layer.ts.
 */

// URL patterns that indicate payment/checkout pages
const BLOCKED_URL_PATTERNS = [
  /\/checkout/i,
  /\/payment/i,
  /\/billing/i,
  /\/purchase/i,
  /\/pay\b/i,
  /paypal\.com/i,
  /stripe\.com\/pay/i,
  /square\.com\/pay/i,
  /venmo\.com/i,
];

// Text that looks like credential input
const BLOCKED_TYPE_PATTERNS = [
  /^.{0,4}password.{0,30}$/i,
  /^.{0,4}ssn.{0,15}$/i,
  /^[0-9]{13,19}$/,                // credit card numbers
  /^[0-9]{3,4}$/,                  // CVV
  /^[A-Za-z0-9+/=]{40,}$/,        // API keys / tokens (long base64)
];

// Shell commands that are dangerous in a sandbox
const BLOCKED_KEY_SEQUENCES = [
  /sudo\s/i,
  /rm\s+-rf\s+\//i,
  /curl.*\|\s*sh/i,
  /wget.*\|\s*sh/i,
  /chmod\s+777/i,
];

export interface SafetyViolation {
  blocked: true;
  reason: string;
  action: string;
  type: 'url' | 'credential' | 'dangerous_command';
}

/**
 * Check if a URL navigation should be blocked.
 */
export function checkUrl(url: string): SafetyViolation | null {
  for (const pattern of BLOCKED_URL_PATTERNS) {
    if (pattern.test(url)) {
      return {
        blocked: true,
        reason: `URL matches blocked pattern: ${pattern.source}`,
        action: 'navigate',
        type: 'url',
      };
    }
  }
  return null;
}

/**
 * Check if typed text looks like credentials or sensitive data.
 */
export function checkTypedText(text: string): SafetyViolation | null {
  for (const pattern of BLOCKED_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        blocked: true,
        reason: `Typed text matches blocked credential pattern`,
        action: 'type',
        type: 'credential',
      };
    }
  }
  return null;
}

/**
 * Check if a key sequence is a dangerous shell command.
 */
export function checkKeySequence(text: string): SafetyViolation | null {
  for (const pattern of BLOCKED_KEY_SEQUENCES) {
    if (pattern.test(text)) {
      return {
        blocked: true,
        reason: `Key sequence matches dangerous command pattern`,
        action: 'key',
        type: 'dangerous_command',
      };
    }
  }
  return null;
}

/**
 * Run all applicable safety checks for a computer use action.
 */
export function checkAction(
  action: string,
  params: Record<string, any>
): SafetyViolation | null {
  // Check URL navigation in type actions (user may type a URL in address bar)
  if (action === 'type' && params.text) {
    const urlCheck = checkUrl(params.text);
    if (urlCheck) return urlCheck;

    const credCheck = checkTypedText(params.text);
    if (credCheck) return credCheck;
  }

  // Check key combos for dangerous shell commands
  if (action === 'key' && params.text) {
    const keyCheck = checkKeySequence(params.text);
    if (keyCheck) return keyCheck;
  }

  return null;
}
