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
