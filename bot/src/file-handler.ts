import fs from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'grammy';

export interface UploadResult {
  filename: string;
  filepath: string;
  size: number;
  mimeType?: string;
  kind: 'document' | 'photo';
}

const KEEP_LAST_N = 50;

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

/**
 * Download a Telegram document or photo to disk. Returns metadata for the
 * agent prompt or null if the message has no attachment.
 *
 * Uses Node's built-in fetch (Node 20+). Goes via Telegram's File API:
 *   1. ctx.api.getFile(file_id) → returns { file_path } on the Telegram CDN
 *   2. fetch https://api.telegram.org/file/bot<token>/<file_path>
 *   3. write to uploadsDir
 */
export async function downloadAttachment(
  ctx: Context,
  uploadsDir: string,
): Promise<UploadResult | null> {
  const msg = ctx.message;
  if (!msg) return null;

  let fileId: string;
  let providedName: string | undefined;
  let mimeType: string | undefined;
  let knownSize: number | undefined;
  let kind: 'document' | 'photo';

  if (msg.document) {
    fileId = msg.document.file_id;
    providedName = msg.document.file_name;
    mimeType = msg.document.mime_type;
    knownSize = msg.document.file_size;
    kind = 'document';
  } else if (msg.photo && msg.photo.length > 0) {
    // Telegram sends multiple sizes; take the largest (last entry)
    const largest = msg.photo[msg.photo.length - 1];
    fileId = largest.file_id;
    knownSize = largest.file_size;
    kind = 'photo';
  } else {
    return null;
  }

  const file = await ctx.api.getFile(fileId);
  if (!file.file_path) return null;

  const token = ctx.api.token;
  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

  const ext = path.extname(file.file_path)
    || (mimeType ? '.' + mimeType.split('/')[1] : '')
    || '';
  const chatId = ctx.chat?.id ?? 'unknown';
  const ts = Date.now();
  const baseName = providedName ?? `${kind}-${chatId}-${ts}${ext}`;
  const filename = safeFilename(baseName);

  await fs.mkdir(uploadsDir, { recursive: true });
  const filepath = path.join(uploadsDir, filename);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Telegram file download failed: ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(filepath, buf);

  return {
    filename,
    filepath,
    size: knownSize ?? buf.length,
    mimeType,
    kind,
  };
}

/**
 * Keep only the last N files in uploadsDir by mtime. Older files deleted.
 * Solo Lab use — no per-chat scoping.
 */
export async function cleanupOldUploads(uploadsDir: string, keepLastN = KEEP_LAST_N): Promise<void> {
  let exists = false;
  try {
    await fs.access(uploadsDir);
    exists = true;
  } catch {
    return;
  }
  if (!exists) return;

  const names = await fs.readdir(uploadsDir);
  const entries = await Promise.all(
    names.map(async name => {
      const full = path.join(uploadsDir, name);
      try {
        const stat = await fs.stat(full);
        if (!stat.isFile()) return null;
        return { full, mtime: stat.mtimeMs };
      } catch {
        return null;
      }
    }),
  );
  const valid = entries.filter((e): e is { full: string; mtime: number } => e !== null);
  valid.sort((a, b) => b.mtime - a.mtime);
  for (const old of valid.slice(keepLastN)) {
    try { await fs.unlink(old.full); } catch { /* ignore */ }
  }
}
