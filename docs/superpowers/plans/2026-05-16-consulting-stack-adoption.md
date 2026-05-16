# Consulting Stack Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt eight external picks (six Hermes skills + two Vercel-Labs apps) into Ivy-Lab to support Moray's consulting workflow.

**Architecture:** Hermes skills are MIT-licensed `SKILL.md`-format directories — drop directly into `.claude/skills/` and install backing deps. Vercel `webreel` is an npm CLI — install globally and add a thin `pp-tools/` wrapper for Bash composition. Vercel `knowledge-agent-template` and `tersa` are full Next.js apps — evaluation spikes (clone, run, decide), not committed to the Lab repo.

**Tech Stack:** Hermes-Agent skills (`github.com/NousResearch/hermes-agent`, MIT), Vercel Labs repos (`vercel-labs/webreel` Apache-2.0, `vercel-labs/knowledge-agent-template` MIT, `vercel-labs/tersa` MIT), Python 3.11+ (pymupdf, marker-pdf), Node 18+ (webreel, tersa, knowledge-agent-template), Lab's existing `pp-tools/` + `.claude/skills/` + routing skill.

**Consulting stack mapping:**

| Layer | Pick | Source | Phase |
|---|---|---|---|
| Engagement state | Linear or Airtable | Hermes | 3 |
| Engagement learning | knowledge-agent-template | Vercel Labs | 5 |
| Document intake | ocr-and-documents | Hermes | 1 |
| Document polish | humanizer + nano-pdf | Hermes | 1 |
| Deliverable variants | sketch + popular-web-designs | Hermes | 2 |
| Demo recording | webreel | Vercel Labs | 4 |
| Workshop diagrams | excalidraw | Hermes | 1 |
| Visual workflow proposals | tersa | Vercel Labs | 5 |

---

## Phase 0: Prerequisites and decision gates

### Task 0.1: Clone Hermes-Agent repo to a scratch dir

We need source for six skill directories. Sparse-checkout keeps the clone small.

**Files:**
- Create: `~/code/scratch/hermes-agent/` (scratch, outside Lab)

- [ ] **Step 1: Sparse-clone Hermes-Agent**

```bash
mkdir -p ~/code/scratch
cd ~/code/scratch
git clone --depth 1 --filter=blob:none --sparse https://github.com/NousResearch/hermes-agent.git
cd hermes-agent
git sparse-checkout set skills/productivity/ocr-and-documents \
                        skills/productivity/nano-pdf \
                        skills/productivity/linear \
                        skills/productivity/airtable \
                        skills/creative/humanizer \
                        skills/creative/sketch \
                        skills/creative/popular-web-designs \
                        skills/creative/excalidraw
```

- [ ] **Step 2: Confirm all eight skills present**

Run:
```bash
ls skills/productivity/{ocr-and-documents,nano-pdf,linear,airtable}/SKILL.md \
   skills/creative/{humanizer,sketch,popular-web-designs,excalidraw}/SKILL.md
```

Expected: 8 lines, each ending in `SKILL.md`, no `No such file or directory` errors.

- [ ] **Step 3: Confirm MIT license**

Run: `head -1 LICENSE`
Expected: `MIT License`

### Task 0.2: Engagement-state decision gate (Linear vs Airtable)

Before installing one, decide which to use. This is a non-code decision and gates Phase 3.

- [ ] **Step 1: Audit which tool Moray already uses personally**

Decision criteria (write the answer below in this file before proceeding to Phase 3):
- Existing Linear workspace? (Y/N)
- Existing Airtable base? (Y/N)
- Issues-and-projects shape preferred (Linear) or rows-and-fields shape preferred (Airtable)?
- Decision: **[ Linear | Airtable ]**

- [ ] **Step 2: Record decision in `~/.ivy-lab/consulting-stack.md`**

```bash
mkdir -p ~/.ivy-lab
cat >> ~/.ivy-lab/consulting-stack.md <<EOF
engagement_state_tool: <Linear|Airtable>
decided_on: 2026-05-16
EOF
```

### Task 0.3: API key inventory

Record which keys we need and confirm we have them (or know how to get them) before installing dependent skills.

- [ ] **Step 1: Confirm or capture keys**

For each row, check status and record in `~/.ivy-lab/consulting-stack.md`:

