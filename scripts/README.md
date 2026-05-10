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

Plus the EEOC detector test (added in Phase 5):

```bash
bash scripts/test-eeoc-detect.sh
```

## SQLite schemas

### `data/audit.db` — every tool call across both transports

Created and migrated automatically by `audit-and-mirror.js`. One row per Claude Code tool invocation (terminal or Telegram).

```sql
CREATE TABLE tool_calls (
  id                   INTEGER PRIMARY KEY,
  ts                   TEXT DEFAULT (datetime('now')),
  session_id           TEXT,
  tool                 TEXT,         -- "Bash", "Read", "mcp__data-onet__...", etc.
  input_redacted       TEXT,         -- JSON of tool input, scrubbed for secrets
  output_size          INTEGER,      -- byte length of response
  exit_status          TEXT,         -- "ok" | "error"
  protected_attributes TEXT          -- comma-separated EEOC tags (Phase 5+) or NULL
);
CREATE INDEX idx_tool    ON tool_calls(tool);
CREATE INDEX idx_session ON tool_calls(session_id);
```

Useful queries:

```bash
# Recent tool calls
sqlite3 data/audit.db "SELECT ts, tool, substr(input_redacted, 1, 60) FROM tool_calls ORDER BY ts DESC LIMIT 20;"

# Anything EEOC-tagged
sqlite3 data/audit.db "SELECT ts, tool, protected_attributes FROM tool_calls WHERE protected_attributes IS NOT NULL ORDER BY ts DESC LIMIT 10;"

# Tool-call frequency leaderboard
sqlite3 data/audit.db "SELECT tool, count(*) AS calls FROM tool_calls GROUP BY tool ORDER BY calls DESC LIMIT 15;"

# Per-session activity
sqlite3 data/audit.db "SELECT session_id, count(*), min(ts), max(ts) FROM tool_calls GROUP BY session_id ORDER BY max(ts) DESC LIMIT 5;"
```

### `pp-mirrors/<source>.db` — per-source PP CLI invocations

One DB per known PP CLI from `pp-tools/registry.json`. Created lazily on first matching Bash invocation. Same schema across all sources — uniform tap.

```sql
CREATE TABLE results (
  id          INTEGER PRIMARY KEY,
  ts          TEXT DEFAULT (datetime('now')),
  invocation  TEXT,         -- exact command line, e.g. "company-goat-pp-cli funding stripe --pick 1 --agent"
  exit_code   INTEGER,      -- 0 on success
  stdout_json TEXT,         -- response body (scrubbed for secrets)
  manifest    TEXT          -- JSON metadata: {source, binary, ts}
);
CREATE INDEX idx_invocation ON results(invocation);
```

Useful queries:

```bash
# All company-goat invocations and their response sizes
sqlite3 pp-mirrors/company-goat.db "SELECT ts, invocation, length(stdout_json) FROM results ORDER BY ts DESC LIMIT 10;"

# "What changed since last sync?" — diff the two most recent rows for an invocation
sqlite3 pp-mirrors/company-goat.db "SELECT stdout_json FROM results WHERE invocation = 'company-goat-pp-cli funding stripe --pick 1 --agent' ORDER BY ts DESC LIMIT 2;"

# Total PP calls per source
for db in pp-mirrors/*.db; do
  echo "$db: $(sqlite3 "$db" "SELECT count(*) FROM results")"
done
```

The mirror is a **tap, not a cache** — every PP call hits upstream every time. See `docs/superpowers/specs/2026-05-10-mirror-cache-decision.md` for why.

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
