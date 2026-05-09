const ALLOWED_IDS: Set<number> = new Set(
  (process.env.ALLOWED_TELEGRAM_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => !isNaN(n))
);

export function isAllowed(telegramUserId: number): boolean {
  return ALLOWED_IDS.has(telegramUserId);
}

export const REJECTION_MESSAGE = 'This bot is private.';
