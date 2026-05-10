---
date: 2026-05-10
status: decided — tap-only
relates_to: docs/superpowers/specs/2026-05-09-ivy-lab-cli-first-architecture-design.md § Section 3 (Printing Press integration)
---

# Mirror-as-Cache vs Tap-Only — Decision

## Question

Should the generic Lab-wide PP mirror hook (`scripts/audit-and-mirror.js`) act as a **tap** (every PP call hits upstream every time, we just record the result) or a **cache** (wrapper checks the mirror for a recent matching invocation, returns it without an upstream call when fresh)?

## Decision

**Tap-only for the generic Lab hook.** Per-CLI sync features (like `company-goat-pp-cli sync`) handle local mirroring when a tool wants it. The two are complementary, not competing.

## Reasoning

### Why not cache at the hook layer

1. **Most Lab queries are exploratory, not repeated.** Looking at `pp-mirrors/company-goat.db` from real usage, the repeat-rate is low — different companies, different subcommands, different flag combinations. Cache hit rate would be marginal.
2. **When you re-query, you usually want fresh data.** If you re-ran `funding stripe` an hour later, it's because you suspect something changed. A cached response defeats the purpose.
3. **Cache invalidation is hard at the hook layer.** The hook sees only the Bash command and JSON output — it doesn't know per-CLI semantics. What's a "fresh" cache for `company-goat funding`? 1 hour? 1 day? Until SEC files something new? The hook can't tell. Per-CLI knowledge is needed.
4. **The 50ms-vs-2-second difference is barely noticeable in interactive use.** This isn't a high-frequency RPC pipeline; it's a research CLI where you wait for a 30-second snapshot anyway.

### Why per-CLI sync is the right place for caching

`company-goat-pp-cli sync` is the canonical pattern: the CLI itself decides what to mirror, when to refresh, what staleness means for its data. Other library CLIs do the same — `linear-pp-cli` syncs to local SQLite on its own schedule. The CLI knows its data model; the hook doesn't.

When Lab wants offline analysis, run `<cli> sync` deliberately. When you want a one-shot fresh fetch, just call the CLI directly — the hook records it for audit, never blocks.

### What the tap is actually for

- **Audit / "what did the agent do" introspection.** `sqlite3 pp-mirrors/company-goat.db "SELECT * FROM results"` shows every invocation with full output. Useful for after-the-fact debugging.
- **Diff / change detection.** `WHERE invocation = ? ORDER BY ts DESC LIMIT 2` then JSON-diff the two rows. "What changed since last sync?"
- **Token economics in retrospect.** The recorded JSON tells you how much data each call returned, which informs future query shaping.

None of these need cache semantics. They need a faithful append-only log. Tap is the right primitive.

## Out of scope (deferred)

- Per-CLI cache TTL configuration in `pp-tools/registry.json`
- A `--from-cache` flag that wrapper scripts could honor
- Hot-storage tier for very-frequent queries

If real repeat-query patterns surface in `pp-mirrors/` over time, revisit this decision then. Don't preemptively add caching machinery before the data shows it would pay.

## Consequences

- The hook stays simple (~150 LOC). No staleness logic. No invalidation. No conflicts when the agent runs queries in parallel.
- Each PP call always has up-to-date data. No surprise stale results.
- Lab benefits from per-CLI sync when it's available (company-goat). Same primitives as any tap-only setup.
