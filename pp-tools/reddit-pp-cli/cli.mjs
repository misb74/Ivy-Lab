#!/usr/bin/env node
// reddit-pp-cli — Bash-pipeable Reddit research CLI.
// Uses Reddit OAuth client_credentials grant. No user account required.
//
// One-time setup:
//   1. Go to https://www.reddit.com/prefs/apps and click "create another app".
//   2. Type: "script". Redirect URL: http://localhost (any value works for client_credentials).
//   3. Copy the client_id (under "personal use script") and client_secret.
//   4. Add to .env (or env): REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET.
//   5. Optional: REDDIT_USERNAME (improves rate limits and is required by Reddit's UA policy).

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { parseArgs } from "node:util";

const VERSION = "0.1.0";
const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API_BASE = "https://oauth.reddit.com";
const CACHE_DIR = join(homedir(), ".cache", "reddit-pp-cli");
const TOKEN_CACHE = join(CACHE_DIR, "token.json");

function die(msg, code = 1) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}

function out(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

function loadDotenv() {
  const path = join(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["'](.*)["']$/, "$1");
  }
}

function getCreds() {
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) loadDotenv();
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  const user = process.env.REDDIT_USERNAME || "ivy-lab-research";
  if (!id || !secret) {
    const e = new Error(
      "REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET not set. " +
      "One-time setup at https://www.reddit.com/prefs/apps (create a 'script' type app), " +
      "then add the values to ./.env. See `reddit-pp-cli help`.",
    );
    e.code = "missing_creds";
    throw e;
  }
  const ua = `pp-cli:reddit-pp-cli:${VERSION} (by /u/${user})`;
  return { id, secret, ua };
}

function readTokenCache() {
  try {
    if (!existsSync(TOKEN_CACHE)) return null;
    const j = JSON.parse(readFileSync(TOKEN_CACHE, "utf8"));
    if (j.expires_at && Date.now() < j.expires_at - 60_000) return j.token;
    return null;
  } catch { return null; }
}

function writeTokenCache(token, expiresInSec) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    const expires_at = Date.now() + expiresInSec * 1000;
    writeFileSync(TOKEN_CACHE, JSON.stringify({ token, expires_at }), { mode: 0o600 });
  } catch { /* non-fatal */ }
}

async function getToken({ id, secret, ua }) {
  const cached = readTokenCache();
  if (cached) return cached;
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": ua,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`token request failed: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
  }
  const j = await res.json();
  if (!j.access_token) throw new Error(`token response missing access_token: ${JSON.stringify(j)}`);
  writeTokenCache(j.access_token, j.expires_in || 86400);
  return j.access_token;
}

async function call(path, query) {
  const creds = getCreds();
  const token = await getToken(creds);
  const url = new URL(API_BASE + path);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "User-Agent": creds.ua,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`${res.status} ${res.statusText} — ${url.toString()}`);
    err.body = body.slice(0, 200);
    throw err;
  }
  return res.json();
}

// ------------------------------ shape helpers ------------------------------

function normalizePost(child) {
  const d = child.data;
  return {
    id: d.id,
    fullname: d.name, // e.g. "t3_abc123"
    title: d.title,
    author: d.author,
    subreddit: d.subreddit,
    score: d.score,
    upvote_ratio: d.upvote_ratio,
    num_comments: d.num_comments,
    created_utc: d.created_utc,
    created_iso: new Date(d.created_utc * 1000).toISOString(),
    url: d.url,
    permalink: `https://www.reddit.com${d.permalink}`,
    is_self: d.is_self,
    selftext: d.selftext ? d.selftext.slice(0, 800) : null,
    flair: d.link_flair_text,
    over_18: d.over_18,
  };
}

function normalizeComment(child) {
  if (child.kind === "more") return null;
  const d = child.data;
  return {
    id: d.id,
    author: d.author,
    score: d.score,
    body: d.body,
    created_utc: d.created_utc,
    created_iso: new Date(d.created_utc * 1000).toISOString(),
    permalink: `https://www.reddit.com${d.permalink}`,
    parent_id: d.parent_id,
    depth: d.depth || 0,
    replies: d.replies?.data?.children?.map(normalizeComment).filter(Boolean) || [],
  };
}

// ------------------------------ subcommands ------------------------------

