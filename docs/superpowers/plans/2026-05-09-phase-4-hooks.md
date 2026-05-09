# Ivy-Lab Phase 4 — Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the two safety hooks and the Lab-wide audit/mirror layer. Adds an `IVY_LAB_BASH_DISABLED` kill switch, a single `data/audit.db` capturing every tool call, and a generic `pp-mirrors/<source>.db` tap for PP CLI invocations.

**Architecture:** Two Node.js scripts in `scripts/`, plus two shared helpers in `scripts/lib/`. They use the system `sqlite3` CLI (child process) rather than `better-sqlite3` Node native module — sidesteps the compiled-bindings issue from Phase 1. PreToolUse hook can block (non-zero exit). PostToolUse hook is a silent tap (always exit 0). Both registered in `.claude/settings.json`.

**Tech Stack:** Node.js (built-in modules only — no new npm deps), system `sqlite3` CLI, bash for tests.

**Spec reference:** `docs/superpowers/specs/2026-05-09-ivy-lab-cli-first-architecture-design.md` § Section 4 (Bash safety) + § Hook architecture summary.

**Pre-conditions assumed:**
- Phase 0+1, 2, 2.5, 3 all merged on `main` (current HEAD: `e97f485`).
- `~/.zshrc` or shell rc has `~/go/bin` on PATH (or absolute paths used).
- System `sqlite3` is available (`which sqlite3` returns a path — macOS ships it by default).

**Phase 4 done-when:**
1. Setting `IVY_LAB_BASH_DISABLED=1` in env, restarting `claude`, and asking the agent to `Run: ls` causes the hook to block with a clear message; MCP tools still work (hook only blocks Bash).
2. Running ANY tool produces one row in `data/audit.db`.
3. Running `company-goat-pp-cli funding stripe --pick 1 --agent` (via the agent) produces a row in `pp-mirrors/company-goat.db` with the full JSON response.
4. Hook scripts complete in <200ms each (target — measure during smoke).
5. `data/audit.db` and `pp-mirrors/*.db` are NOT in the committed diff (gitignored).

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
Expected: empty status (or only `?? data/`), branch `main`, top of log is `e97f485 feat(phase-3): ...`.

- [ ] **Step 2: Create the phase branch**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab checkout -b phase-4-hooks
```

---

## Task 2 — `scripts/lib/scrub-secrets.js` (with TDD)

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/lib/scrub-secrets.js`
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/test-scrub-secrets.sh`

Shared utility used by BOTH hooks. Takes a text blob, returns the same blob with known secret shapes replaced by `[REDACTED]`.

Patterns to handle:
- Anthropic API keys: `sk-ant-[A-Za-z0-9_-]{50,}`
- OpenAI API keys: `sk-[A-Za-z0-9_-]{40,}` (also matches the looser pattern)
- Supabase JWTs: tokens starting with `eyJ` (base64-encoded JWT header) followed by 50+ chars
- AWS access keys: `AKIA[0-9A-Z]{16}`
- GitHub PATs: `gh[oprs]_[A-Za-z0-9_]{30,}`
- Plus: any literal value found in `/Users/moraybrown/Desktop/Ivy-Lab/.env` (loaded at module init)

- [ ] **Step 1: Write the test fixtures + script**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/test-scrub-secrets.sh`

```bash
#!/bin/bash
# Tests scripts/lib/scrub-secrets.js
# Usage: ./scripts/test-scrub-secrets.sh
set -e

SCRUB="node /Users/moraybrown/Desktop/Ivy-Lab/scripts/lib/scrub-secrets.js"

assert_eq() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "PASS  $name"
  else
    echo "FAIL  $name"
    echo "  expected: $expected"
    echo "  actual:   $actual"
    exit 1
  fi
}

# Anthropic key
out=$(echo 'foo sk-ant-api03-AbCdEf1234567890_xyzABCDEFGHIJKLMNOPQRSTUVWXYZ-extra-pad-pad bar' | $SCRUB)
assert_eq "anthropic-key-redacted" "foo [REDACTED] bar" "$out"

# OpenAI key
out=$(echo 'token=sk-AbCdEf1234567890ABCDEFGHIJKLMNOPQRSTUVWX go' | $SCRUB)
assert_eq "openai-key-redacted" "token=[REDACTED] go" "$out"

# AWS key
out=$(echo 'AKIAIOSFODNN7EXAMPLE here' | $SCRUB)
assert_eq "aws-key-redacted" "[REDACTED] here" "$out"

# GitHub PAT
out=$(echo 'gh_PAT gho_AbCdEf1234567890ABCDEFGHIJKLMNOPQR live' | $SCRUB)
assert_eq "github-pat-redacted" "gh_PAT [REDACTED] live" "$out"

# Supabase JWT (base64 header)
out=$(echo 'auth eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.signature_here' | $SCRUB)
assert_eq "supabase-jwt-redacted" "auth [REDACTED]" "$out"

# Pass-through: no secret
out=$(echo 'just regular text without secrets' | $SCRUB)
assert_eq "no-secret-passthrough" "just regular text without secrets" "$out"

# Multi-line input
out=$(printf 'line1\nsk-ant-api03-AbCdEf1234567890_xyzABCDEFGHIJKLMNOPQRSTUVWXYZ-pad-pad\nline3\n' | $SCRUB)
expected=$(printf 'line1\n[REDACTED]\nline3\n')
assert_eq "multi-line-redacted" "$expected" "$out"

# Idempotent — running scrub twice equals running once
once=$(echo 'sk-AbCdEf1234567890ABCDEFGHIJKLMNOPQRSTUVWX' | $SCRUB)
twice=$(echo "$once" | $SCRUB)
assert_eq "idempotent" "$once" "$twice"

echo ""
echo "All scrub-secrets tests passed."
```

```bash
chmod +x /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-scrub-secrets.sh
```

