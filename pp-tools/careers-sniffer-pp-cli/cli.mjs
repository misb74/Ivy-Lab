#!/usr/bin/env node
// careers-sniffer-pp-cli — one CLI for the careers sites NOT covered by
// ats-surface-pp-cli (Greenhouse/Lever/Ashby/SmartRecruiters/Workable/Recruitee)
// or workday-cxs-pp-cli (Workday tenants).
//
// Dispatcher architecture:
//   1. URL-pattern detection picks the cheapest extraction path
//   2. Direct API adapter (Oracle HCM Cloud)
//   3. Server-side JSON-LD extraction (HTTP fetch + parse) — SuccessFactors, iCIMS
//   4. Playwright JSON-LD fallback (browser-hydrated DOM) — SPA sites, bespoke giants
//
// Output: normalized JobPosting array matching ats-surface-pp-cli shape.

import { parseArgs } from "node:util";

const VERSION = "0.1.0";
const UA = "Mozilla/5.0 (compatible; careers-sniffer-pp-cli/0.1.0; +https://github.com/misb74/Ivy-Lab)";

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

async function fetchText(url, timeout = 15000) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) {
    const err = new Error(`${res.status} ${res.statusText} — ${url}`);
    err.status = res.status;
    throw err;
  }
  return { body: await res.text(), contentType: res.headers.get("content-type") || "", finalUrl: res.url };
}

async function fetchJson(url, timeout = 15000) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/json" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) {
    const err = new Error(`${res.status} ${res.statusText} — ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ------------------------------ normalization ------------------------------
//
// Unified output shape (matches ats-surface-pp-cli for cross-tool composability):
//
//   { platform, source_url, id, title, company, location, remote, department, team,
//     url, datePosted, employmentType, salary, description }

function normalizeJobPosting(jp, ctx = {}) {
  // jp = a schema.org JobPosting object (already parsed from JSON-LD)
  if (!jp || typeof jp !== "object") return null;
  if (jp["@type"] && !asArray(jp["@type"]).includes("JobPosting")) return null;

  const loc = firstLocation(jp.jobLocation);
  const remote = isRemote(jp);
  const salary = parseSalary(jp.baseSalary);
  const employmentType = Array.isArray(jp.employmentType)
    ? jp.employmentType[0]
    : jp.employmentType || null;

  return {
    platform: ctx.platform || "unknown",
    source_url: ctx.source_url || null,
    id: jp.identifier?.value || jp.identifier || jp["@id"] || null,
    title: jp.title || null,
    company: jp.hiringOrganization?.name || jp.hiringOrganization || null,
    location: loc,
    remote,
    department: jp.occupationalCategory || null,
    team: null,
    url: jp.url || jp.hiringOrganization?.url || ctx.source_url || null,
    datePosted: jp.datePosted || null,
    validThrough: jp.validThrough || null,
    employmentType,
    salary,
    description: ctx.full ? stripHtml(jp.description)?.slice(0, 800) : null,
  };
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v === undefined || v === null) return [];
  return [v];
}

function firstLocation(jobLocation) {
  const arr = asArray(jobLocation);
  if (!arr.length) return null;
  const l = arr[0];
  if (typeof l === "string") return l;
  const addr = l.address || l;
  return [addr.addressLocality, addr.addressRegion, addr.addressCountry]
    .filter(Boolean)
    .join(", ") || null;
}

function isRemote(jp) {
  if (jp.jobLocationType === "TELECOMMUTE") return true;
  if (jp.applicantLocationRequirements) return true;
  const blob = JSON.stringify(jp.jobLocation || "") + " " + (jp.title || "");
  return /\bremote\b|\btelecommute\b|\banywhere\b/i.test(blob);
}

function parseSalary(bs) {
  if (!bs) return null;
  const v = bs.value || {};
  return {
    currency: bs.currency || null,
    value: v.value ?? null,
    min: v.minValue ?? null,
    max: v.maxValue ?? null,
    unit: v.unitText || null,
  };
}

// ------------------------------ JSON-LD extractor ------------------------------

function extractJsonLd(html) {
  const blocks = [];
  // Tolerant of HTML-entity-encoded `+` (USAJobs ships `ld&#x2B;json`) and
  // other charset quirks between `ld` and `json`.
  const re = /<script[^>]+type=["']application\/ld[^"']*json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    const tryParse = (s) => {
      try { return JSON.parse(s); } catch { return null; }
    };
    let parsed = tryParse(raw);
    if (!parsed) {
      // Lenient retry: strip leading // line-comments + control chars.
      const cleaned = raw.replace(/^\s*\/\/.*$/gm, "").replace(/[\x00-\x1f]/g, " ");
      parsed = tryParse(cleaned);
    }
    if (!parsed) continue;
    if (Array.isArray(parsed)) for (const p of parsed) blocks.push(p);
    else if (parsed["@graph"]) for (const p of parsed["@graph"]) blocks.push(p);
    else blocks.push(parsed);
  }
  return blocks.filter((b) => {
    const t = b && (b["@type"] || b.type);
    return Array.isArray(t) ? t.includes("JobPosting") : t === "JobPosting";
  });
}

// ------------------------------ platform detection ------------------------------

