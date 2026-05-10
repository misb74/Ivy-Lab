import fs from 'node:fs';
import path from 'node:path';
import type { Context } from 'grammy';

export const THRESHOLD = 3800;
const KEEP_LAST_N = 100;

export interface SendReplyOptions {
  topic: string;
  responsesDir: string;
}

export function deriveDocFilename(topic: string): string {
  const trimmed = (topic || '').trim();
  if (!trimmed) return 'response.md';
  // Strip dangerous chars; collapse whitespace to hyphens
  let safe = trimmed
    .replace(/[\/\\]/g, '')
    .replace(/\.\.+/g, '')
    .replace(/[<>:"|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (safe.length === 0) return 'response.md';
  if (safe.length > 50) safe = safe.slice(0, 50);
  return `${safe}.md`;
}

function cleanupOldResponses(dir: string): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime); // newest first
  for (const old of entries.slice(KEEP_LAST_N)) {
    try { fs.unlinkSync(path.join(dir, old.name)); } catch { /* ignore */ }
  }
}

async function sendTextWithFallback(ctx: Context, text: string): Promise<void> {
  // Try Markdown first; if Telegram's strict parser rejects (400 can't-parse-entities),
  // fall back to plain text so the message still gets through.
  try {
    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch (err: any) {
    const desc = String(err?.description || err?.message || '');
    if (err?.error_code === 400 && /can't parse entities|can't find end of the entity/i.test(desc)) {
      await ctx.reply(text);
      return;
    }
    throw err;
  }
}

export async function sendReply(
  ctx: Context,
  text: string,
  opts: SendReplyOptions
): Promise<void> {
  if (text.length <= THRESHOLD) {
    await sendTextWithFallback(ctx, text);
    return;
  }
  // Long message → save to .md, send as document
  fs.mkdirSync(opts.responsesDir, { recursive: true });
  const chatId = ctx.chat?.id ?? 'unknown';
  const ts = Date.now();
  const filename = deriveDocFilename(opts.topic);
  const filepath = path.join(opts.responsesDir, `chat${chatId}-${ts}-${filename}`);
  fs.writeFileSync(filepath, text);
  cleanupOldResponses(opts.responsesDir);
  await ctx.replyWithDocument({ source: filepath, filename } as any);
}
