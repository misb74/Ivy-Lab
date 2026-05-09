#!/usr/bin/env node
// Detect whether a Bash command string invokes a known PP CLI.
// Reads pp-tools/registry.json to know which binaries are registered.
//
// CLI: read stdin, write JSON {"source": "...", "binary": "..."} or {"source": null} to stdout.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const REGISTRY_PATH = '/Users/moraybrown/Desktop/Ivy-Lab/pp-tools/registry.json';

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return {};
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
}

const REGISTRY = loadRegistry();

// Build a map of binary basename -> source name, EXCLUDING meta-tools
const BINARY_TO_SOURCE = {};
for (const [source, meta] of Object.entries(REGISTRY)) {
  if (meta.kind === 'meta-tool') continue;
  if (!meta.binary) continue;
  BINARY_TO_SOURCE[meta.binary] = source;
}

export function detectPPCall(cmd) {
  if (typeof cmd !== 'string') return null;
  const trimmed = cmd.trim();
  if (!trimmed) return null;

  // Take only the first command in a pipeline (split on unescaped |)
  // Simple heuristic: split on | and take first non-empty piece
  const firstCmd = trimmed.split('|')[0].trim();
  if (!firstCmd) return null;

  // Tokenize on whitespace; first token is the binary path
  const tokens = firstCmd.split(/\s+/);
  if (tokens.length === 0) return null;
  const binPath = tokens[0];

  // Get just the basename
  const binBase = binPath.split('/').filter(Boolean).pop();
  if (!binBase) return null;

  const source = BINARY_TO_SOURCE[binBase];
  if (!source) return null;

  return { source, binary: binBase };
}

async function cli() {
  const rl = readline.createInterface({ input: process.stdin });
  const chunks = [];
  for await (const line of rl) chunks.push(line);
  const input = chunks.join('\n');
  const result = detectPPCall(input) || { source: null };
  process.stdout.write(JSON.stringify(result) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