const PLATFORMS = {
  "oracle-hcm": {
    docs: "https://docs.oracle.com/en/cloud/saas/talent-management/24c/farws/index.html",
    description: "Oracle HCM Cloud / Fusion Apps Candidate Experience — public REST endpoint.",
    // Examples:
    //   https://eltc.fa.us6.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs
    //   https://emnz.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1
    test: (u) => /\.fa\.[a-z0-9-]+\.oraclecloud\.com\/hcmUI\/CandidateExperience\//i.test(u.href),
    strategy: "oracle-api",
  },
  "successfactors": {
    docs: "https://help.sap.com/docs/SAP_SUCCESSFACTORS_RECRUITING",
    description: "SAP SuccessFactors Recruiting career site. JSON-LD usually present in job-detail HTML.",
    test: (u) =>
      /\.successfactors\.(com|eu|cn)$/i.test(u.hostname) ||
      /\.sapsf\.(com|eu)$/i.test(u.hostname) ||
      /\/career\?.*company=/i.test(u.href) ||
      /\/careersection\//i.test(u.pathname),
    strategy: "html-jsonld",
  },
  "icims": {
    docs: "https://www.icims.com/",
    description: "iCIMS-hosted career sites. JSON-LD JobPosting blocks live on job-detail pages.",
    test: (u) =>
      /\.icims\.com$/i.test(u.hostname) ||
      /careers-[a-z0-9-]+\.icims\.com/i.test(u.hostname),
    strategy: "html-jsonld",
  },

  // -------- bespoke F500 giants (direct internal-API adapters) --------

  "amazon": {
    docs: "https://www.amazon.jobs/en/search",
    description: "Amazon.jobs public search API (search.json). Returns up to 100 jobs/page via result_limit + offset; max 10000 hits.",
    test: (u) => /(^|\.)amazon\.jobs$/i.test(u.hostname),
    strategy: "amazon-api",
  },

  "microsoft": {
    docs: "https://jobs.careers.microsoft.com/",
    description: "Microsoft global careers site. Uses the PCSX search API at apply.careers.microsoft.com (10 jobs/page, paginated by start offset).",
    test: (u) => /(^|\.)(jobs\.)?careers\.microsoft\.com$/i.test(u.hostname),
    strategy: "microsoft-api",
  },

  "google": {
    docs: "https://www.google.com/about/careers/applications/jobs/results/",
    description: "Google careers (careers.google.com / google.com/about/careers). Internal Google WIZ SPA — job listings are server-injected into the HTML via AF_initDataCallback under key 'ds:1' and require a real browser context (Playwright) to fetch reliably.",
    test: (u) =>
      /(?:^|\.)careers\.google\.com$/i.test(u.hostname) ||
      (/(?:^|\.)google\.com$/i.test(u.hostname) && /\/about\/careers\//i.test(u.pathname)),
    strategy: "google-wiz-preload",
  },

  "meta": {
    docs: "https://www.metacareers.com/",
    description: "Meta Careers (metacareers.com). Bespoke Relay/GraphQL site, no public ATS. Adapter uses Playwright warm-up + page-context POST to /graphql.",
    test: (u) => /(^|\.)metacareers\.com$/i.test(u.hostname),
    strategy: "meta-api",
  },

  "apple": {
    docs: "https://jobs.apple.com — undocumented REST API at /api/v1/search (CSRF-protected via /api/v1/CSRFToken).",
    description: "Apple Careers (jobs.apple.com). Undocumented internal REST API; CSRF token + session cookies obtained from /api/v1/CSRFToken. Page size = 20.",
    test: (u) =>
      /(?:^|\.)jobs\.apple\.com$/i.test(u.hostname) ||
      (/(?:^|\.)apple\.com$/i.test(u.hostname) && /\/jobs/i.test(u.pathname)),
    strategy: "apple-api",
  },
};

function detectPlatform(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return { platform: "invalid", strategy: null, error: `invalid url: ${rawUrl}` }; }
  for (const [name, def] of Object.entries(PLATFORMS)) {
    if (def.test(u)) return { platform: name, strategy: def.strategy };
  }
  return { platform: "unknown", strategy: "playwright-jsonld" };
}

// ------------------------------ adapter: oracle-hcm ------------------------------
//
// Oracle exposes a public REST endpoint at:
//   https://{tenant}.fa.{region}.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions
//     ?onlyData=true
//     &expand=requisitionList.secondaryLocations,flexFieldsFacet.values
//     &finder=findReqs;siteNumber={SITE}
//     &limit={N}
// where SITE is the slug after /sites/ in the careers URL.

