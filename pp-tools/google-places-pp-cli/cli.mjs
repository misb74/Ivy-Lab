#!/usr/bin/env node
// google-places-pp-cli — Lab-style Bash-pipeable CLI for Google Places API (New).
// Reads GOOGLE_PLACES_API_KEY from process.env, or from .env in $PWD.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const VERSION = "0.1.0";
const BASE = "https://places.googleapis.com/v1";

const DEFAULT_FIELDS = {
  search:
    "places.id,places.displayName,places.formattedAddress,places.location,places.priceLevel,places.rating,places.userRatingCount,places.regularOpeningHours.openNow,places.primaryType,places.types",
  nearby:
    "places.id,places.displayName,places.formattedAddress,places.location,places.priceLevel,places.rating,places.userRatingCount,places.regularOpeningHours.openNow,places.primaryType,places.types",
  details:
    "id,displayName,formattedAddress,location,priceLevel,rating,userRatingCount,regularOpeningHours,primaryType,types,websiteUri,nationalPhoneNumber,internationalPhoneNumber,googleMapsUri,reviews,editorialSummary",
  autocomplete:
    "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
};

// Node's parseArgs rejects values starting with `-` (sees them as flags).
// Collapse `--key -1.23` into `--key=-1.23` when the value parses as a number.
function fixNegativeNumbers(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a.startsWith("--") && !a.includes("=") && next != null && /^-\d/.test(next) && !isNaN(parseFloat(next))) {
      out.push(`${a}=${next}`);
      i++;
    } else {
      out.push(a);
    }
  }
  return out;
}

function loadDotenv() {
  const path = join(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["'](.*)["']$/, "$1");
  }
}

function getKey() {
  if (!process.env.GOOGLE_PLACES_API_KEY) loadDotenv();
  const k = process.env.GOOGLE_PLACES_API_KEY;
  if (!k) die("GOOGLE_PLACES_API_KEY not set (env or ./.env)");
  return k;
}

function die(msg, code = 1) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}

async function call(method, path, { body, query, fields } = {}) {
  const url = new URL(BASE + path);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, v);
  const headers = {
    "X-Goog-Api-Key": getKey(),
    "Content-Type": "application/json",
  };
  if (fields) headers["X-Goog-FieldMask"] = fields;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    process.stdout.write(JSON.stringify({ error: true, status: res.status, body: json }, null, 2) + "\n");
    process.exit(2);
  }
  return json;
}

