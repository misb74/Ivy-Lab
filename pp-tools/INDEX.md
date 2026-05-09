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