- [ ] **Step 2: Run the test to see it fail (no implementation yet)**

```bash
mkdir -p /Users/moraybrown/Desktop/Ivy-Lab/scripts/lib
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-scrub-secrets.sh 2>&1 | head -10
```
Expected: error like "Cannot find module .../scripts/lib/scrub-secrets.js" — confirms the test reaches the implementation.

- [ ] **Step 3: Write the implementation**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/lib/scrub-secrets.js`

```javascript
#!/usr/bin/env node
// Redact common secret patterns from a text blob.
// Used by hooks before persisting tool inputs to the audit log.
//
// Supports CLI usage (read stdin, write redacted to stdout) and module export.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const ENV_FILE = '/Users/moraybrown/Desktop/Ivy-Lab/.env';

const SECRET_PATTERNS = [
  // Anthropic API keys
  /sk-ant-[A-Za-z0-9_-]{50,}/g,
  // GitHub PATs (gho_, ghp_, ghr_, ghs_)
  /gh[oprs]_[A-Za-z0-9_]{30,}/g,
  // OpenAI API keys (sk- followed by long token)
  /\bsk-[A-Za-z0-9_-]{40,}\b/g,
  // AWS access keys
  /\bAKIA[0-9A-Z]{16}\b/g,
  // JWTs (three base64 segments separated by dots)
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
];

function loadEnvLiterals() {
  // Load value strings from .env so we can redact them too.
  // Returns a sorted-by-length-desc array so longer values redact first
  // (avoids partial-overlap mismatches).
  if (!fs.existsSync(ENV_FILE)) return [];
  const lines = fs.readFileSync(ENV_FILE, 'utf-8').split('\n');
  const values = [];
  for (const line of lines) {
    const m = line.match(/^[A-Z_][A-Z0-9_]*=(.+)$/);
    if (!m) continue;
    let v = m[1].trim();
    // Strip surrounding quotes
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    // Skip empty or trivially short values (would over-redact)
    if (v.length < 8) continue;
    values.push(v);
  }
  return values.sort((a, b) => b.length - a.length);
}

const ENV_VALUES = loadEnvLiterals();

export function scrubSecrets(text) {
  if (typeof text !== 'string') return text;
  let out = text;
  // Pattern-based redaction first
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  // Literal env value redaction second
  for (const v of ENV_VALUES) {
    if (v.length === 0) continue;
    // Replace all occurrences of the literal value
    out = out.split(v).join('[REDACTED]');
  }
  return out;
}

// CLI: read stdin, write scrubbed to stdout
async function cli() {
  const rl = readline.createInterface({ input: process.stdin });
  const chunks = [];
  for await (const line of rl) chunks.push(line);
  const input = chunks.join('\n') + (chunks.length > 0 ? '\n' : '');
  // Trim trailing newline that readline added if input was a single non-newline line
  const result = scrubSecrets(input.trimEnd() + (input.endsWith('\n') ? '\n' : ''));
  process.stdout.write(result);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run tests; expect all PASS**

```bash
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-scrub-secrets.sh
```
Expected: 7 PASS lines, no FAIL, ends with "All scrub-secrets tests passed."

If any FAIL, fix the regex or implementation and re-run. Do not proceed to Task 3 until all tests pass.

- [ ] **Step 5: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add scripts/lib/scrub-secrets.js scripts/test-scrub-secrets.sh
```

---

## Task 3 — `scripts/lib/pp-detect.js` (with TDD)

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/lib/pp-detect.js`
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/test-pp-detect.sh`

Shared utility used by both hooks. Takes a Bash command string, returns `{ source: '<name>', binary: '<binary>' }` if it matches a known PP CLI from `pp-tools/registry.json`, else `null`.

Detection logic must handle:
- Bare invocation: `company-goat-pp-cli funding stripe --pick 1 --agent`
- Absolute path: `/Users/moraybrown/go/bin/company-goat-pp-cli funding stripe`
- Tilde path: `~/go/bin/company-goat-pp-cli funding stripe`
- Inside a pipeline: `company-goat-pp-cli funding stripe --agent | jq '.filings'` (only the FIRST cmd matters)
- Inside a heredoc: should NOT detect (multi-line scripts are out of scope for v0)
- Not detected: `printing-press` (the meta tool — kind = "meta-tool" in registry, not a data source to mirror)

- [ ] **Step 1: Write the test fixtures**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/test-pp-detect.sh`

```bash
#!/bin/bash
# Tests scripts/lib/pp-detect.js
# Usage: ./scripts/test-pp-detect.sh
set -e

DETECT="node /Users/moraybrown/Desktop/Ivy-Lab/scripts/lib/pp-detect.js"

assert_match() {
  local name="$1" cmd="$2" expected_source="$3"
  out=$(echo -n "$cmd" | $DETECT)
  actual=$(echo "$out" | jq -r '.source // "null"' 2>/dev/null || echo "PARSE_ERROR")
  if [ "$expected_source" = "$actual" ]; then
    echo "PASS  $name"
  else
    echo "FAIL  $name (cmd: $cmd)"
    echo "  expected source: $expected_source"
    echo "  actual:          $actual (raw: $out)"
    exit 1
  fi
}

# Bare invocation
assert_match "bare" "company-goat-pp-cli funding stripe --agent" "company-goat"

# Absolute path
assert_match "absolute" "/Users/moraybrown/go/bin/company-goat-pp-cli funding stripe" "company-goat"

# Tilde path (shell will not have expanded yet, so detect by suffix)
assert_match "tilde" "~/go/bin/company-goat-pp-cli funding stripe" "company-goat"

# Pipeline (first cmd matches)
assert_match "pipeline" "company-goat-pp-cli funding stripe --agent | jq .filings" "company-goat"

# Pipeline (first cmd doesn't match — second does — should NOT detect; first cmd is what wins)
assert_match "pipeline-second-only" "echo hi | company-goat-pp-cli funding stripe" "null"

# Negative: printing-press meta tool (kind=meta-tool — excluded)
assert_match "meta-tool-excluded" "printing-press --version" "null"

# Negative: random command
assert_match "random-cmd" "ls -la mcp-servers/" "null"

# Negative: empty
assert_match "empty" "" "null"

# Negative: just whitespace
assert_match "whitespace" "   " "null"

echo ""
echo "All pp-detect tests passed."
```

```bash
chmod +x /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-pp-detect.sh
```

- [ ] **Step 2: Run to see it fail**

```bash
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-pp-detect.sh 2>&1 | head -5
```
Expected: error indicating module not found, OR FAIL on first test — confirms the harness reaches the implementation.

- [ ] **Step 3: Write the implementation**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/lib/pp-detect.js`

```javascript
#!/usr/bin/env node
// Detect whether a Bash command string invokes a known PP CLI.
// Reads pp-tools/registry.json to know which binaries are registered.
//
// CLI: read stdin, write JSON {"source": "...", "binary": "..."} or {"source": null} to stdout.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const REGISTRY_PATH = '/Users/moraybrown/Desktop/Ivy-Lab/pp-tools/registry.json';

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return {};
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
}

