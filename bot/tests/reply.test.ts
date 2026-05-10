import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { sendReply, deriveDocFilename, THRESHOLD } from '../src/reply.js';

describe('reply', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ivy-lab-reply-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('THRESHOLD is 3800', () => {
    expect(THRESHOLD).toBe(3800);
  });

  it('sends text when under threshold', async () => {
    const ctx = { reply: vi.fn(), replyWithDocument: vi.fn(), chat: { id: 123 } };
    await sendReply(ctx as any, 'hello world', { topic: 'greet', responsesDir: tmpDir });
    expect(ctx.reply).toHaveBeenCalledWith('hello world', expect.any(Object));
    expect(ctx.replyWithDocument).not.toHaveBeenCalled();
  });

  it('sends document when over threshold', async () => {
    const long = 'x'.repeat(4000);
    const ctx = { reply: vi.fn(), replyWithDocument: vi.fn(), chat: { id: 123 } };
    await sendReply(ctx as any, long, { topic: 'big-dump', responsesDir: tmpDir });
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(ctx.replyWithDocument).toHaveBeenCalled();
    const args = (ctx.replyWithDocument as any).mock.calls[0][0];
    expect(args.filename).toMatch(/big-dump.*\.md$/);
    expect(fs.existsSync(args.source)).toBe(true);
    expect(fs.readFileSync(args.source, 'utf-8')).toBe(long);
  });

  it('cleans up old responses files (keeps last 100)', async () => {
    // Create 105 files in the responses dir, then trigger sendReply over threshold
    const long = 'x'.repeat(4000);
    for (let i = 0; i < 105; i++) {
      const f = path.join(tmpDir, `chat123-${1000 + i}.md`);
      fs.writeFileSync(f, 'old content');
      // Stagger mtime so sort order is deterministic
      const mtime = new Date(Date.now() - (105 - i) * 1000);
      fs.utimesSync(f, mtime, mtime);
    }
    const ctx = { reply: vi.fn(), replyWithDocument: vi.fn(), chat: { id: 123 } };
    await sendReply(ctx as any, long, { topic: 'cleanup-test', responsesDir: tmpDir });
    const remaining = fs.readdirSync(tmpDir).length;
    expect(remaining).toBeLessThanOrEqual(100);
  });

  describe('deriveDocFilename', () => {
    it('takes first 50 chars and sanitises', () => {
      expect(deriveDocFilename('a normal topic')).toMatch(/^a-normal-topic\.md$/);
    });

    it('strips dangerous chars', () => {
      expect(deriveDocFilename('topic with /slashes\\\\ and ../escapes')).not.toContain('/');
      expect(deriveDocFilename('topic with /slashes\\\\ and ../escapes')).not.toContain('\\\\');
    });

    it('caps at 50 chars before extension', () => {
      const long = 'x'.repeat(100);
      const name = deriveDocFilename(long);
      expect(name.replace(/\.md$/, '').length).toBeLessThanOrEqual(50);
    });

    it('falls back to "response" if topic is empty', () => {
      expect(deriveDocFilename('')).toBe('response.md');
    });
  });
});
