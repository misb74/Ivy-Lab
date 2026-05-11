# Printing Press CLI Index — Lab

Agent-readable catalogue of installed PP CLIs. Loaded by project `CLAUDE.md` via `@pp-tools/INDEX.md`.

When the agent needs to do company research, fundraising lookups, or compound queries that combine SEC + GitHub + HN data — prefer `company-goat-pp-cli` Bash invocations over MCP tool chains. The piping pattern is the token-economics win.

**Always pass `--agent`** to any company-goat-pp-cli command in agent contexts. It sets `--json --compact --no-input --no-color --yes` together — non-interactive, machine-parseable output, no progress noise.

---

## `printing-press` — meta-CLI for generating new tools

**Binary:** `/Users/moraybrown/go/bin/printing-press` (or `printing-press` if `~/go/bin` is on PATH).
**Version:** 4.2.1.
**Slash command:** `/printing-press <api-name>` from inside Claude Code.

**What it does:** generates a new `<api>-pp-cli` plus `<api>-pp-mcp` for any API or website. Reads docs, sniffs traffic, applies the agent-native CLI playbook.

**Use when:** the user asks for a CLI to talk to an API we don't already have a tool for. Otherwise route to existing MCP / library CLI.

---

## `company-goat-pp-cli` — multi-source startup intel

**Binary:** `/Users/moraybrown/go/bin/company-goat-pp-cli` (or `company-goat-pp-cli` if `~/go/bin` is on PATH).
**Version:** 1.0.0.
**Killer feature:** SEC Form D fundraising data, free. Crunchbase Pro charges $999/year for what's substantially the same source.

**Sources** (one CLI fans out across all seven in parallel):
- SEC EDGAR (Form D filings, broader full-text fallback for non-Form-D)
- GitHub (`engineering` — repo count, contributors, top repos)
- Hacker News via Algolia (`mentions`, `launches` — timeline + Show HN posts)
- Companies House UK (`legal --region uk`)
- Y Combinator directory (`yc`)
- Wikidata SPARQL (`wiki`)
- RDAP / DNS (`domain`)

**Coverage limits:** US private companies raising priced rounds via Reg D show up in `funding`. Pre-Series-A SAFE / convertible-note startups don't (no Form D filed). Non-US use `legal --region uk`.

**Auth (optional):**
- `GITHUB_TOKEN` raises GitHub rate limit from 60/hr → 5000/hr.
- `COMPANIES_HOUSE_API_KEY` required for UK queries (otherwise `legal --region uk` errors).

**Disambiguation:** Common company names are ambiguous. The CLI returns numbered candidates. Either:
- Use `--pick N` to select index N from the candidate list, or
- Use `--agent` (which auto-picks the top result deterministically).

**Built-in sync:** `company-goat-pp-cli sync` mirrors the data plane to its own local SQLite. Use this for repeated queries instead of hitting upstream every time.

### Subcommand reference

| Subcommand | What it does |
|---|---|
| `snapshot` | Fan out all 7 sources in parallel, render unified summary. **Headline command for "tell me about company X".** |
| `funding` | SEC EDGAR Form D filings. Killer feature for US private fundraising. |
| `funding --who 'Name'` | Every Form D filing naming a person. Serial-founder graph. |
| `funding-trend` | Time series of filings showing fundraising cadence over years. |
| `engineering` | GitHub org metadata: repo count, contributors, commit cadence, top languages. |
| `mentions` | Hacker News mention timeline + top N stories by points (Algolia full-text). |
| `launches` | Show HN posts about a company, sorted by points. |
| `legal` | Legal entity lookup (UK via Companies House, US via SEC EDGAR issuer fields). |
| `wiki` | Wikidata facts: founded date, founders, HQ, industry, key people. |
| `yc` | YC directory entry if backed: batch, status, location, description. |
| `domain` | Domain age via RDAP/WHOIS, DNS records, CNAME-based hosting hint. |
| `signal` | Cross-source consistency check. Flags suspicious patterns. |
| `sync` | Sync data to local SQLite for offline search and analysis. |
| `compare` | Align two snapshots column-by-column for direct comparison. |
| `doctor` | Health check — verify auth and connectivity. |
| `agent-context` | Emit structured JSON describing this CLI for agents (self-introspection). |

### Common invocation patterns

