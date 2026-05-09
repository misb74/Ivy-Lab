# Ivy-Lab Phase 3 — Printing Press Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Printing Press in Lab — the `printing-press` meta-CLI plus the `company-goat-pp-cli` library tool — and document them via `pp-tools/INDEX.md` + `registry.json` so the agent can route compound shell pipelines through real PP CLIs instead of MCP tools where it's faster.

**Architecture:** Two binaries land on the user's machine via `npx -y @mvanhorn/printing-press install company-goat` (which `go install`s the binaries and adds focused Claude Code skills user-scope). Lab repo gets a small `pp-tools/` directory with the catalogue + legal_class registry, plus Bash allow updates so Claude Code can invoke the new commands. Mirror taps wait for Phase 4.

**Tech Stack:** Go 1.26.3+ (user prerequisite), npm/npx (orchestrator), `gh` CLI (auth for private catalog reads).

**Spec reference:** `docs/superpowers/specs/2026-05-09-ivy-lab-cli-first-architecture-design.md` § Section 3 (Printing Press integration), § Phase 3 in the day-1 sequence.

**Phase 0 set revision:** the spec named `{company-goat, hackernews-pp, wikipedia-pp}`. Reality: only `company-goat` exists as a separate library tool — HackerNews and Wikidata coverage are bundled INSIDE company-goat as two of its seven sources. Phase 0 install collapses to just `company-goat-pp-cli`.

**User prerequisite (manual, one-time, NOT a plan task):**

```bash
brew install go              # macOS — installs Go 1.26.3+
# or follow https://go.dev/dl/ for other platforms
go version                   # must report 1.26.3 or newer
```

If the prereq isn't met, plan execution stops at Task 3 with a clean BLOCKED status — no system mutations beyond branch creation.

**Phase 3 done-when:** `company-goat-pp-cli funding stripe --json | jq '.filings | length'` returns a real number from a fresh terminal. The Lab repo has `pp-tools/INDEX.md` documenting how the agent uses these new CLIs.

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
Expected: empty status (or only untracked `data/`), branch `main`, log shows `bce46e5 refactor(skills):...` at HEAD.

