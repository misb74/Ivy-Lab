# Ivy-Lab Phase 0+1 — Bootstrap & Copy-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `Ivy-Lab` from "empty repo with founding spec" to "all MCP servers, bot scaffolding, CLI, skills, prompts, and a clean `npm install`" in one reviewable PR.

**Architecture:** Linear file-copy from `/Users/moraybrown/Desktop/Ivy/` (the canonical Ivy main checkout, on branch `main`) into `/Users/moraybrown/Desktop/Ivy-Lab/`. Each major directory tree is its own task with a verification step. Root `package.json`, `tsconfig.base.json`, and `README.md` are written *after* copies complete so workspace globs reflect reality. Branch off `main` in Ivy-Lab, do the work, raise a PR, squash-merge.

**Tech Stack:** npm workspaces, TypeScript 5+, Node 18+, `gh` CLI for PR ops.

**Spec reference:** `docs/superpowers/specs/2026-05-09-ivy-lab-cli-first-architecture-design.md` § Phased rollout, Phases 0–1.

**Source state assumed:** Existing `Ivy` repo at `/Users/moraybrown/Desktop/Ivy/` is on branch `main` with a clean working tree. Verified at plan time: `15922f5 chore: consolidate feat/decision-records-supabase-phase4-5 → main`.

---

## Task 1 — Branch off main in Ivy-Lab

**Files:** none (git only)

- [ ] **Step 1: Confirm Ivy-Lab main is clean and up to date with origin**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab status --short
git -C /Users/moraybrown/Desktop/Ivy-Lab fetch origin
git -C /Users/moraybrown/Desktop/Ivy-Lab log --oneline -3
```

Expected: status empty, log shows `07e3cc1 chore: gitignore...` and `82a0016 docs: founding architecture spec...`.

- [ ] **Step 2: Verify source Ivy is on `main` and clean**

```bash
git -C /Users/moraybrown/Desktop/Ivy status --short
git -C /Users/moraybrown/Desktop/Ivy branch --show-current
```

Expected: empty status, branch shows `main`. If not, STOP and resolve before continuing — copying from a feature branch will pollute Lab with unfinished work.

- [ ] **Step 3: Create the phase branch**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab checkout -b phase-1-bootstrap-and-copy-in
```

Expected: `Switched to a new branch 'phase-1-bootstrap-and-copy-in'`.

---

## Task 2 — Copy `mcp-servers/`

**Files:**
- Copy: `/Users/moraybrown/Desktop/Ivy/mcp-servers/` → `/Users/moraybrown/Desktop/Ivy-Lab/mcp-servers/`

- [ ] **Step 1: Copy with rsync, excluding build artefacts and node_modules**

```bash
rsync -a --exclude='node_modules' --exclude='build' --exclude='dist' --exclude='*.tsbuildinfo' \
  /Users/moraybrown/Desktop/Ivy/mcp-servers/ /Users/moraybrown/Desktop/Ivy-Lab/mcp-servers/
```

- [ ] **Step 2: Verify count matches source**

```bash
diff <(ls /Users/moraybrown/Desktop/Ivy/mcp-servers) <(ls /Users/moraybrown/Desktop/Ivy-Lab/mcp-servers)
```

Expected: empty output (no diff).

- [ ] **Step 3: Spot-check ATS scanner has its Supabase wiring intact**

```bash
test -f /Users/moraybrown/Desktop/Ivy-Lab/mcp-servers/agent-ats-scanner/src/supabase.ts && echo OK
```

Expected: `OK`.

- [ ] **Step 4: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add mcp-servers
```

---

## Task 3 — Copy `packages/`

**Files:**
- Copy: `/Users/moraybrown/Desktop/Ivy/packages/` → `/Users/moraybrown/Desktop/Ivy-Lab/packages/`

- [ ] **Step 1: Copy**

```bash
rsync -a --exclude='node_modules' --exclude='build' --exclude='dist' --exclude='*.tsbuildinfo' \
  /Users/moraybrown/Desktop/Ivy/packages/ /Users/moraybrown/Desktop/Ivy-Lab/packages/