```bash
# Full snapshot (recommended default for company research)
company-goat-pp-cli snapshot stripe --agent

# Form D fundraising
company-goat-pp-cli funding stripe --pick 1 --agent

# Funding cadence over time
company-goat-pp-cli funding-trend stripe --pick 1 --agent --since 2018

# Serial-founder graph
company-goat-pp-cli funding --who 'Patrick Collison' --agent

# GitHub org details
company-goat-pp-cli engineering stripe --pick 1 --agent

# HN mention timeline
company-goat-pp-cli mentions stripe --agent

# UK Ltd / PLC entity (requires COMPANIES_HOUSE_API_KEY)
company-goat-pp-cli legal monzo --region uk --agent

# Domain RDAP / DNS
company-goat-pp-cli domain stripe.com --agent
```

### Output shape (funding subcommand with --agent)

```json
{
  "company": "stripe.com",
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
  "coverage_note": null,
  "fallback_signals": []
}
```

If `filings` is empty, `coverage_note` explains why and `fallback_signals` includes broader EDGAR search hits binned by signal class (subsidiary listings in 10-K Item 21, venture-debt holdings in 10-Q/10-K, M&A 8-Ks).

### When to use this vs MCP tools

- **Use company-goat:** company research, fundraising, founder graph, multi-source compound queries spanning SEC + GitHub + HN.
- **Use existing MCP:** workforce-specific intel (talent sourcing → `talent_search_profiles`, hiring trends → `data-revelio`, etc.).
- **Combine via Bash pipe** for compound queries: `company-goat-pp-cli funding stripe --pick 1 --agent | jq '.filings[].related_persons[].name' | sort -u | head -20` → get founders, then `talent_enrich_profile` on the names.

---

## `google-places-pp-cli` — restaurant / place discovery via Google Places API

**Binary:** `/Users/moraybrown/.local/bin/google-places-pp-cli` (symlink → `pp-tools/google-places-pp-cli/cli.mjs`).
**Version:** 0.1.0.
**What it does:** thin Bash-pipeable wrapper around Google Places API (New) — text search, nearby search, place details, autocomplete. JSON in, JSON out, pipe to `jq`.

**Why this exists:** `table-reservation-goat-pp-cli` knows what's bookable on OpenTable / Tock; `google-places-pp-cli` knows what exists at all and how good it is (rating, review count, hours, cuisine, price level). Use them together — Places for discovery, table-reservation-goat for availability/booking.

**Auth (required):** `GOOGLE_PLACES_API_KEY` in env or `./.env`. Google Cloud billing must be enabled (free tier: ~6K text searches/month against the $200 credit).

**Output:** always JSON. There is no human-formatted mode in v0.1 — pipe to `jq` for any pretty rendering.

### Subcommand reference

| Subcommand | What it does |
|---|---|
| `search <query>` | Text search — `"italian soho london"`. Optional `--lat/--lng/--radius` for location bias, `--open-now`, `--min-rating`, `--price`, `--type`. |
| `nearby` | Nearby search by `--lat/--lng/--radius` (required). Filters by `--type` (e.g. `restaurant`, `italian_restaurant`). |
| `details <place-id>` | Full record for one place. Place ID format: `ChIJ...` or `places/ChIJ...`. |
| `autocomplete <query>` | Typeahead suggestions, optionally biased by `--lat/--lng`. |
| `doctor` | Verify API key works and the API is reachable. |

### Common invocation patterns

```bash
# Top-rated open Italian places in Soho, sorted by rating
google-places-pp-cli search "italian soho london" --limit 10 --open-now \
  | jq -r '.places | sort_by(-.rating) | .[] | "\(.rating)★ (\(.userRatingCount)) — \(.displayName.text) — \(.formattedAddress)"'

# Nearby restaurants within 300m of a point
google-places-pp-cli nearby --lat 51.5145 --lng -0.1380 --radius 300 --type restaurant --limit 20

# Get phone, website, hours for a specific place
google-places-pp-cli details ChIJxwkosSwbdkgRfgcMvtjrhnw

# Cross-reference Google Places discovery → OpenTable availability
google-places-pp-cli search "ramen new york" --lat 40.72 --lng -74.0 --min-rating 4.5 \
  | jq -r '.places[].displayName.text' \
  | while read name; do table-reservation-goat-pp-cli goat "$name" --metro new-york --limit 1 --agent; done
```

### Field masks

The Places API requires an `X-Goog-FieldMask` header. The CLI sets sensible defaults per subcommand; override with `--fields "places.id,places.displayName"` etc. for tighter responses (cheaper + smaller).