const REGISTRY = loadRegistry();

// Build a map of binary basename -> source name, EXCLUDING meta-tools
const BINARY_TO_SOURCE = {};
for (const [source, meta] of Object.entries(REGISTRY)) {
  if (meta.kind === 'meta-tool') continue;
  if (!meta.binary) continue;
  BINARY_TO_SOURCE[meta.binary] = source;
}

export function detectPPCall(cmd) {
  if (typeof cmd !== 'string') return null;
  const trimmed = cmd.trim();
  if (!trimmed) return null;

  // Take only the first command in a pipeline (split on unescaped |)
  // Simple heuristic: split on | and take first non-empty piece
  const firstCmd = trimmed.split('|')[0].trim();
  if (!firstCmd) return null;

  // Tokenize on whitespace; first token is the binary path
  const tokens = firstCmd.split(/\s+/);
  if (tokens.length === 0) return null;
  const binPath = tokens[0];

  // Get just the basename
  const binBase = binPath.split('/').filter(Boolean).pop();
  if (!binBase) return null;

  const source = BINARY_TO_SOURCE[binBase];
  if (!source) return null;

  return { source, binary: binBase };
}

async function cli() {
  const rl = readline.createInterface({ input: process.stdin });
  const chunks = [];
  for await (const line of rl) chunks.push(line);
  const input = chunks.join('\n');
  const result = detectPPCall(input) || { source: null };
  process.stdout.write(JSON.stringify(result) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run tests; expect all PASS**

```bash
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-pp-detect.sh
```
Expected: 9 PASS lines, no FAIL, ends with "All pp-detect tests passed."

- [ ] **Step 5: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add scripts/lib/pp-detect.js scripts/test-pp-detect.sh
```

---

## Task 4 — `scripts/preflight.js` (PreToolUse hook)

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/preflight.js`
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/test-preflight.sh`

Reads tool input from stdin (Claude Code's hook contract). Behaviors:

1. If env `IVY_LAB_BASH_DISABLED=1` AND tool name is `Bash`: print message to stderr, exit 1 (block).
2. If tool is `Bash` AND command matches a `lab_only: true` PP CLI: print warning to stderr, exit 0 (soft-log, don't block).
3. If tool input contains a known secret pattern (Anthropic, OpenAI, AWS, GitHub PAT, JWT) NOT redacted: print "secret-leak detected" to stderr, exit 1 (block, fail closed).
4. Else: exit 0 (allow).

Hook input contract (Claude Code sends JSON via stdin):

```json
{
  "tool_name": "Bash",
  "tool_input": { "command": "ls -la", ...other fields }
}
```

The `tool_input.command` is the field for Bash. Other tools have different shapes — the hook only inspects Bash specifically.

- [ ] **Step 1: Write the test fixtures**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/test-preflight.sh`

```bash
#!/bin/bash
# Tests scripts/preflight.js
set -e

PREFLIGHT="node /Users/moraybrown/Desktop/Ivy-Lab/scripts/preflight.js"

assert_exit() {
  local name="$1" expected_exit="$2" stdin_json="$3" env_kv="$4"
  set +e
  if [ -n "$env_kv" ]; then
    actual_exit=$(eval "$env_kv echo '$stdin_json' | $PREFLIGHT >/dev/null 2>&1; echo \$?")
  else
    actual_exit=$(echo "$stdin_json" | $PREFLIGHT >/dev/null 2>&1; echo $?)
  fi
  set -e
  if [ "$expected_exit" = "$actual_exit" ]; then
    echo "PASS  $name (exit $actual_exit)"
  else
    echo "FAIL  $name"
    echo "  expected exit: $expected_exit"
    echo "  actual exit:   $actual_exit"
    exit 1
  fi
}

# Allow harmless Bash
assert_exit "harmless-bash" 0 '{"tool_name":"Bash","tool_input":{"command":"ls -la"}}'

# Allow non-Bash tools regardless of input
assert_exit "non-bash-allowed" 0 '{"tool_name":"Read","tool_input":{"file_path":"/tmp/foo"}}'

# Kill switch: IVY_LAB_BASH_DISABLED=1 + Bash → block
assert_exit "kill-switch-blocks-bash" 1 '{"tool_name":"Bash","tool_input":{"command":"ls"}}' "IVY_LAB_BASH_DISABLED=1"

# Kill switch does NOT block non-Bash
assert_exit "kill-switch-allows-read" 0 '{"tool_name":"Read","tool_input":{"file_path":"/tmp/foo"}}' "IVY_LAB_BASH_DISABLED=1"

# Secret leak in Bash command → block (Anthropic key shape)
assert_exit "secret-leak-anthropic" 1 '{"tool_name":"Bash","tool_input":{"command":"echo sk-ant-api03-AbCdEf1234567890_xyzABCDEFGHIJKLMNOPQRSTUVWXYZ-padpad"}}'

# Secret leak in Bash command → block (AWS key shape)
assert_exit "secret-leak-aws" 1 '{"tool_name":"Bash","tool_input":{"command":"aws s3 ls --access-key AKIAIOSFODNN7EXAMPLE"}}'

# Empty input — should not crash
assert_exit "empty-input" 0 ''

echo ""
echo "All preflight tests passed."
```

```bash
chmod +x /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-preflight.sh
```

- [ ] **Step 2: Run to see it fail**

```bash
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-preflight.sh 2>&1 | head -5
```
Expected: failure indicating preflight.js not found.

- [ ] **Step 3: Write the implementation**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/preflight.js`

```javascript
#!/usr/bin/env node
// PreToolUse hook for Ivy-Lab.
//
// Behaviors:
//   1. IVY_LAB_BASH_DISABLED=1 + tool=Bash → block (exit 1).
//   2. tool=Bash + command matches lab_only:true PP CLI → soft-log to stderr, allow.
//   3. tool input contains an unredacted secret pattern → block (exit 1, fail closed).
//   4. else → allow (exit 0).

import { detectPPCall } from './lib/pp-detect.js';
import { scrubSecrets } from './lib/scrub-secrets.js';
import fs from 'node:fs';
import readline from 'node:readline';

const REGISTRY_PATH = '/Users/moraybrown/Desktop/Ivy-Lab/pp-tools/registry.json';

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return {};
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
}

const REGISTRY = loadRegistry();

async function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', () => resolve(''));
    // If stdin is empty/closed immediately, resolve quickly
    setTimeout(() => resolve(Buffer.concat(chunks).toString('utf-8')), 50);
  });
}