function deriveOracleParts(careerUrl) {
  const u = new URL(careerUrl);
  const m = u.pathname.match(/\/sites\/([^/?#]+)/i);
  const site = m ? m[1] : "CX_1";
  return { base: `${u.protocol}//${u.host}`, site };
}

async function oracleHcmAdapter(careerUrl, opts) {
  const { base, site } = deriveOracleParts(careerUrl);
  const limit = opts.limit || 200;
  const api =
    `${base}/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
    `?onlyData=true` +
    `&expand=requisitionList.secondaryLocations,flexFieldsFacet.values` +
    `&finder=findReqs;siteNumber=${encodeURIComponent(site)}` +
    `&limit=${limit}`;
  const data = await fetchJson(api);
  const items = data?.items?.[0]?.requisitionList || data?.items || [];
  return items.map((j) => ({
    platform: "oracle-hcm",
    source_url: careerUrl,
    id: String(j.Id || j.id || j.RequisitionId || ""),
    title: j.Title || j.title || null,
    company: j.PrimaryWorkLocationCompanyName || null,
    location: j.PrimaryLocation || j.primaryLocation || null,
    remote: /remote|telecommute|anywhere/i.test(j.PrimaryLocation || ""),
    department: j.Category || null,
    team: null,
    url: j.ExternalUrl || `${base}/hcmUI/CandidateExperience/en/sites/${site}/job/${j.Id}`,
    datePosted: j.PostedDate || null,
    validThrough: null,
    employmentType: j.WorkerType || null,
    salary: null,
    description: opts.full ? stripHtml(j.ShortDescriptionStr || j.ExternalDescriptionStr)?.slice(0, 800) : null,
  }));
}

// ------------------------------ adapter: amazon ------------------------------

async function amazonJobsAdapter(careerUrl, opts = {}) {
  const u = new URL(careerUrl);
  const limit = opts.limit || 100;
  const PAGE = 100;
  const inP = u.searchParams;

  const apiParams = new URLSearchParams();
  const passthrough = [
    "base_query", "loc_query", "latitude", "longitude", "radius",
    "loc_group_id", "category", "sort", "business_category",
  ];
  for (const key of passthrough) {
    const v = inP.get(key);
    if (v) apiParams.set(key, v);
  }
  const countries = [
    ...inP.getAll("country[]"),
    ...inP.getAll("normalized_country_code[]"),
    ...inP.getAll("country"),
  ].filter(Boolean);
  for (const c of countries) apiParams.append("normalized_country_code[]", c);
  for (const f of inP.getAll("category[]")) apiParams.append("category[]", f);
  for (const f of inP.getAll("job_function_id[]")) apiParams.append("job_function_id[]", f);
  for (const f of inP.getAll("business_category[]")) apiParams.append("business_category[]", f);
  if (!apiParams.get("sort")) apiParams.set("sort", "recent");

  const collected = [];
  let offset = 0;
  while (collected.length < limit) {
    const need = Math.min(PAGE, limit - collected.length);
    const p = new URLSearchParams(apiParams);
    p.set("offset", String(offset));
    p.set("result_limit", String(need));
    const apiUrl = `https://www.amazon.jobs/en/search.json?${p.toString()}`;
    const data = await fetchJson(apiUrl);
    const batch = Array.isArray(data?.jobs) ? data.jobs : [];
    if (batch.length === 0) break;
    collected.push(...batch);
    if (batch.length < need) break;
    offset += batch.length;
    if (typeof data.hits === "number" && offset >= data.hits) break;
  }

  return collected.slice(0, limit).map((j) => {
    const locText = j.normalized_location || j.location || "";
    const remote = /\bremote\b|\bvirtual\b|\btelecommute\b|\banywhere\b/i.test(locText) ||
                   /\bremote\b|\bvirtual\b/i.test(j.title || "");
    const detailPath = j.job_path || (j.id_icims ? `/en/jobs/${j.id_icims}` : null);
    const detailUrl = detailPath ? `https://www.amazon.jobs${detailPath}` : careerUrl;
    const empType = j.job_schedule_type
      ? j.job_schedule_type.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(" ")
      : null;
    return {
      platform: "amazon",
      source_url: careerUrl,
      id: String(j.id_icims || j.id || ""),
      title: j.title || null,
      company: "Amazon",
      location: locText || null,
      remote,
      department: j.business_category || j.job_category || null,
      team: j.team?.label || j.job_family || null,
      url: detailUrl,
      datePosted: j.posted_date || null,
      validThrough: null,
      employmentType: empType,
      salary: null,
      description: opts.full ? stripHtml(j.description || j.description_short)?.slice(0, 800) : null,
    };
  });
}

// ------------------------------ adapter: microsoft ------------------------------

async function microsoftCareersAdapter(careerUrl, opts = {}) {
  const u = new URL(careerUrl);
  const lc = u.searchParams.get("lc") || "";
  const q = u.searchParams.get("q") || u.searchParams.get("query") || "";
  const limit = Math.max(1, Math.min(opts.limit || 50, 500));

  const API = "https://apply.careers.microsoft.com/api/pcsx/search";
  const headers = {
    "User-Agent": UA,
    "Accept": "application/json",
    "Referer": "https://jobs.careers.microsoft.com/",
    "Origin": "https://jobs.careers.microsoft.com",
  };

  const jobs = [];
  let start = 0;
  let total = Infinity;
  const seen = new Set();
  while (jobs.length < limit && start < total) {
    const params = new URLSearchParams({ domain: "microsoft.com", query: q, location: lc, start: String(start) });
    const url = `${API}?${params.toString()}&`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      const e = new Error(`microsoft pcsx ${res.status} ${res.statusText}`);
      e.status = res.status;
      throw e;
    }
    const j = await res.json();
    if (j.status && j.status !== 200) throw new Error(`microsoft pcsx api error: ${JSON.stringify(j.error || {})}`);
    const positions = j?.data?.positions || [];
    total = typeof j?.data?.count === "number" ? j.data.count : positions.length;
    if (positions.length === 0) break;
    for (const p of positions) {
      const id = String(p.id || p.displayJobId || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const locations = Array.isArray(p.locations) ? p.locations : [];
      const locStr = locations.join(" | ") || null;
      const flex = (p.workLocationOption || p.locationFlexibility || "").toString().toLowerCase();
      const remote = /remote|telework|anywhere|hybrid/i.test(flex) || /remote/i.test(locStr || "");
      jobs.push({
        platform: "microsoft",
        source_url: careerUrl,
        id,
        title: p.name || null,
        company: "Microsoft",
        location: locStr,
        remote,
        department: p.department || null,
        team: null,
        url: `https://jobs.careers.microsoft.com/global/en/job/${id}`,
        datePosted: p.postedTs ? new Date(p.postedTs * 1000).toISOString() : null,
        validThrough: null,
        employmentType: null,
        salary: null,
        description: null,
      });
      if (jobs.length >= limit) break;
    }
    start += positions.length;
    if (positions.length < 10) break;
  }

  if (opts.full && jobs.length) {
    const DETAIL = "https://apply.careers.microsoft.com/api/pcsx/position_details";
    const CONC = 4;
    let i = 0;
    async function worker() {
      while (i < jobs.length) {
        const idx = i++;
        const job = jobs[idx];
        try {
          const url = `${DETAIL}?position_id=${encodeURIComponent(job.id)}&domain=microsoft.com&hl=en`;
          const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
          if (!res.ok) continue;
          const dj = await res.json();
          const p = dj?.data || {};
          if (p.jobDescription) job.description = stripHtml(String(p.jobDescription)).slice(0, 800);
          const et = p.efcustomTextEmploymentType;
          if (Array.isArray(et) && et.length) job.employmentType = et.join(", ");
          else if (typeof et === "string") job.employmentType = et;
        } catch {}
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONC, jobs.length) }, () => worker()));
  }

  return jobs;
}

