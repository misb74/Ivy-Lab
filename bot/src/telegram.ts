import { Bot, Context } from 'grammy';
import { isAllowed } from './auth.js';
import { runQuery } from './runner.js';
import { SessionStore } from './sessions.js';

export interface BotConfig {
  token: string;
  cwd: string;
  responsesDir: string;
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

  // Handle documents (e.g. screenshots, PDFs) by acknowledging and noting limitations
  bot.on('message:document', async ctx => {
    if (!ctx.from || !isAllowed(ctx.from.id)) return;
    await ctx.reply(
      'Document received but file handling is not wired in this build. ' +
      'Send the relevant text inline or paste the URL/path.',
    );
  });

  bot.catch(err => {
    console.error('[bot] Unhandled error:', err);
  });

  return bot;
}