function block(message) {
  process.stderr.write(`[ivy-lab preflight] BLOCK: ${message}\n`);
  process.exit(1);
}

function warn(message) {
  process.stderr.write(`[ivy-lab preflight] WARN: ${message}\n`);
}

function containsSecret(text) {
  if (typeof text !== 'string') return false;
  const scrubbed = scrubSecrets(text);
  return scrubbed !== text;
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) process.exit(0);

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // If we can't parse the input, allow (don't block on hook bugs)
    process.exit(0);
  }

  const toolName = payload.tool_name || '';
  const toolInput = payload.tool_input || {};

  // Behavior 1: kill switch
  if (process.env.IVY_LAB_BASH_DISABLED === '1' && toolName === 'Bash') {
    block('IVY_LAB_BASH_DISABLED=1 — Bash is disabled this session. Unset the env var and restart claude to re-enable.');
  }

  // Behavior 2: scrape_only soft-log (only for Bash + matched PP CLI)
  if (toolName === 'Bash') {
    const cmd = toolInput.command || '';
    const detected = detectPPCall(cmd);
    if (detected) {
      const meta = REGISTRY[detected.source] || {};
      if (meta.lab_only === true || meta.legal_class === 'scrape_only') {
        warn(`scrape_only PP CLI invoked: ${detected.source} — fine in Lab, would be blocked in Production.`);
      }
    }
  }

  // Behavior 3: secret-leak abort (covers all tools)
  const inputText = JSON.stringify(toolInput);
  if (containsSecret(inputText)) {
    block(`tool input appears to contain a secret (Anthropic/OpenAI/AWS/JWT/GitHub PAT shape). Aborting before it leaks into context.`);
  }

  // Behavior 4: allow
  process.exit(0);
}

main().catch(() => process.exit(0));
```

- [ ] **Step 4: Run tests**

```bash
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-preflight.sh
```
Expected: 7 PASS lines, ends with "All preflight tests passed."

If any FAIL, the failure mode is usually around stdin handling under bash quoting. Fix and re-run.

- [ ] **Step 5: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add scripts/preflight.js scripts/test-preflight.sh
```

---

## Task 5 — `scripts/audit-and-mirror.js` (PostToolUse hook)

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/audit-and-mirror.js`
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/test-audit-and-mirror.sh`

Behaviors:
1. Always: insert one row into `data/audit.db` table `tool_calls` with `(ts, session_id, tool, input_redacted, output_size, exit_status)`.
2. If tool=Bash AND command matches a known PP CLI: also insert one row into `pp-mirrors/<source>.db` table `results` with `(ts, invocation, exit_code, stdout_json, manifest)`.
3. ALWAYS exit 0 (never block PostToolUse — silent tap).

Uses system `sqlite3` CLI via `child_process.execFileSync` to avoid the better-sqlite3 native compile issue.

Hook input contract (Claude Code sends JSON via stdin for PostToolUse):

```json
{
  "tool_name": "Bash",
  "tool_input": { "command": "..." },
  "tool_response": { "output": "..." },
  "session_id": "..."
}
```

- [ ] **Step 1: Write the test fixture**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/test-audit-and-mirror.sh`

```bash
#!/bin/bash
# Tests scripts/audit-and-mirror.js
set -e

HOOK="node /Users/moraybrown/Desktop/Ivy-Lab/scripts/audit-and-mirror.js"
TEST_DATA_DIR="/tmp/ivy-lab-hook-test-$$"
TEST_AUDIT_DB="$TEST_DATA_DIR/data/audit.db"
TEST_MIRRORS_DIR="$TEST_DATA_DIR/pp-mirrors"

# The hook reads its DB paths from env IVY_LAB_DATA_DIR and IVY_LAB_MIRRORS_DIR
# (defaults to repo's data/ and pp-mirrors/ if unset)
export IVY_LAB_DATA_DIR="$TEST_DATA_DIR/data"
export IVY_LAB_MIRRORS_DIR="$TEST_MIRRORS_DIR"

