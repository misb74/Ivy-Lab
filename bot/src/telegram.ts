import { Bot, InputFile, Context } from 'grammy';
import { isAllowed, REJECTION_MESSAGE } from './auth.js';
import { ConversationStore } from './conversation-store.js';
import { runClaude, requestStop, type RunResult } from './claude-runner.js';
import { FileManager } from './file-manager.js';
import { AuditLogger } from './audit.js';
import type { MCPManager } from './mcp-manager.js';
import type Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const activeRequests = new Map<string, boolean>();

export function createBot(
  token: string,
  mcpManager: MCPManager,
  conversationStore: ConversationStore,
  audit: AuditLogger,
  fileManager: FileManager,
): Bot {
  const bot = new Bot(token);

  // Auth middleware — reject unauthorized users
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !isAllowed(userId)) {
      console.log(`[bot] Rejected message from Telegram userId=${userId} username=${ctx.from?.username ?? '<none>'} name="${ctx.from?.first_name ?? ''} ${ctx.from?.last_name ?? ''}"`);
      if (ctx.message) {
        await ctx.reply(REJECTION_MESSAGE);
      }
      return;
    }
    await next();
  });

  // /start
  bot.command('start', async (ctx) => {
    const name = ctx.from?.first_name || 'there';
    await ctx.reply(
      `Hey ${name}.\n\n` +
      `Full Ivy, on Telegram. Research, documents, emails, data — everything the web app can do.\n\n` +
      `What are we working on?`,
    );
  });

  // /clear
  bot.command('clear', async (ctx) => {
    const chatId = String(ctx.chat.id);
    conversationStore.clearChat(chatId);
    await ctx.reply('History cleared. Fresh start.');
  });

  // /usage
  bot.command('usage', async (ctx) => {
    const chatId = String(ctx.chat.id);
    const usage = conversationStore.getDailyUsage(chatId);
    const estimatedCost = (
      (usage.total_input_tokens / 1_000_000) * 3 +
      (usage.total_output_tokens / 1_000_000) * 15
    ).toFixed(4);

    await ctx.reply(
      `Today's usage:\n` +
      `Input: ${usage.total_input_tokens.toLocaleString()} tokens\n` +
      `Output: ${usage.total_output_tokens.toLocaleString()} tokens\n` +
      `Tool calls: ${usage.total_tool_calls}\n` +
      `Est. cost: ~$${estimatedCost}`,
    );
  });

  // /stop
  bot.command('stop', async (ctx) => {
    const chatId = String(ctx.chat.id);
    if (activeRequests.get(chatId)) {
      requestStop(chatId);
      await ctx.reply('Stopping...');
    } else {
      await ctx.reply('Nothing running.');
    }
  });

  // /help
  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Commands:\n' +
      '/start — Welcome\n' +
      '/clear — Wipe conversation history\n' +
      '/usage — Today\'s token usage & cost\n' +
      '/stop — Cancel current request\n' +
      '/help — This message\n\n' +
      'Send any message to chat with Ivy. You can also send files (PDF, DOCX, images) for analysis.',
    );
  });

  // Handle documents (file uploads)
  bot.on('message:document', async (ctx) => {
    await handleMessage(ctx, mcpManager, conversationStore, audit, fileManager);
  });

  // Handle photos
  bot.on('message:photo', async (ctx) => {
    await handleMessage(ctx, mcpManager, conversationStore, audit, fileManager);
  });

  // Handle voice messages
  bot.on('message:voice', async (ctx) => {
    await handleMessage(ctx, mcpManager, conversationStore, audit, fileManager);
  });

  // Handle text messages
  bot.on('message:text', async (ctx) => {
    await handleMessage(ctx, mcpManager, conversationStore, audit, fileManager);
  });

  return bot;
}

async function handleMessage(
  ctx: Context,
  mcpManager: MCPManager,
  conversationStore: ConversationStore,
  audit: AuditLogger,
  fileManager: FileManager,
): Promise<void> {
  const chatId = String(ctx.chat!.id);
  const userName = ctx.from?.first_name;

  activeRequests.set(chatId, true);

  try {
    let userText = ctx.message?.text || ctx.message?.caption || '';
    const uploadedPaths: string[] = [];

    // Handle file uploads
    if (ctx.message?.document) {
      const file = await ctx.getFile();
      const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
      const response = await fetch(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      const fileName = ctx.message.document.file_name || 'upload';
      const savedPath = fileManager.saveUpload(chatId, fileName, buffer);
      uploadedPaths.push(savedPath);
      if (!userText) userText = `[Uploaded file: ${fileName}]`;
      else userText += `\n[Uploaded file: ${fileName} at ${savedPath}]`;
    }

    if (ctx.message?.photo) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const file = await ctx.api.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
      const response = await fetch(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      const savedPath = fileManager.saveUpload(chatId, `photo_${Date.now()}.jpg`, buffer);
      uploadedPaths.push(savedPath);
      if (!userText) userText = `[Uploaded photo at ${savedPath}]`;
      else userText += `\n[Uploaded photo at ${savedPath}]`;
    }

    if (ctx.message?.voice) {
      const file = await ctx.api.getFile(ctx.message.voice.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
      const response = await fetch(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      const savedPath = fileManager.saveUpload(chatId, `voice_${Date.now()}.ogg`, buffer);
      uploadedPaths.push(savedPath);
      if (!userText) userText = `[Voice message at ${savedPath}]`;
      else userText += `\n[Voice message at ${savedPath}]`;
    }

    if (!userText.trim()) return;

    // Store user message
    conversationStore.addMessage(chatId, 'user', userText, {
      filePaths: uploadedPaths.length > 0 ? uploadedPaths : undefined,
    });

    // Load conversation history
    const history = conversationStore.getRecentMessages(chatId);
    const apiMessages: Anthropic.MessageParam[] = history.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    await ctx.replyWithChatAction('typing');

    // Run Claude
    const result: RunResult = await runClaude(
      chatId,
      apiMessages,
      mcpManager,
      audit,
      fileManager,
      async (progressMsg) => {
        try { await ctx.reply(progressMsg); } catch { /* ignore */ }
      },
      userName,
    );

    // Store assistant response
    conversationStore.addMessage(chatId, 'assistant', result.text, {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
    if (result.toolCalls > 0) {
      conversationStore.recordToolCalls(chatId, result.toolCalls);
    }

    // Strip artifact tags
    const cleanText = result.text.replace(
      /<artifact[\s\S]*?<\/artifact>/g,
      '[Full output saved — check web app]',
    );

    // Send text response, split if > 4096 chars
    const chunks = splitMessage(cleanText, 4096);
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }

    // Send generated files
    for (const filePath of result.files) {
      if (fs.existsSync(filePath)) {
        const fileName = path.basename(filePath);
        await ctx.replyWithDocument(new InputFile(filePath, fileName));
      }
    }

    // Token usage footer
    const inK = result.inputTokens > 1000
      ? `${(result.inputTokens / 1000).toFixed(1)}k`
      : String(result.inputTokens);
    const outK = result.outputTokens > 1000
      ? `${(result.outputTokens / 1000).toFixed(1)}k`
      : String(result.outputTokens);
    await ctx.reply(`[${inK} in / ${outK} out${result.toolCalls > 0 ? ` / ${result.toolCalls} tools` : ''}]`);

  } catch (err: any) {
    console.error('[bot] Message handler error:', err);
    await ctx.reply(`Error: ${err.message}`);
  } finally {
    activeRequests.delete(chatId);
  }
}

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf('\n', maxLen);
    if (splitIdx < maxLen * 0.5) splitIdx = maxLen;
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }
  return chunks;
}
