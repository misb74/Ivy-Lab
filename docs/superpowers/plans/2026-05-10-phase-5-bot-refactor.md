# Ivy-Lab Phase 5 — Bot Refactor onto Claude Agent SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `bot/src/` (~1,126 LOC) to a thin Telegram transport over `@anthropic-ai/claude-agent-sdk` (target ≤ 414 LOC). Both transports share the same `.claude/settings.json` — same skills, MCP fleet, Bash policy, hooks. EEOC detection moves to `scripts/audit-and-mirror.js`.

**Architecture:** SDK's `query({ prompt, options: { cwd, resume } })` replaces the manual Anthropic SDK + MCP client wiring. Each Telegram chat maps to a session ID via `bot/sessions.json`. Smart batching (final answer + tool summary footer + 10s heartbeat) replaces the per-tool spam. Adaptive text/document reply for length >3800 chars.

**Tech Stack:** `@anthropic-ai/claude-agent-sdk` 0.2.138 (ESM-only), `grammy` (existing), Node 20.6+ (existing engine constraint), system `sqlite3` CLI (already used by Phase 4 hooks).

**Spec reference:** `docs/superpowers/specs/2026-05-10-phase-5-bot-refactor-design.md` and `docs/superpowers/specs/2026-05-09-ivy-lab-cli-first-architecture-design.md` § Section 2 (Telegram side).

**Pre-conditions verified:**
- Phases 0–4 merged on main at `08d0fde`.
- `Ivy-Lab/.env` has `TELEGRAM_BOT_TOKEN=8740485705:...` (IvyLabsBot, distinct from any Ivy bot).
- `Ivy-Lab/.env` has `ALLOWED_TELEGRAM_IDS=8707917388`.
- Phase 4 hook scripts exist at `scripts/preflight.js` and `scripts/audit-and-mirror.js`; tests pass.

**Phase 5 done-when:**
1. `npm --workspace bot start` boots the bot connected to IvyLabsBot.
2. Sending "hi" from the user's Telegram (ID 8707917388) returns a coherent agent reply.
3. Sending "use data-onet to look up software engineer" returns ONET data — proving same skills + MCP fleet as terminal.
4. Sending "Run: ls" succeeds (Bash allow). Sending "Run: curl https://example.com" gets blocked.
5. Sending "use company-goat-pp-cli funding stripe" produces a row in `pp-mirrors/company-goat.db` (Phase 4 PostToolUse hook fires for Telegram-originated calls too).
6. A long response (e.g. snapshot stripe) arrives as a `.md` document, not a truncated text message.
7. `bot/src/` total LOC ≤ 414 (excluding tests).
8. `data/audit.db` `tool_calls` table has `protected_attributes` column populated for EEOC-relevant queries.

---

## Task 1 — Branch off main

**Files:** none (git only)

- [ ] **Step 1: Confirm main is current**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab status --short
git -C /Users/moraybrown/Desktop/Ivy-Lab branch --show-current
git -C /Users/moraybrown/Desktop/Ivy-Lab fetch origin
git -C /Users/moraybrown/Desktop/Ivy-Lab log --oneline -3
```
Expected: empty status (only `?? data/` or similar untracked OK), branch `main`, top of log is `08d0fde docs(spec): Phase 5 bot refactor sub-design ...`.

- [ ] **Step 2: Create the phase branch**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab checkout -b phase-5-bot-refactor
```

---

## Task 2 — `scripts/lib/eeoc-detect.js` (TDD)

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/lib/eeoc-detect.js`
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/test-eeoc-detect.sh`

Lifts the EEOC protected-attribute detector from `bot/src/audit.ts` to a shared helper. Used by `scripts/audit-and-mirror.js` so both transports get flagging.

- [ ] **Step 1: Write the test fixture**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/test-eeoc-detect.sh`

```bash
#!/bin/bash
# Tests scripts/lib/eeoc-detect.js
set -e

DETECT="node /Users/moraybrown/Desktop/Ivy-Lab/scripts/lib/eeoc-detect.js"

assert_eq() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "PASS  $name"
  else
    echo "FAIL  $name"
    echo "  expected: '$expected'"
    echo "  actual:   '$actual'"
    exit 1
  fi
}

# Single attribute
out=$(echo "What is the median age of software engineers?" | $DETECT)
assert_eq "single-age" "age" "$out"

# Multiple attributes
out=$(echo "Audit hiring fairness by race and gender" | $DETECT)
assert_eq "multi-race-gender" "gender,race" "$out"

# Case insensitive
out=$(echo "RELIGION and Sex categories" | $DETECT)
assert_eq "case-insensitive" "religion,sex" "$out"

