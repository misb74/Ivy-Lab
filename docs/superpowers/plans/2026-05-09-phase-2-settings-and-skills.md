# Ivy-Lab Phase 2 — Settings + Skills + CLAUDE.md Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `claude` runnable from `/Users/moraybrown/Desktop/Ivy-Lab/` with the full curated MCP fleet, Bash policy, project CLAUDE.md, and skill descriptions tuned for Claude Code's native loader.

**Architecture:** Three new config files + two helper scripts copied from Ivy + targeted SKILL.md frontmatter audits. `.mcp.json` registers all 64 servers using Ivy's canonical `bash scripts/run-mcp.sh src/index.ts` pattern. `.claude/settings.json` carries Bash allow/deny only (hooks defer to Phase 4 to avoid pointing at non-existent JS). Project `CLAUDE.md` documents PP-first habits, mirror rules, and `@-imports` for the routing skill catalogue.

**Tech Stack:** Claude Code project config conventions (`.mcp.json`, `.claude/settings.json`, `CLAUDE.md`), bash, sed, jq, npm workspaces.

**Spec reference:** `docs/superpowers/specs/2026-05-09-ivy-lab-cli-first-architecture-design.md` § Section 2 (Agent layer), § Phase 2 in the day-1 sequence.

**Pre-conditions assumed:**
- Phase 0+1 merged on `main` at `4307bf8`. Repo at `/Users/moraybrown/Desktop/Ivy-Lab/` has `mcp-servers/` (61), `packages/`, `bot/`, `cli/`, `bin/`, `prompts/`, `.claude/skills/` (14), `supabase/migrations/`, `.env` (gitignored, populated).
- Source Ivy at `/Users/moraybrown/Desktop/Ivy/` is on `main`, clean.

**Phase 2 done-when:** A user running `cd /Users/moraybrown/Desktop/Ivy-Lab && claude` sees Claude Code report MCP servers connected (count may be <64 because some servers need native modules that aren't compiled — that's a known Phase 1 issue), and the smoke query "use `data-onet` to look up software engineer" returns real ONET data.

**Out of scope for Phase 2 (deferred):**
- Implementing the actual hook scripts (`scripts/preflight.js`, `scripts/audit-and-mirror.js`) — Phase 4
- Installing PP CLIs and writing wrappers — Phase 3
- `pp-mirrors/` directory and tap hook — Phase 4
- Refactoring bot to Claude Agent SDK — Phase 5

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
Expected: empty status, branch `main`, log shows `4307bf8 feat(bootstrap)...` at HEAD.

- [ ] **Step 2: Create the phase branch**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab checkout -b phase-2-settings-and-skills
```
Expected: `Switched to a new branch 'phase-2-settings-and-skills'`.

---

## Task 2 — Copy `scripts/run-mcp.sh` and `scripts/stdin-guard.cjs`

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/run-mcp.sh`
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/scripts/stdin-guard.cjs`

These are required by the canonical `.mcp.json` pattern. Without them, every MCP server fails to spawn.

- [ ] **Step 1: Create scripts dir and copy both files preserving exec bit on the .sh**

```bash
mkdir -p /Users/moraybrown/Desktop/Ivy-Lab/scripts
cp -p /Users/moraybrown/Desktop/Ivy/scripts/run-mcp.sh /Users/moraybrown/Desktop/Ivy-Lab/scripts/run-mcp.sh
cp -p /Users/moraybrown/Desktop/Ivy/scripts/stdin-guard.cjs /Users/moraybrown/Desktop/Ivy-Lab/scripts/stdin-guard.cjs
```

- [ ] **Step 2: Verify exec bit on run-mcp.sh and content of stdin-guard.cjs**

```bash
test -x /Users/moraybrown/Desktop/Ivy-Lab/scripts/run-mcp.sh && echo "run-mcp exec OK"
test -f /Users/moraybrown/Desktop/Ivy-Lab/scripts/stdin-guard.cjs && echo "stdin-guard OK"
head -1 /Users/moraybrown/Desktop/Ivy-Lab/scripts/run-mcp.sh
```
Expected: both echo OK; first line of run-mcp.sh is `#!/bin/bash`.

- [ ] **Step 3: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add scripts
```

---

## Task 3 — Generate `.mcp.json` for Lab

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/.mcp.json`