// ------------------------------ adapter: google ------------------------------

function parseGoogleSearchParams(careerUrl) {
  const u = new URL(careerUrl);
  return {
    location: u.searchParams.get("location") || null,
    q: u.searchParams.get("q") || null,
    target_level: u.searchParams.get("target_level") || null,
    employment_type: u.searchParams.get("employment_type") || null,
    degree: u.searchParams.get("degree") || null,
    page: Number(u.searchParams.get("page") || "1"),
  };
}

function extractGoogleDs1(html) {
  const anchor = html.search(/key:\s*['"]ds:1['"]/);
  if (anchor < 0) return null;
  const dataIdx = html.indexOf("data:", anchor);
  if (dataIdx < 0) return null;
  const i = html.indexOf("[", dataIdx);
  if (i < 0) return null;
  let depth = 0, end = -1, inStr = false, esc = false, strCh = null;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (esc) { esc = false; continue; }
    if (inStr) {
      if (c === "\\") { esc = true; continue; }
      if (c === strCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) { end = j; break; } }
  }
  if (end < 0) return null;
  const raw = html.slice(i, end + 1);
  try { return JSON.parse(raw); } catch { return null; }
}

function normalizeGoogleJob(j, careerUrl) {
  if (!Array.isArray(j) || j.length < 12) return null;
  const id = j[0];
  const title = j[1] || null;
  let location = null, remote = false;
  if (Array.isArray(j[9]) && j[9].length) {
    const locs = j[9].map((l) => (Array.isArray(l) ? l[0] : null)).filter(Boolean);
    location = locs.join("; ") || null;
    remote = /\b(remote|telecommute|anywhere)\b/i.test(location || "");
  }
  let datePosted = null;
  if (Array.isArray(j[14]) && typeof j[14][0] === "number") {
    datePosted = new Date(j[14][0] * 1000).toISOString();
  }
  let descRaw = null;
  if (Array.isArray(j[10]) && typeof j[10][1] === "string") descRaw = j[10][1];
  else if (Array.isArray(j[3]) && typeof j[3][1] === "string") descRaw = j[3][1];
  const company = typeof j[7] === "string" && j[7] ? j[7] : "Google";
  const detailUrl = id
    ? `https://www.google.com/about/careers/applications/jobs/results/${id}`
    : (j[2] || careerUrl);
  return {
    platform: "google",
    source_url: careerUrl,
    id: String(id),
    title,
    company,
    location,
    remote,
    department: null,
    team: null,
    url: detailUrl,
    datePosted,
    validThrough: null,
    employmentType: null,
    salary: null,
    description: null,
    _descRaw: descRaw,
  };
}

async function googleCareersAdapter(careerUrl, opts = {}) {
  const browser = await getPlaywrightBrowser();
  const params = parseGoogleSearchParams(careerUrl);
  const limit = opts.limit || 200;
  const targetPages = Math.max(1, Math.ceil(limit / 20));
  const results = [];
  const seen = new Set();
  let total = null;
  for (let p = params.page; p < params.page + targetPages; p++) {
    const u = new URL(careerUrl);
    u.searchParams.set("page", String(p));
    const ctx = await browser.newContext({ userAgent: UA });
    const page = await ctx.newPage();
    try {
      await page.goto(u.toString(), { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(opts.hydrateMs || 600);
      const html = await page.content();
      const ds1 = extractGoogleDs1(html);
      if (!ds1 || !Array.isArray(ds1[0])) break;
      if (typeof ds1[2] === "number") total = ds1[2];
      let added = 0;
      for (const j of ds1[0]) {
        const norm = normalizeGoogleJob(j, careerUrl);
        if (!norm) continue;
        if (seen.has(norm.id)) continue;
        seen.add(norm.id);
        if (opts.full && norm._descRaw) norm.description = stripHtml(norm._descRaw).slice(0, 800);
        delete norm._descRaw;
        results.push(norm);
        added++;
        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
      if (added === 0) break;
      if (total !== null && results.length >= total) break;
    } finally {
      await ctx.close().catch(() => {});
    }
  }
  return results;
}

// ------------------------------ adapter: meta ------------------------------

async function metaCareersAdapter(careerUrl, opts = {}) {
  const META_DOC_ID = "29615178951461218";

  function parseMetaSearchInput(u) {
    const arrayKeys = ["offices", "roles", "teams", "sub_teams", "divisions", "leadership_levels", "saved_jobs", "saved_searches"];
    const si = {
      q: null, divisions: [], offices: [], roles: [], leadership_levels: [],
      saved_jobs: [], saved_searches: [], sub_teams: [], teams: [],
      is_leadership: false, is_remote_only: false, sort_by_new: false,
      results_per_page: null,
    };
    for (const [k, v] of u.searchParams) {
      if (k === "q") { si.q = v || null; continue; }
      if (k === "is_leadership") { si.is_leadership = v === "true" || v === "1"; continue; }
      if (k === "is_remote_only") { si.is_remote_only = v === "true" || v === "1"; continue; }
      if (k === "sort_by_new") { si.sort_by_new = v === "true" || v === "1"; continue; }
      const m = k.match(/^([a-z_]+)\[\d*\]$/);
      if (m && arrayKeys.includes(m[1])) { si[m[1]].push(v); continue; }
      if (arrayKeys.includes(k)) { si[k].push(v); continue; }
    }
    return si;
  }

  function sniffEmploymentType(teams) {
    if (!Array.isArray(teams)) return null;
    const joined = teams.join(" ").toLowerCase();
    if (joined.includes("internship")) return "INTERN";
    if (joined.includes("university grad")) return "FULL_TIME";
    return null;
  }

  const url = new URL(careerUrl);
  const search_input = parseMetaSearchInput(url);

  const browser = await getPlaywrightBrowser();
  const context = await browser.newContext({ userAgent: UA });
  const page = await context.newPage();
  try {
    const warmupUrl = "https://www.metacareers.com/jobs" + (careerUrl.includes("?") ? careerUrl.slice(careerUrl.indexOf("?")) : "");
    await page.goto(warmupUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(opts.hydrateMs || 1200);

    const payload = await page.evaluate(async ({ search_input, doc_id }) => {
      const body = new URLSearchParams({
        av: "0", __user: "0", __a: "1",
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: "CareersJobSearchResultsDataQuery",
        variables: JSON.stringify({ search_input }),
        doc_id,
      });
      const r = await fetch("/graphql", {
        method: "POST",
        body,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        credentials: "include",
      });
      const text = await r.text();
      let parsed = null; try { parsed = JSON.parse(text); } catch {}
      return { status: r.status, parsed, raw: parsed ? null : text.slice(0, 500) };
    }, { search_input, doc_id: META_DOC_ID });

    if (payload.status !== 200 || !payload.parsed) {
      throw new Error(`meta graphql status=${payload.status} body=${payload.raw || "(non-json)"}`);
    }
    const node = payload.parsed?.data?.job_search_with_featured_jobs;
    if (!node) throw new Error("meta graphql: unexpected shape (no job_search_with_featured_jobs)");
    const all = Array.isArray(node.all_jobs) ? node.all_jobs : [];

    const jobs = all.map((j) => {
      const locations = Array.isArray(j.locations) ? j.locations : [];
      const teams = Array.isArray(j.teams) ? j.teams : [];
      const subTeams = Array.isArray(j.sub_teams) ? j.sub_teams : [];
      return {
        platform: "meta",
        source_url: careerUrl,
        id: j.id || null,
        title: j.title || null,
        company: "Meta",
        location: locations[0] || null,
        remote: locations.some((l) => /remote/i.test(l)),
        department: teams[0] || null,
        team: subTeams[0] || null,
        url: j.id ? `https://www.metacareers.com/jobs/${j.id}/` : careerUrl,
        datePosted: null,
        validThrough: null,
        employmentType: sniffEmploymentType(teams),
        salary: null,
        description: null,
      };
    });

    if (opts.full && jobs.length) {
      const limit = Math.min(jobs.length, opts.fullLimit || 5);
      for (let i = 0; i < limit; i++) {
        const j = jobs[i];
        try {
          const detail = await page.evaluate(async (u) => {
            const r = await fetch(u, { credentials: "include" });
            const html = await r.text();
            const m = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
            const og = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/);
            return { jsonld: m ? m[1] : null, og: og ? og[1] : null };
          }, j.url);
          if (detail.jsonld) {
            try {
              const jp = JSON.parse(detail.jsonld);
              if (jp.description) j.description = stripHtml(jp.description).slice(0, 800);
              if (jp.datePosted) j.datePosted = jp.datePosted;
              if (jp.validThrough) j.validThrough = jp.validThrough;
              if (jp.employmentType && !j.employmentType) j.employmentType = jp.employmentType;
            } catch {}
          }
          if (!j.description && detail.og) j.description = stripHtml(detail.og).slice(0, 800);
        } catch { /* skip on per-job failure */ }
      }
    }
    return jobs;
  } finally {
    await context.close().catch(() => {});
  }
}

// ------------------------------ adapter: apple ------------------------------

const APPLE_COUNTRY_SLUG_TO_ISO = {
  "united-states": "USA", "united-kingdom": "GBR", "ireland": "IRL",
  "germany": "DEU", "france": "FRA", "spain": "ESP", "italy": "ITA",
  "netherlands": "NLD", "switzerland": "CHE", "sweden": "SWE",
  "japan": "JPN", "china-mainland": "CHN", "india": "IND",
  "singapore": "SGP", "australia": "AUS", "canada": "CAN",
  "mexico": "MEX", "brazil": "BRA", "south-korea": "KOR",
  "taiwan": "TWN", "hong-kong": "HKG", "uae": "ARE",
  "united-arab-emirates": "ARE",
};

function parseAppleSetCookies(headers) {
  const getSetCookie = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : null;
  const raw = getSetCookie || (headers.raw ? headers.raw()["set-cookie"] : null);
  if (!raw) {
    const combined = headers.get("set-cookie");
    if (!combined) return "";
    const parts = combined.split(/,(?=\s*[A-Za-z0-9_-]+=)/);
    return parts.map(c => c.split(";")[0].trim()).filter(Boolean).join("; ");
  }
  return raw.map(c => c.split(";")[0].trim()).filter(Boolean).join("; ");
}

function parseAppleSearchUrl(careerUrl) {
  let u;
  try { u = new URL(careerUrl); } catch { return { locations: [], teams: [], query: "" }; }
  const params = u.searchParams;
  const locations = [];
  const locationParam = params.get("location");
  if (locationParam) {
    const codeMatch = locationParam.match(/-([A-Z]{3})$/);
    if (codeMatch) {
      locations.push(`postLocation-${codeMatch[1]}`);
    } else {
      const iso = APPLE_COUNTRY_SLUG_TO_ISO[locationParam.toLowerCase()];
      if (iso) locations.push(`postLocation-${iso}`);
    }
  }
  const teams = [];
  const teamParam = params.get("team");
  if (teamParam) {
    const m = teamParam.match(/-([A-Z]{2,}(?:-[A-Z]{2,})?)$/);
    if (m) teams.push(`teamsAndSubTeams-${m[1]}`);
  }
  const query = params.get("search") || params.get("q") || "";
  return { locations, teams, query };
}

async function appleGetCsrfToken() {
  const res = await fetch("https://jobs.apple.com/api/v1/CSRFToken", {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json",
      "Referer": "https://jobs.apple.com/en-us/search",
      "browserlocale": "en-us",
      "locale": "en_US",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`apple CSRF token fetch failed: ${res.status}`);
  const token = res.headers.get("x-apple-csrf-token");
  if (!token) throw new Error("apple CSRF token missing from response");
  return { token, cookie: parseAppleSetCookies(res.headers) };
}

async function appleSearchPage({ token, cookie, query, locations, teams, page }) {
  const res = await fetch("https://jobs.apple.com/api/v1/search", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Referer": "https://jobs.apple.com/en-us/search",
      "browserlocale": "en-us",
      "locale": "en_US",
      "x-apple-csrf-token": token,
      "Cookie": cookie,
    },
    body: JSON.stringify({
      query: query || "",
      filters: {
        ...(locations.length ? { locations } : {}),
        ...(teams.length ? { teams } : {}),
      },
      page: page || 1,
      locale: "en-us",
      sort: "",
      format: { longDate: "MMMM D, YYYY", mediumDate: "MMM D, YYYY" },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`apple search failed: ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json();
}

function normalizeAppleJob(raw, careerUrl, opts) {
  if (!raw || typeof raw !== "object") return null;
  const full = opts && opts.full;
  const loc = (raw.locations && raw.locations[0]) || {};
  const locName = loc.name || loc.countryName || null;
  const id = raw.positionId || raw.id || raw.jobPositionId || null;
  const slug = raw.transformedPostingTitle || (raw.postingTitle || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const teamCode = (raw.team && raw.team.teamCode) || "";
  const detailId = raw.id || (raw.positionId && loc.postLocationId ? `${raw.positionId}-${loc.postLocationId.replace(/^postLocation-/, "")}` : raw.positionId);
  const url = detailId
    ? `https://jobs.apple.com/en-us/details/${detailId}/${slug}${teamCode ? `?team=${teamCode}` : ""}`
    : null;
  const homeOffice = raw.homeOffice === true;
  const remote = homeOffice || /remote/i.test(raw.postingTitle || "") || /home office/i.test(raw.jobSummary || "");
  let employmentType = null;
  if (typeof raw.standardWeeklyHours === "number") {
    employmentType = raw.standardWeeklyHours >= 35 ? "FULL_TIME" : "PART_TIME";
  }
  return {
    platform: "apple",
    source_url: careerUrl,
    id,
    title: raw.postingTitle || null,
    company: "Apple",
    location: locName,
    remote,
    department: (raw.team && raw.team.teamName) || null,
    team: teamCode || null,
    url,
    datePosted: raw.postDateInGMT || raw.postingDate || null,
    validThrough: null,
    employmentType,
    salary: null,
    description: full ? (stripHtml(raw.jobSummary) || "").slice(0, 800) : null,
  };
}

async function appleCareersAdapter(careerUrl, opts = {}) {
  const { locations, teams, query } = parseAppleSearchUrl(careerUrl);
  const { token, cookie } = await appleGetCsrfToken();
  const maxPages = opts.maxPages || 5;
  const maxJobs = opts.limit || 100;
  const all = [];
  for (let p = 1; p <= maxPages; p++) {
    const data = await appleSearchPage({ token, cookie, query, locations, teams, page: p });
    const results = (data && data.res && data.res.searchResults) || [];
    if (results.length === 0) break;
    for (const r of results) {
      const job = normalizeAppleJob(r, careerUrl, { full: opts.full });
      if (job) all.push(job);
      if (all.length >= maxJobs) break;
    }
    if (all.length >= maxJobs) break;
    if (results.length < 20) break;
  }
  return all;
}

// ------------------------------ strategy: html-jsonld ------------------------------

async function htmlJsonLdStrategy(url, ctx, opts) {
  const { body, finalUrl } = await fetchText(url);
  const postings = extractJsonLd(body);
  return postings
    .map((jp) => normalizeJobPosting(jp, { platform: ctx.platform, source_url: finalUrl || url, full: opts.full }))
    .filter(Boolean);
}

// ------------------------------ strategy: playwright-jsonld ------------------------------

let _playwrightBrowser = null;
let _playwrightPromise = null;

async function getPlaywrightBrowser() {
  if (_playwrightBrowser) return _playwrightBrowser;
  if (_playwrightPromise) return _playwrightPromise;
  _playwrightPromise = (async () => {
    let pw;
    try {
      pw = await import("playwright");
    } catch (e) {
      throw new Error(
        "playwright not available — install with: npm i -g playwright && npx playwright install chromium"
      );
    }
    _playwrightBrowser = await pw.chromium.launch({ headless: true });
    return _playwrightBrowser;
  })();
  return _playwrightPromise;
}

async function closePlaywright() {
  if (_playwrightBrowser) {
    await _playwrightBrowser.close().catch(() => {});
    _playwrightBrowser = null;
  }
}

async function playwrightJsonLdStrategy(url, ctx, opts) {
  const browser = await getPlaywrightBrowser();
  const context = await browser.newContext({ userAgent: UA });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    // Tiny grace period for late-hydrating JSON-LD injectors.
    await page.waitForTimeout(opts.hydrateMs || 500);
    const html = await page.content();
    const postings = extractJsonLd(html);
    return postings
      .map((jp) => normalizeJobPosting(jp, { platform: ctx.platform || "unknown", source_url: url, full: opts.full }))
      .filter(Boolean);
  } finally {
    await context.close().catch(() => {});
  }
}

// ------------------------------ unified dispatcher ------------------------------

async function extractOne(url, opts) {
  const det = detectPlatform(url);
  if (det.error) return { url, platform: det.platform, error: det.error, jobs: [] };

  const t0 = Date.now();
  const strategies = [];
  // Single-shot bespoke adapters: no fallback (a JSON-LD swing is unlikely to help if
  // the company's own internal API didn't respond). Generic platforms try cheap HTTP first
  // then upgrade to Playwright unless --no-playwright / --ssr-only is set.
  const SINGLE_SHOT = new Set(["oracle-api", "amazon-api", "microsoft-api", "google-wiz-preload", "meta-api", "apple-api"]);
  const planned =
    SINGLE_SHOT.has(det.strategy) ? [det.strategy] :
    det.strategy === "html-jsonld" ? (opts.noPlaywright ? ["html-jsonld"] : ["html-jsonld", "playwright-jsonld"]) :
    /* playwright-jsonld */ (opts.ssrOnly || opts.noPlaywright ? ["html-jsonld"] : ["html-jsonld", "playwright-jsonld"]);

  let jobs = [];
  let lastError = null;

  for (const strat of planned) {
    const s0 = Date.now();
    try {
      if (strat === "oracle-api") {
        jobs = await oracleHcmAdapter(url, opts);
      } else if (strat === "amazon-api") {
        jobs = await amazonJobsAdapter(url, opts);
      } else if (strat === "microsoft-api") {
        jobs = await microsoftCareersAdapter(url, opts);
      } else if (strat === "google-wiz-preload") {
        jobs = await googleCareersAdapter(url, opts);
      } else if (strat === "meta-api") {
        jobs = await metaCareersAdapter(url, opts);
      } else if (strat === "apple-api") {
        jobs = await appleCareersAdapter(url, opts);
      } else if (strat === "html-jsonld") {
        jobs = await htmlJsonLdStrategy(url, { platform: det.platform }, opts);
      } else if (strat === "playwright-jsonld") {
        jobs = await playwrightJsonLdStrategy(url, { platform: det.platform }, opts);
      }
      strategies.push({ strategy: strat, ms: Date.now() - s0, jobs_found: jobs.length });
      if (jobs.length > 0) break; // first successful strategy with results wins
    } catch (e) {
      strategies.push({ strategy: strat, ms: Date.now() - s0, error: e.message });
      lastError = e;
    }
  }

  return {
    url,
    platform: det.platform,
    strategy_chain: strategies,
    ms_total: Date.now() - t0,
    jobs_found: jobs.length,
    jobs,
    ...(jobs.length === 0 && lastError ? { error: lastError.message } : {}),
  };
}

// ------------------------------ commands ------------------------------

const HELP = `careers-sniffer-pp-cli ${VERSION} — careers-site extraction for everything ats-surface and workday-cxs don't cover

Usage:
  careers-sniffer-pp-cli <command> [flags]

Commands:
  extract <url>             Extract jobs from one URL.
  scan <url> [<url> ...]    Fan out across multiple URLs in parallel.
  detect <url>              Classify the URL's platform without fetching jobs.
  list-platforms            Print known platforms and detection patterns.
  doctor                    Health probe — runs one known-good URL per strategy.
  version                   Print version.
  help                      This help.

Flags:
  --full              Include description text (truncated to 800 chars per job).
  --limit <n>         Cap jobs per URL (API-side where supported, slice otherwise).
  --concurrency <n>   Parallel URLs in scan (default = number of URLs, max 6).
  --no-playwright     Disable the Playwright fallback (HTML-only).
  --ssr-only          Alias of --no-playwright for clarity in scripts.
  --agent             Stable machine-mode (currently same as default JSON output).
  --hydrate-ms <n>    Extra wait after networkidle in Playwright mode (default 500).

Known platforms (v0.1):
  oracle-hcm      — direct REST API
  successfactors  — server-side JSON-LD
  icims           — server-side JSON-LD
  amazon          — amazon.jobs/search.json (direct API)
  microsoft       — apply.careers.microsoft.com/api/pcsx (direct API)
  google          — careers.google.com (WIZ preload, Playwright required)
  meta            — metacareers.com (GraphQL via Playwright)
  apple           — jobs.apple.com (CSRF-protected direct API)
  unknown         — Playwright + JSON-LD fallback for any other SPA

Examples:
  careers-sniffer-pp-cli extract "https://www.amazon.jobs/en/search?country%5B%5D=GBR"
  careers-sniffer-pp-cli extract "https://jobs.careers.microsoft.com/global/en/search?lc=United%20Kingdom"
  careers-sniffer-pp-cli extract "https://jobs.apple.com/en-us/search?location=united-kingdom-GBR" --full
  careers-sniffer-pp-cli scan url-a url-b url-c | jq '[.results[] | .jobs[]] | length'
`;

async function extractCmd(rest) {
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      full: { type: "boolean" },
      limit: { type: "string" },
      "no-playwright": { type: "boolean" },
      "ssr-only": { type: "boolean" },
      agent: { type: "boolean" },
      "hydrate-ms": { type: "string" },
    },
  });
  if (!positionals.length) die("extract requires a <url> arg");
  if (positionals.length > 1) die("extract takes exactly one URL — use 'scan' for multiple");
  const opts = optsFromValues(values);
  try {
    const result = await extractOne(positionals[0], opts);
    out({ queried_at: new Date().toISOString(), ...result });
  } finally {
    await closePlaywright();
  }
}

function optsFromValues(values) {
  return {
    full: !!values.full,
    limit: parseInt(values.limit || "0", 10) || undefined,
    noPlaywright: !!(values["no-playwright"] || values["ssr-only"]),
    ssrOnly: !!values["ssr-only"],
    hydrateMs: parseInt(values["hydrate-ms"] || "0", 10) || undefined,
  };
}

async function scanCmd(rest) {
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      full: { type: "boolean" },
      limit: { type: "string" },
      concurrency: { type: "string" },
      "no-playwright": { type: "boolean" },
      "ssr-only": { type: "boolean" },
      agent: { type: "boolean" },
      "hydrate-ms": { type: "string" },
    },
  });
  if (!positionals.length) die("scan requires one or more <url> args");
  const opts = optsFromValues(values);
  const concurrency = Math.min(parseInt(values.concurrency || String(positionals.length), 10) || 1, 6);

  const results = [];
  let i = 0;
  async function worker() {
    while (i < positionals.length) {
      const idx = i++;
      const r = await extractOne(positionals[idx], opts);
      results.push(r);
    }
  }
  try {
    await Promise.all(Array.from({ length: concurrency }, worker));
    const allJobs = results.flatMap((r) => r.jobs);
    out({
      queried_at: new Date().toISOString(),
      urls_total: positionals.length,
      jobs_total: allJobs.length,
      results,
      jobs: allJobs,
    });
  } finally {
    await closePlaywright();
  }
}

