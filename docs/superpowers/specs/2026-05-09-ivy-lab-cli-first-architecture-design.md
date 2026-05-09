---
date: 2026-05-09
status: draft (awaiting user review)
author: Moray Brown (with Claude as design partner)
related: existing Ivy monorepo at github.com/misb74/Ivy
---

# Ivy-Lab — CLI-First Architecture (Founding Design)

## Why this exists

Ivy today is an MCP-first monorepo: a gateway web service, a React frontend, ~50 MCP servers, a Telegram bot using direct Anthropic SDK, and the start of a CLI scaffold. It's optimised for production-flavoured client deployments where every external action must funnel through a typed tool boundary.

That architecture is the wrong shape for personal exploratory research from a terminal. Three reasons:

1. **Token economics.** Every tool call goes through MCP and lands the full JSON result in context. For a deep research run touching 30+ sources, the overhead compounds. A CLI invoked through Bash returns stdout that can be piped, headed, jq'd, or sqlite3'd before any of it enters the model's context.
2. **Composability ceiling.** MCP tools can run in parallel but don't compose in the shell sense. CLIs do — `company-goat sec-form-d X | jq '.filings[] | select(...)' | tee filings.json` is one shell invocation. The model writes it, Bash runs it, only the final shape lands in context.
3. **The Printing Press model.** PP is CLI-first with an MCP wrapper, local SQLite mirror per source, and a provenance manifest by default. Ivy has SQLite for some servers but per-agent, not per-source. PP's pattern generalises this.

`ivy-lab` is the parallel repo where these architectural shifts happen. The existing `ivy` repo continues unchanged for production-flavoured work (gateway, frontend, full audit). Both repos can run simultaneously — pick by `cd`-ing.

## Decisions made during brainstorming

### Q1 — Audience: Lab-only

`ivy-lab` is for one user (the author) on one machine. Bash is a first-class tool. Full Printing Press CLI catalogue including grey-area scrapers is permitted in principle. Decision Records, `granted_mode`, RLS audit trails are explicitly out of scope. Production deployment is a non-goal.

### Q2 — Agent runner: Claude Code is the agent

`ivy` (the launcher) boots Claude Code in the repo with a curated MCP fleet, PP CLIs Bash-allowed via `.claude/settings.json`, the existing skill catalogue, and a Lab-tuned project CLAUDE.md. Zero bespoke runner code. Skills, hooks, sub-agents, Plan mode, prompt caching, Bash, Edit/Read all come for free.

The thing being built is the *Ivy distribution* — the curated config, MCP fleet, PP integrations, skills, Bash policy, hooks, and launcher that turn vanilla Claude Code into Ivy. That distribution is the artefact.

### Q3 — Bot: thin Telegram transport over Claude Agent SDK

The Telegram bot stops being its own agent. It becomes a transport that calls `query()` from `@anthropic-ai/claude-agent-sdk`. The SDK reads the same `.claude/settings.json` Claude Code does — same skills, same MCP fleet, same Bash allow list, same hooks. One configuration tunes both surfaces.

Conversation persistence moves from the bot's SQLite (`conversations.db`) to the SDK's session resume mechanism. The bot keeps a tiny `chat_id → session_id` map only.

### Q4 — Repo creation: fresh start, copy-in

`ivy-lab` is a new empty repo. We copy the current state of selected files in. No git history for the copied-in code — the original `ivy` repo retains full history as a reference checkout. This is honest about the fact that we're building a different thing, not deleting our way from one to the other.

### Supabase — same data plane, schema owned by `ivy`

Both repos point at the same Supabase project via `.env`. The ATS scanner MCP server (`mcp-servers/agent-ats-scanner/`) has its own self-contained Supabase client (verified at `mcp-servers/agent-ats-scanner/src/supabase.ts`) — it tries `ATS_SUPABASE_URL` / `ATS_SUPABASE_SERVICE_ROLE_KEY` first, falls back to the main `SUPABASE_*` vars. Lab can write `ats_*` rows that the existing Ivy reads, and vice versa.