const HELP = `reddit-pp-cli ${VERSION} — Bash-pipeable Reddit research CLI

Usage:
  reddit-pp-cli <command> [flags]

Commands:
  search <query>      Search posts. Use --sub to scope to a subreddit.
  subreddit <name>    Browse a subreddit (--sort hot|new|top|rising).
  thread <id>         Fetch one thread's post + comments (id or t3_id or full URL).
  doctor              Verify creds + sample API call.
  version             Print version.
  help                This help.

Common flags:
  --sub <name>           Subreddit name (search scope or browse target).
  --sort <type>          hot | new | top | rising (default: relevance for search, hot for sub).
  --time <range>         hour | day | week | month | year | all (for top/search sort).
  --limit <n>            Max results (default 25, max 100).
  --after <fullname>     Pagination cursor (e.g. t3_abc123).
  --comments <n>         Max comments per thread (thread cmd; default 50).

Examples:
  reddit-pp-cli search "eightfold ai" --sub recruiting --limit 20 \\
    | jq -r '.posts[] | "\\(.score)↑ \\(.num_comments)💬 — \\(.title)"'

  reddit-pp-cli subreddit recruitinghell --sort top --time week \\
    | jq '.posts | sort_by(-.score) | .[0:5]'

  # Sentiment scrape: get top comments on a thread
  reddit-pp-cli thread 1abc23 --comments 30 \\
    | jq -r '[.comments[] | .body] | join("\\n---\\n")'

One-time setup:
  1. https://www.reddit.com/prefs/apps → "create another app" → type: script
  2. Copy the client_id (under the app name) and the client_secret.
  3. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to ./.env.
  4. (Optional) Add REDDIT_USERNAME — Reddit's UA policy expects an account name in the User-Agent.
`;

async function search(rest) {
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      agent: { type: "boolean" },
      sub: { type: "string" },
      sort: { type: "string" },
      time: { type: "string" },
      limit: { type: "string" },
      after: { type: "string" },
    },
  });
  const q = positionals.join(" ").trim();
  if (!q) die("search requires a <query>");
  const path = values.sub ? `/r/${values.sub}/search` : "/search";
  const query = {
    q,
    limit: Math.min(parseInt(values.limit || "25", 10), 100),
    sort: values.sort || "relevance",
    t: values.time,
    after: values.after,
    restrict_sr: values.sub ? 1 : undefined,
    raw_json: 1,
  };
  const j = await call(path, query);
  const posts = (j.data?.children || []).map(normalizePost);
  out({
    query: q,
    subreddit: values.sub || null,
    sort: query.sort,
    count: posts.length,
    after: j.data?.after || null,
    posts,
  });
}

async function subreddit(rest) {
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      agent: { type: "boolean" },
      sort: { type: "string" },
      time: { type: "string" },
      limit: { type: "string" },
      after: { type: "string" },
    },
  });
  const name = positionals[0];
  if (!name) die("subreddit requires a <name>");
  const sort = values.sort || "hot";
  const path = `/r/${name}/${sort}`;
  const query = {
    limit: Math.min(parseInt(values.limit || "25", 10), 100),
    t: values.time,
    after: values.after,
    raw_json: 1,
  };
  const j = await call(path, query);
  const posts = (j.data?.children || []).map(normalizePost);
  out({
    subreddit: name,
    sort,
    count: posts.length,
    after: j.data?.after || null,
    posts,
  });
}

async function thread(rest) {
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      agent: { type: "boolean" },
      comments: { type: "string" },
      sort: { type: "string" },
    },
  });
  let raw = positionals[0];
  if (!raw) die("thread requires a <id> (id, t3_id, or full URL)");
  // Accept full URL, t3_xxx, or bare id
  let id = raw;
  const urlMatch = raw.match(/comments\/([a-z0-9]+)/i);
  if (urlMatch) id = urlMatch[1];
  else if (raw.startsWith("t3_")) id = raw.slice(3);
  const limit = Math.min(parseInt(values.comments || "50", 10), 200);
  const j = await call(`/comments/${id}`, { limit, sort: values.sort || "top", raw_json: 1 });
  // Response is a 2-element array: [{post listing}, {comment listing}]
  const post = j[0]?.data?.children?.[0] ? normalizePost(j[0].data.children[0]) : null;
  const comments = (j[1]?.data?.children || []).map(normalizeComment).filter(Boolean);
  out({ post, comment_count: comments.length, comments });
}

async function doctor() {
  const result = { name: "reddit-pp-cli", version: VERSION };
  try {
    const creds = getCreds();
    result.creds = "loaded";
    result.user_agent = creds.ua;
    const tok = await getToken(creds);
    result.token = tok ? "ok" : "missing";
    const probe = await call("/r/test/hot", { limit: 1, raw_json: 1 });
    result.api = probe.data ? "ok" : "no-data";
  } catch (e) {
    result.error = e.message;
    out(result);
    process.exit(2);
  }
  out(result);
}

function version() { out({ name: "reddit-pp-cli", version: VERSION }); }

const subs = { search, subreddit, thread, doctor, version, help: () => process.stdout.write(HELP) };

const [, , cmd, ...rest] = process.argv;
if (!cmd || cmd === "--help" || cmd === "-h") { process.stdout.write(HELP); process.exit(0); }
if (cmd === "--version" || cmd === "-v") { version(); process.exit(0); }
const fn = subs[cmd];
if (!fn) die(`unknown command: ${cmd} (try: search subreddit thread doctor)`);
try {
  await fn(rest);
} catch (e) {
  out({ error: true, command: cmd, message: e.message, body: e.body });
  process.exit(2);
}