mkdir -p "$IVY_LAB_DATA_DIR" "$IVY_LAB_MIRRORS_DIR"

# Test 1: arbitrary tool produces an audit row
echo '{"tool_name":"Read","tool_input":{"file_path":"/tmp/foo"},"tool_response":{"output":"hello"},"session_id":"sess-123"}' | $HOOK
audit_count=$(sqlite3 "$TEST_AUDIT_DB" "SELECT count(*) FROM tool_calls WHERE tool='Read' AND session_id='sess-123'" 2>/dev/null || echo 0)
if [ "$audit_count" = "1" ]; then echo "PASS  audit-row-created"; else echo "FAIL  audit-row-created (got $audit_count)"; exit 1; fi

# Test 2: PP CLI Bash call produces audit row + mirror row
echo '{"tool_name":"Bash","tool_input":{"command":"company-goat-pp-cli funding stripe --agent"},"tool_response":{"output":"{\"filings\":[{\"amount_raised\":5300000}]}"},"session_id":"sess-456"}' | $HOOK
mirror_count=$(sqlite3 "$TEST_MIRRORS_DIR/company-goat.db" "SELECT count(*) FROM results WHERE invocation LIKE '%funding stripe%'" 2>/dev/null || echo 0)
if [ "$mirror_count" = "1" ]; then echo "PASS  mirror-row-created"; else echo "FAIL  mirror-row-created (got $mirror_count)"; exit 1; fi

# Test 3: Non-PP Bash call does NOT create mirror row
echo '{"tool_name":"Bash","tool_input":{"command":"ls -la"},"tool_response":{"output":"foo bar"},"session_id":"sess-789"}' | $HOOK
ls_mirror_count=$(sqlite3 "$TEST_MIRRORS_DIR/company-goat.db" "SELECT count(*) FROM results WHERE invocation LIKE '%ls -la%'" 2>/dev/null || echo 0)
if [ "$ls_mirror_count" = "0" ]; then echo "PASS  non-pp-no-mirror"; else echo "FAIL  non-pp-no-mirror (got $ls_mirror_count)"; exit 1; fi

# Test 4: Hook always exits 0 even on bad input
set +e
echo 'not json at all' | $HOOK
exit_status=$?
set -e
if [ "$exit_status" = "0" ]; then echo "PASS  malformed-input-exits-0"; else echo "FAIL  malformed-input-exits-0 (got $exit_status)"; exit 1; fi

# Test 5: Secrets in input are redacted in audit DB
echo '{"tool_name":"Bash","tool_input":{"command":"echo sk-ant-api03-AbCdEf1234567890_xyzABCDEFGHIJKLMNOPQRSTUVWXYZ-padpad here"},"tool_response":{"output":"ok"},"session_id":"sess-secret"}' | $HOOK
secret_in_db=$(sqlite3 "$TEST_AUDIT_DB" "SELECT input_redacted FROM tool_calls WHERE session_id='sess-secret'" 2>/dev/null)
if echo "$secret_in_db" | grep -q "REDACTED"; then echo "PASS  secret-scrubbed-in-audit"; else echo "FAIL  secret-scrubbed-in-audit (got: $secret_in_db)"; exit 1; fi
if echo "$secret_in_db" | grep -q "sk-ant"; then echo "FAIL  secret-leaked-in-audit (got: $secret_in_db)"; exit 1; fi

# Cleanup
rm -rf "$TEST_DATA_DIR"

echo ""
echo "All audit-and-mirror tests passed."
```

```bash
chmod +x /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-audit-and-mirror.sh
```

- [ ] **Step 2: Run to see it fail**

```bash
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-audit-and-mirror.sh 2>&1 | head -10
```
Expected: error indicating module not found.

- [ ] **Step 3: Write the implementation**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/audit-and-mirror.js`

```javascript
#!/usr/bin/env node
// PostToolUse hook for Ivy-Lab.
//
// Behaviors:
//   1. Always: insert one row into data/audit.db (tool_calls table).
//   2. If Bash + matches a known PP CLI: also insert into pp-mirrors/<source>.db (results table).
//   3. Always exit 0 — silent tap, never blocks PostToolUse.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { detectPPCall } from './lib/pp-detect.js';
import { scrubSecrets } from './lib/scrub-secrets.js';

const DEFAULT_DATA_DIR = '/Users/moraybrown/Desktop/Ivy-Lab/data';
const DEFAULT_MIRRORS_DIR = '/Users/moraybrown/Desktop/Ivy-Lab/pp-mirrors';

const DATA_DIR = process.env.IVY_LAB_DATA_DIR || DEFAULT_DATA_DIR;
const MIRRORS_DIR = process.env.IVY_LAB_MIRRORS_DIR || DEFAULT_MIRRORS_DIR;
const AUDIT_DB = path.join(DATA_DIR, 'audit.db');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sqlExec(dbPath, sql) {
  // Use sqlite3 CLI in batch mode. Pass SQL via stdin to avoid arg-quoting issues.
  return execFileSync('sqlite3', [dbPath], {
    input: sql,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

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

function ensureMirrorSchema(source) {
  ensureDir(MIRRORS_DIR);
  const dbPath = path.join(MIRRORS_DIR, `${source}.db`);
  sqlExec(dbPath, `
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY,
  ts TEXT DEFAULT (datetime('now')),
  invocation TEXT,
  exit_code INTEGER,
  stdout_json TEXT,
  manifest TEXT
);
CREATE INDEX IF NOT EXISTS idx_invocation ON results(invocation);
`);
  return dbPath;
}

function escapeSqlString(s) {
  if (s == null) return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

async function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', () => resolve(''));
    setTimeout(() => resolve(Buffer.concat(chunks).toString('utf-8')), 50);
  });
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) return; // nothing to do

  let payload;
  try { payload = JSON.parse(raw); } catch { return; }

  const toolName = payload.tool_name || 'unknown';
  const toolInput = payload.tool_input || {};
  const toolResponse = payload.tool_response || {};
  const sessionId = payload.session_id || 'unknown';

  const inputJson = JSON.stringify(toolInput);
  const inputRedacted = scrubSecrets(inputJson);
  const outputJson = typeof toolResponse === 'string' ? toolResponse : JSON.stringify(toolResponse);
  const outputSize = outputJson.length;
  const exitStatus = toolResponse.error ? 'error' : 'ok';

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

  // PP mirror — only for Bash + matched PP CLI
  if (toolName === 'Bash') {
    const cmd = toolInput.command || '';
    const detected = detectPPCall(cmd);
    if (detected) {
      const dbPath = ensureMirrorSchema(detected.source);
      const stdoutJson = scrubSecrets(outputJson);
      sqlExec(dbPath, `
