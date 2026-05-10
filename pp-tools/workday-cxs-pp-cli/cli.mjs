#!/usr/bin/env node
// workday-cxs-pp-cli — Bash-pipeable wrapper around Workday's public CXS
// (Career eXperience Service) endpoints. The same endpoints Workday's own
// careers SPA hits in your browser.
//
// PERSONAL USE ONLY. Workday's ToS prohibits scraping. Use this for personal
// research; do not ship its output as a product feature, do not redistribute,
// do not crawl aggressively. Sustained heavy use can trigger tenant-level
// rate limits or IP blocks. The CLI uses respectful pacing and a clear UA.
//
// Endpoint pattern (no auth):
//   POST {host}/wday/cxs/{tenant}/{site}/jobs   — list jobs (paginated)
//   GET  {host}/wday/cxs/{tenant}/{site}/job{externalPath} — single job detail

import { parseArgs } from "node:util";

const VERSION = "0.1.0";
const UA = "Mozilla/5.0 (compatible; workday-cxs-pp-cli/0.1.0; personal research)";
const PAGE_SIZE = 20; // Workday's CXS endpoint typically caps at 20.
const MIN_DELAY_MS = 250; // Pacing between paginated requests.

function die(msg, code = 1) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}

function out(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseWorkdayUrl(input) {
  let u;
  try { u = new URL(input.startsWith("http") ? input : `https://${input}`); }
  catch { throw new Error(`not a valid URL: ${input}`); }
  const hostMatch = u.host.match(/^([^.]+)\.([^.]+)\.myworkdayjobs\.com$/);
  if (!hostMatch) throw new Error(`not a myworkdayjobs.com URL: ${u.host}`);
  const tenant = hostMatch[1];
  const dc = hostMatch[2];
  const parts = u.pathname.split("/").filter(Boolean);
  // Strip optional locale prefix (en-US, fr-FR, etc.)
  if (parts[0] && /^[a-z]{2}(-[A-Z]{2})?$/.test(parts[0])) parts.shift();
  const site = parts[0];
  if (!site) throw new Error(`URL is missing the site segment (e.g. /Careers): ${input}`);
  return {
    host: u.host,
    tenant,
    dc,
    site,
    base: `https://${u.host}`,
    apiBase: `https://${u.host}/wday/cxs/${tenant}/${site}`,
    rawPath: u.pathname,
  };
}

async function postJobs(parsed, { limit, offset, searchText, appliedFacets }) {
  const res = await fetch(`${parsed.apiBase}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": UA,
    },
    body: JSON.stringify({
      appliedFacets: appliedFacets || {},
      limit,
      offset,
      searchText: searchText || "",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`${res.status} ${res.statusText} — ${parsed.apiBase}/jobs`);
    err.status = res.status;
    err.body = body.slice(0, 200);
    throw err;
  }
  return res.json();
}

async function getJob(parsed, externalPath) {
  if (!externalPath.startsWith("/")) externalPath = "/" + externalPath;
  // externalPath from the listing API already starts with "/job/...", and we extract
  // it from URLs that include "/job/..." too — so don't prepend another "/job".
  const url = `${parsed.apiBase}${externalPath}`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`${res.status} ${res.statusText} — ${url}`);
    err.status = res.status;
    err.body = body.slice(0, 200);
    throw err;
  }
  return res.json();
}

function normalizeListing(j, parsed) {
  return {
    tenant: parsed.tenant,
    site: parsed.site,
    title: j.title,
    location: j.locationsText,
    timeType: j.timeType,
    postedOn: j.postedOn, // human-relative ("Posted Yesterday", "Posted 30+ Days Ago")
    startDate: j.startDate || null,
    externalPath: j.externalPath,
    url: `${parsed.base}/${parsed.site}${j.externalPath}`,
    bulletFields: j.bulletFields || [],
  };
}

// ------------------------------ subcommands ------------------------------

const HELP = `workday-cxs-pp-cli ${VERSION} — Workday CXS endpoints (PERSONAL USE ONLY)

Usage:
  workday-cxs-pp-cli <command> [flags]

Commands:
  scan <url>       Sweep all jobs from a Workday tenant. Paginated, paced.
  job <url>        Fetch full detail for one job (from its public URL or externalPath).
  doctor           Health check against a known-good public tenant (AstraZeneca).
  version          Print version.
  help             This help.

URL formats accepted (tenant URL pattern: {tenant}.{dc}.myworkdayjobs.com/{site}):
  https://astrazeneca.wd3.myworkdayjobs.com/Careers
  https://astrazeneca.wd3.myworkdayjobs.com/en-US/Careers
  astrazeneca.wd3.myworkdayjobs.com/Careers   (scheme inferred)

Flags:
  --limit <n>          Max jobs to return (default 100; cap 5000).
  --search <q>         Free-text search inside the tenant.
  --location <name>    Convenience filter (post-fetch substring match on locationsText).
  --since <days>       Convenience filter (post-fetch, against startDate).
  --concurrency <n>    Pages fetched in parallel (default 1; max 4 — be respectful).

Examples:
  workday-cxs-pp-cli scan https://astrazeneca.wd3.myworkdayjobs.com/Careers --limit 200 \\
    | jq -r '.jobs[] | "\\(.location) — \\(.title)"' | sort -u | head -20

  workday-cxs-pp-cli scan https://astrazeneca.wd3.myworkdayjobs.com/Careers --search "AI oncology" \\
    | jq '.jobs | length'

  workday-cxs-pp-cli job https://astrazeneca.wd3.myworkdayjobs.com/Careers/job/Cambridge-UK/Senior-Director_R-200124 \\
    | jq '{title, postingDate, jobDescription: (.jobDescription[:400])}'

NOTES:
  - Workday's ToS prohibits scraping. Personal research only.
  - Sustained pages-per-second ramp can trigger tenant rate limits or IP blocks.
    Default pacing: 250ms between sequential requests.
  - Endpoints are unauthenticated and unstable — Workday can move/block them
    at any tenant's request. If a previously-working tenant 403s, accept it.
`;

async function scan(rest) {
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      agent: { type: "boolean" },
      limit: { type: "string" },
      search: { type: "string" },
      location: { type: "string" },
      since: { type: "string" },
      concurrency: { type: "string" },
    },
  });
  const url = positionals[0];
  if (!url) die("scan requires <url>");
  const parsed = parseWorkdayUrl(url);
  const userLimit = Math.min(parseInt(values.limit || "100", 10), 5000);
  const concurrency = Math.min(parseInt(values.concurrency || "1", 10), 4);

  const t0 = Date.now();
  const first = await postJobs(parsed, {
    limit: PAGE_SIZE, offset: 0, searchText: values.search,
  });
  const total = first.total ?? 0;
  const target = Math.min(total, userLimit);
  const all = [...(first.jobPostings || [])];

  // Remaining offsets
  const offsets = [];
  for (let o = PAGE_SIZE; o < target; o += PAGE_SIZE) offsets.push(o);

  let nextIdx = 0;
  const errors = [];
  async function worker() {
    while (nextIdx < offsets.length) {
      const myIdx = nextIdx++;
      const offset = offsets[myIdx];
      try {
        const page = await postJobs(parsed, {
          limit: PAGE_SIZE, offset, searchText: values.search,
        });
        for (const j of (page.jobPostings || [])) all.push(j);
      } catch (e) {
        errors.push({ offset, error: e.message });
      }
      if (offsets.length > 1) await sleep(MIN_DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  // Trim to userLimit (we may have over-fetched on the last page)
  const trimmed = all.slice(0, userLimit);
  let normalized = trimmed.map((j) => normalizeListing(j, parsed));

  // Post-fetch convenience filters
  if (values.location) {
    const needle = values.location.toLowerCase();
    normalized = normalized.filter((j) => (j.location || "").toLowerCase().includes(needle));
  }
  if (values.since) {
    const days = parseInt(values.since, 10);
    if (!isNaN(days)) {
      const cutoff = Date.now() - days * 86400_000;
      normalized = normalized.filter((j) => j.startDate && new Date(j.startDate).getTime() >= cutoff);
    }
  }

  out({
    queried_at: new Date().toISOString(),
    tenant: parsed.tenant,
    site: parsed.site,
    host: parsed.host,
    total_at_tenant: total,
    fetched: trimmed.length,
    after_filters: normalized.length,
    elapsed_ms: Date.now() - t0,
    errors: errors.length ? errors : undefined,
    jobs: normalized,
  });
}

async function job(rest) {
  const { positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: { agent: { type: "boolean" } },
  });
  const url = positionals[0];
  if (!url) die("job requires <url>");
  let parsed, externalPath;
  try {
    parsed = parseWorkdayUrl(url);
    // The externalPath is whatever follows /{site} in the URL pathname.
    const u = new URL(url);
    const segs = u.pathname.split("/").filter(Boolean);
    if (segs[0] && /^[a-z]{2}(-[A-Z]{2})?$/.test(segs[0])) segs.shift();
    segs.shift(); // drop site
    externalPath = "/" + segs.join("/");
    if (!externalPath || externalPath === "/") {
      die("job URL is missing the externalPath segment (e.g. /job/Location/Title_RID)");
    }
  } catch (e) {
    die(e.message);
  }
  const j = await getJob(parsed, externalPath);
  // The detail response has a richer shape: { jobPostingInfo: { title, location, jobDescription, ... } }
  out({
    tenant: parsed.tenant,
    site: parsed.site,
    url,
    detail: j.jobPostingInfo || j,
  });
}

async function doctor() {
  const result = { name: "workday-cxs-pp-cli", version: VERSION, scope: "personal_use_only" };
  try {
    const parsed = parseWorkdayUrl("https://astrazeneca.wd3.myworkdayjobs.com/Careers");
    const j = await postJobs(parsed, { limit: 1, offset: 0 });
    result.probe = {
      tenant: parsed.tenant,
      site: parsed.site,
      total: j.total,
      sample_title: j.jobPostings?.[0]?.title || null,
    };
    result.api = "ok";
  } catch (e) {
    result.api = "fail";
    result.error = e.message;
  }
  out(result);
}

function version() { out({ name: "workday-cxs-pp-cli", version: VERSION }); }

const subs = { scan, job, doctor, version, help: () => process.stdout.write(HELP) };

const [, , cmd, ...rest] = process.argv;
if (!cmd || cmd === "--help" || cmd === "-h") { process.stdout.write(HELP); process.exit(0); }
if (cmd === "--version" || cmd === "-v") { version(); process.exit(0); }
const fn = subs[cmd];
if (!fn) die(`unknown command: ${cmd} (try: scan job doctor)`);
try {
  await fn(rest);
} catch (e) {
  out({ error: true, command: cmd, message: e.message, body: e.body });
  process.exit(2);
}