Source Ivy's `.mcp.json` has 64 servers using absolute paths like `/Users/moraybrown/Desktop/Ivy/scripts/run-mcp.sh` and `/Users/moraybrown/Desktop/Ivy/mcp-servers/X/src/index.ts`. We rewrite to `/Users/moraybrown/Desktop/Ivy-Lab/...` via sed.

- [ ] **Step 1: Copy and rewrite paths**

```bash
sed 's|/Users/moraybrown/Desktop/Ivy/|/Users/moraybrown/Desktop/Ivy-Lab/|g' \
  /Users/moraybrown/Desktop/Ivy/.mcp.json > /Users/moraybrown/Desktop/Ivy-Lab/.mcp.json
```

- [ ] **Step 2: Verify it's valid JSON and has 64 servers**

```bash
jq '.mcpServers | length' /Users/moraybrown/Desktop/Ivy-Lab/.mcp.json
```
Expected: `64`.

- [ ] **Step 3: Verify no source paths leaked through (every reference should now be Ivy-Lab)**

```bash
grep -c "/Users/moraybrown/Desktop/Ivy/" /Users/moraybrown/Desktop/Ivy-Lab/.mcp.json
```
Expected: `0`. If non-zero, sed pattern was wrong — STOP and BLOCK.

- [ ] **Step 4: Verify Lab paths are present**

```bash
grep -c "/Users/moraybrown/Desktop/Ivy-Lab/" /Users/moraybrown/Desktop/Ivy-Lab/.mcp.json
```
Expected: roughly 100+ (each server has 2 path occurrences for run-mcp.sh + index.ts, plus the Google/Playwright ones differ).

- [ ] **Step 5: Spot-check one local-fleet entry and one external entry**

```bash
jq '.mcpServers["data-onet"]' /Users/moraybrown/Desktop/Ivy-Lab/.mcp.json
jq '.mcpServers["google-calendar"]' /Users/moraybrown/Desktop/Ivy-Lab/.mcp.json
```
Expected:
- `data-onet` shape: `{"type":"stdio","command":"bash","args":["/Users/moraybrown/Desktop/Ivy-Lab/scripts/run-mcp.sh","/Users/moraybrown/Desktop/Ivy-Lab/mcp-servers/data-onet/src/index.ts"]}`
- `google-calendar` shape includes `source /Users/moraybrown/Desktop/Ivy-Lab/.env` and `npx @cocal/google-calendar-mcp`

- [ ] **Step 6: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add .mcp.json
```

---

## Task 4 — Author `.claude/settings.json`

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/.claude/settings.json`

Carries Bash allow/deny lists. **Hooks are deferred to Phase 4** — settings.json that references non-existent hook scripts would fire on every tool call and error. Phase 2 keeps it clean.

The directory `.claude/` already exists (from `.claude/skills/` in Phase 1). Do not create.

- [ ] **Step 1: Write the file**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/.claude/settings.json`

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
      "Bash(echo:*)"
    ],
    "deny": [
      "Bash(sudo:*)",
      "Bash(curl:*)",
      "Bash(wget:*)"
    ]
  }
}
```

**Why deny `curl`/`wget`:** spec § Section 4 — forces all external HTTP through PP CLIs (which get mirrored, audited, attributed to a `legal_class`). PP isn't installed yet (Phase 3) but the policy goes in now so it's consistent.

**No `mcpServers` field here** — that's in `.mcp.json` (Claude Code resolves both files).

**No `hooks` field here** — Phase 4 adds them along with the JS scripts they reference.

- [ ] **Step 2: Verify valid JSON**

```bash
jq '.' /Users/moraybrown/Desktop/Ivy-Lab/.claude/settings.json | head -5
jq '.permissions.allow | length' /Users/moraybrown/Desktop/Ivy-Lab/.claude/settings.json
jq '.permissions.deny | length' /Users/moraybrown/Desktop/Ivy-Lab/.claude/settings.json
```
Expected: prints first 5 lines of formatted JSON, allow length `28`, deny length `3`.

**Why so few deny rules:** `rm` is not in the allow-list, so Claude Code prompts for confirmation on any `rm` invocation — that's the actual safety net for destructive deletes. The deny-list focuses on the architecturally-significant blocks: no privilege escalation (`sudo`), no raw HTTP that bypasses PP CLIs (`curl`/`wget`). Adding overly-broad glob patterns for `rm -rf /` would also block legitimate `rm -rf /tmp/X` and is theatre.