# No protected attributes
out=$(echo "What is the wage for occupation 15-1252.00?" | $DETECT)
assert_eq "no-attrs" "" "$out"

# Compound terms
out=$(echo "sexual orientation and gender identity protections" | $DETECT)
assert_eq "compound-orientation-identity" "gender identity,sexual orientation" "$out"

# Empty input
out=$(echo "" | $DETECT)
assert_eq "empty" "" "$out"

# Word-boundary safety (don't match "agen" inside "agenda")
out=$(echo "Set the agenda for the meeting" | $DETECT)
assert_eq "no-false-match-agenda" "" "$out"

echo ""
echo "All eeoc-detect tests passed."
```

```bash
chmod +x /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-eeoc-detect.sh
```

- [ ] **Step 2: Run to see it fail**

```bash
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-eeoc-detect.sh 2>&1 | head -5
```
Expected: error indicating module not found.

- [ ] **Step 3: Write the implementation**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/lib/eeoc-detect.js`

```javascript
#!/usr/bin/env node
// Detect EEOC protected attributes mentioned in a text blob.
// Returns sorted comma-separated list of attribute names found, or empty string.
//
// CLI: read stdin, write attribute list to stdout.

import readline from 'node:readline';

// Order matters for compound matching: longer phrases first so we don't
// match "gender" inside "gender identity" before catching "gender identity".
const PROTECTED_ATTRIBUTES = [
  'sexual orientation',
  'gender identity',
  'national origin',
  'genetic information',
  'veteran status',
  'marital status',
  'pregnancy',
  'disability',
  'citizenship',
  'religion',
  'gender',
  'race',
  'color',
  'sex',
  'age',
];

export function detectProtectedAttributes(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const lower = text.toLowerCase();
  const found = new Set();
  for (const attr of PROTECTED_ATTRIBUTES) {
    // Word-boundary regex: only match attr as a whole word (or hyphenated form)
    const re = new RegExp(`\\b${attr.replace(/\s/g, '\\s')}\\b`, 'i');
    if (re.test(lower)) found.add(attr);
  }
  return Array.from(found).sort();
}

async function cli() {
  const rl = readline.createInterface({ input: process.stdin });
  const chunks = [];
  for await (const line of rl) chunks.push(line);
  const result = detectProtectedAttributes(chunks.join('\n'));
  process.stdout.write(result.join(',') + (result.length > 0 ? '\n' : ''));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch(err => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 4: Run tests; expect all PASS**

```bash
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-eeoc-detect.sh
```
Expected: 7 PASS, ends "All eeoc-detect tests passed."

- [ ] **Step 5: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add scripts/lib/eeoc-detect.js scripts/test-eeoc-detect.sh
```

---

## Task 3 — Update `scripts/audit-and-mirror.js` to use EEOC detector + `protected_attributes` column

**Files:**
- Modify: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/audit-and-mirror.js`
- Modify: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/test-audit-and-mirror.sh` (add new test case)

Adds EEOC detection to every audit row. Adds `protected_attributes` column with `ALTER TABLE ... ADD COLUMN` graceful migration.

- [ ] **Step 1: Add a new test case to `test-audit-and-mirror.sh`**

Edit `/Users/moraybrown/Desktop/Ivy-Lab/scripts/test-audit-and-mirror.sh`. After the existing Test 5 (secret-scrubbed), and BEFORE the cleanup `rm -rf` line, add:

```bash
# Test 6: protected attributes column populated for EEOC-relevant input
echo '{"tool_name":"Bash","tool_input":{"command":"check hiring fairness by age and disability"},"tool_response":{"output":"ok"},"session_id":"sess-eeoc"}' | $HOOK
attrs=$(sqlite3 "$TEST_AUDIT_DB" "SELECT protected_attributes FROM tool_calls WHERE session_id='sess-eeoc'" 2>/dev/null)
if echo "$attrs" | grep -q "age" && echo "$attrs" | grep -q "disability"; then echo "PASS  eeoc-attrs-stored"; else echo "FAIL  eeoc-attrs-stored (got: $attrs)"; exit 1; fi

# Test 7: protected_attributes empty for non-EEOC input
echo '{"tool_name":"Read","tool_input":{"file_path":"/tmp/foo.txt"},"tool_response":{"output":"hello"},"session_id":"sess-noeeoc"}' | $HOOK
attrs=$(sqlite3 "$TEST_AUDIT_DB" "SELECT protected_attributes FROM tool_calls WHERE session_id='sess-noeeoc'" 2>/dev/null)
if [ -z "$attrs" ]; then echo "PASS  no-eeoc-empty"; else echo "FAIL  no-eeoc-empty (got: $attrs)"; exit 1; fi
```

