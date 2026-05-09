#!/usr/bin/env node
// Redact common secret patterns from a text blob.
// Used by hooks before persisting tool inputs to the audit log.
//
// Supports CLI usage (read stdin, write redacted to stdout) and module export.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const ENV_FILE = '/Users/moraybrown/Desktop/Ivy-Lab/.env';

const SECRET_PATTERNS = [
  // Anthropic API keys
  /sk-ant-[A-Za-z0-9_-]{50,}/g,
  // GitHub PATs (gho_, ghp_, ghr_, ghs_)
  /gh[oprs]_[A-Za-z0-9_]{30,}/g,
  // OpenAI API keys (sk- followed by long token)
  /\bsk-[A-Za-z0-9_-]{40,}\b/g,
  // AWS access keys
  /\bAKIA[0-9A-Z]{16}\b/g,
  // JWTs (three base64 segments separated by dots)
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
];

function loadEnvLiterals() {
  // Load value strings from .env so we can redact them too.
  // Returns a sorted-by-length-desc array so longer values redact first
  // (avoids partial-overlap mismatches).
  if (!fs.existsSync(ENV_FILE)) return [];
  const lines = fs.readFileSync(ENV_FILE, 'utf-8').split('\n');
  const values = [];
  for (const line of lines) {
    const m = line.match(/^[A-Z_][A-Z0-9_]*=(.+)$/);
    if (!m) continue;
    let v = m[1].trim();
    // Strip surrounding quotes
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    // Skip empty or trivially short values (would over-redact)
    if (v.length < 8) continue;
    values.push(v);
  }
  return values.sort((a, b) => b.length - a.length);
}

const ENV_VALUES = loadEnvLiterals();

export function scrubSecrets(text) {
  if (typeof text !== 'string') return text;
  let out = text;
  // Pattern-based redaction first
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  // Literal env value redaction second
  for (const v of ENV_VALUES) {
    if (v.length === 0) continue;
    // Replace all occurrences of the literal value
    out = out.split(v).join('[REDACTED]');
  }
  return out;
}

// CLI: read stdin, write scrubbed to stdout
async function cli() {
  const rl = readline.createInterface({ input: process.stdin });
  const chunks = [];
  for await (const line of rl) chunks.push(line);
  const input = chunks.join('\n') + (chunks.length > 0 ? '\n' : '');
  // Trim trailing newline that readline added if input was a single non-newline line
  const result = scrubSecrets(input.trimEnd() + (input.endsWith('\n') ? '\n' : ''));
  process.stdout.write(result);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