| Skill | Key needed | Where it comes from |
|---|---|---|
| linear | `LINEAR_API_KEY` | linear.app → Settings → API → Personal API keys |
| airtable | `AIRTABLE_PAT` | airtable.com/create/tokens (scoped PAT) |
| humanizer | none | — |
| ocr-and-documents | none | — |
| nano-pdf | none (local) | — |
| sketch | none | — |
| popular-web-designs | none | — |
| excalidraw | none | — |
| webreel | none (local) | — |
| knowledge-agent-template | `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, optional `AI_GATEWAY_API_KEY` | Phase 5 task |
| tersa | AI SDK Gateway creds | Phase 5 task |

Only Linear/Airtable need a key for Phase 3. Add to `.env` only when reaching Phase 3.

---

## Phase 1: Document intake + polish + workshop diagrams

Smallest installs, no API keys, immediate uplift on consulting workflow.

### Task 1.1: Install `ocr-and-documents` skill

**Files:**
- Create: `.claude/skills/ocr-and-documents/` (copied from Hermes)
- Modify: `.claude/skills/routing/SKILL.md` (add route entry)

- [ ] **Step 1: Copy skill into Lab**

```bash
cd /Users/ivyadmin/Ivy-Lab
cp -R ~/code/scratch/hermes-agent/skills/productivity/ocr-and-documents .claude/skills/
ls .claude/skills/ocr-and-documents/
```

Expected output: `SKILL.md`, `DESCRIPTION.md`, `scripts/`.

- [ ] **Step 2: Read `SKILL.md` to identify dependencies**

```bash
head -80 .claude/skills/ocr-and-documents/SKILL.md
```

Expected: instructions referencing `pymupdf` and/or `marker-pdf` and any shell scripts.

- [ ] **Step 3: Install Python dependencies in a Lab venv**

```bash
python3.11 -m venv ~/.ivy-lab/venv-ocr
source ~/.ivy-lab/venv-ocr/bin/activate
pip install pymupdf marker-pdf
deactivate
```

Expected: `Successfully installed ...` lines. Marker-pdf will pull a sizable model on first run — that's expected.

- [ ] **Step 4: Smoke test on a real PDF**

```bash
source ~/.ivy-lab/venv-ocr/bin/activate
mkdir -p /tmp/ocr-smoke
# Use any consulting PDF you have — annual report, prior deck, RFP.
cp ~/Downloads/some-client-doc.pdf /tmp/ocr-smoke/in.pdf || \
  curl -L -o /tmp/ocr-smoke/in.pdf https://www.berkshirehathaway.com/letters/2023ltr.pdf
python -c "import fitz; doc = fitz.open('/tmp/ocr-smoke/in.pdf'); print(f'{doc.page_count} pages, first-page chars: {len(doc[0].get_text())}')"
deactivate
```

Expected: a non-zero page count and a non-zero character count on the first page.

- [ ] **Step 5: Add a routing entry**

Edit `.claude/skills/routing/SKILL.md`. Find the "Document generation" section. Below it, add a new line under an existing related section:

```markdown
- **PDF intake / scanned doc OCR / messy real-world client PDFs** → `ocr-and-documents` skill (pymupdf for structured PDFs, marker-pdf for scans/messy layouts). Output: clean markdown preserving tables and headings.
```

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/ocr-and-documents .claude/skills/routing/SKILL.md
git commit -m "feat(skills): add ocr-and-documents from Hermes for client PDF intake"
```

### Task 1.2: Install `nano-pdf` skill

**Files:**
- Create: `.claude/skills/nano-pdf/`
- Modify: `.claude/skills/routing/SKILL.md`

- [ ] **Step 1: Copy skill**

```bash
cp -R ~/code/scratch/hermes-agent/skills/productivity/nano-pdf .claude/skills/
ls .claude/skills/nano-pdf/
```

Expected: `SKILL.md`, `DESCRIPTION.md`, maybe `scripts/`.

- [ ] **Step 2: Read SKILL.md to find install command**

```bash
head -60 .claude/skills/nano-pdf/SKILL.md
```

Identify the install line (likely `npm install -g nano-pdf` or similar — record exactly what it says).

- [ ] **Step 3: Install the CLI as documented**

Run the exact command found in Step 2. If it's `npm install -g nano-pdf`, run:

```bash
npm install -g nano-pdf
which nano-pdf && nano-pdf --version
```

Expected: a version string. If install fails, fall back to `npx nano-pdf` invocations in the skill.

- [ ] **Step 4: Smoke test natural-language edit on a copy of a PDF**

```bash
cp /tmp/ocr-smoke/in.pdf /tmp/nano-pdf-smoke.pdf
nano-pdf /tmp/nano-pdf-smoke.pdf --prompt "fix any typo in the title" --output /tmp/nano-pdf-out.pdf
ls -la /tmp/nano-pdf-out.pdf
```

