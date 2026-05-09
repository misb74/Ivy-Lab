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