INSERT INTO results (invocation, exit_code, stdout_json, manifest)
VALUES (
  ${escapeSqlString(cmd)},
  0,
  ${escapeSqlString(stdoutJson)},
  ${escapeSqlString(JSON.stringify({ source: detected.source, binary: detected.binary, ts: new Date().toISOString() }))}
);
`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(0)); // never block
```

- [ ] **Step 4: Run tests**

```bash
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-audit-and-mirror.sh
```
Expected: 5 PASS lines, ends with "All audit-and-mirror tests passed."

- [ ] **Step 5: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add scripts/audit-and-mirror.js scripts/test-audit-and-mirror.sh
```

---

## Task 6 — `scripts/README.md`

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/README.md`

- [ ] **Step 1: Write the file**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/README.md`

```markdown
# Ivy-Lab hooks and helpers

Two hook scripts and two shared helpers, plus a bash test harness.

## Files

| File | Purpose |
|---|---|
| `preflight.js` | PreToolUse hook. Kill switch (`IVY_LAB_BASH_DISABLED=1`), scrape_only soft-log, secret-leak abort. |
| `audit-and-mirror.js` | PostToolUse hook. Always inserts one row in `data/audit.db`. PP Bash calls also insert into `pp-mirrors/<source>.db`. |
| `lib/scrub-secrets.js` | Shared utility — redact known secret shapes + literal `.env` values. |
| `lib/pp-detect.js` | Shared utility — given a Bash command, returns `{ source, binary }` if it matches a known PP CLI from `pp-tools/registry.json`, else `null`. |
| `test-*.sh` | Bash test harnesses for each module. Use system `sqlite3` for assertions. |
| `run-mcp.sh` | Phase 2 MCP launcher (loads `.env`, runs servers via tsx). Unrelated to hooks. |
| `stdin-guard.cjs` | Phase 2 helper — exits MCP children when Claude Code closes stdin. |

## Hook input contract

Claude Code spawns the hook script and pipes JSON to stdin. PreToolUse payload:

```json
{
  "tool_name": "Bash",
  "tool_input": { "command": "..." }
}
```

PostToolUse payload adds `tool_response` and `session_id`.

PreToolUse honours exit code:
- `0` = allow.
- `1` = block (Claude Code surfaces stderr).

PostToolUse exit code is ignored — always `0` to avoid silent breakage.

## Running tests

```bash
bash scripts/test-scrub-secrets.sh
bash scripts/test-pp-detect.sh
bash scripts/test-preflight.sh
bash scripts/test-audit-and-mirror.sh
```

Each prints `PASS` lines per case and a final summary. Exits non-zero on first FAIL.

## Why system `sqlite3` instead of `better-sqlite3`?

`better-sqlite3` is a Node native module that requires `node-gyp` to compile bindings. On macOS 26 beta with CLT-only (no Xcode.app), `node-gyp` v11's `XcodeVersion()` regex breaks and the build fails. Phase 1 worked around this with `--ignore-scripts`, but that means `better-sqlite3` is not available at runtime.

The hooks dodge this entirely by shelling out to the system `sqlite3` CLI (which ships with macOS). Slightly more overhead per call but avoids the native-compile dependency.

## Debugging a hook failure

If a hook fires unexpectedly:

1. Run the hook directly with the offending JSON on stdin: `echo '<json>' | node scripts/preflight.js`. Observe stderr.
2. Check `data/audit.db` for the recorded `tool_calls` row matching the session.
3. If the kill switch is unintentionally active: `unset IVY_LAB_BASH_DISABLED` in your shell, restart `claude`.
4. If a secret-leak abort is wrong: `node -e "import('./scripts/lib/scrub-secrets.js').then(m => console.log(m.scrubSecrets(process.argv[1])))" '<offending input>'` — see what's matching.
5. Disable both hooks temporarily by removing the `hooks` block from `.claude/settings.json` (commit only after fixing).

## Adding a new PP CLI

1. Add the binary metadata to `pp-tools/registry.json` (set `legal_class`, `domain`, `lab_only`).
2. The hooks pick it up automatically — no code change needed in `preflight.js` or `audit-and-mirror.js`.
3. Add Bash allow patterns in `.claude/settings.json` so Claude Code can invoke without prompting.
```

- [ ] **Step 2: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add scripts/README.md
```

---

## Task 7 — `.claude/settings.json` hooks wiring (controller-only)

**Files:**
- Modify: `/Users/moraybrown/Desktop/Ivy-Lab/.claude/settings.json`

**IMPORTANT — controller-only step.** The Claude Code harness blocks subagents from writing `.claude/settings.json`. Implementer should report NEEDS_CONTEXT for this task; the top-level Claude (controller) does the write directly.

The change adds a `hooks` block referencing the two new scripts. Final structure:

```json
{
  "permissions": { ... existing ... },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          { "type": "command", "command": "node /Users/moraybrown/Desktop/Ivy-Lab/scripts/preflight.js" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          { "type": "command", "command": "node /Users/moraybrown/Desktop/Ivy-Lab/scripts/audit-and-mirror.js" }
        ]
      }
    ]
  }
}
```