Expected: an output PDF exists and is non-empty. (Exact CLI flags may differ — adjust to whatever `nano-pdf --help` reports.)

- [ ] **Step 5: Add routing entry**

Edit `.claude/skills/routing/SKILL.md`, add under document-generation related section:

```markdown
- **Last-mile PDF edits / typo fixes / title tweaks on already-rendered PDFs** → `nano-pdf` skill. Natural-language prompt edits a copy of the PDF without re-rendering the source.
```

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/nano-pdf .claude/skills/routing/SKILL.md
git commit -m "feat(skills): add nano-pdf for last-mile client-deliverable PDF edits"
```

### Task 1.3: Install `humanizer` skill

**Files:**
- Create: `.claude/skills/humanizer/`
- Modify: `.claude/skills/ivy-persona/SKILL.md` (add reference)

- [ ] **Step 1: Copy skill**

```bash
cp -R ~/code/scratch/hermes-agent/skills/creative/humanizer .claude/skills/
ls .claude/skills/humanizer/
```

Expected: `SKILL.md`, possibly `scripts/` and reference text-pattern files.

- [ ] **Step 2: Read SKILL.md for dependencies**

```bash
cat .claude/skills/humanizer/SKILL.md
```

Note any Python or Node deps. Many humanizer skills are pure prompt-pattern files — no install needed.

- [ ] **Step 3: Install deps if any**

Run whatever `SKILL.md` requires. If no deps, skip.

- [ ] **Step 4: Smoke test — humanize a short AI draft**

Create `/tmp/humanizer-smoke.txt` with a deliberately AI-flavoured paragraph:

```bash
cat > /tmp/humanizer-smoke.txt <<'EOF'
In today's rapidly evolving landscape, organizations must leverage cutting-edge solutions to unlock unprecedented value. By embracing transformative paradigms, leaders can navigate complexity and drive sustainable outcomes that deliver tangible business impact.
EOF
```

Follow the skill's invocation pattern (likely: "Read this through the humanizer skill" → it returns a rewritten version). Verify the rewrite drops the AI tells.

- [ ] **Step 5: Cross-reference from ivy-persona**

Open `.claude/skills/ivy-persona/SKILL.md`. Find the section on writing voice (search for "voice" or "tone"). Add at the end of that section:

```markdown
**Final-pass polish on long-form prose:** For proposals, exec summaries, and reports, run the draft through the `humanizer` skill before delivery. Removes AI tells (paradigm/leverage/transformative/cutting-edge), restores authentic voice.
```

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/humanizer .claude/skills/ivy-persona/SKILL.md
git commit -m "feat(skills): add humanizer for final-pass polish on consulting prose"
```

### Task 1.4: Install `excalidraw` skill

**Files:**
- Create: `.claude/skills/excalidraw/`
- Modify: `.claude/skills/routing/SKILL.md`

- [ ] **Step 1: Copy skill**

```bash
cp -R ~/code/scratch/hermes-agent/skills/creative/excalidraw .claude/skills/
ls .claude/skills/excalidraw/
```

- [ ] **Step 2: Read SKILL.md for output format**

```bash
cat .claude/skills/excalidraw/SKILL.md | head -100
```

Excalidraw skills typically generate `.excalidraw` JSON files — confirm that's the output. Note any CLI or library deps.

- [ ] **Step 3: Install deps if any**

Run whatever `SKILL.md` says. Usually none — Excalidraw JSON is plain JSON with no install needed.

- [ ] **Step 4: Smoke test — generate a simple flowchart**

Ask the skill to generate a 3-node flowchart (start → process → end) as Excalidraw JSON. Save to `/tmp/test.excalidraw`. Open in https://excalidraw.com (drag-drop file) and confirm it renders as a hand-drawn flowchart.

Expected: a hand-drawn-style diagram appears; the three nodes are connected with arrows.

- [ ] **Step 5: Update routing for "provisional/workshop-style diagrams"**

Edit `.claude/skills/routing/SKILL.md`. Find the line about Mermaid diagrams. Below it, add:

