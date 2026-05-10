---
date: 2026-05-10
status: draft (awaiting user review)
extends: 2026-05-09-ivy-lab-cli-first-architecture-design.md § Section 2 (Agent layer — Telegram side)
---

# Phase 5 — Bot Refactor onto Claude Agent SDK (Sub-Design)

## Why this exists

The founding architecture spec sketched the bot as a thin Telegram transport over the Claude Agent SDK, but didn't pin down four practical UX/storage choices that decide how the refactor feels in use. This sub-design captures those choices so the implementation plan can be precise.

## Decisions made during brainstorming

### Q1 — Bot verbosity: smart batching (final answer + grouped tool summary + heartbeat)

The Claude Agent SDK streams `assistant_text`, `tool_use`, `tool_result`, plus thinking events. Long Lab queries fire 50+ tool_use events. Telegram chat is not terminal scrollback — phones don't reward verbose stream-of-tool-calls.

**Behaviour:**
- Bot subscribes to SDK events but does NOT relay every `tool_use` to Telegram.
- If 10 seconds pass without an `assistant_text` event, send a heartbeat: `⏳ working...` (max one per turn — don't spam if the agent is genuinely thinking for 60s).
- When the agent stops, send the final `assistant_text` content (with adaptive long-message handling — see Q4).
- Append a one-line summary footer: `_Used N tools across M sources: <comma-separated source names>_` (e.g. "Used 7 tools across 3 sources: data-onet, company-goat, agent-deep-research"). Counts derived from event log; sources from MCP server names + PP CLI registry.

### Q2 — Session state: JSON file at `bot/sessions.json`

Bot needs a `chat_id → session_id` map so Telegram conversations resume the right SDK session across restarts.

**Implementation:**
- File: `bot/sessions.json`. Schema: `{ "<chat_id>": "<session_id>", ... }`.
- Load on startup. If file missing, treat as empty map.
- Write on every new mapping (write-through, ~1KB max).
- Single-user single-process — no locking concerns.
- File is gitignored (already covered by `bot/` not being a special path; we'll add an explicit `bot/sessions.json` line if needed).

The SDK persists the actual conversation state; this file just maps Telegram chats to SDK sessions.

### Q3 — EEOC protected-attribute detection: move to `scripts/audit-and-mirror.js`

Bot's current `audit.ts` (93 LOC) has its own SQLite + EEOC detector. After Phase 4, `scripts/audit-and-mirror.js` captures every tool call across both transports. The bot's audit storage is redundant; the EEOC logic should be at the same layer.

**Implementation:**
- Move the `PROTECTED_ATTRIBUTES` array and `detectProtectedAttributes()` function from `bot/src/audit.ts` to `scripts/lib/eeoc-detect.js` (alongside the other shared helpers).
- Import it in `scripts/audit-and-mirror.js`.
- Add column `protected_attributes` (TEXT, comma-separated tags) to `data/audit.db` `tool_calls` table. Use `ALTER TABLE ... ADD COLUMN` on first run if the column doesn't exist (graceful migration; existing rows get NULL).
- Both transports get EEOC flagging in the audit log. No separate bot DB.

### Q4 — Long messages: adaptive (text under 4000 chars, document over)

Telegram's 4096-char limit will trip on snapshots, full SOC details, multi-source dumps. Bot tries text first; falls back to document for long responses.

**Implementation:**
- Threshold: 3800 chars (4096 minus a buffer for Markdown formatting + headers).
- Under threshold: send as text via `ctx.reply(text, { parse_mode: 'Markdown' })`.
- Over threshold: write to `data/telegram-bot/responses/<chat_id>-<timestamp>.md`, send via `ctx.replyWithDocument({ source: filepath, filename: '<topic>.md' })`. The agent picks the topic from the prompt (first 50 chars sanitised) for the document filename.
- Files in `data/telegram-bot/responses/` are gitignored (under `data/*.db` family — actually they're `.md`, so add explicit pattern).
- Cleanup: keep last 100 files; older ones deleted on each new write. Simple `fs.readdir + sort + slice + unlink` — no cron needed.

## Architecture (post-refactor)

### Files

```
bot/
├── src/
│   ├── index.ts          # ~80 LOC — entry point: load config, init SDK + Grammy, wire signal handlers
│   ├── telegram.ts       # ~120 LOC — Grammy handlers: text, document, /start, /usage, /stop. Calls runner.
│   ├── runner.ts         # ~80 LOC — wraps query() from SDK; event loop; heartbeat scheduler; reply formatter
│   ├── sessions.ts       # ~30 LOC — JSON file I/O for chat_id ↔ session_id
│   ├── reply.ts          # ~40 LOC — adaptive text-or-document sending
│   ├── auth.ts           # 14 LOC — unchanged from current
│   └── file-manager.ts   # ~50 LOC — Telegram up/down for user-uploaded files (slimmed from current 72)
├── package.json          # deps: @anthropic-ai/claude-agent-sdk, grammy. Drop @anthropic-ai/sdk, @modelcontextprotocol/sdk, better-sqlite3.
├── sessions.json         # gitignored
└── tests/
    ├── auth.test.ts      # unchanged
    ├── sessions.test.ts  # new — JSON map round-trip
    └── reply.test.ts     # new — text/document threshold logic
```

### Files deleted

- `bot/src/claude-runner.ts` (221 LOC) — SDK replaces the agent loop.
- `bot/src/mcp-manager.ts` (237 LOC) — SDK loads MCP from `.claude/settings.json` automatically.
- `bot/src/conversation-store.ts` (151 LOC) — SDK persists session state; `sessions.json` only maps chat IDs.
- `bot/src/audit.ts` (93 LOC) — EEOC logic moves to `scripts/lib/eeoc-detect.js`; audit storage handled by `scripts/audit-and-mirror.js`.

**Net LOC change:** ~1,126 → ~414 (63% reduction).

### Data flow

```
Telegram message
  ↓
grammy handler (telegram.ts)
  ↓ allowlist check (auth.ts)
  ↓ session lookup (sessions.ts → bot/sessions.json)
  ↓
runner.ts: query({ prompt, options: { cwd: <repo>, resume: sessionId } })
  ↓ SDK loads .claude/settings.json (skills, mcp, hooks, permissions)
  ↓ SDK streams events
  ↓ runner heartbeat scheduler (10s timer; resets on assistant_text)
  ↓ runner accumulates assistant_text + tool_use counts
  ↓ on stop: build summary footer
  ↓
reply.ts: send via text or document based on length
  ↓
PostToolUse hook fires for each tool call (already live from Phase 4)
  ↓ data/audit.db gets row with protected_attributes column
  ↓ pp-mirrors/<source>.db gets row for PP CLI calls
```

### Hooks integration

The existing Phase 4 hooks (`scripts/preflight.js`, `scripts/audit-and-mirror.js`) fire automatically because the SDK reads the same `.claude/settings.json` as Claude Code terminal. No bot-side hook code needed.

After this refactor:
- Telegram-originated tool calls show up in `data/audit.db` exactly like terminal-originated ones.
- `IVY_LAB_BASH_DISABLED=1` blocks Bash for the bot's process if set in its env.
- Secret-leak protection covers Telegram messages too — if a user texts a key by accident, the hook aborts the tool call before it lands in audit.

### Error handling

- **SDK error mid-stream:** runner catches, sends a one-line `⚠ tool error: <message>` reply. Conversation state is preserved (SDK handles resume).
- **Telegram send failure:** retry once with text mode if document failed; log to stderr; surface error to user as plain text "couldn't send response — see bot logs."
- **Hook block (preflight):** SDK surfaces this as a tool error in the event stream; runner relays as `⚠ blocked by preflight: <reason>` — Telegram user sees what the kill switch / secret-leak abort caught.
- **Session resume failure** (e.g. SDK rejects an old session ID): runner catches, starts a fresh session, writes new mapping to `sessions.json`, replies normally.

## Testing

- **Unit:** `sessions.ts` (JSON map round-trip), `reply.ts` (length threshold + filename derivation). Vitest already configured for bot.
- **Integration smoke test (manual, post-merge):** user sends Telegram message → expect text response for short queries; document for long queries. Verify `data/audit.db` shows Telegram-origin rows alongside terminal rows. Verify `pp-mirrors/company-goat.db` gets rows from PP queries originating in Telegram.
- **EEOC detector smoke:** terminal-side query that mentions "age discrimination" — `sqlite3 data/audit.db "SELECT protected_attributes FROM tool_calls ORDER BY id DESC LIMIT 1"` should show `age,disability` or similar.

## User prerequisite

`TELEGRAM_BOT_TOKEN` in `Ivy-Lab/.env` must be the **IvyLabsBot** token (NOT the production-Ivy bot's token — that would conflict). User created IvyLabsBot via @BotFather earlier (mentioned in chat history) but hasn't yet swapped the token in `.env`. Phase 5 plan begins with confirming this is set; if not, plan blocks at Task 1 until it is.

## Out of scope

- Multi-user Telegram with role-based access (Lab is single-user; allowlist is enough).
- Conversation history reset commands beyond what SDK provides natively.
- Pretty Markdown table rendering for tool outputs (rely on SDK's defaults).
- Voice/audio transcription via the bot (existing `agent-transcription` MCP handles audio when invoked; no Telegram-specific work needed).
- File-edit support over Telegram (read-only file context only).
- Schema docs in `scripts/README.md` (the small Phase 4.5 polish item — fold into Phase 5 PR if convenient, otherwise its own follow-up).

## Success criteria

Phase 5 is "done enough" when:

- Sending a Telegram message to IvyLabsBot from the user's phone produces a coherent agent response in the same chat thread.
- The agent uses the same skills, MCP fleet, and Bash policy as the terminal — proven by asking for a `data-onet` lookup AND a `company-goat-pp-cli funding` query and getting the same shape of answer as in terminal Claude Code.
- A `Run: ls` request via Telegram is allowed (Bash allow-list applies), but a `Run: curl` request is denied (deny-list applies).
- A long response (e.g. `snapshot stripe`) arrives as a `.md` document, not a truncated text message.
- `bot/src/` is ≤ 414 LOC (excluding tests).
- `data/audit.db` has rows with non-NULL `protected_attributes` after a query mentioning a protected attribute.
- `IVY_LAB_BASH_DISABLED=1` in the bot's env (set in `bot/.env` or systemd unit) blocks Bash for Telegram-originated requests, same as it does for terminal.