The `matcher: ".*"` runs the hook for every tool. The hook itself decides whether to act (Bash-specific behaviors only fire for Bash).

After writing, verify:
```bash
jq '.hooks.PreToolUse | length' /Users/moraybrown/Desktop/Ivy-Lab/.claude/settings.json
jq '.hooks.PostToolUse | length' /Users/moraybrown/Desktop/Ivy-Lab/.claude/settings.json
git -C /Users/moraybrown/Desktop/Ivy-Lab add .claude/settings.json
```
Expected: both lengths `1`.

---

## Task 8 — `CLAUDE.md` flip "Phase 4" → "active"

**Files:**
- Modify: `/Users/moraybrown/Desktop/Ivy-Lab/CLAUDE.md`

The `## Bash safety` section currently says:
- "Audit log lives at `data/audit.db` (Phase 4)."
- Kill switch line says "(PreToolUse hook lands in Phase 4)."

Both should flip to active state.

- [ ] **Step 1: Edit CLAUDE.md**

Use the Edit tool with two replacements:

Replacement 1:
- old_string: `- Audit log lives at \`data/audit.db\` (Phase 4).`
- new_string: `- Audit log lives at \`data/audit.db\` — every tool call recorded.`

Replacement 2:
- old_string: `- Kill switch: \`IVY_LAB_BASH_DISABLED=1\` env var disables Bash for the Claude Code session (PreToolUse hook lands in Phase 4).`
- new_string: `- Kill switch: \`IVY_LAB_BASH_DISABLED=1\` env var disables Bash for the Claude Code session (live; PreToolUse hook in \`scripts/preflight.js\`).`

Also update the "Mirror rules" section:
- old_string: `- Every external CLI call writes a row into \`pp-mirrors/<source>.db\` via the PostToolUse hook (Phase 4).`
- new_string: `- Every external CLI call writes a row into \`pp-mirrors/<source>.db\` via \`scripts/audit-and-mirror.js\` (PostToolUse hook).`

- [ ] **Step 2: Verify and stage**

```bash
grep -E "Audit log lives at .data/audit\.db. — every tool call recorded\." /Users/moraybrown/Desktop/Ivy-Lab/CLAUDE.md && echo "audit line OK"
grep -E "Kill switch.*live.*scripts/preflight\.js" /Users/moraybrown/Desktop/Ivy-Lab/CLAUDE.md && echo "kill line OK"
grep -E "scripts/audit-and-mirror\.js" /Users/moraybrown/Desktop/Ivy-Lab/CLAUDE.md && echo "mirror line OK"
git -C /Users/moraybrown/Desktop/Ivy-Lab add CLAUDE.md
```
Expected: 3 OK lines.

---

## Task 9 — Run all tests one final time

**Files:** none (verification)

- [ ] **Step 1: All four test scripts**

```bash
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-scrub-secrets.sh
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-pp-detect.sh
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-preflight.sh
bash /Users/moraybrown/Desktop/Ivy-Lab/scripts/test-audit-and-mirror.sh
```
Expected: all four end with "All <name> tests passed."

If any fail, fix the issue and re-run before continuing.

---

## Task 10 — Commit + push + PR

- [ ] **Step 1: Final pre-commit safety**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab status --short | grep -iE '\.(env|db|db-shm|db-wal|sqlite|sqlite3|key|pem)$' | wc -l
```
Expected: `0`. If non-zero, STOP — gitignore is broken and we'd commit data.

Final staged file count and list:
```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab diff --cached --name-only | sort
```
Expected sorted list:
- `.claude/settings.json`
- `CLAUDE.md`
- `scripts/README.md`
- `scripts/audit-and-mirror.js`
- `scripts/lib/pp-detect.js`
- `scripts/lib/scrub-secrets.js`
- `scripts/preflight.js`
- `scripts/test-audit-and-mirror.sh`
- `scripts/test-pp-detect.sh`
- `scripts/test-preflight.sh`
- `scripts/test-scrub-secrets.sh`

(11 files total.)

- [ ] **Step 2: Commit**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab commit -m "$(cat <<'EOF'
feat(phase-4): hooks — preflight (kill switch + secret-leak block) + audit-and-mirror (audit.db + pp-mirrors fan-out)

Phase 4 of the Ivy-Lab founding architecture (see docs/superpowers/specs/2026-05-09-... and docs/superpowers/plans/2026-05-09-phase-4-hooks.md).

Adds:
- scripts/preflight.js (PreToolUse hook): IVY_LAB_BASH_DISABLED kill switch, scrape_only soft-log for lab_only PP CLIs, secret-leak abort (Anthropic/OpenAI/AWS/JWT/GitHub PAT shapes).
- scripts/audit-and-mirror.js (PostToolUse hook): every tool call → data/audit.db (tool_calls table). PP CLI Bash invocations → pp-mirrors/<source>.db (results table). Always exits 0 — silent tap.
- scripts/lib/scrub-secrets.js: shared utility, redacts known key shapes plus literal .env values.
- scripts/lib/pp-detect.js: shared utility, parses Bash command and returns {source,binary} for known PP CLIs from pp-tools/registry.json.
- scripts/test-*.sh: bash test harnesses for all four modules. Run all four; each ends with "All X tests passed."
- scripts/README.md: hook contract, debug guide, sqlite3-CLI rationale.

Modifies:
- .claude/settings.json: adds hooks.PreToolUse and hooks.PostToolUse referencing the two new scripts with matcher ".*".
- CLAUDE.md: flips three references from "(Phase 4)" placeholders to live state.

SQLite via system sqlite3 CLI (not better-sqlite3 native module) — sidesteps Phase 1's macOS-26-beta + node-gyp compile issue.

Smoke test (must run from a separate Claude Code session):
1. cd /Users/moraybrown/Desktop/Ivy-Lab && claude
2. Ask agent to "Run: ls" — verify a row appears in data/audit.db.
3. Ask agent to invoke company-goat-pp-cli funding stripe --pick 1 --agent — verify a row appears in pp-mirrors/company-goat.db.
4. Quit, set IVY_LAB_BASH_DISABLED=1, restart claude, ask for any Bash — verify it's blocked.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab push -u origin phase-4-hooks
```

