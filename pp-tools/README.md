# pp-tools — Printing Press integration for Lab

Printing Press is the Go-based CLI generator at https://github.com/mvanhorn/cli-printing-press. Pre-built CLIs live in https://github.com/mvanhorn/printing-press-library.

This directory is Lab's local catalogue of which PP CLIs we've installed and how the agent uses them. The CLIs themselves live at `~/go/bin/` (system-level), not here.

## Files

- `INDEX.md` — agent-readable catalogue: per-CLI synopsis, common commands, output shape sketch. Imported from project `CLAUDE.md` so Claude Code auto-loads it.
- `registry.json` — per-CLI metadata: `legal_class`, `domain`, `lab_only` flag, source list, optional auth, `built_in_sync` flag.

## Currently installed (Phase 0 set)

- **`printing-press`** (4.2.1) — meta-CLI; generates new CLIs on demand. Binary: `/Users/moraybrown/go/bin/printing-press`.
- **`company-goat-pp-cli`** (1.0.0) — multi-source startup intel: SEC Form D, GitHub, HN, Companies House, YC, Wikidata, RDAP. Binary: `/Users/moraybrown/go/bin/company-goat-pp-cli`. Has built-in `sync` subcommand for local SQLite mirror.

## Phase 0 set revision (vs original spec)

The architecture spec named `{company-goat, hackernews-pp, wikipedia-pp}`. Reality: only `company-goat` is a separate library tool — HackerNews coverage (`mentions`, `launches`) and Wikidata (`wiki`) are bundled INSIDE company-goat as 2 of its 7 sources. Phase 0 collapses to 1 install with full 7-source coverage.

## Adding more CLIs

```bash
GH_TOKEN=$(gh auth token) npx -y @mvanhorn/printing-press install <name>
```

Then update `registry.json` with the legal_class metadata and `INDEX.md` with the synopsis + common commands. Add the new binary name to `.claude/settings.json` Bash allow-list so Claude Code can invoke it without prompting.

## PATH note

If `~/go/bin` is not on your shell `$PATH`, add this to your `~/.zshrc` (or `~/.bashrc`):

```bash
export PATH="$HOME/go/bin:$PATH"
```

Until that's in place, invoke binaries with absolute paths (`/Users/moraybrown/go/bin/company-goat-pp-cli ...`). Lab's `.claude/settings.json` allow-list covers both forms.

## Mirror taps

Two layers exist for SQLite mirroring:

1. **Built-in (per-CLI)**: `company-goat-pp-cli sync` mirrors company-goat's data plane to its own local SQLite. Use this where available.
2. **Generic Lab-wide tap (Phase 4)**: a PostToolUse hook that intercepts every Bash invocation matching a known PP CLI and inserts a row into `pp-mirrors/<source>.db`. Generic and works for tools without built-in sync.

Use `built_in_sync: true` in `registry.json` to mark CLIs that don't need the generic tap.
