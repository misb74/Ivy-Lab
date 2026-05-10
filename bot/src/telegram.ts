import { Bot, Context } from 'grammy';
import { isAllowed } from './auth.js';
import { runQuery } from './runner.js';
import { SessionStore } from './sessions.js';
import { downloadAttachment, cleanupOldUploads, UploadResult } from './file-handler.js';

export interface BotConfig {
  token: string;
  cwd: string;
  responsesDir: string;
  uploadsDir: string;
  sessions: SessionStore;
}

export function buildBot(config: BotConfig): Bot {
  const bot = new Bot(config.token);

  bot.command('start', async ctx => {
    await ctx.reply(
      'Ivy Lab bot — connected to your local research stack.\n' +
      'Send me a query and I\'ll route through the same skills + MCP fleet as terminal Claude Code.\n\n' +
      'Commands:\n' +
      '  /clear — reset this chat\'s session (next message starts fresh)\n' +
      '  /help — this message',
    );
  });

  bot.command('help', async ctx => {
    await ctx.reply(
      'Available commands:\n' +
      '  /start — welcome message\n' +
      '  /clear — reset this chat\'s SDK session\n' +
      '  /help — this message\n\n' +
      'Anything else gets sent to the agent.',
    );
  });

  bot.command('clear', async ctx => {
    if (!ctx.from || !isAllowed(ctx.from.id)) {
      await ctx.reply('Not authorised.');
      return;
    }
    if (ctx.chat?.id) config.sessions.clear(ctx.chat.id);
    await ctx.reply('Session cleared. Next message starts a fresh conversation.');
  });

  bot.on('message:text', async ctx => {
    if (!ctx.from) return;
    if (!isAllowed(ctx.from.id)) {
      console.warn(`[bot] Rejected message from unauthorised user: ${ctx.from.id}`);
      return; // Silently drop — don't tell unknown users why we ignored them
    }
    const prompt = ctx.message.text.trim();
    if (!prompt) return;
    await runQuery({
      ctx,
      prompt,
      cwd: config.cwd,
      responsesDir: config.responsesDir,
      sessions: config.sessions,
    });
  });

  // Handle documents (PDFs, txt, csv, etc.) — download, then route to agent with file path
  bot.on('message:document', async ctx => {
    if (!ctx.from || !isAllowed(ctx.from.id)) return;
    await handleAttachment(ctx, config, 'document');
  });

  // Handle photos (screenshots, camera images) — same pattern
  bot.on('message:photo', async ctx => {
    if (!ctx.from || !isAllowed(ctx.from.id)) return;
    await handleAttachment(ctx, config, 'photo');
  });

  bot.catch(err => {
    console.error('[bot] Unhandled error:', err);
  });

  return bot;
}

async function handleAttachment(
  ctx: Context,
  config: BotConfig,
  expected: 'document' | 'photo',
): Promise<void> {
  let result: UploadResult | null;
  try {
    result = await downloadAttachment(ctx, config.uploadsDir);
  } catch (err: any) {
    await ctx.reply(`File download failed: ${String(err?.message || err).slice(0, 200)}`);
    return;
  }
  if (!result) {
    await ctx.reply(`No ${expected} found in that message.`);
    return;
  }
  cleanupOldUploads(config.uploadsDir).catch(() => {/* best-effort */});

  const caption = (ctx.message?.caption || '').trim();
  const defaultAsk = result.kind === 'photo' ? 'describe and analyse this image' : 'analyse this file';
  const ask = caption || defaultAsk;
  const sizeKb = Math.round(result.size / 1024);
  const meta = result.mimeType ? `${sizeKb}KB ${result.mimeType}` : `${sizeKb}KB`;

  const prompt =
    `User uploaded a ${result.kind} via Telegram.\n` +
    `Path: ${result.filepath}\n` +
    `Original filename: ${result.filename}\n` +
    `Size/type: ${meta}\n\n` +
    `User's request: ${ask}\n\n` +
    `Use the Read tool to inspect the file at the path above. ` +
    `Then answer the user's request based on the file contents.`;

  await runQuery({
    ctx,
    prompt,
    cwd: config.cwd,
    responsesDir: config.responsesDir,
    sessions: config.sessions,
  });
}