- [ ] **Step 3: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add .claude/settings.json
```

---

## Task 5 — Author project `CLAUDE.md`

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/CLAUDE.md`

Project-level CLAUDE.md is auto-loaded by Claude Code on session start at the repo root.

- [ ] **Step 1: Write the file**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/CLAUDE.md`

```markdown
# Ivy-Lab — Personal CLI-First Workforce Research

This is the Lab branch of Ivy. Optimised for terminal-first research from one machine, with full Bash composition and per-source SQLite mirrors. See [`docs/superpowers/specs/2026-05-09-ivy-lab-cli-first-architecture-design.md`](docs/superpowers/specs/2026-05-09-ivy-lab-cli-first-architecture-design.md) for architecture and rationale.

## How this differs from the production-flavoured Ivy at github.com/misb74/Ivy

- No gateway, no frontend, no Decision Records validation. Lab outputs are not decision-grade by definition.
- Bash is a first-class tool — you can pipe `jq`, `sqlite3`, PP CLIs, etc. without going through MCP.
- Schema is owned by the production Ivy repo. Lab does not write Supabase migrations. Migrations live read-only at `supabase/migrations/`.

## Bash composition — the Printing Press habit

When working with external data sources, prefer the shell-pipe pattern over multi-MCP-call orchestration:

```bash
company-goat sec-form-d "AstraZeneca" | jq '.filings[] | select(.amount > 1000000)' | tee /tmp/big-filings.json
sqlite3 pp-mirrors/company-goat.db "SELECT * FROM results WHERE invocation LIKE '%sec-form-d%' ORDER BY ts DESC LIMIT 2"
```

The model writes the pipeline; Bash runs it; only the final shape lands in your context. This is the token-economics win the Lab is built around.

## Mirror rules

- Every external CLI call writes a row into `pp-mirrors/<source>.db` via the PostToolUse hook (Phase 4).
- "What changed since last sync" is a single SQL query against the mirror — no per-source code.
- DBs are gitignored. Treat them as local cache, not source of truth.

## Schema-ownership rule

- New tables / migrations: add them in the production Ivy repo only. Apply via Supabase CLI from there.
- Lab's `supabase/migrations/` is a read-only mirror — do NOT add files there.
- After Ivy adds a migration: `rsync -a /Users/moraybrown/Desktop/Ivy/supabase/migrations/ ./supabase/migrations/` from Lab root to refresh the mirror.

## Bash safety

- `.claude/settings.json` deny-lists raw `curl`/`wget` deliberately. Use a PP CLI instead.
- Kill switch: `IVY_LAB_BASH_DISABLED=1` env var disables Bash for the Claude Code session (PreToolUse hook lands in Phase 4).
- Audit log lives at `data/audit.db` (Phase 4).

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
```

- [ ] **Step 2: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add CLAUDE.md
```

---

## Task 6 — Audit and update SKILL.md descriptions

**Files:**
- Modify (only if needed): up to 14 files at `/Users/moraybrown/Desktop/Ivy-Lab/.claude/skills/<name>/SKILL.md`

Claude Code's native skill loader matches user prompts against each skill's `description:` frontmatter. Source Ivy delegated trigger logic to `gateway/skill-registry.json`; Lab uses Claude Code's loader. Some descriptions need beefing up so they trigger on the same intents the registry-defined triggers used to fire on.

The 14 skills:

| Skill | Action |
|---|---|
| `agent-builder` | Audit description — must trigger on "build agent / agent spec / scaffold agent / agent SDK / generate agent / agent_spec" |
| `artifacts` | Audit — must trigger on "skill_analysis / automation_assessment / career_ladder / workforce_plan / job_analysis / role_design / task_decomposition / org_design / decision_transparency / labor market / hiring trends / artifact / card / insight / onboarding / skill_deep_dive" (extensive list — see `gateway/skill-registry.json` in source Ivy) |
| `customer-data` | Audit — must trigger on "upload data / employee roster / org data / import csv / customer data / workforce data / headcount data" |
| `deep-research` | Audit — must trigger on "deep research / federated / multi-source / cross-source / academic research / curated findings" |
| `finance-transformation` | Already a flagship — audit the existing description, leave alone unless thin |
| `interview-analysis` | Audit — must trigger on "activity analysis / time study / run interviews / practitioner interview / collect activity data" |
| `ivy` | Tier-1 / always-loaded in source — its description should be broad. Probably leave alone |
| `ivy-persona` | Tier-1 / persona — leave alone |
| `lessons` | Tier-1 / corrections — leave alone |
| `output` | Audit — must trigger on "create report / executive report / html / pdf / docx / xlsx / pptx / presentation / slide deck / clone / artifact to html" |
| `report-cloner` | Audit — must trigger on "clone_create / ingest_pdf / clone_status / report template" |
| `routing` | Tier-1 catalogue — leave alone |
| `swp-analysis` | Audit — must trigger on "SWP / workforce planning session / Build Borrow Buy Bot / strategic workforce / transcript" |
| `workforce-sim` | Audit — must trigger on "simulate / workforce redesign / WorkVine / maturation curve / agent capability / human-agent team / BBBOB / finance function" |

