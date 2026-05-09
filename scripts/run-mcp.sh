#!/bin/bash
# Loads .env and runs an MCP server via tsx with stdin-close guard.
# When the parent Claude Code session exits and closes stdin,
# the guard ensures this process exits too — preventing zombie accumulation.
# Usage: run-mcp.sh /path/to/server/index.ts

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
set -a
source "$PROJECT_ROOT/.env" 2>/dev/null
set +a

# Run node directly with tsx hooks + stdin guard preload.
# This replaces `npx tsx` to avoid extra npx process overhead
# and to inject our stdin-guard before the server starts.
exec node \
  --require "$PROJECT_ROOT/scripts/stdin-guard.cjs" \
  --require "$PROJECT_ROOT/node_modules/tsx/dist/preflight.cjs" \
  --import "file://$PROJECT_ROOT/node_modules/tsx/dist/loader.mjs" \
  "$1"
