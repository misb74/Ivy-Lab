import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SessionStore } from '../src/sessions.js';

describe('SessionStore', () => {
  let tmpDir: string;
  let storePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ivy-lab-sessions-'));
    storePath = path.join(tmpDir, 'sessions.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns undefined for unknown chat', () => {
    const store = new SessionStore(storePath);
    expect(store.get(123456)).toBeUndefined();
  });

  it('round-trips chat_id → session_id', () => {
    const store = new SessionStore(storePath);
    store.set(123456, 'sess-abc');
    expect(store.get(123456)).toBe('sess-abc');
  });

  it('persists across instances', () => {
    const a = new SessionStore(storePath);
    a.set(123456, 'sess-abc');
    const b = new SessionStore(storePath);
    expect(b.get(123456)).toBe('sess-abc');
  });

  it('overwrites existing mapping', () => {
    const store = new SessionStore(storePath);
    store.set(123456, 'sess-old');
    store.set(123456, 'sess-new');
    expect(store.get(123456)).toBe('sess-new');
  });

  it('handles missing file gracefully', () => {
    const store = new SessionStore(path.join(tmpDir, 'doesnt-exist.json'));
    expect(store.get(123)).toBeUndefined();
    store.set(123, 'sess-x');
    expect(store.get(123)).toBe('sess-x');
  });

  it('clears a session', () => {
    const store = new SessionStore(storePath);
    store.set(123456, 'sess-abc');
    store.clear(123456);
    expect(store.get(123456)).toBeUndefined();
  });
});
