#!/usr/bin/env node
// ats-surface-pp-cli — unified Bash-pipeable CLI over the public job-board APIs of
// Greenhouse, Lever, Ashby, SmartRecruiters, Workable, and Recruitee.
// No auth, no API key. All endpoints used here are the vendors' documented public APIs.

import { parseArgs } from "node:util";

const VERSION = "0.1.0";
const UA = "Mozilla/5.0 (compatible; ats-surface-pp-cli/0.1.0; +https://github.com/misb74/Ivy-Lab)";

function die(msg, code = 1) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}

function out(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

function stripHtml(s) {
  if (!s || typeof s !== "string") return s;
  return s.replace(/<[^>]*>/g, "").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}

async function fetchJson(url, timeout = 15000) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/json" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
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

// ------------------------------ adapters ------------------------------
//
// Each adapter:
//   url(slug)        -> full upstream URL
//   parse(data, slug, opts) -> normalized job array
//
// Normalized shape:
//   { ats, ats_slug, id, title, company, location, remote, department, team,
//     url, datePosted, employmentType, description }

const ADAPTERS = {
  greenhouse: {
    docs: "https://developers.greenhouse.io/job-board.html",
    // Always content=true — that's the only way to get departments/offices,
    // which are part of the unified shape's value.
    url: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
    parse: (data, slug, opts) =>
      (data.jobs || []).map((j) => ({
        ats: "greenhouse",
        ats_slug: slug,
        id: String(j.id),
        title: j.title,
        company: j.company_name || null,
        location: j.location?.name || null,
        remote: /remote|anywhere/i.test(j.location?.name || ""),
        department: j.departments?.[0]?.name || null,
        team: j.departments?.[0]?.child_departments?.[0]?.name || null,
        url: j.absolute_url,
        datePosted: j.updated_at || null,
        employmentType: null,
        description: opts.full ? stripHtml(j.content)?.slice(0, 800) : null,
      })),
  },

  lever: {
    docs: "https://github.com/lever/postings-api",
    url: (slug) => `https://api.lever.co/v0/postings/${slug}?mode=json`,
    parse: (data, slug, opts) => {
      const arr = Array.isArray(data) ? data : [];
      return arr.map((j) => ({
        ats: "lever",
        ats_slug: slug,
        id: j.id || j.lever_id,
        title: j.text,
        company: null,
        location: j.categories?.location || null,
        remote: /remote/i.test(j.categories?.location || "") || j.workplaceType === "remote",
        department: j.categories?.department || j.categories?.team || null,
        team: j.categories?.team || null,
        url: j.hostedUrl,
        datePosted: j.createdAt ? new Date(j.createdAt).toISOString() : null,
        employmentType: j.categories?.commitment || null,
        description: opts.full ? stripHtml(j.descriptionPlain || j.description)?.slice(0, 800) : null,
      }));
    },
  },

  ashby: {
    docs: "https://developers.ashbyhq.com/reference/public-job-board-api",
    url: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
    parse: (data, slug, opts) =>
      (data.jobs || []).map((j) => ({
        ats: "ashby",
        ats_slug: slug,
        id: j.id,
        title: j.title,
        company: data.title || null,
        location: j.location || null,
        remote: !!j.isRemote,
        department: j.department || null,
        team: j.team || null,
        url: j.jobUrl,
        datePosted: j.publishedDate || null,
        employmentType: j.employmentType || null,
        description: opts.full ? stripHtml(j.descriptionHtml)?.slice(0, 800) : null,
      })),
  },

  smartrecruiters: {
    docs: "https://developers.smartrecruiters.com/docs/posting-api-overview",
    url: (slug, opts) =>
      `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=${opts.limit || 100}`,
    parse: (data, slug, opts) =>
      (data.content || []).map((j) => ({
        ats: "smartrecruiters",
        ats_slug: slug,
        id: j.id,
        title: j.name,
        company: j.company?.name || null,
        location: [j.location?.city, j.location?.region, j.location?.country].filter(Boolean).join(", ") || null,
        remote: !!j.location?.remote,
        department: j.department?.label || null,
        team: null,
        url: j.ref || `https://jobs.smartrecruiters.com/${slug}/${j.id}`,
        datePosted: j.releasedDate || j.createdOn || null,
        employmentType: j.typeOfEmployment?.label || null,
        description: opts.full ? null : null, // SR list endpoint omits description; full needs per-job fetch
      })),
  },

  workable: {
    docs: "https://workable.readme.io/docs/jobs",
    url: (slug) => `https://apply.workable.com/api/v1/widget/accounts/${slug}`,
    parse: (data, slug, opts) =>
      (data.jobs || []).map((j) => ({
        ats: "workable",
        ats_slug: slug,
        id: j.shortcode || j.id,
        title: j.title,
        company: data.name || null,
        location: [j.location?.city, j.location?.region, j.location?.country].filter(Boolean).join(", ") || null,
        remote: j.location?.workplace === "remote" || j.remote === true,
        department: j.department || null,
        team: null,
        url: j.url || `https://apply.workable.com/${slug}/j/${j.shortcode}`,
        datePosted: j.published_on || j.publishedAt || null,
        employmentType: j.employment_type || null,
        description: opts.full ? stripHtml(j.description)?.slice(0, 800) : null,
      })),
  },

  recruitee: {
    docs: "https://docs.recruitee.com/reference/offers",
    url: (slug) => `https://${slug}.recruitee.com/api/offers/`,
    parse: (data, slug, opts) =>
      (data.offers || []).map((j) => ({
        ats: "recruitee",
        ats_slug: slug,
        id: String(j.id),
        title: j.title,
        company: j.company_name || null,
        location: [j.city, j.country].filter(Boolean).join(", ") || j.location || null,
        remote: !!j.remote,
        department: j.department || null,
        team: null,
        url: j.careers_url || j.careers_apply_url,
        datePosted: j.published_at || null,
        employmentType: j.employment_type_code || null,
        description: opts.full ? stripHtml(j.description)?.slice(0, 800) : null,
      })),
  },
};

// ------------------------------ commands ------------------------------

const HELP = `ats-surface-pp-cli ${VERSION} — unified job-board API CLI

Usage:
  ats-surface-pp-cli <command> [flags]

Commands:
  scan <ats>:<slug> [<ats>:<slug> ...]  Fan out across one or more ATS:slug pairs.
  list-ats                              Print supported ATSes and their docs URLs.
  doctor                                Health check (probes one known-good slug per ATS).
  version                               Print version.
  help                                  This help.

Supported ATSes:
  greenhouse  — slug = board token (e.g. anthropic)
  lever       — slug = company name (e.g. attentive)
  ashby       — slug = job-board name (e.g. Ashby)
  smartrecruiters — slug = company identifier (e.g. Visa)
  workable    — slug = workable account name
  recruitee   — slug = recruitee subdomain (e.g. acme for acme.recruitee.com)

Flags:
  --full              Include description text (truncated to 800 chars per job).
  --limit <n>         Max jobs per source (where the API supports a limit param).
  --concurrency <n>   Parallel sources (default = number of pairs, max 10).

Examples:
  ats-surface-pp-cli scan greenhouse:anthropic ashby:Ashby smartrecruiters:Visa
  ats-surface-pp-cli scan greenhouse:anthropic --full | jq '[.jobs[] | select(.title | test("(AI|ML)"; "i"))]'
  ats-surface-pp-cli scan recruitee:vendora | jq '.jobs | group_by(.department) | map({dept: .[0].department, count: length})'
  ats-surface-pp-cli list-ats
`;

function parsePair(token) {
  const idx = token.indexOf(":");
  if (idx <= 0) die(`bad pair (need <ats>:<slug>): ${token}`);
  const ats = token.slice(0, idx);
  const slug = token.slice(idx + 1);
  if (!ADAPTERS[ats]) die(`unknown ats: ${ats} (run 'ats-surface-pp-cli list-ats')`);
  if (!slug) die(`empty slug for ${ats}`);
  return { ats, slug };
}

async function scan(rest) {
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      agent: { type: "boolean" },
      full: { type: "boolean" },
      limit: { type: "string" },
      concurrency: { type: "string" },
    },
  });
  if (!positionals.length) die("scan requires one or more <ats>:<slug> args");
  const pairs = positionals.map(parsePair);
  const opts = { full: !!values.full, limit: parseInt(values.limit || "0", 10) || undefined };
  const concurrency = Math.min(parseInt(values.concurrency || String(pairs.length), 10), 10);

  const sources = [];
  const allJobs = [];

  let i = 0;
  async function worker() {
    while (i < pairs.length) {
      const idx = i++;
      const { ats, slug } = pairs[idx];
      const adapter = ADAPTERS[ats];
      const url = adapter.url(slug, opts);
      const t0 = Date.now();
      try {
        const data = await fetchJson(url);
        const jobs = adapter.parse(data, slug, opts);
        const trimmed = opts.limit ? jobs.slice(0, opts.limit) : jobs;
        for (const j of trimmed) allJobs.push(j);
        sources.push({ ats, slug, jobs_found: trimmed.length, ms: Date.now() - t0 });
      } catch (e) {
        sources.push({ ats, slug, error: e.message, status: e.status, ms: Date.now() - t0 });
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  out({
    queried_at: new Date().toISOString(),
    sources,
    jobs_total: allJobs.length,
    jobs: allJobs,
  });
}

function listAts() {
  out({
    ats: Object.entries(ADAPTERS).map(([k, v]) => ({ name: k, docs: v.docs })),
  });
}

async function doctor() {
  // Probes a known-good or known-empty slug per ATS to verify the adapter parses.
  const probes = [
    ["greenhouse", "anthropic"],
    ["lever", "attentive"],
    ["ashby", "Ashby"],
    ["smartrecruiters", "Visa"],
    ["workable", "superhi"],
    ["recruitee", "recruitee"],
  ];
  const results = [];
  for (const [ats, slug] of probes) {
    const adapter = ADAPTERS[ats];
    const url = adapter.url(slug, {});
    try {
      const data = await fetchJson(url);
      const jobs = adapter.parse(data, slug, {});
      results.push({ ats, slug, status: "ok", count: jobs.length });
    } catch (e) {
      results.push({ ats, slug, status: "fail", error: e.message });
    }
  }
  out({ name: "ats-surface-pp-cli", version: VERSION, probes: results });
}

function version() {
  out({ name: "ats-surface-pp-cli", version: VERSION });
}

const subs = { scan, "list-ats": listAts, doctor, version, help: () => process.stdout.write(HELP) };

const [, , cmd, ...rest] = process.argv;
if (!cmd || cmd === "--help" || cmd === "-h") { process.stdout.write(HELP); process.exit(0); }
if (cmd === "--version" || cmd === "-v") { version(); process.exit(0); }
const fn = subs[cmd];
if (!fn) die(`unknown command: ${cmd} (try: scan list-ats doctor)`);
try {
  await fn(rest);
} catch (e) {
  out({ error: true, command: cmd, message: e.message });
  process.exit(2);
}