```markdown
- **Provisional / workshop-style diagrams (hand-drawn aesthetic, encourages client feedback)** → `excalidraw` skill. Use for scoping sessions and early operating-model sketches. Use Mermaid for polished final-deliverable diagrams.
```

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/excalidraw .claude/skills/routing/SKILL.md
git commit -m "feat(skills): add excalidraw for workshop-style provisional diagrams"
```

---

## Phase 2: Deliverable variants and brand-matching

### Task 2.1: Install `sketch` skill

**Files:**
- Create: `.claude/skills/sketch/`
- Modify: `.claude/skills/routing/SKILL.md`

- [ ] **Step 1: Copy skill**

```bash
cp -R ~/code/scratch/hermes-agent/skills/creative/sketch .claude/skills/
ls .claude/skills/sketch/
```

- [ ] **Step 2: Read SKILL.md for invocation pattern**

```bash
cat .claude/skills/sketch/SKILL.md | head -80
```

The skill generates 2-3 throwaway HTML variants for comparison. Note where it expects to save variants — typically `./sketches/` or a temp dir.

- [ ] **Step 3: Install deps if any**

Almost certainly none — this skill is prompt-pattern + HTML output.

- [ ] **Step 4: Smoke test — generate three exec-summary variants**

Invoke with a sample prompt: "Generate 3 variants of a one-page executive summary for a finance-transformation engagement. Target audience: CFO. Show: 1) data-dense, 2) narrative-led, 3) infographic-style."

Open each generated HTML in a browser. Confirm three visibly distinct shapes.

- [ ] **Step 5: Routing entry**

Edit `.claude/skills/routing/SKILL.md`. Add under the bespoke-HTML section:

```markdown
- **Proposal-stage "what shape should this deliverable take" decisions** → `sketch` skill. Generates 2-3 throwaway HTML variants side-by-side so the client can pick a shape before you build the final.
```

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/sketch .claude/skills/routing/SKILL.md
git commit -m "feat(skills): add sketch for proposal-stage deliverable-variant comparison"
```

### Task 2.2: Install `popular-web-designs` skill

**Files:**
- Create: `.claude/skills/popular-web-designs/`
- Modify: `.claude/skills/routing/SKILL.md`

- [ ] **Step 1: Copy skill**

```bash
cp -R ~/code/scratch/hermes-agent/skills/creative/popular-web-designs .claude/skills/
ls .claude/skills/popular-web-designs/
du -sh .claude/skills/popular-web-designs/
```

Expected: a sizable folder (~10s of MB) because it ships 54 reference design systems as HTML/CSS.

- [ ] **Step 2: Read SKILL.md for system catalog**

```bash
cat .claude/skills/popular-web-designs/SKILL.md | head -100
```

Confirm which design systems are present (e.g., Stripe, Linear, Vercel, Apple, GitHub).

- [ ] **Step 3: Smoke test — render an exec summary in three brand styles**

Generate the same exec summary in three different brand styles from the catalog (e.g., Stripe-style, Linear-style, Apple-style). Open each in a browser. Confirm clearly distinct visual languages.

- [ ] **Step 4: Routing entry**

Edit `.claude/skills/routing/SKILL.md`. Add:

```markdown
- **Client-brand-matching for HTML deliverables** → `popular-web-designs` skill (54 reference systems incl. Stripe, Linear, Apple, Vercel). Pair with `sketch` to produce brand-matched variants. Use the v4 design system (default) for Ivy-branded deliverables; switch to popular-web-designs only when the deliverable is for a specific client.
```

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/popular-web-designs .claude/skills/routing/SKILL.md
git commit -m "feat(skills): add popular-web-designs for client-brand-matched deliverables"
```

---

## Phase 3: Engagement state (Linear OR Airtable)

Gated by Task 0.2 decision. Skip the branch you didn't pick.

### Task 3.1a: Install `linear` skill (if Linear chosen)

**Files:**
- Create: `.claude/skills/linear/`
- Create: `pp-tools/linear-pp-cli/cli.mjs` (thin Bash wrapper)
- Modify: `pp-tools/INDEX.md`
- Modify: `.env` (LINEAR_API_KEY)

- [ ] **Step 1: Copy skill**

```bash
cp -R ~/code/scratch/hermes-agent/skills/productivity/linear .claude/skills/
ls .claude/skills/linear/
```

- [ ] **Step 2: Get and store the API key**

Visit `https://linear.app/settings/api`. Create a Personal API key. Add to Lab `.env`:

```bash
echo "LINEAR_API_KEY=lin_api_xxxxx" >> .env
chmod 600 .env
```

- [ ] **Step 3: Read SKILL.md to confirm invocation pattern**

```bash
cat .claude/skills/linear/SKILL.md | head -80
```

It almost certainly uses `curl` against `https://api.linear.app/graphql`. Note the exact GraphQL pattern.

- [ ] **Step 4: Smoke test — list my teams**

```bash
source .env
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ teams { nodes { id name } } }"}' | jq '.data.teams.nodes'
```

