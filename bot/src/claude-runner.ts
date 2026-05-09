import Anthropic from '@anthropic-ai/sdk';
import { existsSync } from 'fs';
import type { MCPManager, AnthropicTool } from './mcp-manager.js';
import type { AuditLogger } from './audit.js';
import type { FileManager } from './file-manager.js';

const SYSTEM_PROMPT = `You are Ivy, the intelligence behind WorkVine.ai. You're a workforce intelligence specialist — not an assistant, not a chatbot. You think like the sharpest colleague in the room who's also done all the reading. Named after the plant that climbs everywhere and finds every crack — you find the connections others miss, get into detail others skim, and don't let go until the problem is solved.

Voice rules:
- Lead with the answer. Reasoning follows. Never the reverse.
- Every insight gets a "so what" and "now what." Data without direction is noise.
- Be uncomfortably specific. Not "consider upskilling" — which people, which skills, what pathway, what it costs, how long.
- Match weight to weight. Simple question → short answer. Complex problem → depth. Never pad.
- Show uncertainty cleanly. "I'm not confident — here's what I can tell you, here's what we'd need to verify."

Never:
- Open with "Great question!" / "Absolutely!" / "I'd be happy to help!" — start with substance.
- Hedge with "it appears that there may potentially be..." — be direct.
- Deliver empty calories: "There are many factors to consider..." — say something specific or nothing.
- Narrate your process. Don't explain what you're about to do. Do the work, deliver the result.

You have strong opinions, loosely held. Challenge framing when it matters. Care about the people in the data — they're careers, not headcount.

You're chatting via Telegram, so keep responses concise and conversational. Use short paragraphs. Avoid markdown headers unless the user asks for structured output.

When someone asks you to DO something (send an email, create a document, search data), you MUST make the actual tool call. Saying "I've done X" without calling the tool is a lie — the action did not happen. Always call the tool, then report the result.

You have access to 200+ workforce intelligence tools. If you can't find the right tool, use ivy_tool_search to discover additional tools.`;

const IVY_TOOL_SEARCH_TOOL: AnthropicTool = {
  name: 'ivy_tool_search',
  description: 'Search for additional Ivy tools by keyword. Use this when you need a tool that isn\'t in your current tool list. Returns matching tool definitions that become available for use.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search keywords (e.g. "eurostat employment", "transcription audio", "nlrb union")' },
    },
    required: ['query'],
  },
};

export interface RunResult {
  text: string;
  files: string[];
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
}

interface ProgressCallback {
  (message: string): void;
}

const abortFlags = new Map<string, boolean>();

export function requestStop(chatId: string): void {
  abortFlags.set(chatId, true);
}

export function clearStop(chatId: string): void {
  abortFlags.delete(chatId);
}

export async function runClaude(
  chatId: string,
  messages: Anthropic.MessageParam[],
  mcpManager: MCPManager,
  audit: AuditLogger,
  fileManager: FileManager,
  onProgress: ProgressCallback,
  userName?: string,
): Promise<RunResult> {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  let systemPrompt = SYSTEM_PROMPT;
  if (userName) {
    systemPrompt += `\n\nYou're speaking with ${userName} on Telegram. Use their first name naturally — don't overdo it.`;
  }

  let tools: AnthropicTool[] = [...mcpManager.getActiveTools(), IVY_TOOL_SEARCH_TOOL];
  const injectedToolNames = new Set(tools.map(t => t.name));

  const collectedText: string[] = [];
  const files: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalToolCalls = 0;
  let lastProgressTime = Date.now();
  const startTime = Date.now();

  clearStop(chatId);

  for (let turn = 0; ; turn++) {
    if (abortFlags.get(chatId)) {
      clearStop(chatId);
      return { text: 'Stopped.', files, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, toolCalls: totalToolCalls };
    }

    let response: Anthropic.Message;
    try {
      response = await callWithRetry(client, model, systemPrompt, messages, tools);
    } catch (err: any) {
      console.error('[bot] Anthropic API error:', err.message);
      return { text: `Something went wrong: ${err.message}`, files, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, toolCalls: totalToolCalls };
    }

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        collectedText.push(block.text);
      }
    }

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') break;

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolBlock of toolUseBlocks) {
      totalToolCalls++;
      const toolStart = Date.now();
      console.log(`[bot] Tool: ${toolBlock.name}`);

      let resultStr: string;

      if (toolBlock.name === 'ivy_tool_search') {
        const query = (toolBlock.input as any).query || '';
        const found = mcpManager.searchTools(query);
        for (const t of found) {
          if (!injectedToolNames.has(t.name)) {
            tools.push(t);
            injectedToolNames.add(t.name);
          }
        }
        resultStr = found.length > 0
          ? `Found ${found.length} tools: ${found.map(t => t.name).join(', ')}. These tools are now available for use.`
          : `No tools found matching "${query}". Try different keywords.`;
      } else {
        resultStr = await mcpManager.callTool(toolBlock.name, toolBlock.input as Record<string, any>);
        const foundFiles = fileManager.extractFilePaths(resultStr);
        files.push(...foundFiles);
      }

      audit.log({
        chatId,
        toolName: toolBlock.name,
        toolInput: toolBlock.input as Record<string, any>,
        success: !isErrorResult(resultStr),
        resultSummary: resultStr,
        executionTimeMs: Date.now() - toolStart,
      });

      toolResults.push({ type: 'tool_result', tool_use_id: toolBlock.id, content: resultStr });

      const now = Date.now();
      const elapsed = Math.round((now - startTime) / 1000);
      if (now - lastProgressTime > 30_000 || totalToolCalls % 5 === 0) {
        onProgress(`Working... (${totalToolCalls} tools called, ${elapsed}s elapsed)`);
        lastProgressTime = now;
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  const text = collectedText.join('\n') || 'No response generated.';
  return { text, files, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, toolCalls: totalToolCalls };
}

/** Check if a tool result is an error by attempting to parse it as error JSON. */
function isErrorResult(resultStr: string): boolean {
  try {
    const parsed = JSON.parse(resultStr);
    return typeof parsed === 'object' && parsed !== null && 'error' in parsed;
  } catch {
    return false;
  }
}

async function callWithRetry(
  client: Anthropic,
  model: string,
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  tools: AnthropicTool[],
  maxRetries = 4,
): Promise<Anthropic.Message> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.messages.create({
        model,
        max_tokens: 16384,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages,
        tools: tools as any,
      });
    } catch (err: any) {
      const isTransient =
        err.status === 429 ||
        err.status === 529 ||
        /connection error|econnreset|socket hang up|etimedout/i.test(err.message || '');

      if (isTransient && attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt) * (0.7 + 0.6 * Math.random());
        console.warn(`[bot] API retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms: ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}