**Approach:** for each skill above with "Audit", read its current `description:` frontmatter. If it already covers the relevant trigger intents in semantic terms (Claude Code uses semantic matching, not keyword), leave it alone. If it's too narrow, expand it.

- [ ] **Step 1: Read all 14 current descriptions in one pass**

```bash
for skill in agent-builder artifacts customer-data deep-research finance-transformation interview-analysis ivy ivy-persona lessons output report-cloner routing swp-analysis workforce-sim; do
  echo "=== $skill ==="
  awk '/^---$/{c++; next} c==1' /Users/moraybrown/Desktop/Ivy-Lab/.claude/skills/$skill/SKILL.md | head -10
  echo ""
done
```
This prints just the YAML frontmatter (everything between the first two `---` markers) for each skill.

- [ ] **Step 2: For each skill flagged "Audit" above, decide whether the description needs expansion**

Decision rule:
- If description already mentions multiple representative trigger intents → LEAVE ALONE.
- If description is one-sentence narrow ("Build agents from simulations") and would miss intents like "scaffold agent", "generate agent" → EXPAND.

For each skill that needs expansion, edit the SKILL.md file's frontmatter `description:` field to a 1–3 sentence version that covers the intent space. Do NOT change body content. Do NOT touch other frontmatter fields.

Example expansion (artifacts, hypothetical — confirm against actual current state):

Before:
```yaml
description: Generate workforce analysis cards.
```

After:
```yaml
description: Generate workforce analysis artifact cards — skill analysis, automation assessment, career ladders, workforce plans, job/role analysis, task decomposition, org design, decision transparency. Use when the user asks for a structured analysis output, an "insight" / "card", or names a specific workforce domain (skills, roles, jobs, automation, careers, workforce planning).
```

- [ ] **Step 3: Verify all SKILL.md files still parse as valid frontmatter**

```bash
for skill in agent-builder artifacts customer-data deep-research finance-transformation interview-analysis ivy ivy-persona lessons output report-cloner routing swp-analysis workforce-sim; do
  if ! head -1 /Users/moraybrown/Desktop/Ivy-Lab/.claude/skills/$skill/SKILL.md | grep -q '^---$'; then
    echo "BROKEN: $skill — first line is not '---'"
  fi
done
echo "Done"
```
Expected: only `Done` printed (no BROKEN lines).

- [ ] **Step 4: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add .claude/skills/
```

- [ ] **Step 5: Sanity check the staged diff is small and intentional**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab diff --cached --stat .claude/skills/ | tail -10
```
Expected: a few SKILL.md files modified, no new files added/removed. If new files appear, that's a mistake — fix it.

---

## Task 7 — Document smoke-test procedure in PR description

**Files:** none (this is a checklist-prep task; smoke test is run by the human reviewer)

The user will run `claude` from `/Users/moraybrown/Desktop/Ivy-Lab/` and verify. Since this conversation is itself running inside Claude Code in a different directory, we cannot run the smoke test from here — that would require a separate terminal session.

- [ ] **Step 1: Confirm the smoke-test commands the human will run are documented in the PR (Task 9 includes them)**

(No action — verification step only.)

---

## Task 8 — Commit

**Files:** all staged

- [ ] **Step 1: Final pre-commit safety**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab status --short | grep -E '\.(env|db|db-shm|db-wal|sqlite|sqlite3|key|pem)$' | wc -l
```
Expected: `0`. If non-zero, STOP — secrets/data staged.

- [ ] **Step 2: Confirm staged tree composition**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab diff --cached --name-only | sort
```
Expected files (additions):
- `.claude/settings.json`
- `.mcp.json`
- `CLAUDE.md`
- `scripts/run-mcp.sh`
- `scripts/stdin-guard.cjs`

