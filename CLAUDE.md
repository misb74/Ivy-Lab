# Ivy-Lab — Personal CLI-First Workforce Research

This is the Lab branch of Ivy. Optimised for terminal-first research from one machine, with full Bash composition and per-source SQLite mirrors. See [`docs/superpowers/specs/2026-05-09-ivy-lab-cli-first-architecture-design.md`](docs/superpowers/specs/2026-05-09-ivy-lab-cli-first-architecture-design.md) for architecture and rationale.

## How this differs from the production-flavoured Ivy at github.com/misb74/Ivy

- No gateway, no frontend, no Decision Records validation. Lab outputs are not decision-grade by definition.
- Bash is a first-class tool — you can pipe `jq`, `sqlite3`, PP CLIs, etc. without going through MCP.
- Schema is owned by the production Ivy repo. Lab does not write Supabase migrations. Migrations live read-only at `supabase/migrations/`.

## Bash composition — the Printing Press habit

When working with external data sources, prefer the shell-pipe pattern over multi-MCP-call orchestration:

```bash
company-goat-pp-cli funding stripe --pick 1 --agent | jq '.filings[] | select(.amount_raised > 1000000)' | tee /tmp/big-filings.json
company-goat-pp-cli snapshot stripe --pick 1 --agent | jq '.engineering.public_repos, .funding.filings | length'
```

The model writes the pipeline; Bash runs it; only the final shape lands in your context. This is the token-economics win the Lab is built around.

## Mirror rules

- Every external CLI call writes a row into `pp-mirrors/<source>.db` via `scripts/audit-and-mirror.js` (PostToolUse hook).
- "What changed since last sync" is a single SQL query against the mirror — no per-source code.
- DBs are gitignored. Treat them as local cache, not source of truth.

## Schema-ownership rule

- New tables / migrations: add them in the production Ivy repo only. Apply via Supabase CLI from there.
- Lab's `supabase/migrations/` is a read-only mirror — do NOT add files there.
- After Ivy adds a migration: `rsync -a /Users/moraybrown/Desktop/Ivy/supabase/migrations/ ./supabase/migrations/` from Lab root to refresh the mirror.

## Design-system mirror

The HTML executive report skill (`.claude/skills/output/SKILL.md`) requires the **Ivy v4 design system** — full CSS/JS at `gateway/src/v4-html/`. Lab is gateway-less by design, but the design system itself is needed so the bot and terminal Claude Code can produce on-brand HTML reports.

- `gateway/` is a **read-only mirror** of `/Users/moraybrown/Desktop/Ivy/gateway/src/v4-html/`. Same pattern as `supabase/migrations/`.
- `gateway/` is gitignored — do not commit changes here.
- After Ivy updates the design system: run `scripts/sync-design-system.sh` from Lab root to refresh.
- The reference report (`outputs/deep-research/agent-factory-work-transformation.html`) is also mirrored by the same script.

## Bash safety

- `.claude/settings.json` deny-lists raw `curl`/`wget` deliberately. Use a PP CLI instead.
- Kill switch: `IVY_LAB_BASH_DISABLED=1` env var disables Bash for the Claude Code session (live; PreToolUse hook in `scripts/preflight.js`).
- Audit log lives at `data/audit.db` — every tool call recorded.

## Working with the MCP fleet

- ~64 servers registered in `.mcp.json`. Some won't spawn until native modules compile — that's a Phase 2 known issue (see `docs/superpowers/specs/...` and the bootstrap PR description).
- `data-*` servers wrap public APIs; safe for any work.
- `agent-ats-scanner` writes to the shared Supabase project (same data plane as production Ivy).
- `agent-talent-sourcer` requires PDL or Apollo API keys; without them, it 401s.
- For talent research with deeper bios, use `multi_search(source_group: "talent")` + parallel `WebSearch` instead of PDL.

## Skills you should know about

- `routing` — catalogue of which MCP tool to use for which workforce question.
- `deep-research` — structured multi-source pipeline with SQLite persistence.
- `workforce-sim` — simulate workforce redesign with Build/Borrow/Buy/Bot framework.
- `agent-builder` — turn a simulation into an actual agent spec.

## Imports

@.claude/skills/routing/SKILL.md
@pp-tools/INDEX.md
