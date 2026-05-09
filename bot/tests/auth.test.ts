import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('auth', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows a user whose ID is in the allowlist', async () => {
    vi.stubEnv('ALLOWED_TELEGRAM_IDS', '123456,789012');
    const { isAllowed } = await import('../src/auth.js');
    expect(isAllowed(123456)).toBe(true);
    expect(isAllowed(789012)).toBe(true);
  });

  it('rejects a user whose ID is not in the allowlist', async () => {
    vi.stubEnv('ALLOWED_TELEGRAM_IDS', '123456');
    const { isAllowed } = await import('../src/auth.js');
    expect(isAllowed(999999)).toBe(false);
  });

  it('rejects all users when ALLOWED_TELEGRAM_IDS is not set', async () => {
    vi.stubEnv('ALLOWED_TELEGRAM_IDS', '');
    const { isAllowed } = await import('../src/auth.js');
    expect(isAllowed(123456)).toBe(false);
  });

  it('returns the rejection message with no capability hints', async () => {
    const { REJECTION_MESSAGE } = await import('../src/auth.js');
    expect(REJECTION_MESSAGE).toBe('This bot is private.');
    expect(REJECTION_MESSAGE).not.toContain('Ivy');
    expect(REJECTION_MESSAGE).not.toContain('workforce');
  });
});
