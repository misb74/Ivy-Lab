// URL patterns that indicate payment/checkout pages
export const BLOCKED_URL_PATTERNS = [
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

// Field attribute patterns that indicate sensitive fields
export const BLOCKED_FIELD_PATTERNS = [
  /password/i,
  /passwd/i,
  /credit.?card/i,
  /card.?number/i,
  /cvv/i,
  /cvc/i,
  /ccv/i,
  /ssn/i,
  /social.?security/i,
  /bank.?account/i,
  /routing.?number/i,
  /account.?number/i,
  /pin.?code/i,
  /secret.?key/i,
  /api.?key/i,
  /auth.?token/i,
];

// Button text patterns that indicate payment actions
export const BLOCKED_BUTTON_PATTERNS = [
  /pay\s*now/i,
  /place\s*order/i,
  /buy\s*now/i,
  /complete\s*purchase/i,
  /submit\s*payment/i,
  /confirm\s*order/i,
  /process\s*payment/i,
  /checkout/i,
];

// Input types that are always blocked
export const BLOCKED_INPUT_TYPES = ['password'];
