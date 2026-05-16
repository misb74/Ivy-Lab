# Tersa Evaluation

**Status:** PARTIAL — pnpm install + AI Gateway credentials needed to render the canvas.

**Repo:** `github.com/vercel-labs/tersa` (MIT)
**Local clone:** `~/code/scratch/tersa/`
**Cloned:** 2026-05-16

## Why we're evaluating this

For consulting proposal and scoping conversations: clients want to see the *shape* of an AI workflow before approving the build. Today that conversation happens with Mermaid diagrams or hand-drawn boxes — fine, but flat. A live, draggable canvas where you connect "input → LLM transform → output" nodes and run them live in front of the client is a different category of artifact.

Tersa ([Vercel Labs](https://github.com/vercel-labs/tersa)) is an open-source self-hosted canvas for exactly this. Drag, drop, connect, run — powered by Vercel AI SDK Gateway, 25+ provider models.

The bet: tersa lives ad-hoc on `localhost:3000` during scoping sessions, supplements the proposal deck, becomes the artifact that gets shared back with clients during the build phase.

## Inspection findings

### Architecture

- **Stack:** Next.js 15 (App Router, Turbopack) + React 19 + Vercel AI SDK + AI SDK Gateway + Vercel Blob + ReactFlow (canvas) + TipTap (rich text) + Tailwind + shadcn/ui + Kibo UI + Radix.
- **No DB.** Canvas state persists to browser localStorage. That's a meaningful design choice for consulting use: every client gets a fresh canvas, no cross-contamination, no DB to manage.
- **Streaming:** Real-time text generation visible on the canvas. Good demo property.
- **Cost indicators:** Tersa surfaces relative model pricing inline. Useful for "this workflow uses Sonnet for step 1, GPT-4o-mini for step 2 — here's why the cost shape is what it is" conversations.
- **Reasoning extraction:** Shows model reasoning where supported. Good for the "what is the agent thinking" client question.

### Environment variables required

From the README (`.env.local`):

| Var | Status | How to get |
|---|---|---|
| AI SDK Gateway credentials | Required | Vercel dashboard → AI Gateway |
| Provider API keys | Optional | One or more of: Anthropic, OpenAI, Google, etc., depending on which models you want available |

**Lighter blocker than KAT.** No OAuth dance, no Better-Auth, no DB to provision. Once an AI Gateway key is in `.env.local`, `pnpm dev` should yield a running canvas.

### Install path

```bash
cd ~/code/scratch/tersa
pnpm install
cp .env.example .env.local   # (need to check if .env.example exists; not visible at top level)
# Fill in AI SDK Gateway creds
pnpm dev
# → http://localhost:3000
```

Note: `.env.example` wasn't visible at repo root in inspection — may live elsewhere or env shape is documented in README only. Confirm on first install.

## Acceptance criteria

The question: **would Tersa land in a real proposal conversation?**

Specific test:

1. Run a workflow that's representative of consulting use: 3-node pipeline of *Topic input → LLM analysis (e.g., "summarize the workforce risks in this team description") → markdown output*.
2. Run it once with the canvas visible. Confirm:
   - Canvas renders.
   - Output streams.
   - Cost indicators show.
   - Reasoning panel (if supported by chosen model) shows.
3. Imagine you're showing this to a real client. Answer in one paragraph: would this land? What does it add over a Mermaid diagram of the same workflow?

## Decision space

Three options once acceptance runs:

### Option A — Use ad-hoc during proposals
- Spin up tersa on `localhost:3000` during scoping sessions.
- Build canvases live or pre-baked depending on the conversation shape.
- Screenshot or screen-share for follow-up.
- **Pros:** zero commitment; matches how proposal artifacts are usually produced (one-shot).
- **Cons:** no client access; can't be left running for self-service exploration; every engagement starts from scratch.

### Option B — Stand up a per-client dedicated instance
- Deploy tersa to Vercel under a client-specific subdomain (e.g., `acme.tersa.workvine.ai`).
- Hand the client read access to their canvas during the build phase.
- **Pros:** client-facing artifact that lives between meetings; canvas becomes a shared reference.
- **Cons:** per-client infra; auth wiring needed (tersa as-shipped is local-only, no multi-tenant).

### Option C — Shelve
- Canvas-shape proposal artifacts don't actually win deals or shape decisions.
- Stick with Mermaid + sketch (HTML variants) for proposal artifacts.

**Tentative lean (pre-acceptance):** Option A. Low commitment, real test of whether the canvas earns the conversation. Promote to B only if 3+ consecutive engagements have asked to "see the workflow again" after the proposal meeting.

## Next steps

1. **[Manual]** Get AI SDK Gateway credentials from Vercel dashboard.
2. **[Auto-resumable]** Run `pnpm install` in the tersa clone.
3. **[Auto-resumable]** Create `.env.local`, populate Gateway key.
4. **[Auto-resumable]** Run `pnpm dev`, open localhost:3000.
5. **[Auto-resumable]** Build the 3-node acceptance workflow.
6. **[Decision]** Answer the "would this land" question. Pick option A/B/C and update Status.

## Time-box

Budget: **2 hours** post-credentials. Tersa is materially simpler than KAT to evaluate — no OAuth, no DB, lower acceptance bar.