- [ ] **Step 2: Create the phase branch**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab checkout -b phase-3-printing-press
```
Expected: `Switched to a new branch 'phase-3-printing-press'`.

---

## Task 2 — Verify prerequisites

**Files:** none (shell verification only)

- [ ] **Step 1: Verify Go is installed and is 1.26.3+**

```bash
go version
```
Expected: `go version go1.26.3 darwin/arm64` or similar (version must be 1.26.3 or newer).

If `command not found: go` or version is older than 1.26.3:
- STOP and report BLOCKED with status: "User prerequisite missing — install Go 1.26.3+ via `brew install go` (macOS) or https://go.dev/dl/."
- Do not proceed past this task.

- [ ] **Step 2: Verify GOPATH bin is on PATH**

```bash
echo "$PATH" | tr ':' '\n' | grep -E 'go/bin|GOPATH' | head -3
```
Expected: at least one line containing `/go/bin` (typically `~/go/bin`). If empty, the user must add `export PATH="$HOME/go/bin:$PATH"` to their shell rc — note as a soft warning but proceed.

- [ ] **Step 3: Verify gh and npx**

```bash
gh --version | head -1
npx --version
```
Expected: gh 2.x or newer; npx 8+ (verified at plan time: 2.86.0 and 11.6.1).

- [ ] **Step 4: Verify GH_TOKEN export path for npm orchestrator**

```bash
gh auth token | head -c 7
echo ""
```
Expected: prints `gho_xxx` (first 7 chars of token). If it errors or prints nothing, user is not authenticated — STOP and BLOCK with: "Run `gh auth login`."

---

## Task 3 — Install the printing-press meta binary

**Files:** none (system-level install at `~/go/bin/printing-press`)

- [ ] **Step 1: Install via `go install`**

```bash
go install github.com/mvanhorn/cli-printing-press/v4/cmd/printing-press@latest 2>&1 | tail -10
```
Expected: command returns successfully (no error). Build can take 30s–2min.

If it fails with "module not found" or auth errors:
- Check `gh auth token | head -c 7` again
- Try with explicit `GOPRIVATE=github.com/mvanhorn/* GITHUB_TOKEN=$(gh auth token) go install github.com/mvanhorn/cli-printing-press/v4/cmd/printing-press@latest`
- If still failing, report BLOCKED with the exact error.

- [ ] **Step 2: Verify install**

```bash
which printing-press
printing-press --version 2>&1 | head -3
```
Expected: path under `~/go/bin/printing-press` (or system gobin); version output prints.

---

## Task 4 — Install company-goat-pp-cli + focused skill

**Files:** none (system-level install)

The npm orchestrator does two things in one call: (a) `go install`s the company-goat-pp-cli binary, (b) installs the focused `pp-company-goat` skill at user-scope so `/pp-company-goat` slash commands work in any Claude Code session.

- [ ] **Step 1: Run the orchestrator**

```bash
GH_TOKEN=$(gh auth token) npx -y @mvanhorn/printing-press install company-goat 2>&1 | tail -20
```
Expected: ends with success indicator like "installed company-goat-pp-cli + skill pp-company-goat" (exact text varies). Should take 1–3 min for the Go build.

If npm errors with auth-related complaints, ensure `GH_TOKEN` is exported in the env. If it errors with permissions or 404, the catalog may have moved — report BLOCKED with the exact error.

- [ ] **Step 2: Verify binary**

```bash
which company-goat-pp-cli
company-goat-pp-cli --version 2>&1 | head -3
company-goat-pp-cli --help 2>&1 | head -20
```
Expected: path under `~/go/bin/`; version output; help text listing subcommands like `funding`, `funding-trend`, `legal`, `github`, `snapshot`.

- [ ] **Step 3: Verify focused skill installed**

```bash
ls ~/.claude/skills/ 2>/dev/null | grep -i "pp-company-goat\|printing-press" | head -5
```
Expected: at least `pp-company-goat` directory listed (or similar — exact name from npm orchestrator). If empty, the skill installation may have failed silently — note as DONE_WITH_CONCERNS.

---

## Task 5 — Smoke-test company-goat against a real query

**Files:** none (network call to SEC EDGAR + GitHub + HN)

This proves the binary works against real data sources. Picks Stripe because they're well-known, have SEC filings (Form D), an active GitHub presence, and frequent HN coverage.

- [ ] **Step 1: SEC Form D query**

```bash
company-goat-pp-cli funding stripe --json 2>&1 | jq '.filings | length' 2>&1 | head -3
```
Expected: a non-zero number (Stripe has Form D filings). If `jq` parse fails, the JSON shape isn't what we expect — print raw output for debugging:

```bash
company-goat-pp-cli funding stripe --json 2>&1 | head -50
```

- [ ] **Step 2: GitHub coverage**

```bash
company-goat-pp-cli github stripe 2>&1 | head -10
```
Expected: GitHub org info for stripe (followers, repo count, etc.).

If both queries return real data, Phase 3's core install is validated.

---

## Task 6 — Create `pp-tools/` directory in Lab repo

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/pp-tools/README.md`
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/pp-tools/registry.json`
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/pp-tools/INDEX.md`

- [ ] **Step 1: Make the directory**

```bash
mkdir -p /Users/moraybrown/Desktop/Ivy-Lab/pp-tools
```

- [ ] **Step 2: Write `pp-tools/README.md`**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/pp-tools/README.md`

Content:

```markdown
# pp-tools — Printing Press integration for Lab

Printing Press is the Go-based CLI generator at https://github.com/mvanhorn/cli-printing-press. Pre-built CLIs live in https://github.com/mvanhorn/printing-press-library.

This directory is Lab's local catalogue of which PP CLIs we've installed and how the agent uses them. The CLIs themselves live at `~/go/bin/` (system-level), not here. The skills live at `~/.claude/skills/pp-*` (user-scope), not here.

## Files

- `INDEX.md` — agent-readable catalogue: per-CLI synopsis, common commands, output shape sketch, mirror table name. Imported from project `CLAUDE.md` so Claude Code auto-loads it.
- `registry.json` — per-CLI metadata: `legal_class` (public_api / scrape_only), `domain`, `lab_only` flag, source list, optional auth.

## Currently installed (Phase 0 set)

- **`printing-press`** — meta-CLI; generates new CLIs on demand (`/printing-press <api>`).
- **`company-goat-pp-cli`** — multi-source startup intel (SEC Form D, GitHub, HN, Companies House, YC, Wikidata, RDAP).

## Adding more CLIs

```bash
GH_TOKEN=$(gh auth token) npx -y @mvanhorn/printing-press install <name>
```

Then update `registry.json` with the legal_class metadata and `INDEX.md` with the synopsis + common commands. Add the new binary name to `.claude/settings.json` Bash allow-list so Claude Code can invoke it without prompting.

## Mirror taps

Phase 4 wires a PostToolUse hook that intercepts every Bash invocation matching a known PP CLI and inserts a row into `pp-mirrors/<source>.db`. Until Phase 4 lands, PP calls run upstream every time without local persistence.
```

- [ ] **Step 3: Write `pp-tools/registry.json`**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/pp-tools/registry.json`

Content:

```json
{
  "printing-press": {
    "binary": "printing-press",
    "kind": "meta-tool",
    "legal_class": "meta",
    "domain": "cli-generation",
    "lab_only": false,
    "auth_optional": ["GITHUB_TOKEN", "GH_TOKEN"],
    "purpose": "Generates new CLIs for any API on demand. Slash command: /printing-press <api>."
  },
  "company-goat": {
    "binary": "company-goat-pp-cli",
    "kind": "library-cli",
    "legal_class": "public_api",
    "domain": "company-research",
    "lab_only": false,
    "sources": [
      "SEC EDGAR Form D",
      "GitHub",
      "Hacker News (Algolia)",
      "Companies House (UK)",
      "Y Combinator directory",
      "Wikidata SPARQL",
      "RDAP / DNS"
    ],
    "auth_optional": ["GITHUB_TOKEN", "COMPANIES_HOUSE_API_KEY"],
    "mirror_table": "pp-mirrors/company-goat.db",
    "common_subcommands": ["funding", "funding-trend", "github", "legal", "snapshot"]
  }
}
```

- [ ] **Step 4: Write `pp-tools/INDEX.md`**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/pp-tools/INDEX.md`

Content:

```markdown
# Printing Press CLI Index — Lab

Agent-readable catalogue of installed PP CLIs. Loaded by project `CLAUDE.md` via `@pp-tools/INDEX.md`.

When the agent needs to do company research, fundraising lookups, or compound queries that combine SEC + GitHub + HN data — prefer `company-goat-pp-cli` Bash invocations over MCP tool chains. The piping pattern is the token-economics win.

---

## `printing-press` — meta-CLI for generating new tools

**What it does:** generates a new `<api>-pp-cli` plus `<api>-pp-mcp` for any API or website. Reads docs, sniffs traffic, applies the agent-native CLI playbook.

**Use when:** the user asks for a CLI to talk to an API we don't already have a tool for.

**Slash command:** `/printing-press <api-name>` from inside Claude Code.

**Direct invocation:** `printing-press --help` shows the binary's own subcommands (mostly for advanced use; the slash command is the primary interface).

---

## `company-goat-pp-cli` — multi-source startup intel

**What it does:** fans out across seven free sources to research startups in seconds. Killer feature is SEC Form D fundraising data, which Crunchbase Pro charges $999/year to wrap.

**Sources:** SEC EDGAR (Form D), GitHub, Hacker News (Algolia), Companies House (UK), Y Combinator, Wikidata, RDAP / DNS.

**Coverage limits:** US private companies raising priced rounds via Reg D show up in `funding`. Pre-Series-A SAFE / convertible-note startups don't (no Form D filed). Non-US use `legal --region uk`.

**Auth (optional):** `GITHUB_TOKEN` raises GitHub rate limit from 60/hr → 5000/hr. `COMPANIES_HOUSE_API_KEY` required for UK queries.

**Mirror table** (Phase 4): `pp-mirrors/company-goat.db` (uniform schema across all PP CLIs).

### Common commands

```bash
# Form D filings for a company by name
company-goat-pp-cli funding stripe --json

# Funding cadence over time
company-goat-pp-cli funding-trend stripe --since 2018

# Serial-founder graph
company-goat-pp-cli funding --who 'Patrick Collison'

# Cross-source snapshot (SEC + GitHub + HN + legal)
company-goat-pp-cli snapshot stripe

# UK Ltd / PLC entity lookup
company-goat-pp-cli legal --region uk monzo

# Domain RDAP / DNS
company-goat-pp-cli funding --domain stripe.com --json

# GitHub org details only
company-goat-pp-cli github stripe
```

### Output shape (funding subcommand)

```json
{
  "company": "Stripe",
  "filings": [
    {
      "filed": "2023-03-15",
      "form": "D",
      "amount_raised": 6500000000,
      "exemption": "506(b)",
      "issuer_cik": "0001690511",
      "related_persons": [
        { "name": "Patrick Collison", "relationship": "Director, Officer" }
      ]
    }
  ],
  "coverage_note": null
}
```

If `filings` is empty, `coverage_note` explains why (SAFE-only round, acquired, pre-Reg-D, etc.) and the response includes `fallback_signals` from broader EDGAR search (subsidiary listings, venture-debt holdings, M&A 8-Ks).

### When to use this vs MCP tools

- **Use company-goat:** company research, fundraising, founder-graph, multi-source compound queries that span SEC + GitHub + HN.
- **Use existing MCP:** workforce-specific intel (talent sourcing → `talent_search_profiles`, hiring trends → `data-revelio`, etc.).
- **Combine via Bash pipe:** `company-goat-pp-cli funding stripe --json | jq '.filings[].related_persons[].name' | sort -u | head -20` to get founders, then look up their backgrounds with `talent_enrich_profile`.
```

- [ ] **Step 5: Stage all three files**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add pp-tools/
git -C /Users/moraybrown/Desktop/Ivy-Lab status --short pp-tools/
```
Expected: 3 files staged with `A` prefix.

---

## Task 7 — Update `.claude/settings.json` Bash allow

**Files:**
- Modify: `/Users/moraybrown/Desktop/Ivy-Lab/.claude/settings.json`

**IMPORTANT — controller-only step.** The Claude Code harness blocks subagents from writing `.claude/settings.json` (it's flagged as agent-permission-config self-modification, even cross-project). The implementer SHOULD report this task as NEEDS_CONTEXT if they're a subagent — the controller (top-level Claude) writes the file directly via the Write tool.

- [ ] **Step 1: Read current settings.json**

The current file at `/Users/moraybrown/Desktop/Ivy-Lab/.claude/settings.json` has 28 allow entries and 3 deny entries. We add 2 new allow entries.

- [ ] **Step 2 (controller): write the updated file with these 2 new entries appended to `allow`**

After `"Bash(echo:*)"`, add:
```json
      "Bash(printing-press:*)",
      "Bash(company-goat-pp-cli:*)"
```

The full updated `.claude/settings.json` content:

```json
{
  "permissions": {
    "allow": [
      "Bash(jq:*)",
      "Bash(sqlite3:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(grep:*)",
      "Bash(rg:*)",
      "Bash(wc:*)",
      "Bash(cut:*)",
      "Bash(sort:*)",
      "Bash(uniq:*)",
      "Bash(awk:*)",
      "Bash(sed:*)",
      "Bash(cat:*)",
      "Bash(ls:*)",
      "Bash(find:*)",
      "Bash(test:*)",
      "Bash(diff:*)",
      "Bash(git:*)",
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(node:*)",
      "Bash(tsx:*)",
      "Bash(gh:*)",
      "Bash(rsync:*)",
      "Bash(mkdir:*)",
      "Bash(cp:*)",
      "Bash(mv:*)",
      "Bash(echo:*)",
      "Bash(printing-press:*)",
      "Bash(company-goat-pp-cli:*)"
    ],
    "deny": [
      "Bash(sudo:*)",
      "Bash(curl:*)",
      "Bash(wget:*)"
    ]
  }
}
```

- [ ] **Step 3: Verify and stage**

```bash
jq '.permissions.allow | length' /Users/moraybrown/Desktop/Ivy-Lab/.claude/settings.json
git -C /Users/moraybrown/Desktop/Ivy-Lab add .claude/settings.json
```
Expected: allow length `30` (was 28 + 2 new entries).

---

## Task 8 — Update `CLAUDE.md` PP example

**Files:**
- Modify: `/Users/moraybrown/Desktop/Ivy-Lab/CLAUDE.md`

The existing example uses fictional `company-goat sec-form-d "AstraZeneca"` syntax. With the real CLI installed, switch to actual syntax.

- [ ] **Step 1: Edit CLAUDE.md**

Find the existing block:

```bash
company-goat sec-form-d "AstraZeneca" | jq '.filings[] | select(.amount > 1000000)' | tee /tmp/big-filings.json
sqlite3 pp-mirrors/company-goat.db "SELECT * FROM results WHERE invocation LIKE '%sec-form-d%' ORDER BY ts DESC LIMIT 2"
```

Replace with the real syntax:

```bash
company-goat-pp-cli funding stripe --json | jq '.filings[] | select(.amount_raised > 1000000)' | tee /tmp/big-filings.json
sqlite3 pp-mirrors/company-goat.db "SELECT * FROM results WHERE invocation LIKE '%funding%stripe%' ORDER BY ts DESC LIMIT 2"
```

Use the Edit tool with old_string = `company-goat sec-form-d "AstraZeneca" | jq '.filings[] | select(.amount > 1000000)' | tee /tmp/big-filings.json` and new_string = `company-goat-pp-cli funding stripe --json | jq '.filings[] | select(.amount_raised > 1000000)' | tee /tmp/big-filings.json`.

Then a second Edit for the `sqlite3` line: old_string = `sqlite3 pp-mirrors/company-goat.db "SELECT * FROM results WHERE invocation LIKE '%sec-form-d%' ORDER BY ts DESC LIMIT 2"` and new_string = `sqlite3 pp-mirrors/company-goat.db "SELECT * FROM results WHERE invocation LIKE '%funding%stripe%' ORDER BY ts DESC LIMIT 2"`.

- [ ] **Step 2: Verify the @-import for `pp-tools/INDEX.md` is added at the bottom**

Read the last 5 lines of CLAUDE.md. If the bottom imports section currently is:

```
## Imports

@.claude/skills/routing/SKILL.md
```

Add `@pp-tools/INDEX.md` on a new line below, so it becomes:

```
## Imports

@.claude/skills/routing/SKILL.md
@pp-tools/INDEX.md
```

Use the Edit tool: old_string = `@.claude/skills/routing/SKILL.md` and new_string = `@.claude/skills/routing/SKILL.md\n@pp-tools/INDEX.md`. Note: the Edit tool's new_string should contain a literal newline, not the `\n` escape — write it as a multi-line string.

- [ ] **Step 3: Verify**

```bash
grep -E "company-goat-pp-cli funding stripe" /Users/moraybrown/Desktop/Ivy-Lab/CLAUDE.md && echo "PP example updated"
grep -E "^@pp-tools/INDEX\.md$" /Users/moraybrown/Desktop/Ivy-Lab/CLAUDE.md && echo "import added"
git -C /Users/moraybrown/Desktop/Ivy-Lab add CLAUDE.md
```
Expected: both echo lines print.

---

## Task 9 — Final pre-commit safety + commit

**Files:** all staged

- [ ] **Step 1: Status and safety**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab diff --cached --name-only | sort
git -C /Users/moraybrown/Desktop/Ivy-Lab status --short | grep -iE '\.(env|db|db-shm|db-wal|sqlite|sqlite3|key|pem)$' | wc -l
```
Expected staged files (sorted):
- `.claude/settings.json`
- `CLAUDE.md`
- `pp-tools/INDEX.md`
- `pp-tools/README.md`
- `pp-tools/registry.json`

Expected safety sweep: `0`. If non-zero, STOP and BLOCK.

- [ ] **Step 2: Commit**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab commit -m "$(cat <<'EOF'
feat(phase-3): install Printing Press meta + company-goat library tool

Phase 3 of the Ivy-Lab founding architecture (see docs/superpowers/specs/2026-05-09-...).

Installs (system-level on user's machine, not in repo):
- printing-press meta-CLI at ~/go/bin/printing-press (via go install github.com/mvanhorn/cli-printing-press/v4/cmd/printing-press@latest)
- company-goat-pp-cli at ~/go/bin/company-goat-pp-cli (via npx -y @mvanhorn/printing-press install company-goat — also installs the focused pp-company-goat skill at user-scope)

Documents in repo:
- pp-tools/README.md — directory README explaining the install layout (CLIs at ~/go/bin/, skills at ~/.claude/skills/, catalogue here)
- pp-tools/registry.json — legal_class + domain metadata for the installed CLIs (printing-press = meta, company-goat = public_api)
- pp-tools/INDEX.md — agent-readable catalogue: synopsis, common commands, output shape sketch, mirror table name. Imported from CLAUDE.md.

Allows in repo:
- .claude/settings.json — adds Bash(printing-press:*) and Bash(company-goat-pp-cli:*) so Claude Code can invoke without prompting.

Updates in repo:
- CLAUDE.md — replaces fictional company-goat sec-form-d example with real company-goat-pp-cli funding syntax, adds @pp-tools/INDEX.md import.

Phase 0 set revision noted: spec named {company-goat, hackernews-pp, wikipedia-pp} but only company-goat exists as a library tool. HackerNews and Wikidata coverage are bundled INSIDE company-goat as 2 of its 7 sources, so Phase 0 collapses to 1 install.

Defers to Phase 4:
- pp-mirrors/ tap hook (PostToolUse via scripts/audit-and-mirror.js)
- preflight.js kill switch and scrape_only logging

Smoke test: company-goat-pp-cli funding stripe --json | jq '.filings | length' returns a real number.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10 — Push branch and create PR

- [ ] **Step 1: Push**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab push -u origin phase-3-printing-press
```

- [ ] **Step 2: Build PR body file**

```bash
cat > /tmp/ivy-lab-phase-3-pr-body.md <<'BODY'
## Summary

Implements Phase 3 of the Ivy-Lab founding architecture. Installs Printing Press on the user's machine and documents it in the repo.

### System-level installs (not in repo)

- `~/go/bin/printing-press` — meta-CLI generator
- `~/go/bin/company-goat-pp-cli` — multi-source startup intel (SEC Form D + GitHub + HN + Companies House + YC + Wikidata + RDAP)
- `~/.claude/skills/pp-company-goat/` — focused Claude Code skill (user-scope; works in any session)

### Repo changes

- `pp-tools/README.md` — install layout docs
- `pp-tools/registry.json` — legal_class metadata for installed CLIs
- `pp-tools/INDEX.md` — agent-readable catalogue with synopsis + common commands + output shape, imported from `CLAUDE.md`
- `.claude/settings.json` — `Bash(printing-press:*)` + `Bash(company-goat-pp-cli:*)` added to allow-list (allow length 28 → 30)
- `CLAUDE.md` — example pipeline updated to real `company-goat-pp-cli funding` syntax; `@pp-tools/INDEX.md` added to imports

### Phase 0 set revision

Original spec named `{company-goat, hackernews-pp, wikipedia-pp}`. Reality check: only `company-goat` exists as a separate library tool. HackerNews (via Algolia) and Wikidata are bundled INSIDE company-goat as 2 of its 7 sources. Phase 0 install collapses to 1 install with 7-source coverage.

## Test plan (smoke test — run in a separate Claude Code session)

- [ ] `cd /Users/moraybrown/Desktop/Ivy-Lab && claude` — should still launch with no warnings
- [ ] Ask: "use company-goat-pp-cli to look up Stripe's recent fundraising filings" — agent should run `company-goat-pp-cli funding stripe --json` and return SEC Form D filings
- [ ] Ask: "what's the slash command for generating a new CLI?" — agent should know about `/printing-press <api>` (from the focused skill or INDEX.md)
- [ ] Verify Bash deny still works — `curl -s https://example.com` should still be blocked

## Known issues / follow-up

- Mirror taps for `pp-mirrors/company-goat.db` not yet wired — Phase 4
- `pp-company-goat` focused skill location needs verification once installed (`ls ~/.claude/skills/`)
- Future PP CLI installs (Phase 1+) repeat the pattern: `npx -y @mvanhorn/printing-press install <name>`, append to `registry.json` + `INDEX.md`, add to allow-list

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
```

- [ ] **Step 3: Create PR**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && gh pr create \
  --title "Phase 3: Install Printing Press + company-goat library tool" \
  --body-file /tmp/ivy-lab-phase-3-pr-body.md
```

- [ ] **Step 4: Capture PR URL**

```bash
gh pr view --json url,number,title,state
```

---

## Task 11 — User PR review + smoke test + squash-merge

**Files:** none (user-gated)

- [ ] **Step 1: User reviews the PR diff** at the URL from Task 10 Step 4.

- [ ] **Step 2: User runs smoke test in a new Claude Code session**

From a separate terminal:
```bash
cd /Users/moraybrown/Desktop/Ivy-Lab
claude
```

Then in that session:
1. "use `company-goat-pp-cli` to look up Stripe's recent fundraising filings"
2. "what's the slash command for generating a new CLI?"
3. "Run: `curl -s https://example.com`" (must still be blocked)

- [ ] **Step 3: After user approval, controller squash-merges**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && gh pr merge --squash --delete-branch
git -C /Users/moraybrown/Desktop/Ivy-Lab checkout main
git -C /Users/moraybrown/Desktop/Ivy-Lab pull
git -C /Users/moraybrown/Desktop/Ivy-Lab fetch --prune origin
git -C /Users/moraybrown/Desktop/Ivy-Lab log --oneline -5
```
Expected: `phase-3-printing-press` deleted on origin and locally; main has the squash-merged Phase 3 commit at HEAD.

---

## Done when

- [ ] PR `phase-3-printing-press` squash-merged into `main`.
- [ ] `printing-press --version` and `company-goat-pp-cli --version` both work from a fresh terminal.
- [ ] `company-goat-pp-cli funding stripe --json | jq '.filings | length'` returns a real number.
- [ ] In a fresh Claude Code session at `/Users/moraybrown/Desktop/Ivy-Lab`, asking for a Stripe fundraising lookup triggers a `company-goat-pp-cli funding stripe` Bash invocation.
- [ ] No `.env` or DB files in the merged commit.

After this plan: **Phase 4 — write `scripts/preflight.js` (PreToolUse: kill switch, scrape_only log) + `scripts/audit-and-mirror.js` (PostToolUse: audit.db + pp-mirrors/<source>.db fan-out) + wire them into `.claude/settings.json` hooks**. Gets its own plan.