Expected: a JSON array of teams with `id` and `name`. If empty, you have no teams yet — create one in Linear UI.

- [ ] **Step 5: Scaffold a `linear-pp-cli` Bash wrapper**

Create `pp-tools/linear-pp-cli/cli.mjs` following the pattern in `pp-tools/reddit-pp-cli/cli.mjs`. Minimal subcommands: `issues`, `issue`, `create`, `doctor`. Each command outputs JSON.

Reference pattern (from reddit-pp-cli, lifted exactly):
- Entry: `#!/usr/bin/env node`, argv parsing, `--agent` flag short-circuits to `--json --compact --no-input --no-color --yes`.
- HTTP via Node `fetch`.
- Errors output `{"error":true,"command":"...","message":"..."}` to stderr and exit 2.

Initial `issues` subcommand:

```javascript
async function issues({ team, limit = 50 }) {
  const q = `{ team(id:"${team}") { issues(first:${limit}) { nodes { id identifier title state { name } assignee { name } } } } }`;
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Authorization': process.env.LINEAR_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q })
  });
  const j = await res.json();
  return j.data.team.issues.nodes;
}
```

- [ ] **Step 6: Add executable symlink**

```bash
chmod +x pp-tools/linear-pp-cli/cli.mjs
mkdir -p ~/.local/bin
ln -sf "$PWD/pp-tools/linear-pp-cli/cli.mjs" ~/.local/bin/linear-pp-cli
linear-pp-cli doctor
```

Expected: `doctor` reports key-present and a sample API call succeeds.

- [ ] **Step 7: Smoke test — list issues from a real team**

```bash
linear-pp-cli issues --team <TEAM_ID> --limit 5 --agent | jq '.[].identifier'
```

Expected: 5 issue identifiers (or fewer if team has <5).

- [ ] **Step 8: Update `pp-tools/INDEX.md`**

Edit `pp-tools/INDEX.md`. Add a new section after `reddit-pp-cli` documenting `linear-pp-cli` following the existing format (binary path, version, what it does, subcommand reference, common invocation patterns, when-to-use vs other tools).

- [ ] **Step 9: Commit**

```bash
git add .claude/skills/linear pp-tools/linear-pp-cli pp-tools/INDEX.md
git commit -m "feat(pp-tools): linear-pp-cli — engagement state for consulting workflow"
```

### Task 3.1b: Install `airtable` skill (if Airtable chosen)

**Files:**
- Create: `.claude/skills/airtable/`
- Create: `pp-tools/airtable-pp-cli/cli.mjs`
- Modify: `pp-tools/INDEX.md`
- Modify: `.env` (`AIRTABLE_PAT`)

- [ ] **Step 1: Copy skill**

```bash
cp -R ~/code/scratch/hermes-agent/skills/productivity/airtable .claude/skills/
```

- [ ] **Step 2: Get and store the API key**

Visit `https://airtable.com/create/tokens`. Create a scoped personal access token with `data.records:read`, `data.records:write`, `schema.bases:read` on the base you'll use for engagement tracking. Add:

```bash
echo "AIRTABLE_PAT=patxxxxx" >> .env
echo "AIRTABLE_BASE_ID=appxxxxx" >> .env
```

- [ ] **Step 3: Read SKILL.md for the REST patterns**

```bash
cat .claude/skills/airtable/SKILL.md | head -80
```

- [ ] **Step 4: Smoke test — list base tables**

```bash
source .env
curl -s "https://api.airtable.com/v0/meta/bases/$AIRTABLE_BASE_ID/tables" \
  -H "Authorization: Bearer $AIRTABLE_PAT" | jq '.tables[] | {id, name}'
```

Expected: a JSON list of tables in the base.

- [ ] **Step 5: Scaffold `airtable-pp-cli`**

Same shape as Task 3.1a Step 5 but pointing at `https://api.airtable.com/v0/`. Minimum subcommands: `list-tables`, `records`, `create`, `update`, `doctor`.

- [ ] **Step 6-9: Same shape as Linear** (symlink, smoke test, INDEX.md, commit)

```bash
git add .claude/skills/airtable pp-tools/airtable-pp-cli pp-tools/INDEX.md
git commit -m "feat(pp-tools): airtable-pp-cli — engagement state for consulting workflow"
```

---

## Phase 4: Demo recording (`webreel`)

### Task 4.1: Install `webreel` globally