function out(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

const HELP = `google-places-pp-cli ${VERSION} — Google Places API (New) for Bash pipelines

Usage:
  google-places-pp-cli <command> [flags]

Commands:
  search <query>         Text Search — find places matching free-text query.
  nearby                 Nearby Search — places within radius of a lat/lng.
  details <place-id>     Place Details — full record for one place.
  autocomplete <query>   Autocomplete — typeahead suggestions.
  doctor                 Verify API key works.
  version                Print version.
  help                   This help.

Common flags:
  --agent                JSON output, non-interactive (default).
  --fields <mask>        Override X-Goog-FieldMask (advanced).
  --limit <n>            Max results (search/nearby; default 10, max 20).
  --lat <f> --lng <f>    Center for search bias / nearby.
  --radius <m>           Radius in meters (nearby; default 1500).
  --type <t>             Place type filter (e.g. restaurant, cafe).
  --open-now             Bias toward currently-open places (search).
  --min-rating <f>       Minimum rating (search).
  --price <range>        Price levels, comma-separated (1,2,3,4).
  --language <code>      Language code (e.g. en, fr).
  --region <code>        Region code (e.g. US, GB).

Examples:
  google-places-pp-cli search "italian soho london" --limit 5
  google-places-pp-cli nearby --lat 51.5145 --lng -0.1380 --radius 500 --type restaurant
  google-places-pp-cli details ChIJN1t_tDeuEmsRUsoyG83frY4
  google-places-pp-cli search "ramen" --lat 40.72 --lng -74.0 --open-now --min-rating 4.3 --agent | jq '.places[].displayName.text'
`;

const subs = {
  async search(rest) {
    const { values, positionals } = parseArgs({
      args: fixNegativeNumbers(rest),
      allowPositionals: true,
      options: {
        agent: { type: "boolean" },
        json: { type: "boolean" },
        fields: { type: "string" },
        limit: { type: "string" },
        lat: { type: "string" },
        lng: { type: "string" },
        radius: { type: "string" },
        type: { type: "string" },
        "open-now": { type: "boolean" },
        "min-rating": { type: "string" },
        price: { type: "string" },
        language: { type: "string" },
        region: { type: "string" },
      },
    });
    const query = positionals.join(" ").trim();
    if (!query) die("search requires a <query>");
    const body = { textQuery: query, pageSize: Math.min(parseInt(values.limit || "10", 10), 20) };
    if (values.lat && values.lng) {
      body.locationBias = {
        circle: {
          center: { latitude: parseFloat(values.lat), longitude: parseFloat(values.lng) },
          radius: parseFloat(values.radius || "5000"),
        },
      };
    }
    if (values.type) body.includedType = values.type;
    if (values["open-now"]) body.openNow = true;
    if (values["min-rating"]) body.minRating = parseFloat(values["min-rating"]);
    if (values.price) body.priceLevels = values.price.split(",").map((p) => `PRICE_LEVEL_${["FREE","INEXPENSIVE","MODERATE","EXPENSIVE","VERY_EXPENSIVE"][parseInt(p,10)]}`);
    if (values.language) body.languageCode = values.language;
    if (values.region) body.regionCode = values.region;
    out(await call("POST", "/places:searchText", { body, fields: values.fields || DEFAULT_FIELDS.search }));
  },

  async nearby(rest) {
    const { values } = parseArgs({
      args: fixNegativeNumbers(rest),
      options: {
        agent: { type: "boolean" },
        json: { type: "boolean" },
        fields: { type: "string" },
        limit: { type: "string" },
        lat: { type: "string" },
        lng: { type: "string" },
        radius: { type: "string" },
        type: { type: "string" },
        language: { type: "string" },
        region: { type: "string" },
      },
    });
    if (!values.lat || !values.lng) die("nearby requires --lat and --lng");
    const body = {
      maxResultCount: Math.min(parseInt(values.limit || "10", 10), 20),
      locationRestriction: {
        circle: {
          center: { latitude: parseFloat(values.lat), longitude: parseFloat(values.lng) },
          radius: parseFloat(values.radius || "1500"),
        },
      },
    };
    if (values.type) body.includedTypes = [values.type];
    if (values.language) body.languageCode = values.language;
    if (values.region) body.regionCode = values.region;
    out(await call("POST", "/places:searchNearby", { body, fields: values.fields || DEFAULT_FIELDS.nearby }));
  },

  async details(rest) {
    const { values, positionals } = parseArgs({
      args: fixNegativeNumbers(rest),
      allowPositionals: true,
      options: {
        agent: { type: "boolean" },
        json: { type: "boolean" },
        fields: { type: "string" },
        language: { type: "string" },
        region: { type: "string" },
      },
    });
    const id = positionals[0];
    if (!id) die("details requires a <place-id>");
    const path = id.startsWith("places/") ? `/${id}` : `/places/${id}`;
    const query = {};
    if (values.language) query.languageCode = values.language;
    if (values.region) query.regionCode = values.region;
    out(await call("GET", path, { query, fields: values.fields || DEFAULT_FIELDS.details }));
  },

  async autocomplete(rest) {
    const { values, positionals } = parseArgs({
      args: fixNegativeNumbers(rest),
      allowPositionals: true,
      options: {
        agent: { type: "boolean" },
        json: { type: "boolean" },
        fields: { type: "string" },
        lat: { type: "string" },
        lng: { type: "string" },
        radius: { type: "string" },
        language: { type: "string" },
        region: { type: "string" },
      },
    });
    const query = positionals.join(" ").trim();
    if (!query) die("autocomplete requires a <query>");
    const body = { input: query };
    if (values.lat && values.lng) {
      body.locationBias = {
        circle: {
          center: { latitude: parseFloat(values.lat), longitude: parseFloat(values.lng) },
          radius: parseFloat(values.radius || "5000"),
        },
      };
    }
    if (values.language) body.languageCode = values.language;
    if (values.region) body.regionCode = values.region;
    out(await call("POST", "/places:autocomplete", { body, fields: values.fields || DEFAULT_FIELDS.autocomplete }));
  },

  async doctor() {
    const key = process.env.GOOGLE_PLACES_API_KEY ? "set" : (loadDotenv(), process.env.GOOGLE_PLACES_API_KEY ? "loaded from .env" : "MISSING");
    const result = { version: VERSION, key, base: BASE };
    if (key === "MISSING") { out(result); process.exit(1); }
    try {
      const r = await call("POST", "/places:searchText", {
        body: { textQuery: "google", pageSize: 1 },
        fields: "places.id",
      });
      result.api = r.places ? "ok" : "no-results";
    } catch (e) {
      result.api = `error: ${e.message}`;
    }
    out(result);
  },

  version() { out({ name: "google-places-pp-cli", version: VERSION }); },
  help() { process.stdout.write(HELP); },
};

const [, , cmd, ...rest] = process.argv;
if (!cmd || cmd === "--help" || cmd === "-h") { process.stdout.write(HELP); process.exit(0); }
if (cmd === "--version" || cmd === "-v") { subs.version(); process.exit(0); }
const fn = subs[cmd];
if (!fn) die(`unknown command: ${cmd} (try: search nearby details autocomplete doctor)`);
await fn(rest);
