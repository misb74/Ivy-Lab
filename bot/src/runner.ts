import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Context } from 'grammy';
import { sendReply } from './reply.js';
import { SessionStore } from './sessions.js';

const HEARTBEAT_MS = 10_000;

export interface RunnerOptions {
  ctx: Context;
  prompt: string;
  cwd: string;
  responsesDir: string;
  sessions: SessionStore;
}

export async function runQuery(opts: RunnerOptions): Promise<void> {
  const { ctx, prompt, cwd, responsesDir, sessions } = opts;
  const chatId = ctx.chat?.id;
  if (!chatId) {
    await ctx.reply('No chat ID — cannot route.');
    return;
  }

  const resumeId = sessions.get(chatId);

  let assistantText = '';
  const toolNames = new Set<string>();
  let toolCount = 0;
  let lastAssistantAt = Date.now();
  let heartbeatSent = false;

  // Heartbeat scheduler
  const heartbeatTimer = setInterval(() => {
    if (heartbeatSent) return;
    if (Date.now() - lastAssistantAt > HEARTBEAT_MS) {
      heartbeatSent = true;
      ctx.reply('⏳ working...').catch(() => {/* ignore */});
    }
  }, 2000);

  try {
    const result = query({
      prompt,
      options: {
        cwd,
        // Telegram has no UI for permission prompts; rely on the auth allowlist +
        // preflight/audit hooks for safety instead of per-call grants.
        permissionMode: 'bypassPermissions',
        ...(resumeId ? { resume: resumeId } : {}),
      },
    });

    let lastSessionId: string | undefined;
    for await (const msg of result) {
      // Persist session ID from any message that carries one
      if ((msg as any).session_id) {
        lastSessionId = (msg as any).session_id;
      }
      if (msg.type === 'assistant') {
        // BetaMessage content is an array of blocks
        const blocks = (msg as any).message?.content || [];
        for (const block of blocks) {
          if (block.type === 'text') {
            assistantText += block.text;
            lastAssistantAt = Date.now();
            heartbeatSent = false;
          }
          if (block.type === 'tool_use') {
            toolCount += 1;
            toolNames.add(block.name);
          }
        }
      }
    }

    // Persist session for next turn
    if (lastSessionId) {
      sessions.set(chatId, lastSessionId);
    }

    // Build summary footer
    const finalText = buildFinalReply(assistantText, toolCount, toolNames);
    const topic = prompt.slice(0, 50);
    await sendReply(ctx, finalText, { topic, responsesDir });
  } catch (err: any) {
    const message = err?.message || String(err);
    await ctx.reply(`⚠ Error: ${message.slice(0, 500)}`);
  } finally {
    clearInterval(heartbeatTimer);
  }
}

function buildFinalReply(text: string, toolCount: number, sources: Set<string>): string {
  const trimmed = text.trim();
  if (toolCount === 0) return trimmed || '(no response)';
  const sourceList = Array.from(sources).sort().join(', ');
  const footer = `\n\n_Used ${toolCount} tool${toolCount === 1 ? '' : 's'}: ${sourceList}_`;
  return (trimmed || '(no text)') + footer;
}