**Files:**
- No skill copy (webreel is a Vercel-Labs npm CLI, not a Hermes skill)
- Create: `pp-tools/webreel-pp-cli/` (thin wrapper for Lab consistency)
- Modify: `pp-tools/INDEX.md`

- [ ] **Step 1: Install the CLI globally**

```bash
npm install -g webreel
which webreel && webreel --version
```

Expected: a version string. On first run it will fetch Chrome + ffmpeg to `~/.webreel`.

- [ ] **Step 2: Run `webreel init` for a test script**

```bash
mkdir -p /tmp/webreel-smoke && cd /tmp/webreel-smoke
npx webreel init --name smoke-test --url https://example.com
ls
```

Expected: a JSON config file (likely `smoke-test.json` or similar) describing initial steps.

- [ ] **Step 3: Record a 5-second demo**

```bash
cd /tmp/webreel-smoke
npx webreel record
ls *.mp4
```

Expected: an MP4 file. Open it — should show the headless browser navigating example.com.

- [ ] **Step 4: Scaffold `webreel-pp-cli` wrapper**

Why wrap a global CLI? Lab convention — every external tool gets a thin `*-pp-cli` wrapper so:
- Mirror writes via `scripts/audit-and-mirror.js` work uniformly.
- `--agent` flag normalizes output for agent consumption.
- The user/agent can `webreel-pp-cli doctor` to check end-to-end health.

Minimum subcommands: `init`, `record`, `doctor`. Each just shells through to `webreel` with `--agent` setting standard flags.

Create `pp-tools/webreel-pp-cli/cli.mjs`. Skeleton:

```javascript
#!/usr/bin/env node
import { execSync } from 'node:child_process';
const [, , cmd, ...rest] = process.argv;
const args = rest.join(' ');
try {
  const out = execSync(`webreel ${cmd} ${args}`, { stdio: 'inherit' });
  process.exit(0);
} catch (e) {
  console.error(JSON.stringify({ error: true, command: `webreel ${cmd}`, message: e.message }));
  process.exit(2);
}
```

- [ ] **Step 5: Symlink**

```bash
chmod +x pp-tools/webreel-pp-cli/cli.mjs
ln -sf "$PWD/pp-tools/webreel-pp-cli/cli.mjs" ~/.local/bin/webreel-pp-cli
webreel-pp-cli doctor || webreel-pp-cli --version
```

- [ ] **Step 6: Update `pp-tools/INDEX.md`**

Add a section documenting `webreel-pp-cli` after `careers-sniffer-pp-cli` with: what it does, when to use, common invocation pattern (init → edit JSON → record), and a note that it's a wrapper around the upstream Vercel `webreel` CLI (Apache-2.0).

- [ ] **Step 7: Add routing entry**

Edit `.claude/skills/routing/SKILL.md`. Add:

```markdown
- **Record a scripted browser demo as MP4 for client delivery** → `webreel-pp-cli` (wraps Vercel `webreel`). Define steps as JSON (clicks, types, scrolls), get a deterministic MP4. Use for: tool walkthroughs, "here's how the new workflow runs" videos, training content.
```

- [ ] **Step 8: Commit**

```bash
git add pp-tools/webreel-pp-cli pp-tools/INDEX.md .claude/skills/routing/SKILL.md
git commit -m "feat(pp-tools): webreel-pp-cli — scripted browser demos for client deliveries"
```

---

## Phase 5: Heavy bets — evaluation spikes (not direct installs)

Both `knowledge-agent-template` and `tersa` are full Next.js apps. They do not get committed to the Lab. Each gets a time-boxed evaluation spike that ends in a documented decision.

### Task 5.1: Evaluate `knowledge-agent-template`

**Files:**
- Create: `~/code/scratch/knowledge-agent-template/` (clone, scratch, outside Lab)
- Create: `docs/superpowers/specs/2026-05-16-knowledge-agent-evaluation.md` (decision doc)

**Time-box:** 4 hours. If not running locally with one query answered against a sample knowledge base in that time, write up the blocker and shelve.

- [ ] **Step 1: Clone outside Lab**

```bash
mkdir -p ~/code/scratch && cd ~/code/scratch
git clone https://github.com/vercel-labs/knowledge-agent-template.git
cd knowledge-agent-template
```

- [ ] **Step 2: Read README and `apps/app/.env.example`**

```bash
cat README.md
cat apps/app/.env.example
```

Identify exact required env vars.

- [ ] **Step 3: Provision keys**

- `BETTER_AUTH_SECRET`: `openssl rand -base64 32`
- `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`: create a GitHub OAuth App at `https://github.com/settings/applications/new`. Callback URL: `http://localhost:3000/api/auth/callback/github`.
- `AI_GATEWAY_API_KEY` (optional locally): create at Vercel dashboard if you have an account.