```

- [ ] **Step 2: Verify `ivy-core` exists**

```bash
test -f /Users/moraybrown/Desktop/Ivy-Lab/packages/ivy-core/package.json && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add packages
```

---

## Task 4 — Copy `bot/` (pre-refactor; Phase 5 will rewrite)

**Files:**
- Copy: `/Users/moraybrown/Desktop/Ivy/bot/` → `/Users/moraybrown/Desktop/Ivy-Lab/bot/`

The bot lands in its current direct-Anthropic-SDK form. Phase 5 refactors it to use the Claude Agent SDK. Bringing it now means we have the `auth.ts`, `audit.ts`, and `file-manager.ts` files we'll keep in the refactor.

- [ ] **Step 1: Copy**

```bash
rsync -a --exclude='node_modules' --exclude='build' --exclude='dist' --exclude='*.tsbuildinfo' \
  /Users/moraybrown/Desktop/Ivy/bot/ /Users/moraybrown/Desktop/Ivy-Lab/bot/
```

- [ ] **Step 2: Verify all 8 source files present**

```bash
ls /Users/moraybrown/Desktop/Ivy-Lab/bot/src/ | sort
```

Expected: `audit.ts auth.ts claude-runner.ts conversation-store.ts file-manager.ts index.ts mcp-manager.ts telegram.ts`.

- [ ] **Step 3: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add bot
```

---

## Task 5 — Copy `cli/` (existing scaffold)

**Files:**
- Copy: `/Users/moraybrown/Desktop/Ivy/cli/` → `/Users/moraybrown/Desktop/Ivy-Lab/cli/`

- [ ] **Step 1: Copy**

```bash
rsync -a --exclude='node_modules' --exclude='build' --exclude='dist' --exclude='*.tsbuildinfo' \
  /Users/moraybrown/Desktop/Ivy/cli/ /Users/moraybrown/Desktop/Ivy-Lab/cli/
```

- [ ] **Step 2: Verify the scaffold subdirs are present**

```bash
ls /Users/moraybrown/Desktop/Ivy-Lab/cli/bin /Users/moraybrown/Desktop/Ivy-Lab/cli/src
```

Expected: `bin` shows `ivy.ts`; `src` shows `commands constants.ts parsers types.ts ui`.

- [ ] **Step 3: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add cli
```

---

## Task 6 — Copy `bin/ivy` launcher

**Files:**
- Copy: `/Users/moraybrown/Desktop/Ivy/bin/ivy` → `/Users/moraybrown/Desktop/Ivy-Lab/bin/ivy`

- [ ] **Step 1: Create dir and copy preserving exec bit**

```bash
mkdir -p /Users/moraybrown/Desktop/Ivy-Lab/bin
cp -p /Users/moraybrown/Desktop/Ivy/bin/ivy /Users/moraybrown/Desktop/Ivy-Lab/bin/ivy
```

- [ ] **Step 2: Verify exec bit preserved**

```bash
test -x /Users/moraybrown/Desktop/Ivy-Lab/bin/ivy && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add bin
```

---

## Task 7 — Copy `prompts/`

**Files:**
- Copy: `/Users/moraybrown/Desktop/Ivy/prompts/` → `/Users/moraybrown/Desktop/Ivy-Lab/prompts/`

- [ ] **Step 1: Copy**

```bash
rsync -a /Users/moraybrown/Desktop/Ivy/prompts/ /Users/moraybrown/Desktop/Ivy-Lab/prompts/
```

- [ ] **Step 2: Verify non-empty**

```bash
test -d /Users/moraybrown/Desktop/Ivy-Lab/prompts && ls /Users/moraybrown/Desktop/Ivy-Lab/prompts | head -5
```

Expected: at least one file or subdir listed.

- [ ] **Step 3: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add prompts
```

---

## Task 8 — Copy `.claude/skills/`

**Files:**
- Copy: `/Users/moraybrown/Desktop/Ivy/.claude/skills/` → `/Users/moraybrown/Desktop/Ivy-Lab/.claude/skills/`

We bring all 14 skills as-is. Description-frontmatter migration (absorbing trigger phrases from the Production-Ivy `gateway/skill-registry.json`) happens in Phase 2, not here.

- [ ] **Step 1: Copy**

```bash
mkdir -p /Users/moraybrown/Desktop/Ivy-Lab/.claude
rsync -a /Users/moraybrown/Desktop/Ivy/.claude/skills/ /Users/moraybrown/Desktop/Ivy-Lab/.claude/skills/
```

- [ ] **Step 2: Verify all 14 skills present**