function detectCmd(rest) {
  if (!rest.length) die("detect requires a <url> arg");
  const det = detectPlatform(rest[0]);
  out({ url: rest[0], ...det });
}

function listPlatformsCmd() {
  out({
    platforms: Object.entries(PLATFORMS).map(([name, def]) => ({
      name,
      strategy: def.strategy,
      description: def.description,
      docs: def.docs,
    })),
    fallback: { name: "unknown", strategy: "playwright-jsonld", description: "Generic Playwright + JSON-LD JobPosting extraction for SPA / bespoke career sites." },
  });
}

async function doctorCmd() {
  // Lightweight probes — confirm the dispatcher and Playwright availability.
  // We do NOT make external calls in doctor; we only verify detection + Playwright load.
  const probes = [
    { url: "https://eltc.fa.us6.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs", expect: "oracle-hcm" },
    { url: "https://career.successfactors.com/career?company=tenantA", expect: "successfactors" },
    { url: "https://careers-acme.icims.com/jobs/12345/foo/job", expect: "icims" },
    { url: "https://www.amazon.jobs/en/search?country%5B%5D=GBR", expect: "amazon" },
    { url: "https://jobs.careers.microsoft.com/global/en/search?lc=United%20Kingdom", expect: "microsoft" },
    { url: "https://www.google.com/about/careers/applications/jobs/results/?location=London", expect: "google" },
    { url: "https://www.metacareers.com/jobs?offices%5B0%5D=London%2C+UK", expect: "meta" },
    { url: "https://jobs.apple.com/en-us/search?location=united-kingdom-GBR", expect: "apple" },
    { url: "https://example.com/some-unknown-careers-page", expect: "unknown" },
  ];
  const detection = probes.map((p) => {
    const det = detectPlatform(p.url);
    return { ...p, got: det.platform, ok: det.platform === p.expect, strategy: det.strategy };
  });

  let playwrightOk = false;
  let playwrightError = null;
  try {
    const browser = await getPlaywrightBrowser();
    playwrightOk = !!browser;
    await closePlaywright();
  } catch (e) {
    playwrightError = e.message;
  }

  out({
    name: "careers-sniffer-pp-cli",
    version: VERSION,
    detection,
    playwright: { available: playwrightOk, error: playwrightError },
  });
}

function versionCmd() {
  out({ name: "careers-sniffer-pp-cli", version: VERSION });
}

const subs = {
  extract: extractCmd,
  scan: scanCmd,
  detect: detectCmd,
  "list-platforms": listPlatformsCmd,
  doctor: doctorCmd,
  version: versionCmd,
  help: () => process.stdout.write(HELP),
};

const [, , cmd, ...rest] = process.argv;
if (!cmd || cmd === "--help" || cmd === "-h") { process.stdout.write(HELP); process.exit(0); }
if (cmd === "--version" || cmd === "-v") { versionCmd(); process.exit(0); }
const fn = subs[cmd];
if (!fn) die(`unknown command: ${cmd} (try: extract scan detect list-platforms doctor)`);
try {
  await fn(rest);
  process.exit(0);
} catch (e) {
  out({ error: true, command: cmd, message: e.message });
  await closePlaywright().catch(() => {});
  process.exit(2);
}
