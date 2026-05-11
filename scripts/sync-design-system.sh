#!/usr/bin/env bash
# Refresh the Ivy v4 design system mirror from the production Ivy repo.
# The HTML executive report skill (.claude/skills/output/SKILL.md) reads
# CSS/JS from gateway/src/v4-html/. Lab does not own this code — it lives
# in the production Ivy repo. This script keeps Lab's local copy current.
#
# Same pattern as supabase/migrations/ — read-only mirror, gitignored.

set -euo pipefail

SOURCE_REPO="${IVY_SOURCE_REPO:-/Users/moraybrown/Desktop/Ivy}"
LAB_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -d "$SOURCE_REPO/gateway/src/v4-html" ]]; then
  echo "error: $SOURCE_REPO/gateway/src/v4-html not found." >&2
  echo "Set IVY_SOURCE_REPO if Ivy is at a different path." >&2
  exit 1
fi

echo "[sync] design system: $SOURCE_REPO/gateway/src/v4-html → $LAB_ROOT/gateway/src/v4-html"
mkdir -p "$LAB_ROOT/gateway/src"
rsync -a --delete "$SOURCE_REPO/gateway/src/v4-html/" "$LAB_ROOT/gateway/src/v4-html/"

# Reference report — used by the output skill as the worked example
if [[ -f "$SOURCE_REPO/outputs/deep-research/agent-factory-work-transformation.html" ]]; then
  echo "[sync] reference report"
  mkdir -p "$LAB_ROOT/outputs/deep-research"
  rsync -a "$SOURCE_REPO/outputs/deep-research/agent-factory-work-transformation.html" \
           "$LAB_ROOT/outputs/deep-research/"
fi

echo "[sync] done."
