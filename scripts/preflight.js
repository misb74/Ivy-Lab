#!/usr/bin/env node
// PreToolUse hook for Ivy-Lab.
//
// Behaviors:
//   1. IVY_LAB_BASH_DISABLED=1 + tool=Bash → block (exit 1).
//   2. tool=Bash + command matches lab_only:true PP CLI → soft-log to stderr, allow.
//   3. tool input contains an unredacted secret pattern → block (exit 1, fail closed).
//   4. else → allow (exit 0).

import { detectPPCall } from './lib/pp-detect.js';
import { scrubSecrets } from './lib/scrub-secrets.js';
import fs from 'node:fs';
import readline from 'node:readline';

const REGISTRY_PATH = '/Users/moraybrown/Desktop/Ivy-Lab/pp-tools/registry.json';

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return {};
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
}

const REGISTRY = loadRegistry();

async function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', () => resolve(''));
    // If stdin is empty/closed immediately, resolve quickly
    setTimeout(() => resolve(Buffer.concat(chunks).toString('utf-8')), 50);
  });
}

function block(message) {
  process.stderr.write(`[ivy-lab preflight] BLOCK: ${message}\n`);
  process.exit(1);
}

function warn(message) {
  process.stderr.write(`[ivy-lab preflight] WARN: ${message}\n`);
}

function containsSecret(text) {
  if (typeof text !== 'string') return false;
  const scrubbed = scrubSecrets(text);
  return scrubbed !== text;
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) process.exit(0);

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // If we can't parse the input, allow (don't block on hook bugs)
    process.exit(0);
  }

  const toolName = payload.tool_name || '';
  const toolInput = payload.tool_input || {};

  // Behavior 1: kill switch
  if (process.env.IVY_LAB_BASH_DISABLED === '1' && toolName === 'Bash') {
    block('IVY_LAB_BASH_DISABLED=1 — Bash is disabled this session. Unset the env var and restart claude to re-enable.');
  }

  // Behavior 2: scrape_only soft-log (only for Bash + matched PP CLI)
  if (toolName === 'Bash') {
    const cmd = toolInput.command || '';
    const detected = detectPPCall(cmd);
    if (detected) {
      const meta = REGISTRY[detected.source] || {};
      if (meta.lab_only === true || meta.legal_class === 'scrape_only') {
        warn(`scrape_only PP CLI invoked: ${detected.source} — fine in Lab, would be blocked in Production.`);
      }
    }
  }

  // Behavior 3: secret-leak abort (covers all tools)
  const inputText = JSON.stringify(toolInput);
  if (containsSecret(inputText)) {
    block(`tool input appears to contain a secret (Anthropic/OpenAI/AWS/JWT/GitHub PAT shape). Aborting before it leaks into context.`);
  }

  // Behavior 4: allow
  process.exit(0);
}

main().catch(() => process.exit(0));