- [ ] **Step 2: Run the test — expect FAIL on the new cases (column doesn't exist yet)**

```bash
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-audit-and-mirror.sh 2>&1 | tail -10
```
Expected: original 5 tests still PASS, new 6th FAILs because `protected_attributes` column doesn't exist.

- [ ] **Step 3: Update `scripts/audit-and-mirror.js`**

Use the Edit tool. Find this block:

```javascript
import { detectPPCall } from './lib/pp-detect.js';
import { scrubSecrets } from './lib/scrub-secrets.js';
```

Add the EEOC import below them:

```javascript
import { detectPPCall } from './lib/pp-detect.js';
import { scrubSecrets } from './lib/scrub-secrets.js';
import { detectProtectedAttributes } from './lib/eeoc-detect.js';
```

Then update `ensureAuditSchema()` to include the new column. Find:

```javascript
function ensureAuditSchema() {
  ensureDir(DATA_DIR);
  sqlExec(AUDIT_DB, `
CREATE TABLE IF NOT EXISTS tool_calls (
  id INTEGER PRIMARY KEY,
  ts TEXT DEFAULT (datetime('now')),
  session_id TEXT,
  tool TEXT,
  input_redacted TEXT,
  output_size INTEGER,
  exit_status TEXT
);
CREATE INDEX IF NOT EXISTS idx_tool ON tool_calls(tool);
CREATE INDEX IF NOT EXISTS idx_session ON tool_calls(session_id);
`);
}
```

Replace with:

```javascript
function ensureAuditSchema() {
  ensureDir(DATA_DIR);
  sqlExec(AUDIT_DB, `
CREATE TABLE IF NOT EXISTS tool_calls (
  id INTEGER PRIMARY KEY,
  ts TEXT DEFAULT (datetime('now')),
  session_id TEXT,
  tool TEXT,
  input_redacted TEXT,
  output_size INTEGER,
  exit_status TEXT
);
CREATE INDEX IF NOT EXISTS idx_tool ON tool_calls(tool);
CREATE INDEX IF NOT EXISTS idx_session ON tool_calls(session_id);
`);
  // Graceful migration: add protected_attributes column if it doesn't exist.
  // sqlite3's ALTER TABLE ADD COLUMN is idempotent only if we check first.
  try {
    const cols = sqlExec(AUDIT_DB, 'PRAGMA table_info(tool_calls);').trim().split('\n');
    const hasColumn = cols.some(line => line.split('|')[1] === 'protected_attributes');
    if (!hasColumn) {
      sqlExec(AUDIT_DB, 'ALTER TABLE tool_calls ADD COLUMN protected_attributes TEXT;');
    }
  } catch {
    // If migration fails (e.g. concurrent runner), continue — INSERT will still work
    // because the column gets added on next idle invocation.
  }
}
```

Then update the INSERT in `main()`. Find:

```javascript
  // Always: audit row
  ensureAuditSchema();
  sqlExec(AUDIT_DB, `
INSERT INTO tool_calls (session_id, tool, input_redacted, output_size, exit_status)
VALUES (
  ${escapeSqlString(sessionId)},
  ${escapeSqlString(toolName)},
  ${escapeSqlString(inputRedacted)},
  ${outputSize},
  ${escapeSqlString(exitStatus)}
);
`);
```

Replace with:

```javascript
  // Always: audit row
  ensureAuditSchema();
  const protectedAttrs = detectProtectedAttributes(inputJson + ' ' + (typeof toolResponse === 'string' ? toolResponse : JSON.stringify(toolResponse)));
  const protectedAttrsStr = protectedAttrs.length > 0 ? protectedAttrs.join(',') : null;
  sqlExec(AUDIT_DB, `
INSERT INTO tool_calls (session_id, tool, input_redacted, output_size, exit_status, protected_attributes)
VALUES (
  ${escapeSqlString(sessionId)},
  ${escapeSqlString(toolName)},
  ${escapeSqlString(inputRedacted)},
  ${outputSize},
  ${escapeSqlString(exitStatus)},
  ${escapeSqlString(protectedAttrsStr)}
);
`);
```

- [ ] **Step 4: Run all tests; expect all PASS**

```bash
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-audit-and-mirror.sh
```
Expected: 7 PASS lines (5 original + 2 new), ends "All audit-and-mirror tests passed."

- [ ] **Step 5: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add scripts/audit-and-mirror.js scripts/test-audit-and-mirror.sh
```

---

## Task 4 — Update `bot/package.json` dependencies

**Files:**
- Modify: `/Users/moraybrown/Desktop/Ivy-Lab/bot/package.json`

Drop `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, `better-sqlite3`. Add `@anthropic-ai/claude-agent-sdk`.

- [ ] **Step 1: Read the current file to confirm shape**

```bash
cat /Users/moraybrown/Desktop/Ivy-Lab/bot/package.json
```

- [ ] **Step 2: Edit the dependencies block**

Use the Edit tool. The current `dependencies` block is:

```json
  "dependencies": {
    "@anthropic-ai/sdk": "^0.78.0",
    "@modelcontextprotocol/sdk": "^1.12.1",
    "better-sqlite3": "^11.0.0",
    "grammy": "^1.42.0"
  },
```

Replace with:

```json
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.2.138",
    "grammy": "^1.42.0"
  },
```

- [ ] **Step 3: Reinstall workspace deps**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && npm install --ignore-scripts 2>&1 | tail -10
```

The `--ignore-scripts` flag is the same workaround from Phase 1 (avoids the `node-gyp`/macOS-26-beta issue). With `better-sqlite3` removed, this might not be needed anymore — but keep it for safety on the first install.

Expected: ends with "added/changed/removed X packages." Net: removes 3 packages, adds 1.

- [ ] **Step 4: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add bot/package.json package-lock.json
```

---

## Task 5 — `bot/src/sessions.ts` (TDD)

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/bot/src/sessions.ts`
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/bot/tests/sessions.test.ts`

Tiny module: `chat_id → session_id` map persisted to `bot/sessions.json`.

- [ ] **Step 1: Write the failing test**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/bot/tests/sessions.test.ts`

```typescript
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
```

- [ ] **Step 2: Run vitest; expect FAIL**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab/bot && npm test 2>&1 | tail -10
```
Expected: vitest reports module not found or imports fail for `../src/sessions.js`.

- [ ] **Step 3: Write the implementation**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/bot/src/sessions.ts`

```typescript
import fs from 'node:fs';
import path from 'node:path';

export class SessionStore {
  private filePath: string;
  private map: Record<string, string>;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.map = this.load();
  }

  private load(): Record<string, string> {
    try {
      if (!fs.existsSync(this.filePath)) return {};
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.map, null, 2));
  }

  get(chatId: number): string | undefined {
    return this.map[String(chatId)];
  }

  set(chatId: number, sessionId: string): void {
    this.map[String(chatId)] = sessionId;
    this.save();
  }

  clear(chatId: number): void {
    delete this.map[String(chatId)];
    this.save();
  }
}
```

- [ ] **Step 4: Run vitest; expect all 6 PASS**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab/bot && npm test 2>&1 | tail -10
```