### When to use this vs other tools

- **Use google-places:** "find me restaurants matching X" / "what's near here" / "is this place any good" / "what are this place's hours" / "phone number / website / map link for X".
- **Use table-reservation-goat:** "is this place bookable tonight at 8pm" / "watch for cancellations" / "book a table".
- **Combine:** Places to discover → table-reservation-goat to check availability → google-places `details` to get phone/website if booking falls through.

---

## `jobposting-schema-pp-cli` — schema.org JobPosting JSON-LD extractor

**Binary:** `/Users/moraybrown/.local/bin/jobposting-schema-pp-cli` (symlink → `pp-tools/jobposting-schema-pp-cli/cli.mjs`).
**Version:** 0.1.0.
**What it does:** fetches public career pages, extracts schema.org `JobPosting` blocks from `<script type="application/ld+json">` tags, normalizes to a unified shape. No auth, no API key — relies on data employers already publish for Google for Jobs SEO.

**Coverage reality (read this):** works on sites that ship JSON-LD **server-side**. That includes USAJobs, most government job pages, classic-CMS career sites, and any employer that takes Google for Jobs SEO seriously. **Does NOT work** on most 2026-era SPA career sites (Greenhouse `job-boards.greenhouse.io`, Stripe, Apple, Microsoft, LinkedIn, etc.) — those hydrate JSON-LD client-side, so a server-side fetch returns 0 blocks. For those, route to `ats-surface-pp-cli` (when built) or the upstream ATS API directly.

### Subcommand reference

| Subcommand | What it does |
|---|---|
| `extract <url>` | Fetch one URL, extract JobPosting JSON-LD blocks, normalize. |
| `sitemap <url>` | Fetch a sitemap.xml, scan each URL for JobPosting blocks. Bounded concurrency. Detects sitemap-of-sitemaps and returns nested URLs to scan separately. |
| `discover <domain>` | Probe common career-page paths (`/sitemap.xml`, `/careers`, `/jobs`, etc.) and report HTTP status — useful for finding the right sitemap before running `sitemap`. |
| `doctor` | Health check. |

### Common invocation patterns

```bash
# Extract one job (USAJobs example — known to ship JSON-LD)
jobposting-schema-pp-cli extract https://www.usajobs.gov/job/856555200 \
  | jq '.jobs[] | {title, location, salary, datePosted}'

# Find a careers sitemap before scanning
jobposting-schema-pp-cli discover example.com \
  | jq '.candidates[] | select(.status==200)'

# Scan a sitemap, filter to remote-only roles
jobposting-schema-pp-cli sitemap https://example.com/jobs/sitemap.xml --limit 100 \
  | jq '[.jobs[] | select(.remote)] | length'

# Raw mode (full JSON-LD record, not normalized)
jobposting-schema-pp-cli extract https://www.usajobs.gov/job/856555200 --raw
```

### Output shape (normalized)

```json
{
  "title": "Registered Nurse - PACT",
  "company": null,
  "location": "Kansas City, MO",
  "remote": false,
  "employmentType": "OTHER",
  "datePosted": "02/05/2026",
  "validThrough": "2026-02-13",
  "salary": { "currency": "USD", "value": 68432, "unit": "YEAR" },
  "description": "Kansas City VA Medical Center is hiring three (3) Registered Nurse - PACT...",
  "url": "https://www.usajobs.gov/job/856555200",
  "source": "https://www.usajobs.gov/job/856555200"
}
```

Errors come back as `{"error": true, "command": "...", "message": "..."}` and exit 2 — clean for agent consumption.

### When to use this vs other tools

- **Use jobposting-schema:** any non-ATS career page (custom CMS, government, smaller employers), or as a fallback when you don't know what platform a careers site uses.
- **Use ats-surface (TBD):** Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee, Gem — these have structured public APIs that return more data, faster, more reliably.
- **Combine:** `discover` to find the sitemap, then `sitemap` to bulk-extract, then pipe to `jq` for skill / location / salary analysis.

---

## `ats-surface-pp-cli` — unified job-board API CLI across 6 ATSes

**Binary:** `/Users/moraybrown/.local/bin/ats-surface-pp-cli` (symlink → `pp-tools/ats-surface-pp-cli/cli.mjs`).
**Version:** 0.1.0.
**What it does:** one CLI, one normalized shape, six public job-board APIs fanned out in parallel. Greenhouse + Lever + Ashby + SmartRecruiters + Workable + Recruitee. No auth, no API key — every endpoint here is the vendor's documented public API.