Discipline rule: schema is owned by `ivy`. New migrations land in `ivy/supabase/migrations/` only, applied via Supabase CLI from there. Lab copies that directory in as read-only reference (a `README.md` in Lab's mirror states this). No second migration source. Avoids drift.

## Architecture

### Repo layout

```
ivy-lab/
├── bin/
│   └── ivy                    # bash launcher (lifted from current bin/ivy, splash)
├── .claude/
│   ├── settings.json          # MCP servers, Bash allow/deny, hook config
│   ├── skills/                # curated skills (descriptions hold trigger phrases)
│   └── CLAUDE.md              # Lab-tuned: PP-first, mirror rules, @-imports
├── mcp-servers/               # full ~50 servers copied from ivy (deferral handles weight)
├── packages/
│   └── ivy-core/              # shared utils
├── pp-tools/
│   ├── installed/             # PP CLIs (install path TBD per PP project conventions)
│   ├── wrappers/              # bash wrappers — one per CLI we expose
│   ├── registry.json          # legal_class + domain metadata per tool
│   └── INDEX.md               # human/agent-readable catalogue (synopsis, args, mirror table)
├── pp-mirrors/                # gitignored — per-source SQLite, one DB per CLI
├── data/                      # gitignored — audit.db plus existing ivy SQLite DBs
├── bot/                       # thin Telegram transport over Claude Agent SDK (~300 LOC)
├── cli/                       # existing scaffold (commands, parsers, ui, splash)
├── prompts/                   # copied
├── supabase/migrations/       # READ-ONLY mirror of ivy/supabase/migrations (with README)
├── scripts/
│   ├── preflight.js           # PreToolUse hook — kill switch, secret-leak abort
│   ├── audit-and-mirror.js    # PostToolUse hook — audit.db + pp-mirrors fan-out
│   └── README.md
├── .env.example               # SUPABASE_*, ATS_SUPABASE_*, ANTHROPIC_API_KEY,
│                              # TELEGRAM_BOT_TOKEN, ALLOWED_TELEGRAM_IDS,
│                              # IVY_LAB_BASH_DISABLED
└── package.json               # workspaces: mcp-servers/*, packages/*, bot, cli
```

Explicitly not copied from `ivy`: `gateway/`, `frontend/`, `gateway/src/decisions/` (pure Production), `gateway/src/v4-html/`, `gateway/src/v4-pdf.ts`, `playwright.config.ts`, anything under `tests/` that targets gateway/frontend.

### Agent layer

**Terminal — Claude Code reads `.claude/settings.json`:**

```jsonc
{
  "mcpServers": {
    "agent-deep-research":   { "command": "node", "args": ["mcp-servers/agent-deep-research/build/index.js"] },
    "agent-ats-scanner":     { "command": "node", "args": ["mcp-servers/agent-ats-scanner/build/index.js"] },
    "data-onet":             { "command": "node", "args": ["mcp-servers/data-onet/build/index.js"] }
    // ... full curated fleet
  },
  "permissions": {
    "allow": [
      "Bash(jq:*)", "Bash(sqlite3:*)", "Bash(head:*)", "Bash(tail:*)",
      "Bash(grep:*)", "Bash(rg:*)", "Bash(wc:*)", "Bash(cut:*)", "Bash(sort:*)", "Bash(uniq:*)",
      "Bash(company-goat:*)", "Bash(hackernews-pp:*)", "Bash(wikipedia-pp:*)"
    ],
    "deny": [
      "Bash(rm -rf /:*)", "Bash(sudo:*)", "Bash(curl:*)", "Bash(wget:*)",
      "Bash(:(){ :|:& };:*)"
    ]
  },
  "hooks": {
    "PreToolUse":  [{ "matcher": ".*",   "hooks": [{ "type": "command", "command": "node scripts/preflight.js" }]}],
    "PostToolUse": [{ "matcher": ".*",   "hooks": [{ "type": "command", "command": "node scripts/audit-and-mirror.js" }]}]
  }
}
```

Denying raw `curl`/`wget` is opinionated: it forces every external HTTP call through a PP CLI (which gets mirrored, audited, attributed to a `legal_class`). Otherwise the agent finds curl as the path of least resistance and the architecture stops being load-bearing.

**Skills:** copied to `.claude/skills/` as-is. The trigger phrases that lived in `gateway/skill-registry.json` migrate into each SKILL.md `description:` frontmatter (Claude Code's native loader). The `tier1`/`tier2` distinction is dropped — Claude Code's discovery handles it.

**Telegram — `bot/src/index.ts` (sketch):**

```ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import { Bot } from 'grammy';

const tg = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

tg.on('message:text', async (ctx) => {
  if (!isAllowed(ctx.from?.id)) return;

  const result = query({
    prompt: ctx.message.text,
    options: {
      cwd: process.cwd(),                    // resolves .claude/settings.json automatically
      resume: getSessionId(ctx.chat.id)      // SDK persists conversation state
    }
  });

  for await (const msg of result) {
    if (msg.type === 'assistant_text') await ctx.reply(msg.text);
    if (msg.type === 'tool_use')      await ctx.reply(`🔧 ${msg.name}`);
  }
});
```

What survives in `bot/`: `auth.ts` (Telegram allowlist), `file-manager.ts` (Telegram up/down ↔ local files). What dies: `claude-runner.ts`, `mcp-manager.ts`, `conversation-store.ts` (SDK replaces them). What relocates: `audit.ts` EEOC detection moves into `scripts/audit-and-mirror.js` so both transports share it. Net `bot/` LOC: ~1,200 → ~300.

### Printing Press integration

**Phase 0 set:** `company-goat` (SEC filings → exec/M&A signal), `hackernews-pp` (tech sentiment), `wikipedia-pp` (company/person reference). Three is enough to validate the pattern. Phase 1 expands public-API tools as queries demand. Phase 2 (gated, `lab_only: true` in registry) brings in scrape-class tools like LinkedIn / Redfin only after a real need surfaces.

**Per-tool wrappers in `pp-tools/wrappers/`:** thin bash wrappers, ~5–10 lines each, that exist to (a) shape stdout into a JSON envelope the mirror hook can parse without ambiguity, (b) tee output without modifying upstream PP code. Tools whose stdout is already cleanly parseable can skip wrappers in later phases.

**`pp-tools/registry.json`:**

```json
{
  "company-goat":  { "legal_class": "public_api", "domain": "sec-filings",   "lab_only": false },
  "hackernews-pp": { "legal_class": "public_api", "domain": "tech-news",     "lab_only": false },
  "wikipedia-pp":  { "legal_class": "public_api", "domain": "encyclopaedia", "lab_only": false }
}
```

Forward-compatible with the future production-Ivy story: `lab_only: true` entries would be blocked by a PreToolUse hook there. Same metadata feeds `gateway/src/tool-metadata.ts` if/when a PP wrapper graduates to a Production MCP — `legal_class` becomes a peer of `concurrencySafe`, `requiresConfirmation`.

**`pp-tools/INDEX.md`:** human/agent-readable catalogue, one 4–6-line entry per tool (synopsis, common args, output shape sketch, mirror table). Imported from project CLAUDE.md as `@pp-tools/INDEX.md` so Claude Code auto-loads it.

**Auto-mirror hook (`scripts/audit-and-mirror.js`, PostToolUse):**

```
Receives { tool_input, tool_response } as JSON on stdin from Claude Code.
1. Always: insert into data/audit.db (tool, input_redacted, exit_code, ts, session_id).
   input_redacted runs through scrubSecrets() (Anthropic/OpenAI/Supabase key shapes,
   .env value patterns).
2. If tool === 'Bash' and command starts with a known PP CLI:
   open pp-mirrors/<source>.db, ensure schema, insert one row.
3. Silent — never returns a hook error.
```

Uniform mirror schema across sources:

```sql
CREATE TABLE results (
  id INTEGER PRIMARY KEY,
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  invocation TEXT,
  exit_code INTEGER,
  stdout_json TEXT,
  manifest TEXT
);
CREATE INDEX idx_invocation ON results(invocation);
```

"What changed since last sync" becomes one SQL query — `WHERE invocation = ? ORDER BY ts DESC LIMIT 2` then JSON-diff the two rows. No per-source mirror code to maintain.

**Mirror as tap, not cache (Phases 0–4).** Every PP call hits upstream every time; we record the result. Mirror-as-cache (wrapper checks recent matching invocation, returns it without an upstream call when fresh) is deferred until repeat-query traces in `pp-mirrors/` show it would actually help. Caching adds per-wrapper complexity (TTL policy, cache-key normalisation, freshness override flags) that is unjustified before there's evidence it pays.

### Bash safety

**Three pieces:**

1. **Allow/deny lists** in `.claude/settings.json` (above). Deny includes raw `curl`/`wget` to keep `legal_class` load-bearing.

2. **Single audit DB.** `data/audit.db` captures every tool call (MCP and Bash) via the PostToolUse hook. Retention/rotation is manual for Lab — a one-line cron later if the file grows.

3. **Kill switch.** `IVY_LAB_BASH_DISABLED=1` env var is checked by `scripts/preflight.js` (PreToolUse). When set, Bash calls fail closed; MCP tools still work. Recovery move if the agent goes off the rails — set the env var, restart the session, investigate via MCP only.

**Deliberately omitted:**
- Tool-metadata.ts equivalent for every Bash command (the allow list IS the metadata)
- EEOC pre-blocking (the existing audit.ts logic flags after the fact for review; pre-blocking generates false positives in benign HR queries)
- Decision Records `granted_mode` validation (Production's job; Lab outputs are by definition not decision-grade)

### Hook architecture summary

| Hook | When | Purpose |
|---|---|---|
| `preflight.js` | PreToolUse | Kill switch (`IVY_LAB_BASH_DISABLED`); soft-log `scrape_only` PP CLIs; abort on obvious secret-leak patterns in tool input |
| `audit-and-mirror.js` | PostToolUse | Insert into `data/audit.db`; if Bash + PP CLI, fan out to `pp-mirrors/<source>.db` |

Both hooks are JS, ~250 LOC total. The Claude Agent SDK runs them identically for terminal and bot — same safety net both surfaces.

## Phased rollout (Day-1 sequence)

| Phase | Effort | Deliverable | Done when |
|---|---|---|---|
| 0 — Sanity | ~30 min | Empty Ivy-Lab with workspace, .gitignore, initial commit pushed | `git push` succeeds |
| 1 — Copy-in | ~1 hr | mcp-servers, packages, prompts, .claude/skills, bin/ivy, cli, bot (pre-refactor), supabase mirror | `npm install` clean, build either passes or fails for known reasons |
| 2 — Settings + skills | ~2 hr | `.claude/settings.json`, project CLAUDE.md, SKILL.md frontmatter migration, `.env` populated | `claude` reports connected MCP servers; data-onet smoke query returns real data |
| 3 — PP install | ~1–2 hr | 3 PP CLIs installed, wrappers, registry.json, INDEX.md | `bash pp-tools/wrappers/company-goat.sh sec-form-d "X" \| jq '.filings \| length'` returns a number |
| 4 — Hooks | ~2 hr | preflight.js, audit-and-mirror.js, README | PP query through Claude creates one audit row + one mirror row; kill switch verified |
| 5 — Bot refactor | ~1 day | bot/ rewritten to ≤300 LOC over Claude Agent SDK | Telegram → PP query mirrors and audits identically to terminal |
| 6 — End-to-end | ~30 min | Canonical "summarise 8-Ks + cross-check HN" query; ATS scan to live Supabase | All four validations green |

**Total:** ~1.5 days of focused work. Phase 5 is the chunkiest slice.

## Out of scope

- Production deployment, client-facing UX, billing
- Decision Records / `granted_mode` validation
- Frontend (React WorkVine.ai app stays in `ivy`)
- Gateway web service (stays in `ivy`)
- New Supabase migrations (only via `ivy`)
- Mirror-as-cache semantics in Phase 0–1 (deferred to Phase 2)
- Granular per-CLI Bash kill switches (single `IVY_LAB_BASH_DISABLED` env var)
- Pre-installing all 49 PP tools (lazy expansion as queries demand)

## Open questions deferred to implementation

1. **PP install mechanism.** Whether PP ships as npm packages, git submodules, or self-contained binaries — answered by reading the PP project README during Phase 3. Wrapper paths in `pp-tools/wrappers/` adjust accordingly.
2. **Path-with-space already handled.** User renamed `/Users/moraybrown/Desktop/Ivy Lab` → `/Users/moraybrown/Desktop/Ivy-Lab` before Phase 0.
3. **Mirror-as-cache.** Decided after Phase 0–1 produces real repeat-query traces.
4. **Skill description rewrites.** Each SKILL.md `description:` frontmatter audited during Phase 2; some already have good triggers, some need to absorb `gateway/skill-registry.json` phrases.
5. **Curated MCP fleet for Lab.** Phase 2 starts with the full ~50 servers (deferral handles weight). If query latency or tool-search noise becomes a problem, prune from there. No pre-pruning.

## Success criteria

Ivy-Lab is "done enough" when:

- `cd ~/Desktop/Ivy-Lab && ivy` launches Claude Code with full MCP fleet, PP CLIs allowed, skills loaded, hooks active.
- Sending a message to the Telegram bot from a phone produces the same answer as running the same query in the terminal — same tools, same audit trail, same mirrors.
- Running an ATS scan from Lab persists to the same Supabase project the production-Ivy reads from.
- Token spend on a deep-research-equivalent run is materially lower than the same run in production-Ivy, because PP composition keeps full JSON out of the model context.
- Setting `IVY_LAB_BASH_DISABLED=1` and restarting kills Bash but leaves MCP tools working.

That's the bar.