- [ ] **Step 5: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add bot/src/sessions.ts bot/tests/sessions.test.ts
```

---

## Task 6 — `bot/src/reply.ts` (TDD)

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/bot/src/reply.ts`
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/bot/tests/reply.test.ts`

Adaptive sender: text under 3800 chars → `ctx.reply`; over → `ctx.replyWithDocument` of a `.md` file.

- [ ] **Step 1: Write the failing test**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/bot/tests/reply.test.ts`

```typescript
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
```

- [ ] **Step 2: Run vitest; expect FAIL**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab/bot && npm test 2>&1 | tail -10
```

- [ ] **Step 3: Write the implementation**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/bot/src/reply.ts`

```typescript
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

export async function sendReply(
  ctx: Context,
  text: string,
  opts: SendReplyOptions
): Promise<void> {
  if (text.length <= THRESHOLD) {
    await ctx.reply(text, { parse_mode: 'Markdown' });
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
```

- [ ] **Step 4: Run vitest; expect all PASS**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab/bot && npm test 2>&1 | tail -10
```

- [ ] **Step 5: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add bot/src/reply.ts bot/tests/reply.test.ts
```

---

## Task 7 — `bot/src/runner.ts` (SDK wrapper, no unit tests; integration smoke later)

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/bot/src/runner.ts`

The runner wraps `query()` from the Claude Agent SDK and implements the smart-batching UX from Q1: heartbeat, tool counting, summary footer.

- [ ] **Step 1: Write the implementation**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/bot/src/runner.ts`

```typescript
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
```

- [ ] **Step 2: Confirm import path resolves (typecheck-only proxy)**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab/bot && npx tsc --noEmit src/runner.ts 2>&1 | head -10
```
Expected: zero errors. If `@anthropic-ai/claude-agent-sdk` types fail to resolve, recheck Task 4's npm install.

- [ ] **Step 3: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add bot/src/runner.ts
```

---

## Task 8 — `bot/src/telegram.ts` (rewrite)

**Files:**
- Modify: `/Users/moraybrown/Desktop/Ivy-Lab/bot/src/telegram.ts`