```bash
ls /Users/moraybrown/Desktop/Ivy-Lab/.claude/skills | wc -l
```

Expected: `14`.

- [ ] **Step 3: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add .claude/skills
```

---

## Task 9 — Copy `supabase/migrations/` as read-only mirror

**Files:**
- Copy: `/Users/moraybrown/Desktop/Ivy/supabase/migrations/` → `/Users/moraybrown/Desktop/Ivy-Lab/supabase/migrations/`
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/supabase/migrations/README.md`

The discipline rule from the spec: schema is owned by `Ivy`. Lab's mirror exists for type/shape reference only. The README declares this so anyone (including future-you) reading the directory understands.

- [ ] **Step 1: Copy migrations**

```bash
mkdir -p /Users/moraybrown/Desktop/Ivy-Lab/supabase
rsync -a /Users/moraybrown/Desktop/Ivy/supabase/migrations/ /Users/moraybrown/Desktop/Ivy-Lab/supabase/migrations/
```

- [ ] **Step 2: Write the README declaring read-only status**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/supabase/migrations/README.md`

```markdown
# Supabase migrations — READ-ONLY MIRROR

This directory is a read-only mirror of `Ivy/supabase/migrations/`.

**Do not add migrations here.** Schema for the shared Supabase project is owned by the
`Ivy` repo. Add migrations there, apply via the Supabase CLI from there, then sync this
directory by `rsync -a /Users/moraybrown/Desktop/Ivy/supabase/migrations/ ./` from the
Ivy-Lab repo root.