Plus modifications to some subset of `.claude/skills/*/SKILL.md`.

- [ ] **Step 3: Commit**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab commit -m "$(cat <<'EOF'
feat(phase-2): .mcp.json, .claude/settings.json, CLAUDE.md, run-mcp launcher, skill description tuning

Phase 2 of the Ivy-Lab founding architecture (see docs/superpowers/specs/2026-05-09-...).

Adds:
- .mcp.json registering all 64 MCP servers (local fleet + google-calendar + google-drive + playwright). Paths rewritten from source Ivy to /Users/moraybrown/Desktop/Ivy-Lab/.
- scripts/run-mcp.sh and scripts/stdin-guard.cjs copied verbatim from Ivy. Required by .mcp.json — load .env and inject stdin-guard preload so MCP children exit when Claude Code closes stdin.
- .claude/settings.json with Bash allow-list (jq, sqlite3, head, tail, grep, rg, awk, sed, npm, npx, node, gh, rsync, etc.) and deny-list (rm -rf /, sudo, curl, wget, fork-bomb). curl/wget denial is intentional — forces external HTTP through PP CLIs once installed in Phase 3.
- CLAUDE.md project memory: Bash composition habit, mirror rules, schema-ownership rule, kill-switch documentation, skill catalogue pointers, @-import for routing skill.

Tunes:
- SKILL.md description frontmatter for skills whose descriptions were too narrow to trigger on the trigger intents previously held in source Ivy's gateway/skill-registry.json. Tier-1 skills (ivy, ivy-persona, lessons, routing) and already-broad descriptions left alone.

Defers:
- Hooks (preflight.js, audit-and-mirror.js) until Phase 4. settings.json has no hooks field today — pointing at non-existent JS would fail every tool call.
- PP CLI install + wrappers + INDEX.md until Phase 3.
- Bot refactor onto Claude Agent SDK until Phase 5.

Smoke test (must run manually from a separate terminal — this conversation runs inside Claude Code already):
1. cd /Users/moraybrown/Desktop/Ivy-Lab && claude
2. Verify Claude Code's startup log shows MCP servers connecting (count <64 OK if native modules aren't compiled — known Phase 1 issue with macOS 26 beta + node-gyp).
3. Run "use data-onet to look up software engineer" — should return real ONET occupation data.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
Expected: `[phase-2-settings-and-skills <hash>] feat(phase-2): ...`.

---

## Task 9 — Push and create PR

**Files:** none (remote)

- [ ] **Step 1: Push branch**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab push -u origin phase-2-settings-and-skills
```

- [ ] **Step 2: Build PR body file**

```bash
cat > /tmp/ivy-lab-phase-2-pr-body.md <<'BODY'
## Summary

Implements Phase 2 of the Ivy-Lab founding architecture (see [spec](docs/superpowers/specs/2026-05-09-ivy-lab-cli-first-architecture-design.md) § Section 2 + day-1 sequence).

Brings the project to a point where `claude` can be launched from `/Users/moraybrown/Desktop/Ivy-Lab/` with the full curated MCP fleet, Bash policy, project CLAUDE.md, and skill descriptions tuned for Claude Code's native loader.

### Adds

- `.mcp.json` — 64 MCP servers registered using the canonical `bash scripts/run-mcp.sh src/index.ts` pattern from source Ivy. Path-rewritten via `sed` from source.
- `scripts/run-mcp.sh` + `scripts/stdin-guard.cjs` — required by `.mcp.json` to load `.env` and prevent zombie MCP children when Claude Code exits.
- `.claude/settings.json` — Bash `permissions` (allow-list of data-shaping tools, deny-list of `curl`/`wget`/`sudo`/destructive `rm`).
- `CLAUDE.md` project memory — Bash composition habit, mirror rules, schema-ownership rule, kill-switch, skill catalogue.

### Tunes

- SKILL.md `description:` frontmatter for skills whose triggers used to live in source Ivy's `gateway/skill-registry.json`. Tier-1 skills left alone.

### Defers (intentional)

- **Hooks** to Phase 4 — `settings.json` has no `hooks` field today because `preflight.js`/`audit-and-mirror.js` don't exist yet, and pointing at non-existent JS would fail every tool call.
- **PP CLI install + wrappers** to Phase 3.
- **Bot refactor onto Claude Agent SDK** to Phase 5.

## Test plan (smoke test — must run manually from a separate terminal)

