#!/usr/bin/env node
// webreel-pp-cli — thin wrapper around the upstream Vercel-Labs `webreel` CLI
// (Apache-2.0, npm: webreel). Lab convention: every external tool gets a
// *-pp-cli wrapper so audit-and-mirror hooks have a consistent target and the
// agent invocation surface stays uniform with reddit-pp-cli, ats-surface-pp-cli,
// careers-sniffer-pp-cli, etc.
//
// Subcommands shell through to upstream webreel with no transformation:
//   init       Scaffold a new webreel.config.json
//   record     Record video(s) declared in config
//   validate   Validate config without running
//   preview    Run a video in a visible browser without recording
//   composite  Re-composite from stored raw recordings/timelines
//   doctor     Verify upstream webreel is on PATH and report version
//
// The --agent flag is accepted and passes through (webreel doesn't currently
// use it, but the convention is preserved for future-proofing).

import { spawn, spawnSync } from "node:child_process";

const VERSION = "0.1.0";

function out(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

function die(obj, code = 2) {
  process.stderr.write(JSON.stringify({ error: true, ...obj }, null, 2) + "\n");
  process.exit(code);
}

function parseFlags(argv) {
  // Strip --agent from argv (Lab convention; webreel itself doesn't consume it).
  const filtered = argv.filter((a) => a !== "--agent");
  const agentMode = argv.length !== filtered.length;
  return { agentMode, rest: filtered };
}

async function runDoctor() {
  const r = spawnSync("webreel", ["--version"], { encoding: "utf8" });
  if (r.error || r.status !== 0) {
    die({
      command: "webreel-pp-cli doctor",
      message: "upstream `webreel` not found on PATH. Run `npm install -g webreel` first.",
    });
  }
  out({
    ok: true,
    tool: "webreel-pp-cli",
    wrapper_version: VERSION,
    upstream: "webreel",
    upstream_version: r.stdout.trim(),
    notes: [
      "Wrapper is a transparent passthrough. All upstream flags work.",
      "First record/preview will fetch Chrome + ffmpeg into ~/.webreel (~few hundred MB).",
    ],
  });
}

async function passthrough(subcommand, rest) {
  // Stream stdio so progress (npm post-install Chrome/ffmpeg download, record
  // progress bar) is visible to the user.
  const child = spawn("webreel", [subcommand, ...rest], { stdio: "inherit" });
  child.on("close", (code) => process.exit(code ?? 0));
  child.on("error", (err) =>
    die({
      command: `webreel ${subcommand}`,
      message: err.message,
    })
  );
}

async function main() {
  const [, , subcommand, ...rawRest] = process.argv;

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    process.stdout.write(
      `webreel-pp-cli ${VERSION} — Lab wrapper around \`webreel\` (Vercel Labs, Apache-2.0)\n\n` +
        `Usage: webreel-pp-cli <subcommand> [options]\n\n` +
        `Subcommands:\n` +
        `  init       Scaffold a new webreel.config.json\n` +
        `  record     Record video(s) declared in config\n` +
        `  validate   Validate config without running\n` +
        `  preview    Run a video in a visible browser without recording\n` +
        `  composite  Re-composite from stored raw recordings\n` +
        `  doctor     Verify upstream webreel is installed\n\n` +
        `All subcommands except \`doctor\` are transparent passthroughs to \`webreel\`.\n` +
        `Run \`webreel <subcommand> --help\` for upstream-specific flags.\n`
    );
    process.exit(0);
  }

  if (subcommand === "--version" || subcommand === "-V") {
    out({ version: VERSION, upstream: "webreel" });
    return;
  }

  const { rest } = parseFlags(rawRest);

  if (subcommand === "doctor") {
    return runDoctor();
  }

  if (["init", "record", "validate", "preview", "composite", "help"].includes(subcommand)) {
    return passthrough(subcommand, rest);
  }

  die({
    command: `webreel-pp-cli ${subcommand}`,
    message: `unknown subcommand: ${subcommand}. Run webreel-pp-cli --help.`,
  });
}

main().catch((e) => die({ command: "webreel-pp-cli", message: String(e) }));