Two migration sources for one Supabase project = drift. One source. Always.
```

- [ ] **Step 3: Verify migrations and README present**

```bash
ls /Users/moraybrown/Desktop/Ivy-Lab/supabase/migrations/*.sql | wc -l
test -f /Users/moraybrown/Desktop/Ivy-Lab/supabase/migrations/README.md && echo "README OK"
```

Expected: at least 1 SQL file, `README OK`.

- [ ] **Step 4: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add supabase
```

---

## Task 10 — Sync runtime SQLite DBs (gitignored, runtime convenience)

**Files:**
- Copy: `/Users/moraybrown/Desktop/Ivy/data/` → `/Users/moraybrown/Desktop/Ivy-Lab/data/`

The seeded DBs (`skills-intelligence.db`, `research-index.db`) bring real content with them so Lab has working data on first run. These files are gitignored (`.gitignore` line `data/*.db`) so they never enter the repo — this rsync is purely local convenience.

- [ ] **Step 1: Sync data dir, including DBs but excluding telegram bot uploads**

```bash
mkdir -p /Users/moraybrown/Desktop/Ivy-Lab/data
rsync -a --exclude='telegram-bot/uploads' \
  /Users/moraybrown/Desktop/Ivy/data/ /Users/moraybrown/Desktop/Ivy-Lab/data/
```

- [ ] **Step 2: Verify DBs are NOT staged (gitignore working)**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab status --short | grep -E '\.db$' || echo "No .db files staged — gitignore working"
```

Expected: `No .db files staged — gitignore working`.

- [ ] **Step 3: No `git add` for this task — DBs stay local-only**

(Skip — gitignore handles it.)

---

## Task 11 — Write `tsconfig.base.json`

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/tsconfig.base.json`

This is the shared TypeScript config that workspace `tsconfig.json` files extend. We copy from the existing Ivy and trim if needed.

- [ ] **Step 1: Copy from source**

```bash
cp /Users/moraybrown/Desktop/Ivy/tsconfig.base.json /Users/moraybrown/Desktop/Ivy-Lab/tsconfig.base.json
```

- [ ] **Step 2: Verify presence**

```bash
test -f /Users/moraybrown/Desktop/Ivy-Lab/tsconfig.base.json && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add tsconfig.base.json
```

---

## Task 12 — Write root `package.json` with workspaces

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/package.json`

Use globs (`mcp-servers/*`, `packages/*`) instead of enumerated entries. npm warns on dirs without `package.json` but doesn't fail. The Production-Ivy package.json enumerates because it had to skip a few dirs — for Lab we accept the warnings or fix later if a specific dir misbehaves.

- [ ] **Step 1: Write the file**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/package.json`

```json
{
  "name": "ivy-lab",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "CLI-first Lab companion to Ivy. Claude Code is the agent; Telegram bot is a thin transport over the Claude Agent SDK.",
  "workspaces": [
    "mcp-servers/*",
    "packages/*",
    "bot",
    "cli"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "start:bot": "npm --workspace bot start"
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 2: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add package.json
```

---

## Task 13 — Write top-level `README.md`

**Files:**
- Create: `/Users/moraybrown/Desktop/Ivy-Lab/README.md`

Light README — points at the spec instead of duplicating it.

- [ ] **Step 1: Write the file**

Path: `/Users/moraybrown/Desktop/Ivy-Lab/README.md`

```markdown
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
```

- [ ] **Step 2: Stage**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add README.md
```

---

## Task 14 — `npm install`

**Files:** none (mutates `node_modules/` and `package-lock.json`)

This is the first real validation. If workspaces are wired right, `npm install` resolves all dependencies. If a workspace has a broken `package.json`, it surfaces here.

- [ ] **Step 1: Install**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && npm install 2>&1 | tail -30
```

Expected: ends with `added N packages` line. Warnings about missing `package.json` in non-package directories under `mcp-servers/*` are tolerable — log them but don't block.

- [ ] **Step 2: Verify `package-lock.json` was created**

```bash
test -f /Users/moraybrown/Desktop/Ivy-Lab/package-lock.json && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Stage `package-lock.json`** (gitignore should NOT exclude it)

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab add package-lock.json
```

---

## Task 15 — Build smoke test (typecheck across workspaces)

**Files:** none (compiles to `build/` in each workspace, gitignored)

We verify that copied workspaces compile in their new home. If gateway-specific imports broke (e.g. an MCP server imported from `gateway/src/` — which we didn't copy), this surfaces here.

- [ ] **Step 1: Typecheck across workspaces**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && npm run typecheck 2>&1 | tail -50
```

Expected: zero errors, or only known-tolerable errors. Examples of *acceptable* errors that we'll fix in Phase 2 not here:
- A workspace that imports `@ivy/gateway` (the gateway package — not in Lab) — note it, don't fix now.

If errors surface, write a one-paragraph note in the PR description listing them with the workspace name. Phase 2 prunes/fixes.

- [ ] **Step 2: Capture typecheck output for the PR**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && npm run typecheck 2>&1 | tail -50 > /tmp/ivy-lab-typecheck.txt
echo "Typecheck output saved to /tmp/ivy-lab-typecheck.txt"
```

(File goes in `/tmp/` — not committed. Used as PR description input in Task 17.)

---

## Task 16 — Commit the bootstrap

**Files:** all staged

- [ ] **Step 1: Final status check before commit**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab status --short | head -20
```

Expected: shows staged additions for mcp-servers, packages, bot, cli, bin, prompts, .claude/skills, supabase, tsconfig.base.json, package.json, package-lock.json, README.md. NO `.env` and NO `*.db` files.

- [ ] **Step 2: Confirm `.env` and `*.db` are not staged**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab status --short | grep -E '(\.env$|\.db$)' && echo "BLOCKED — secrets or DBs staged" || echo "Clean"
```

Expected: `Clean`. If `BLOCKED`, STOP and unstage before committing.

- [ ] **Step 3: Commit**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab commit -m "$(cat <<'EOF'
feat(bootstrap): copy mcp-servers, packages, bot, cli, skills, prompts, supabase migrations from Ivy

Phase 0+1 of the Ivy-Lab founding architecture (see docs/superpowers/specs/2026-05-09-...).

Brings:
- mcp-servers/ (61 servers, full fleet from Ivy main)
- packages/ivy-core
- bot/ (pre-refactor — Phase 5 rewrites onto Claude Agent SDK)
- cli/ scaffold (commands, parsers, ui, splash)
- bin/ivy launcher
- prompts/, .claude/skills/ (14 skills)
- supabase/migrations/ as READ-ONLY mirror with README declaring rule

Adds:
- root package.json with workspaces (mcp-servers/*, packages/*, bot, cli)
- tsconfig.base.json
- README.md pointing at the spec

Source: /Users/moraybrown/Desktop/Ivy at 15922f5 on main, clean working tree.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: `[phase-1-bootstrap-and-copy-in <hash>] feat(bootstrap): ...` with file count showing thousands of new files.

---

## Task 17 — Push branch and create PR

**Files:** none (remote)

- [ ] **Step 1: Push branch**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab push -u origin phase-1-bootstrap-and-copy-in
```

Expected: branch created on origin.

- [ ] **Step 2: Build the PR body file**

```bash
cat > /tmp/ivy-lab-pr-body.md <<'BODY_HEAD'
## Summary

Implements Phases 0 and 1 of the Ivy-Lab founding architecture (see [spec](docs/superpowers/specs/2026-05-09-ivy-lab-cli-first-architecture-design.md)).

Brings the full MCP fleet, packages/ivy-core, bot (pre-refactor), cli scaffold, skills, prompts, and a read-only mirror of supabase/migrations from `/Users/moraybrown/Desktop/Ivy` at `15922f5` on `main`. Adds root package.json with workspace globs, tsconfig.base.json, and a README pointing at the spec.

## Typecheck output (for triage in Phase 2)

```
BODY_HEAD
cat /tmp/ivy-lab-typecheck.txt >> /tmp/ivy-lab-pr-body.md
cat >> /tmp/ivy-lab-pr-body.md <<'BODY_TAIL'
```

## Test plan

- [ ] `npm install` clean from a fresh clone
- [ ] `npm run typecheck` results triaged (any failures noted above for Phase 2 fixup)
- [ ] `.env` and `*.db` files NOT in the diff (verified pre-commit)
- [ ] `supabase/migrations/README.md` declares read-only status
- [ ] `bin/ivy` retains exec bit

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY_TAIL
```

- [ ] **Step 3: Create the PR using `--body-file`**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && gh pr create \
  --title "Phase 0+1: Bootstrap & copy-in from Ivy" \
  --body-file /tmp/ivy-lab-pr-body.md
```

Expected: PR URL returned. Note it for the next task.

---

## Task 18 — Self-review the PR diff

**Files:** none (review only)

- [ ] **Step 1: Open PR diff in browser**

```bash
gh pr view --web
```

- [ ] **Step 2: Skim the file tree on the PR Files tab**

What to check:
- Roughly the right number of files (~5,000–10,000 depending on workspace contents).
- No `.env`, no `*.db`, no `node_modules/`, no `build/` directories in the diff.
- `README.md`, `package.json`, `tsconfig.base.json`, `supabase/migrations/README.md` all present.
- `.claude/skills/` shows 14 directories.

- [ ] **Step 3: If anything looks wrong, push a fixup commit**

If a file slipped in that shouldn't (e.g. a stray `node_modules`), `git rm -r --cached <path>` and commit + push. Don't merge dirty.

---

## Task 19 — Squash-merge and clean up

**Files:** none (git ops)

- [ ] **Step 1: Squash-merge via `gh`**

```bash
cd /Users/moraybrown/Desktop/Ivy-Lab && gh pr merge --squash --delete-branch
```

Expected: PR merged on remote, branch deleted on remote, branch deleted locally.

- [ ] **Step 2: Pull main locally**

```bash
git -C /Users/moraybrown/Desktop/Ivy-Lab checkout main
git -C /Users/moraybrown/Desktop/Ivy-Lab pull
git -C /Users/moraybrown/Desktop/Ivy-Lab log --oneline -5
```

Expected: main now has 3 commits — founding spec, gitignore + env example, Phase 0+1 bootstrap.

- [ ] **Step 3: Confirm `mcp-servers/` and friends are present on main**

```bash
ls /Users/moraybrown/Desktop/Ivy-Lab/mcp-servers | wc -l
test -f /Users/moraybrown/Desktop/Ivy-Lab/package.json && echo "package.json OK"
test -f /Users/moraybrown/Desktop/Ivy-Lab/bin/ivy && echo "launcher OK"
```

Expected: `61`, `package.json OK`, `launcher OK`.

---

## Done when

- [ ] PR `phase-1-bootstrap-and-copy-in` is squash-merged into `main` on GitHub.
- [ ] Local `Ivy-Lab/main` has the bootstrap commit at HEAD.
- [ ] `npm install` runs clean from the repo root.
- [ ] `npm run typecheck` either passes or surfaces only known errors logged in the PR description for Phase 2 fixup.
- [ ] No `.env` or `*.db` files in the repo's git history.

After this plan, the repo is ready for **Phase 2 — `.claude/settings.json` + skill description migration + project CLAUDE.md**, which gets its own plan.