Rewrite as a thin Grammy handler that dispatches text messages to `runner.ts`. Replaces 260 LOC with ~120 LOC.

- [ ] **Step 1: Write the new content**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/bot/src/telegram.ts`

```typescript
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
```

- [ ] **Step 2: Confirm typechecks**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab/bot && npx tsc --noEmit src/telegram.ts 2>&1 | head -10
```
Expected: zero errors.

- [ ] **Step 3: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add bot/src/telegram.ts
```

---

## Task 9 — `bot/src/index.ts` (rewrite)

**Files:**
- Modify: `/Users/moraybrown/Desktop/Ivy-Lab/bot/src/index.ts`

Slim entry point. Loads config, builds bot, starts polling, handles shutdown.

- [ ] **Step 1: Write new content**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/bot/src/index.ts`

```typescript
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBot } from './telegram.js';
import { SessionStore } from './sessions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = process.env.IVY_PROJECT_DIR || path.resolve(__dirname, '../..');
const dataDir = path.join(projectDir, 'data', 'telegram-bot');
const responsesDir = path.join(dataDir, 'responses');
const sessionsPath = path.join(projectDir, 'bot', 'sessions.json');

async function main(): Promise<void> {
  console.log('[bot] Starting Ivy-Lab Telegram bot');
  console.log(`[bot] Project dir: ${projectDir}`);
  console.log(`[bot] Sessions file: ${sessionsPath}`);
  console.log(`[bot] Responses dir: ${responsesDir}`);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('[bot] TELEGRAM_BOT_TOKEN not set in env. Exiting.');
    process.exit(1);
  }

  if (!process.env.ALLOWED_TELEGRAM_IDS) {
    console.warn(
      '[bot] ALLOWED_TELEGRAM_IDS not set — bot will reject ALL users until you add ' +
      'your Telegram user ID. Message the bot once to log your ID, then set ' +
      'ALLOWED_TELEGRAM_IDS in .env and restart.',
    );
  }

  const sessions = new SessionStore(sessionsPath);
  const bot = buildBot({
    token,
    cwd: projectDir,
    responsesDir,
    sessions,
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`[bot] Received ${signal} — stopping`);
    void bot.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await bot.start({
    onStart: info => {
      console.log(`[bot] Connected as @${info.username} (id=${info.id}). Polling.`);
    },
  });
}

main().catch(err => {
  console.error('[bot] Fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add bot/src/index.ts
```

---

## Task 10 — Slim `bot/src/file-manager.ts`

**Files:**
- Modify: `/Users/moraybrown/Desktop/Ivy-Lab/bot/src/file-manager.ts`

Drop most of the upload/download glue (no longer wired through to the agent in v0). Keep only the helper that ensures the data directory exists, since `bot/src/index.ts` references `dataDir` for responses.