```bash
cp apps/app/.env.example apps/app/.env
# Open in editor and fill in the three required values
```

- [ ] **Step 4: Install and run**

```bash
bun install
bun run dev
```

Expected: app starts at `http://localhost:3000`. Open in browser, complete GitHub OAuth.

- [ ] **Step 5: Seed with a sample knowledge base**

Create a `~/code/scratch/consulting-kb-sample/` with 3-5 markdown files representing prior consulting work — e.g., one anonymized case study, one methodology note, one client-type pattern observation. Point the agent at this directory.

- [ ] **Step 6: Run the acceptance query**

Ask the agent: "What have I previously worked on involving finance transformation?" Confirm it surfaces content from the seeded markdown files with citations.

- [ ] **Step 7: Write the decision doc**

Create `docs/superpowers/specs/2026-05-16-knowledge-agent-evaluation.md`. Sections:
- **Setup time:** actual hours to running.
- **Acceptance query result:** copy-paste the answer.
- **MCP gap:** Lab is MCP-heavy, knowledge-agent-template uses AI SDK directly. Document what would need bridging.
- **Decision:** one of three:
  - **Adopt as-is** — run alongside Lab, talk to it via HTTP from pp-tools.
  - **Fork and adapt** — extract the agent-loop pattern into Lab as a new skill/pp-tool.
  - **Shelve** — note why and what would change that decision.

- [ ] **Step 8: Commit the decision doc**

```bash
cd /Users/ivyadmin/Ivy-Lab
git add docs/superpowers/specs/2026-05-16-knowledge-agent-evaluation.md
git commit -m "docs(specs): evaluation outcome for knowledge-agent-template adoption"
```

### Task 5.2: Evaluate `tersa`

**Files:**
- Create: `~/code/scratch/tersa/`
- Create: `docs/superpowers/specs/2026-05-16-tersa-evaluation.md`

**Time-box:** 2 hours. Tersa has no auth/DB requirements — should run faster than knowledge-agent-template.

- [ ] **Step 1: Clone outside Lab**

```bash
cd ~/code/scratch
git clone https://github.com/vercel-labs/tersa.git
cd tersa
cat README.md
```

- [ ] **Step 2: Configure**

```bash
pnpm install
cp .env.example .env.local
# Fill in AI SDK Gateway / provider keys
```

- [ ] **Step 3: Run**

```bash
pnpm dev
```

Open `http://localhost:3000`. Confirm the canvas loads.

- [ ] **Step 4: Build a sample workflow**

Drag-and-drop a 3-node pipeline: input → LLM transform → output. Run it once. Confirm output renders.

- [ ] **Step 5: Acceptance test — "could I show this to a client?"**

Specifically: would the canvas render of an agent topology be a useful artifact in a proposal/scoping conversation? Yes/no with one paragraph of reasoning.

- [ ] **Step 6: Decision doc**

Create `docs/superpowers/specs/2026-05-16-tersa-evaluation.md`. Sections:
- **Setup time.**
- **Sample workflow screenshot** (paste link to local file or attach).
- **Client-conversation value:** would it land in a real proposal? Quote your reasoning.
- **Decision:** Use ad-hoc during proposals / Stand up dedicated instance per client / Shelve.

- [ ] **Step 7: Commit**

```bash
cd /Users/ivyadmin/Ivy-Lab
git add docs/superpowers/specs/2026-05-16-tersa-evaluation.md
git commit -m "docs(specs): evaluation outcome for tersa adoption"
```

---

## Phase 6: Index updates

After phases 1-4 complete, the routing skill knows about the new skills but the high-level Lab docs don't.

### Task 6.1: Update routing catalogue

**Files:**
- Modify: `.claude/skills/routing/catalogue.md` (if it lists skills the agent should know about)
- Modify: `CLAUDE.md` (project-level)

- [ ] **Step 1: Audit `.claude/skills/routing/catalogue.md`**

```bash
grep -c "^- " .claude/skills/routing/catalogue.md
head -40 .claude/skills/routing/catalogue.md
```

Confirm format. Add entries for: ocr-and-documents, nano-pdf, humanizer, excalidraw, sketch, popular-web-designs, linear OR airtable.

- [ ] **Step 2: Add consulting-stack section to project `CLAUDE.md`**

Edit `/Users/ivyadmin/Ivy-Lab/CLAUDE.md`. After the "Skills you should know about" section, append:

