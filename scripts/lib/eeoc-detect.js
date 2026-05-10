#!/usr/bin/env node
// Detect EEOC protected attributes mentioned in a text blob.
// Returns sorted comma-separated list of attribute names found, or empty string.
//
// CLI: read stdin, write attribute list to stdout.

import readline from 'node:readline';

// Order matters for compound matching: longer phrases first so we don't
// match "gender" inside "gender identity" before catching "gender identity".
const PROTECTED_ATTRIBUTES = [
  'sexual orientation',
  'gender identity',
  'national origin',
  'genetic information',
  'veteran status',
  'marital status',
  'pregnancy',
  'disability',
  'citizenship',
  'religion',
  'gender',
  'race',
  'color',
  'sex',
  'age',
];

export function detectProtectedAttributes(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const lower = text.toLowerCase();
  const found = new Set();
  for (const attr of PROTECTED_ATTRIBUTES) {
    // Word-boundary regex: only match attr as a whole word (or hyphenated form)
    const re = new RegExp(`\\b${attr.replace(/\s/g, '\\s')}\\b`, 'i');
    if (re.test(lower)) {
      // Don't add a shorter attr if a longer compound already covers it.
      // e.g. skip "gender" when "gender identity" is already found.
      const alreadyCovered = Array.from(found).some(
        existing => existing.startsWith(attr + ' ') || existing.endsWith(' ' + attr)
      );
      if (!alreadyCovered) found.add(attr);
    }
  }
  return Array.from(found).sort();
}

async function cli() {
  const rl = readline.createInterface({ input: process.stdin });
  const chunks = [];
  for await (const line of rl) chunks.push(line);
  const result = detectProtectedAttributes(chunks.join('\n'));
  process.stdout.write(result.join(',') + (result.length > 0 ? '\n' : ''));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch(err => { console.error(err); process.exit(1); });
}