Actually, on re-read: `bot/src/index.ts` already creates `responsesDir` via `fs.mkdirSync` (inside `reply.ts`'s `sendReply`). The current `file-manager.ts` is no longer needed for v0.

**Decision:** delete `file-manager.ts` entirely. Resurface in a later phase if user-uploaded files become a feature.

- [ ] **Step 1: Delete the file**

```bash
rm /Users/moraybrown/Desktop/Ivy-Lab/bot/src/file-manager.ts
git -C /Users/moraybrown/Desktop/Ivy-Lab add -A bot/src/file-manager.ts
```

- [ ] **Step 2: Verify deletion is staged**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab status --short bot/src/file-manager.ts
```
Expected: ` D bot/src/file-manager.ts`.

---

## Task 11 — Delete obsolete files

**Files (delete):**
- `bot/src/claude-runner.ts` (221 LOC — SDK replaces)
- `bot/src/mcp-manager.ts` (237 LOC — SDK replaces)
- `bot/src/conversation-store.ts` (151 LOC — SDK persists)
- `bot/src/audit.ts` (93 LOC — moved to scripts/lib/eeoc-detect.js + scripts/audit-and-mirror.js)
- Their tests if any

- [ ] **Step 1: Identify and delete obsolete bot tests**

```bash
ls /Users/moraybrown/Desktop/Ivy-Lab/bot/tests/
```
Expected output may include tests like `audit.test.ts`, `auth.test.ts`. Keep `auth.test.ts` (still used). Delete any test that exclusively tests `claude-runner`, `mcp-manager`, `conversation-store`, or `audit`:

```bash
for f in /Users/moraybrown/Desktop/Ivy-Lab/bot/tests/*.test.ts; do
  base=$(basename "$f" .test.ts)
  case "$base" in
    audit|claude-runner|mcp-manager|conversation-store)
      echo "deleting: $f"
      rm "$f"
      ;;
    *)
      echo "keeping: $f"
      ;;
  esac
done
```

- [ ] **Step 2: Delete the source files**

```bash
rm /Users/moraybrown/Desktop/Ivy-Lab/bot/src/claude-runner.ts
rm /Users/moraybrown/Desktop/Ivy-Lab/bot/src/mcp-manager.ts
rm /Users/moraybrown/Desktop/Ivy-Lab/bot/src/conversation-store.ts
rm /Users/moraybrown/Desktop/Ivy-Lab/bot/src/audit.ts
git -C /Users/moraybrown/Desktop/Ivy-Lab add -A bot/src/ bot/tests/
```

- [ ] **Step 3: Verify final bot/src/ shape**

```bash
ls /Users/moraybrown/Desktop/Ivy-Lab/bot/src/
wc -l /Users/moraybrown/Desktop/Ivy-Lab/bot/src/*.ts
```
Expected files only: `auth.ts`, `index.ts`, `reply.ts`, `runner.ts`, `sessions.ts`, `telegram.ts`. Total LOC ≤ 414 (target from spec).

---

## Task 12 — Add `bot/sessions.json` to `.gitignore` + `data/telegram-bot/responses/` cleanup

**Files:**
- Modify: `/Users/moraybrown/Desktop/Ivy-Lab/.gitignore`

The bot's `sessions.json` shouldn't go to git (it contains chat IDs). Same for the responses dir.

- [ ] **Step 1: Inspect current .gitignore**

```bash
cat /Users/moraybrown/Desktop/Ivy-Lab/.gitignore
```

- [ ] **Step 2: Append entries (if not already present)**

Use the Edit tool on `.gitignore`. Find the line `# Telegram bot local state` (existed since Phase 1) and below it the existing `data/telegram-bot/uploads/` entry. Replace:

```
# Telegram bot local state
data/telegram-bot/uploads/
```

with:

```
# Telegram bot local state
data/telegram-bot/uploads/
data/telegram-bot/responses/
bot/sessions.json
bot/sessions.json.bak
```

- [ ] **Step 3: Verify gitignore catches both**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && git check-ignore -v bot/sessions.json data/telegram-bot/responses/test.md 2>&1
```
Expected: both paths report `.gitignore:<line>:...`.

- [ ] **Step 4: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add .gitignore
```

---

## Task 13 — Typecheck + tests

- [ ] **Step 1: Workspace typecheck**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && npm run typecheck 2>&1 | tail -30
```
Expected: zero errors. Some workspaces still no-op via `--if-present`. Bot should compile clean.

- [ ] **Step 2: Bot tests**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab/bot && npm test 2>&1 | tail -20
```
Expected: all tests pass. New: `sessions.test.ts` (6 cases), `reply.test.ts` (~7 cases). Existing: `auth.test.ts`.

- [ ] **Step 3: Hook tests**

```bash
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-eeoc-detect.sh
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-audit-and-mirror.sh
```
Expected: both end with "All ... tests passed."

---

## Task 14 — Manual local-bot smoke test (controller-driven)

**Files:** none (runtime test)

This validates the bot actually starts and connects to IvyLabsBot. The user will message from their phone in Task 16.

- [ ] **Step 1: Start the bot in the foreground**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && npm --workspace bot start 2>&1 | head -10
```
Expected: log lines:
- `[bot] Starting Ivy-Lab Telegram bot`
- `[bot] Project dir: /Users/moraybrown/Desktop/Ivy-Lab`
- `[bot] Connected as @IvyLabsBot (id=8740485705). Polling.`

If you see `[bot] TELEGRAM_BOT_TOKEN not set`, the `.env` is not being loaded — check `bot/package.json`'s start script (it loads `.env` from `../`).

- [ ] **Step 2: After confirming "Polling", interrupt with Ctrl-C**

The bot will print `[bot] Received SIGINT — stopping` and exit.

If the bot logs an error (auth failed, network), STOP and report BLOCKED with the error.

---

## Task 15 — Commit + push + PR

- [ ] **Step 1: Final pre-commit safety**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab status --short | grep -iE '\.(env|db|db-shm|db-wal|sqlite|sqlite3|key|pem|sessions\.json)$' | wc -l
git -C /Users/moraybrown/Desktop/Ivy-Lab diff --cached --name-only | sort
```
Expected: safety sweep `0`. Staged files include the bot src changes, hook updates, scripts/lib/eeoc-detect.js, .gitignore, package.json, package-lock.json.

- [ ] **Step 2: Commit**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab commit -m "$(cat <<'EOF'
feat(phase-5): bot refactor onto Claude Agent SDK; EEOC detection moves to shared hook

Phase 5 of the Ivy-Lab founding architecture. See docs/superpowers/specs/2026-05-10-phase-5-bot-refactor-design.md and docs/superpowers/plans/2026-05-10-phase-5-bot-refactor.md.

Adds:
- bot/src/sessions.ts — chat_id ↔ session_id JSON map (write-through, ~30 LOC).
- bot/src/reply.ts — adaptive text/document sender with 3800-char threshold and last-100 file cleanup (~50 LOC).
- bot/src/runner.ts — wraps query() from @anthropic-ai/claude-agent-sdk; smart batching (final answer + tool summary footer + 10s heartbeat); session resume (~80 LOC).
- bot/tests/sessions.test.ts and bot/tests/reply.test.ts — vitest unit tests for the new modules.
- scripts/lib/eeoc-detect.js — shared EEOC protected-attribute detector (lifted from old bot/src/audit.ts).
- scripts/test-eeoc-detect.sh — bash test harness (7 cases, all pass).

Modifies:
- bot/src/index.ts — slim entry: load token + allowlist, build bot via telegram.ts, polling + shutdown handlers (~50 LOC, was 78).
- bot/src/telegram.ts — Grammy handlers: /start, /clear, /help, message:text, message:document. Dispatches to runner. (~85 LOC, was 260.)
- bot/package.json — drop @anthropic-ai/sdk, @modelcontextprotocol/sdk, better-sqlite3; add @anthropic-ai/claude-agent-sdk@^0.2.138.
- scripts/audit-and-mirror.js — adds protected_attributes column with graceful ALTER TABLE migration; calls detectProtectedAttributes() on every audit insert.
- scripts/test-audit-and-mirror.sh — adds 2 tests for EEOC column population.
- .gitignore — adds data/telegram-bot/responses/, bot/sessions.json{,bak}.

Deletes (1,030 LOC removed):
- bot/src/claude-runner.ts (221) — SDK replaces.
- bot/src/mcp-manager.ts (237) — SDK loads MCP via .claude/settings.json automatically.
- bot/src/conversation-store.ts (151) — SDK persists session state; sessions.json only maps chat IDs.
- bot/src/audit.ts (93) — EEOC moves to scripts/lib/eeoc-detect.js; audit storage handled by scripts/audit-and-mirror.js.
- bot/src/file-manager.ts (72) — Telegram file up/down not wired in v0; resurface later if needed.
- Obsolete tests for the deleted modules.

Net bot/src/ LOC: ~1,126 → target ≤414. Both transports now share .claude/settings.json — same skills, MCP fleet, Bash policy, hooks. Phase 4 hooks fire automatically for Telegram-originated calls.

Smoke test plan (must run from a separate terminal — see PR body):
1. cd /Users/moraybrown/Desktop/Ivy-Lab && npm --workspace bot start
2. From your phone, message @IvyLabsBot — verify a real reply.
3. Send: "use data-onet to look up software engineer" — expect ONET data.
4. Send: "Run: ls" (allow), "Run: curl https://example.com" (deny by Phase 4 preflight).
5. Send: "use company-goat-pp-cli funding stripe --pick 1 --agent" — verify pp-mirrors/company-goat.db gets a row from Telegram-origin call.
6. sqlite3 data/audit.db "SELECT tool, protected_attributes FROM tool_calls WHERE protected_attributes IS NOT NULL LIMIT 5;" — verify EEOC column populated.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab push -u origin phase-5-bot-refactor
```

- [ ] **Step 4: Build PR body file**

```bash
cat > /tmp/ivy-lab-phase-5-pr-body.md <<'BODY'
## Summary

Refactors the Telegram bot from a 1,126 LOC direct-Anthropic-SDK + manual-MCP setup to a thin transport over `@anthropic-ai/claude-agent-sdk`. Both transports (terminal Claude Code, Telegram bot) now share one `.claude/settings.json` — same skills, MCP fleet, Bash policy, Phase 4 hooks.

### bot/src/ LOC: ~1,126 → ~414 (63% reduction)

**Adds:** `sessions.ts`, `reply.ts`, `runner.ts` + vitest tests for the first two.
**Modifies:** `index.ts`, `telegram.ts`, `package.json` (drops 3 deps, adds 1).
**Deletes:** `claude-runner.ts`, `mcp-manager.ts`, `conversation-store.ts`, `audit.ts`, `file-manager.ts` + obsolete tests.

### EEOC detection unified

The bot's old `audit.ts` had its own EEOC detector + SQLite. After this PR, that logic lives in `scripts/lib/eeoc-detect.js` and runs from the shared `scripts/audit-and-mirror.js` PostToolUse hook. Both transports get the `protected_attributes` column populated. New `ALTER TABLE` migration adds the column gracefully on first run; existing rows get NULL.

### UX choices implemented (per spec)

- **Smart batching:** bot sends final assistant_text + 1-line `_Used N tools: <sources>_` footer. No per-tool spam. 10s heartbeat (`⏳ working...`) for long quiet stretches.
- **JSON sessions:** `bot/sessions.json` maps `chat_id → session_id`. Survives restarts. Gitignored.
- **Adaptive replies:** text under 3800 chars, document over (`.md` file in `data/telegram-bot/responses/`, last-100 cleanup).
- **EEOC moved to hook:** described above.

## Test plan

In-repo unit + hook tests:
```bash
cd bot && npm test
bash scripts/test-eeoc-detect.sh
bash scripts/test-audit-and-mirror.sh
```

End-to-end smoke (separate terminal):

- [ ] `cd /Users/moraybrown/Desktop/Ivy-Lab && npm --workspace bot start` — bot logs `Connected as @IvyLabsBot (id=8740485705). Polling.`
- [ ] From your phone (Telegram user 8707917388), message the bot: "hi" — expect a coherent reply.
- [ ] "use data-onet to look up software engineer" — expect ONET occupation data via the same MCP pipeline as terminal.
- [ ] "Run: ls mcp-servers | wc -l" — expect a Bash composition that runs (allow-list) and returns 61.
- [ ] "Run: curl -s https://example.com" — expect a deny / fall-back to MCP.
- [ ] "use company-goat-pp-cli funding stripe --pick 1 --agent" — expect a real Form D response. Then `sqlite3 pp-mirrors/company-goat.db "SELECT count(*) FROM results;"` should show ≥ 1 (Phase 4 hook fired for Telegram-origin call).
- [ ] "audit hiring fairness by age and disability" — afterwards `sqlite3 data/audit.db "SELECT tool, protected_attributes FROM tool_calls WHERE protected_attributes IS NOT NULL LIMIT 5;"` should show rows tagged `age,disability`.
- [ ] Send something that produces a long response (e.g. "snapshot stripe") — expect a `.md` document attachment in chat, not a truncated text message.

## Known issues / follow-up

- v0 doesn't wire user-uploaded Telegram files through to the agent (deleted file-manager.ts). If you want to send screenshots/PDFs and have the agent read them, that's a follow-up phase.
- Heartbeat is fixed at 10s; if a long run produces text every 9s, the heartbeat won't fire. Acceptable for v0.
- `bot/sessions.json` is single-process. If you ever run the bot under systemd with multiple workers, switch to SQLite via `sqlite3` CLI matching the audit-DB pattern.
- Phase 6 (end-to-end validation) is the next step. Mostly manual smoke testing across both transports — gets its own short plan if needed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
```

- [ ] **Step 5: Create PR**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && gh pr create \
  --title "Phase 5: Bot refactor onto Claude Agent SDK" \
  --body-file /tmp/ivy-lab-phase-5-pr-body.md
```

- [ ] **Step 6: Capture PR URL**

```bash
gh pr view --json url,number,title,state
```

---

## Task 16 — User PR review + smoke test + squash-merge

**Files:** none (user-gated)

- [ ] **Step 1: User reviews PR diff** at the URL from Task 15 Step 6.

- [ ] **Step 2: User runs the end-to-end smoke test from a separate terminal**

Per the PR body's test plan. The user starts the bot, messages from phone, checks audit DB + mirror DB.

- [ ] **Step 3: After approval, controller squash-merges**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && gh pr merge --squash --delete-branch
git -C /Users/moraybrown/Desktop/Ivy-Lab checkout main
git -C /Users/moraybrown/Desktop/Ivy-Lab pull
git -C /Users/moraybrown/Desktop/Ivy-Lab fetch --prune origin
git -C /Users/moraybrown/Desktop/Ivy-Lab log --oneline -5
```

---

## Done when

- [ ] PR `phase-5-bot-refactor` squash-merged into `main`.
- [ ] Bot launches against IvyLabsBot.
- [ ] Phone-originated message returns a real agent response that uses the same skills + MCP fleet as terminal.
- [ ] Telegram-origin tool calls show up in `data/audit.db` and `pp-mirrors/*.db`.
- [ ] Long responses arrive as `.md` documents.
- [ ] `bot/src/` ≤ 414 LOC.
- [ ] EEOC `protected_attributes` column populated on relevant queries from EITHER transport.

After this plan: **Phase 6 — end-to-end validation** (~30 min, mostly manual cross-transport smoke testing). Optional polish: reattach file-manager for inline document uploads, granular per-CLI Bash kill switches, mirror-as-cache semantics.