- [ ] **Step 4: Build PR body**

```bash
cat > /tmp/ivy-lab-phase-4-pr-body.md <<'BODY'
## Summary

Lands the two safety hooks and the Lab-wide audit/mirror layer.

### Adds (`scripts/`)

- **`preflight.js`** — PreToolUse hook. Three behaviors: `IVY_LAB_BASH_DISABLED` kill switch, scrape_only soft-log for `lab_only: true` PP CLIs, secret-leak abort (Anthropic/OpenAI/AWS/JWT/GitHub PAT shapes — fail closed before secrets enter audit log or context).
- **`audit-and-mirror.js`** — PostToolUse hook. Always inserts one row in `data/audit.db`. PP Bash calls also insert into `pp-mirrors/<source>.db` with the full JSON response. Always exits 0 (never blocks).
- **`lib/scrub-secrets.js`** — shared utility, redacts known key shapes plus literal `.env` values.
- **`lib/pp-detect.js`** — shared utility, parses Bash command and returns `{ source, binary }` for known PP CLIs from `pp-tools/registry.json`.
- **`test-*.sh`** — bash test harnesses, no new npm deps. Each ends with `All X tests passed.`
- **`README.md`** — hook contract, debug guide.

### Modifies

- `.claude/settings.json` — adds `hooks.PreToolUse` + `hooks.PostToolUse`.
- `CLAUDE.md` — flips three `(Phase 4)` placeholders to live references.

### SQLite via system `sqlite3` CLI

Not `better-sqlite3` Node native module. Sidesteps the Phase 1 macOS-26-beta + node-gyp compile issue. Slightly more overhead per call but no native-build dependency.

## Test plan

In-repo unit tests:
```bash
bash scripts/test-scrub-secrets.sh
bash scripts/test-pp-detect.sh
bash scripts/test-preflight.sh
bash scripts/test-audit-and-mirror.sh
```

Smoke test (from a separate Claude Code session):

- [ ] `cd /Users/moraybrown/Desktop/Ivy-Lab && claude`
- [ ] Ask: "Run: ls". After completion, verify `sqlite3 data/audit.db "SELECT count(*) FROM tool_calls;"` shows ≥ 1.
- [ ] Ask: "use `company-goat-pp-cli` to look up Stripe fundraising". Verify `sqlite3 pp-mirrors/company-goat.db "SELECT count(*) FROM results;"` shows ≥ 1.
- [ ] Quit, `export IVY_LAB_BASH_DISABLED=1`, restart `claude`. Ask for `Run: ls`. Verify the agent reports a hook block (`[ivy-lab preflight] BLOCK: IVY_LAB_BASH_DISABLED=1 ...`).
- [ ] Verify MCP tools still work in the kill-switched session (e.g. `data-onet` lookup).
- [ ] `unset IVY_LAB_BASH_DISABLED`, restart, verify Bash works again.

## Known issues / follow-up

- `data/audit.db` and `pp-mirrors/*.db` are gitignored (Phase 1's `*.db` global pattern). They live local-only.
- Hook performance budget is <200ms per call. If smoke test feels slow, profile with `time node scripts/audit-and-mirror.js < /tmp/sample.json`.
- Phase 5 (bot refactor onto Claude Agent SDK) is the next big step — the bot currently uses direct Anthropic SDK and won't share these hooks until Phase 5 lands.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
```

- [ ] **Step 5: Create PR**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && gh pr create \
  --title "Phase 4: Hooks — preflight + audit-and-mirror" \
  --body-file /tmp/ivy-lab-phase-4-pr-body.md
```

- [ ] **Step 6: Capture PR URL**

```bash
gh pr view --json url,number,title,state
```

---

## Task 11 — User PR review + smoke test + squash-merge

**Files:** none (user-gated)

- [ ] **Step 1: User reviews PR**

- [ ] **Step 2: User runs smoke test**

From a separate terminal:
```bash
cd /Users/moraybrown/Desktop/Ivy-Lab
claude
```

Then in the session:
1. "Run: ls"
2. "use company-goat-pp-cli to look up Stripe fundraising"
3. Quit, `export IVY_LAB_BASH_DISABLED=1`, restart `claude`, ask "Run: ls" — should be blocked.
4. Verify with `sqlite3 data/audit.db "SELECT * FROM tool_calls ORDER BY ts DESC LIMIT 5;"` and `sqlite3 pp-mirrors/company-goat.db "SELECT invocation, length(stdout_json) FROM results ORDER BY ts DESC LIMIT 3;"`.

- [ ] **Step 3: After approval, controller squash-merges**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && gh pr merge --squash --delete-branch
git -C /Users/moraybrown/Desktop/Ivy-Lab checkout main
git -C /Users/moraybrown/Desktop/Ivy-Lab pull
git -C /Users/moraybrown/Desktop/Ivy-Lab fetch --prune origin
```

---

## Done when

- [ ] PR `phase-4-hooks` squash-merged into `main`.
- [ ] All four `scripts/test-*.sh` test scripts pass.
- [ ] Smoke test confirms: audit row created on any tool call, mirror row created on company-goat call, kill switch blocks Bash but not MCP.
- [ ] `data/audit.db` and `pp-mirrors/*.db` exist locally but NOT in the merged commit.

After this plan: **Phase 5 — bot refactor onto Claude Agent SDK** (~1 day, the big one). Gets its own plan.
