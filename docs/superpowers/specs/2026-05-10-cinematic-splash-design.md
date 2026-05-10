---
date: 2026-05-10
status: approved
extends: bin/ivy launcher (existing rose-themed splash from Phase 1)
---

# Cinematic Splash Screen — Design

## Why

Existing `bin/ivy` is a competent rose-themed splash inherited from production-Ivy. For Lab we want a sub-second cinematic launch: a real wordmark, a gradient sweep, a typewriter tagline, and a live status table — all under 1 second so it never grates on the 20th launch of the day.

## Decisions (from brainstorming)

- **Direction:** Fresh redesign with wow factor. Not minor edits to existing.
- **Wordmark/icon:** Single bold gradient wordmark (`IVY-LAB`), no icon. Rose palette gradient sweep across letters.
- **Animation/flow:** Sub-second (~940ms total), auto-launch claude. No menu, no caching tricks.

## Architecture

Single bash script at `bin/ivy`. ~180 LOC. No external runtime dependencies — pure bash + ANSI escapes + `jq` (already on system) for config-file reads. No `figlet` or `node` invocation needed.

## Components

```
1. Subtle vine flourish band      static
2. ASCII wordmark "IVY-LAB"       hand-rendered, gradient sweep, 240ms
3. Tagline                        typewriter reveal, 700ms
4. Status table                   instant render after typewriter
5. Bottom rule
6. exec claude "$@"
```

### Wordmark

ANSI Shadow style, 6 lines tall. Hand-typed verbatim into the script (no figlet runtime). Gradient sweep applied by repainting the block 4 times with palette shifted left-to-right (`R1 → R5`), 60ms per frame. Total animation: 240ms.

### Tagline

`terminal lab · workforce intel + pp` (35 chars). 20ms/char = 700ms typewriter.

### Status table (live values)

```
   version    v<x.y.z>  ·  N phases shipped
   bash       <allow_count> allow / <deny_count> deny
   mcp        <server_count> servers · <skill_count> skills
   pp tools   <pp_count> cli (<comma-list of names>)
   hooks      preflight + audit-and-mirror live
   bot        @IvyLabsBot · transport ready
   guard      IVY_LAB_BASH_DISABLED  ▸  <on|off>
```

Sources:
- `version` — `package.json` (existing splash already does this)
- `phases shipped` — `git log --oneline | grep -c '^.* feat(phase'` (rough count)
- `bash` — `jq '.permissions.allow | length'` and `.deny | length` from `.claude/settings.json`
- `mcp` — `jq '.mcpServers | length'` from `.mcp.json`
- `skills` — `ls .claude/skills | wc -l`
- `pp tools` — `jq -r 'keys | @csv'` from `pp-tools/registry.json`, plus `length`
- `hooks` — file existence check on `scripts/preflight.js` AND `scripts/audit-and-mirror.js`. Both present → "live"; one missing → "partial"; both missing → "not configured"
- `bot` — static "@IvyLabsBot · transport ready" (we don't probe Telegram from splash)
- `guard` — `[ "$IVY_LAB_BASH_DISABLED" = "1" ] && echo "⚠ ACTIVE (Bash blocked)" || echo "off"`. Active state shown in bright rose, off shown dim.

### Animation budget

| Element | Duration |
|---|---|
| Vine flourish | 0ms |
| Wordmark gradient sweep | 240ms (4 frames × 60ms) |
| Tagline typewriter | 700ms (35 chars × 20ms) |
| Status table | 0ms |
| **Total** | **~940ms** |

### Error handling

- Any `jq` / file read failure → fallback to `?` placeholder. Splash still renders.
- Terminal width < 60 cols → skip wordmark, show compact one-line `IVY ▸ LAB v<x.y.z>` + status table.
- Non-tty (e.g. piped output, CI) → skip animation entirely. Just print final state with no delays.

### Files

- Modify: `bin/ivy` (~99 → ~180 LOC). Preserve executable bit.
- Add: `bin/ivy.legacy` (rename existing one as backup) — actually, no. Just overwrite via Edit tool; git history is the backup.

## Out of scope

- Animated reveals beyond gradient sweep + typewriter (no spinning, no bouncing, no sound)
- "Did you know" rotating tip line
- Per-launch caching to skip animation
- Detection of running bot process
- Telegram API ping to verify bot is alive

## Success criteria

- Running `bin/ivy` shows the splash in <1s, then claude launches.
- All status values are real (no fake numbers).
- `bin/ivy` continues to pass through args (`bin/ivy --version` reaches claude unchanged).
- On a 60-col-wide terminal, the compact mode kicks in and looks reasonable.
- On a non-tty (`bin/ivy 2>&1 | head`), no garbled escape sequences.