**Why this exists:** each ATS publishes a different endpoint, different field names, different response shape. Comparing AI/ML hiring across Anthropic (Greenhouse), Ashby (Ashby), and Visa (SmartRecruiters) used to mean three different fetches, three different parsers. Now: one `scan greenhouse:anthropic ashby:Ashby smartrecruiters:Visa` call, one unified JSON output, pipe to `jq`.

**Complement to:** `jobposting-schema-pp-cli` (covers non-ATS career sites where JSON-LD is server-rendered).

### Supported ATSes

| ATS | Slug = | Doc |
|---|---|---|
| `greenhouse` | board token (e.g. `anthropic`) | [Job Board API](https://developers.greenhouse.io/job-board.html) |
| `lever` | company name (e.g. `attentive`) | [Postings API](https://github.com/lever/postings-api) |
| `ashby` | job-board name (e.g. `Ashby`) | [Public Job Board API](https://developers.ashbyhq.com/reference/public-job-board-api) |
| `smartrecruiters` | company identifier (e.g. `Visa`) | [Posting API](https://developers.smartrecruiters.com/docs/posting-api-overview) |
| `workable` | account name | [Widget API](https://workable.readme.io/docs/jobs) |
| `recruitee` | recruitee subdomain (e.g. `acme` for `acme.recruitee.com`) | [Offers API](https://docs.recruitee.com/reference/offers) |

### Subcommand reference

| Subcommand | What it does |
|---|---|
| `scan <ats>:<slug> [<ats>:<slug> ...]` | Fan out across one or more `<ats>:<slug>` pairs in parallel. Returns unified `jobs[]` array. |
| `list-ats` | List supported ATSes and their docs URLs. |
| `doctor` | Probe one known-good slug per ATS to verify each adapter parses. |

### Common invocation patterns

```bash
# Single ATS
ats-surface-pp-cli scan greenhouse:anthropic | jq '.jobs | length'

# Cross-ATS competitive scan
ats-surface-pp-cli scan greenhouse:anthropic ashby:openai smartrecruiters:Visa --limit 50

# AI/ML breakdown by department
ats-surface-pp-cli scan greenhouse:anthropic \
  | jq -r '.jobs[] | select(.title | test("(AI|ML|model|research)"; "i")) | .department' \
  | sort | uniq -c | sort -rn

# With descriptions (much larger payload)
ats-surface-pp-cli scan greenhouse:anthropic --full \
  | jq '[.jobs[] | select(.description | test("oncology"; "i"))]'

# Compose with google-places-pp-cli — find restaurants near offices
ats-surface-pp-cli scan greenhouse:anthropic \
  | jq -r '[.jobs[].location] | unique | .[]' \
  | head -5 \
  | while read loc; do google-places-pp-cli search "lunch near $loc" --limit 3 --agent; done
```

### Output shape (normalized)

Every ATS returns the same per-job shape:

```json
{
  "ats": "greenhouse",
  "ats_slug": "anthropic",
  "id": "5161980008",
  "title": "Account Executive, Beneficial Deployments",
  "company": "Anthropic",
  "location": "London, UK",
  "remote": false,
  "department": "Sales",
  "team": null,
  "url": "https://job-boards.greenhouse.io/anthropic/jobs/5161980008",
  "datePosted": "2026-05-09T...",
  "employmentType": null,
  "description": null
}
```

Top-level response includes a `sources[]` array showing per-ATS status, jobs_found, and ms timing — useful for "which ATS was slow / errored" debugging.

Errors per source don't kill the whole scan — they land in `sources[].error` and the rest of the sources still return.

### When to use this vs other tools

- **Use ats-surface:** any company on a known ATS — gets you structured, paginated, normalized job data.
- **Use jobposting-schema:** non-ATS career sites (custom CMS, government, smaller employers) where JSON-LD is server-side.
- **Use `agent-ats-scanner` MCP:** when running inside the gateway/production Ivy where Bash isn't available, OR when the auto-detect-which-ATS feature matters (it scans common patterns automatically; ats-surface requires you to say `<ats>:<slug>` explicitly).
- **Workday is NOT covered here** by design — it has a different access reality (CXS endpoints, ToS-restricted scraping). Will live as `workday-cxs-pp-cli` if/when that scope is acceptable.

---

## `reddit-pp-cli` — Reddit research CLI for HR practitioner sentiment

**Binary:** `/Users/moraybrown/.local/bin/reddit-pp-cli` (symlink → `pp-tools/reddit-pp-cli/cli.mjs`).
**Version:** 0.1.0.
**What it does:** OAuth-authenticated Reddit search + thread fetch, normalized JSON out, pipe to `jq`. Killer use case for Ivy: practitioner sentiment on HR vendors, recruiting tools, role demands ("what do recruiters actually say about Eightfold").

**Auth (required):** `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` in env or `./.env`. Reddit closed all unauthenticated `.json` endpoints in 2023 — OAuth is mandatory now. Uses the `client_credentials` grant (no user account login required, no OAuth callback dance).

**One-time setup:**
1. Go to <https://www.reddit.com/prefs/apps> → "create another app".
2. Type: `script`. Redirect URL: `http://localhost` (any value works for client_credentials).
3. Copy the `client_id` (the string under the app name, NOT the description) and `client_secret`.
4. Add to `.env`:
   ```
   REDDIT_CLIENT_ID=...
   REDDIT_CLIENT_SECRET=...
   REDDIT_USERNAME=your_reddit_username   # optional; Reddit's UA policy expects an account name
   ```
5. Verify: `reddit-pp-cli doctor`.

Tokens are cached at `~/.cache/reddit-pp-cli/token.json` (24h TTL) so subsequent invocations skip the token refresh round-trip.

### Subcommand reference

| Subcommand | What it does |
|---|---|
| `search <query>` | Search posts. Use `--sub <name>` to scope to a subreddit. `--sort relevance\|hot\|new\|top`, `--time hour\|day\|week\|month\|year\|all`. |
| `subreddit <name>` | Browse a subreddit. `--sort hot\|new\|top\|rising`. |
| `thread <id>` | Fetch one thread's post + comments. Accepts post ID, `t3_id`, or full URL. `--comments <n>` (max 200). |
| `doctor` | Verify creds + sample API call. |

### Common invocation patterns

```bash
# Vendor sentiment scan
reddit-pp-cli search "eightfold ai" --sub recruiting --limit 30 \
  | jq -r '.posts[] | "\(.score)↑ \(.num_comments)💬 — \(.title)"'

# What's hot in r/recruitinghell this week
reddit-pp-cli subreddit recruitinghell --sort top --time week \
  | jq '.posts[0:5] | map({title, score, permalink})'

# Drill into a single thread for sentiment
reddit-pp-cli thread 1abc23 --comments 50 \
  | jq -r '.comments[] | "[\(.score)] \(.author): \(.body | gsub("\\n"; " ") | .[0:160])"'

# Cross-source: Reddit chatter + ATS hiring on the same vendor
reddit-pp-cli search "workday recruiter" --limit 10 | jq '.posts | length'
ats-surface-pp-cli scan smartrecruiters:Workday --limit 10 | jq '.jobs | length'
```

### Output shape (search/subreddit)

```json
{
  "query": "eightfold ai",
  "subreddit": "recruiting",
  "count": 23,
  "after": "t3_xyz",
  "posts": [
    {
      "id": "abc123",
      "fullname": "t3_abc123",
      "title": "...",
      "author": "...",
      "subreddit": "recruiting",
      "score": 47,
      "upvote_ratio": 0.93,
      "num_comments": 18,
      "created_iso": "2026-04-15T10:23:00.000Z",
      "url": "...",
      "permalink": "https://www.reddit.com/r/...",
      "is_self": true,
      "selftext": "...",
      "flair": "Discussion"
    }
  ]
}
```

### When to use this vs other tools

- **Use reddit-pp-cli:** practitioner sentiment, vendor reputation chatter, role-demand signals from working recruiters/HR pros, thread drill-downs.
- **Use `data-research-index` (MCP):** academic/institutional findings (HBS, Stanford DEL, etc.) — that's authoritative literature, this is folk wisdom.
- **Combine:** Reddit for "what people are complaining about" → cross-reference with ATS hiring deltas via `ats-surface-pp-cli` to see if the chatter shows up in real hiring patterns.

---

## `workday-cxs-pp-cli` — Workday CXS endpoints (PERSONAL USE ONLY)

**Binary:** `/Users/moraybrown/.local/bin/workday-cxs-pp-cli` (symlink → `pp-tools/workday-cxs-pp-cli/cli.mjs`).
**Version:** 0.1.0.

> ⚠️ **PERSONAL USE ONLY.** Workday's ToS prohibits scraping. The CXS endpoints this CLI hits are unauthenticated but unintended for third-party use. Output of this CLI is for **personal research only** — do NOT ship as a product feature, do NOT redistribute, do NOT crawl aggressively. Sustained heavy use can trigger tenant rate limits or IP blocks. Tenants can request blocks at any time.

**What it does:** Bash-pipeable wrapper around Workday's public CXS (Career eXperience Service) endpoints — the same JSON API Workday's own careers SPA hits in the user's browser. Covers thousands of large enterprises (AstraZeneca, Sanofi, Salesforce, etc.) that `ats-surface-pp-cli` deliberately doesn't include.

**Why this is split from `ats-surface-pp-cli`:** different access reality. ats-surface wraps APIs vendors actively want consumed (Greenhouse Job Board API, etc.). Workday CXS is unauthenticated-but-not-meant-for-third-parties. Mixing them would muddy the `legal_class` metadata on the registry and lose the kill-switch.

### Subcommand reference

| Subcommand | What it does |
|---|---|
| `scan <url>` | Sweep all jobs from a Workday tenant. Paginated (20/page), paced (250ms between requests), defaults to limit 100 (max 5000). |
| `job <url>` | Fetch full detail for one job (from its public URL). Returns the rich `jobPostingInfo` shape — title, full description HTML, jobReqId, dates, location, etc. |
| `doctor` | Health check — probes AstraZeneca's Workday tenant. |

### URL format

Workday tenants live at `{tenant}.{dc}.myworkdayjobs.com/{site}` where `{dc}` is the data center (`wd1`, `wd3`, `wd5`, `wd12`, etc.). The CLI parses any of:

- `https://astrazeneca.wd3.myworkdayjobs.com/Careers`
- `https://astrazeneca.wd3.myworkdayjobs.com/en-US/Careers` (locale prefix tolerated)
- `astrazeneca.wd3.myworkdayjobs.com/Careers` (scheme inferred)

### Common invocation patterns

```bash
# What's the size of AstraZeneca's open hiring?
workday-cxs-pp-cli scan https://astrazeneca.wd3.myworkdayjobs.com/Careers --limit 5 \
  | jq '.total_at_tenant'

# AI-keyword roles, by location
workday-cxs-pp-cli scan https://astrazeneca.wd3.myworkdayjobs.com/Careers --search "AI" --limit 100 \
  | jq -r '.jobs[] | "\(.location) — \(.title)"'

# Sample of recently-posted oncology roles
workday-cxs-pp-cli scan https://astrazeneca.wd3.myworkdayjobs.com/Careers --search "oncology" --limit 50 \
  | jq '.jobs[] | select(.postedOn | test("Today|Yesterday|days ago"; "i"))'

# Drill into one job's full description
workday-cxs-pp-cli job "https://astrazeneca.wd3.myworkdayjobs.com/Careers/job/Cambridge-UK/Senior-Director_R-200124" \
  | jq '.detail | {title, location, jobReqId, descPreview: (.jobDescription | gsub("<[^>]+>"; "") | .[0:500])}'
```

### Output shape (scan)

```json
{
  "queried_at": "2026-05-10T...",
  "tenant": "astrazeneca",
  "site": "Careers",
  "total_at_tenant": 1487,
  "fetched": 100,
  "after_filters": 42,
  "elapsed_ms": 4823,
  "jobs": [
    {
      "tenant": "astrazeneca",
      "site": "Careers",
      "title": "Senior Director, Customer Engagement",
      "location": "UK - Cambridge",
      "timeType": "Full time",
      "postedOn": "Posted Yesterday",
      "startDate": null,
      "externalPath": "/job/UK---Cambridge/Senior-Director_R-200124",
      "url": "https://astrazeneca.wd3.myworkdayjobs.com/Careers/job/UK---Cambridge/Senior-Director_R-200124"
    }
  ]
}
```

### Pacing & politeness

- 250ms minimum delay between sequential paginated requests.
- Default concurrency 1 (sequential pages). `--concurrency` capped at 4.
- User-Agent identifies the CLI clearly: `workday-cxs-pp-cli/0.1.0 (personal research)`.
- If you find yourself wanting to scan 5000+ jobs/day, you're using it wrong for the personal-use scope.

### When to use this vs other tools

- **Use workday-cxs:** any Workday-hosted enterprise that's NOT on a Greenhouse/Lever/Ashby/SmartRecruiters/Workable/Recruitee surface (which is most large enterprises — pharma, finance, retail, traditional tech).
- **Use ats-surface:** anything on the structured-public-API ATSes — that's the safe-to-ship path.
- **Use jobposting-schema:** custom CMS career sites with server-rendered JSON-LD.
- **Use careers-sniffer:** any URL not covered by ats-surface/workday-cxs/jobposting-schema — see next entry.

---

## `careers-sniffer-pp-cli` — universal dispatcher for everything else

**Binary:** `/Users/moraybrown/.local/bin/careers-sniffer-pp-cli` (symlink → `pp-tools/careers-sniffer-pp-cli/cli.mjs`).
**Version:** 0.1.0.
**What it does:** the catch-all for careers URLs not covered by `ats-surface-pp-cli` (Greenhouse/Lever/Ashby/SmartRecruiters/Workable/Recruitee) or `workday-cxs-pp-cli` (Workday tenants). Dispatches per URL: detects the platform, runs the cheapest extraction path that works, falls back to Playwright + JSON-LD for SPAs.

**Strategy chain (per URL):**
1. **URL pattern detection** → classify platform.
2. **Direct API** for known platforms with a clean public REST endpoint (Oracle HCM Cloud).
3. **HTML JSON-LD** for known platforms that ship `JobPosting` server-side (SuccessFactors, iCIMS).
4. **Playwright JSON-LD fallback** — load the URL in headless Chromium, wait for hydration, extract any `<script type="application/ld+json">` JobPosting blocks. Generic; works on any SPA that publishes structured data for Google for Jobs.

If the cheap path returns 0 jobs, the dispatcher upgrades to Playwright automatically (unless `--no-playwright` is set).

**Known platforms (v0.2 — added 5 bespoke F500-giant adapters):**

| Platform | Strategy | Notes |
|---|---|---|
| `oracle-hcm` | direct API (`recruitingCEJobRequisitions`) | Detects `*.fa.{region}.oraclecloud.com/hcmUI/CandidateExperience/`. Pulls site slug from URL. |
| `successfactors` | HTML JSON-LD | Detects `*.successfactors.{com\|eu\|cn}`, `*.sapsf.{com\|eu}`, and `?company=` / `/careersection/` URL shapes. |
| `icims` | HTML JSON-LD | Detects `*.icims.com`. White-labeled iCIMS subdomains won't match — needs the raw iCIMS host. |
| `amazon` | direct API (`amazon.jobs/search.json`) | Public, no auth, paginated 100/page. Verified: 30k+ open roles. |
| `microsoft` | direct API (`apply.careers.microsoft.com/api/pcsx`) | Public, no auth, 10/page. The documented `gcsservices.careers.microsoft.com` endpoint is stale — Microsoft migrated to `apply.careers.microsoft.com` (clean cert, no SNI workaround). |
| `google` | WIZ preload (Playwright) | No public JSON XHR. Job data is server-injected into HTML as `AF_initDataCallback({key:'ds:1', data:[...]})`. Playwright required; 20/page. |
| `meta` | GraphQL (Playwright) | Bespoke Relay/GraphQL site, no public ATS. Adapter does Playwright warm-up + page-context POST to `/graphql` (op=`CareersJobSearchResultsDataQuery`, `doc_id=29615178951461218`). `doc_id` is pinned from observed traffic and may rotate. |
| `apple` | CSRF-protected direct API | The "anti-bot" was overstated — Apple exposes `POST /api/v1/search` after a `GET /api/v1/CSRFToken` dance for token + session cookies. 20/page. No Playwright needed. |
| `unknown` (fallback) | Playwright JSON-LD | Catches anything else that hydrates client-side AND publishes Google-for-Jobs JSON-LD. |

**Verified end-to-end** (2026-05-11, parallel scan, UK queries, `--limit 5 --concurrency 5`):

| Platform | Strategy | Latency | Jobs |
|---|---|---:|---:|
| Amazon | direct API | 445 ms | 5 |
| Apple | direct API + CSRF | 1041 ms | 5 |
| Microsoft | direct API | 1143 ms | 5 |
| Meta | GraphQL via Playwright | 3090 ms | 16 (Meta returns full result set in one call; `--limit` ignored client-side) |
| Google | WIZ preload via Playwright | 3519 ms | 5 |
| **Total** | — | **3.5 s wall** | **36 jobs** |

### Subcommand reference

| Subcommand | What it does |
|---|---|
| `extract <url>` | Single URL → normalized jobs array. |
| `scan <url> [<url>...]` | Fan out across multiple URLs in parallel (default concurrency = N URLs, max 6). |
| `detect <url>` | Classify the platform without fetching jobs. Cheap, no network call beyond URL parse. |
| `list-platforms` | Show all known platforms and detection patterns. |
| `doctor` | Health probe — verifies detection logic + Playwright availability. |

### Common invocation patterns

```bash
# Classify a URL (no fetch)
careers-sniffer-pp-cli detect "https://jobs.careers.microsoft.com/global/en/job/123"

# Single extract with all strategies enabled
careers-sniffer-pp-cli extract "https://www.usajobs.gov/job/856555200" --full

# Disable Playwright (HTML-only, fast)
careers-sniffer-pp-cli extract "$URL" --no-playwright

# Fan out across many URLs
careers-sniffer-pp-cli scan url-a url-b url-c --concurrency 4 \
  | jq '[.results[] | {url, platform, strategy_chain, jobs_found}]'

# Compose: get a Microsoft UK job ID via Playwright, then extract
# (Microsoft search page itself has no JSON-LD; per-company adapter is a v0.2 path)
```

### Output shape (extract)

```json
{
  "queried_at": "2026-05-11T...",
  "url": "https://www.usajobs.gov/job/856555200",
  "platform": "unknown",
  "strategy_chain": [
    { "strategy": "html-jsonld", "ms": 413, "jobs_found": 1 }
  ],
  "ms_total": 413,
  "jobs_found": 1,
  "jobs": [
    {
      "platform": "unknown",
      "source_url": "https://www.usajobs.gov/job/856555200",
      "id": null,
      "title": "Registered Nurse - PACT",
      "company": "Kansas City VA Medical Center",
      "location": "Kansas City, MO",
      "remote": false,
      "department": null,
      "team": null,
      "url": "https://www.usajobs.gov/job/856555200",
      "datePosted": "02/05/2026",
      "validThrough": "2026-02-13",
      "employmentType": "OTHER",
      "salary": { "currency": "USD", "value": 68432, "unit": "YEAR" },
      "description": null
    }
  ]
}
```

### Empirical reality (v0.1 testing)

A genuine finding from validation: **not every SPA careers site publishes JSON-LD JobPosting**, even after hydration.

- ✅ **Works:** USAJobs (server-rendered HTML, JSON-LD ships in initial response). The dispatcher picks the cheap HTML path and finishes in ~500ms.
- ⚠️ **Doesn't work yet:** Microsoft careers (`jobs.careers.microsoft.com`), Apple careers (`jobs.apple.com`), modern Greenhouse `job-boards.greenhouse.io` SPA — these hydrate client-side BUT do not inject JSON-LD JobPosting into the DOM. They power their job-detail UI from a private API and rely on indexing by other means (Google Talent API, ATS aggregator partnerships).
- The CLI correctly attempts both strategies on these and reports `jobs_found: 0` with a clean strategy_chain showing what was tried — that's accurate behavior, not a bug.

**v0.2 path for the holdouts:** add per-company direct-API adapters following the Oracle pattern. Microsoft has a private endpoint at `gcsservices.careers.microsoft.com/search/api/v1/search` (Azure Edge cert SNI quirk requires a browser-equivalent client). One adapter per F500 holdout = bounded scope.

### When to use this vs other tools

| User intent | Tool |
|---|---|
| URL is on Greenhouse/Lever/Ashby/SmartRecruiters/Workable/Recruitee | `ats-surface-pp-cli` |
| URL is on Workday (`*.myworkdayjobs.com`) | `workday-cxs-pp-cli` |
| URL is server-rendered with JSON-LD (USAJobs, gov, smaller employers) | `jobposting-schema-pp-cli` OR `careers-sniffer-pp-cli` (both work; sniffer is faster to remember) |
| URL is on Oracle / SuccessFactors / iCIMS | `careers-sniffer-pp-cli` |
| Bespoke / unknown / SPA — best-effort attempt | `careers-sniffer-pp-cli` (Playwright fallback) |
| Bespoke giant where JSON-LD is absent (Microsoft/Apple) | Stub here for now, add bespoke adapter in v0.2; for "just give me the jobs" → Adzuna |