This conversation runs inside Claude Code already, so the smoke test cannot run from inside this conversation. Run from a separate terminal session:

- [ ] `cd /Users/moraybrown/Desktop/Ivy-Lab && claude`
- [ ] Verify the startup log shows MCP servers connecting. Count <64 is OK — some servers need native modules (`better-sqlite3`) that aren't compiled due to the macOS 26 beta + node-gyp issue logged in PR #1.
- [ ] Run prompt: "use `data-onet` to look up software engineer". Expect real ONET occupation data (data-onet is HTTP-only, doesn't depend on native modules).
- [ ] Try a Bash piping pattern: ask Claude to run `ls mcp-servers | wc -l | jq -R 'tonumber'` (verifies allow-list works). Expected: `61`.
- [ ] Try a denied Bash command: ask Claude to run `curl -s https://example.com`. Expected: blocked by permissions deny-list.

## Known issues for follow-up

- `claude` on Lab will report a smaller-than-64 connected-server count until `better-sqlite3` is compiled. Track at [PR #1](https://github.com/misb74/Ivy-Lab/pull/1) (resolution path: install full Xcode, or pin `node-gyp` to a version with the macOS 26 fix).
- Some servers may fail to connect for other reasons (missing API keys for `agent-talent-sourcer`, etc.). Document any failures observed during smoke test.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
```

- [ ] **Step 3: Create PR**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && gh pr create \
  --title "Phase 2: .mcp.json + .claude/settings.json + CLAUDE.md + skill tuning" \
  --body-file /tmp/ivy-lab-phase-2-pr-body.md
```

- [ ] **Step 4: Capture PR URL for Task 10**

```bash
gh pr view --json url,number
```

---

## Task 10 — Self-review the PR

**Files:** none (review only)

- [ ] **Step 1: Open PR diff in browser**

```bash
gh pr view --web
```

- [ ] **Step 2: Verify file tree on PR Files tab**

What to check:
- 5 added files (`.mcp.json`, `.claude/settings.json`, `CLAUDE.md`, `scripts/run-mcp.sh`, `scripts/stdin-guard.cjs`)
- A handful of modified `.claude/skills/*/SKILL.md` files (only frontmatter `description:` lines should change — body content untouched)
- No `.env`, no `*.db`, no `node_modules` in the diff
- `.mcp.json` is JSON, paths all reference `/Users/moraybrown/Desktop/Ivy-Lab/`
- `scripts/run-mcp.sh` retains exec bit (GitHub shows mode `100755`)

- [ ] **Step 3: Run the manual smoke test from a separate terminal session**

Per the test plan in the PR body. If smoke test passes, comment on the PR confirming. If it fails, file the failure mode as a comment and decide: fix in this PR or merge with the failure documented as Phase 2.5 follow-up.

---

## Task 11 — Squash-merge

**Files:** none (git ops; user-gated)

- [ ] **Step 1: Confirm with user before merging**

The user must explicitly approve the merge after smoke-test results.

- [ ] **Step 2: Squash-merge**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && gh pr merge --squash --delete-branch
```

- [ ] **Step 3: Pull main and prune**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab checkout main
git -C /Users/moraybrown/Desktop/Ivy-Lab pull
git -C /Users/moraybrown/Desktop/Ivy-Lab fetch --prune origin
```

- [ ] **Step 4: Verify final state**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab log --oneline -5
git -C /Users/moraybrown/Desktop/Ivy-Lab branch -a
```
Expected: 5 commits on main (founding spec, gitignore, plan-1, bootstrap, phase-2). No local or remote phase-2 branch.

---

## Done when

- [ ] PR `phase-2-settings-and-skills` squash-merged into `main`.
- [ ] `cd /Users/moraybrown/Desktop/Ivy-Lab && claude` launches Claude Code with the curated MCP fleet, even if some servers fail (native modules issue is tracked separately).
- [ ] Smoke query "use `data-onet` to look up software engineer" returns real ONET data.
- [ ] Bash composition pipeline (`ls | wc -l | jq`) works inside the Claude Code session.
- [ ] Denied commands (`curl`) are blocked by the deny-list.

After this plan: **Phase 3 — install Phase 0 PP CLIs (`company-goat`, `hackernews-pp`, `wikipedia-pp`) + write `pp-tools/registry.json` + `pp-tools/INDEX.md` + 3 wrapper scripts**. Gets its own plan.
