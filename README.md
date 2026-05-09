# Ivy-Lab

CLI-first companion to [Ivy](https://github.com/misb74/Ivy). Optimised for personal terminal-based research with full Bash composition and per-source SQLite mirrors.

- **Terminal agent:** Claude Code reads `.claude/settings.json` for the curated MCP fleet, Bash policy, hooks, and skill catalogue.
- **Mobile transport:** Telegram bot (`bot/`) runs over the Claude Agent SDK and shares the same `.claude/settings.json` — same skills, same MCP fleet, same Bash allow-list.
- **Printing Press integration:** PP CLIs install under `pp-tools/`. PostToolUse hook taps every Bash invocation into per-source SQLite mirrors (`pp-mirrors/`).

See [`docs/superpowers/specs/2026-05-09-ivy-lab-cli-first-architecture-design.md`](docs/superpowers/specs/2026-05-09-ivy-lab-cli-first-architecture-design.md) for the full architecture and rationale.

## Status

Bootstrapping. Active phase: see `docs/superpowers/plans/`.

## Quick start

Not yet — bootstrap not complete. Track progress in `docs/superpowers/plans/`.

## Companion repo

Production-flavoured Ivy with gateway, frontend, and full Decision Records lives at https://github.com/misb74/Ivy.