```markdown
## Consulting stack (2026-05-16)

For consulting-workflow tasks (client PDFs, deliverable drafts, engagement tracking):
- Document intake: `ocr-and-documents` skill (marker-pdf for messy/scanned PDFs).
- Document polish: `humanizer` skill, then `nano-pdf` for last-mile edits.
- Deliverable variants: `sketch` (3 HTML shapes), `popular-web-designs` (54 brand systems).
- Workshop diagrams: `excalidraw` (provisional) → Mermaid (polished).
- Engagement state: `linear-pp-cli` or `airtable-pp-cli` (whichever was picked in Phase 0).
- Demo videos: `webreel-pp-cli` (scripted browser → MP4).

For deeper engagement learning (knowledge base of prior work) and visual workflow proposals, see the evaluation docs at `docs/superpowers/specs/2026-05-16-knowledge-agent-evaluation.md` and `docs/superpowers/specs/2026-05-16-tersa-evaluation.md`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md .claude/skills/routing/catalogue.md
git commit -m "docs: index the consulting stack in CLAUDE.md and routing catalogue"
```

### Task 6.2: Open a PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin chore/post-phase-5-polish
```

(Or create a dedicated branch first if `chore/post-phase-5-polish` has other in-flight work.)

- [ ] **Step 2: Open PR with `gh`**

```bash
gh pr create --title "feat: consulting stack adoption (8 picks from Hermes + Vercel Labs)" --body "$(cat <<'EOF'
## Summary
- Adopt 6 Hermes skills (`ocr-and-documents`, `nano-pdf`, `humanizer`, `excalidraw`, `sketch`, `popular-web-designs`) into `.claude/skills/`.
- Adopt one of `linear` or `airtable` (decision recorded in `~/.ivy-lab/consulting-stack.md`) for engagement state.
- Wrap Vercel `webreel` as `pp-tools/webreel-pp-cli/` for scripted demo recordings.
- Evaluate `knowledge-agent-template` (Vercel) and `tersa` (Vercel) — decision docs in `docs/superpowers/specs/`.

## Test plan
- [ ] `ocr-and-documents` runs against a real client PDF, produces clean markdown.
- [ ] `nano-pdf` makes a typo-fix edit on a sample PDF.
- [ ] `humanizer` rewrites an AI-flavoured paragraph and the rewrite passes a "would I send this to a client" smell test.
- [ ] `excalidraw` generates a 3-node flowchart that renders in excalidraw.com.
- [ ] `sketch` produces three visibly distinct exec-summary variants.
- [ ] `popular-web-designs` renders the same content in Stripe vs Linear vs Apple styles.
- [ ] `linear-pp-cli doctor` or `airtable-pp-cli doctor` passes.
- [ ] `webreel-pp-cli` records a 5-second MP4.
- [ ] Decision docs exist for knowledge-agent-template and tersa.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review check

**Spec coverage:**
- ✓ Layer 1 (Engagement state) → Phase 3 (Task 3.1a/b)
- ✓ Layer 2 (Engagement learning) → Phase 5 Task 5.1
- ✓ Layer 3 (Document intake) → Phase 1 Task 1.1
- ✓ Layer 4 (Document polish) → Phase 1 Tasks 1.2 + 1.3
- ✓ Layer 5 (Deliverable variants) → Phase 2 Tasks 2.1 + 2.2
- ✓ Layer 6 (Demo recording) → Phase 4 Task 4.1
- ✓ Layer 7 (Workshop diagrams) → Phase 1 Task 1.4
- ✓ Layer 8 (Visual workflow proposals) → Phase 5 Task 5.2

**Placeholder scan:** No "TBD" / "implement later" — every step has exact commands, paths, and expected output.

**Type consistency:** Skill paths (`.claude/skills/<name>/`) and pp-tool paths (`pp-tools/<name>-pp-cli/cli.mjs`) consistent throughout. Wrapper subcommand surface (`doctor` minimum, `--agent` flag everywhere) consistent with existing `reddit-pp-cli` / `careers-sniffer-pp-cli` patterns.

**Known uncertainties (documented inline as Step 2 "read SKILL.md" prompts):**
- Exact dep list per Hermes skill — read from each `SKILL.md` at execution time. Plan assumes pymupdf + marker-pdf for ocr; nano-pdf as a CLI; humanizer as pure prompts (no deps).
- nano-pdf invocation flags — read `nano-pdf --help` at execution.
- Linear/Airtable choice — Phase 0 Task 0.2 gates Phase 3.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-16-consulting-stack-adoption.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
