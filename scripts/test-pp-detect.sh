#!/bin/bash
# Tests scripts/lib/pp-detect.js
# Usage: ./scripts/test-pp-detect.sh
set -e

DETECT="node /Users/moraybrown/Desktop/Ivy-Lab/scripts/lib/pp-detect.js"

assert_match() {
  local name="$1" cmd="$2" expected_source="$3"
  out=$(echo -n "$cmd" | $DETECT)
  actual=$(echo "$out" | jq -r '.source // "null"' 2>/dev/null || echo "PARSE_ERROR")
  if [ "$expected_source" = "$actual" ]; then
    echo "PASS  $name"
  else
    echo "FAIL  $name (cmd: $cmd)"
    echo "  expected source: $expected_source"
    echo "  actual:          $actual (raw: $out)"
    exit 1
  fi
}

# Bare invocation
assert_match "bare" "company-goat-pp-cli funding stripe --agent" "company-goat"

# Absolute path
assert_match "absolute" "/Users/moraybrown/go/bin/company-goat-pp-cli funding stripe" "company-goat"

# Tilde path (shell will not have expanded yet, so detect by suffix)
assert_match "tilde" "~/go/bin/company-goat-pp-cli funding stripe" "company-goat"

# Pipeline (first cmd matches)
assert_match "pipeline" "company-goat-pp-cli funding stripe --agent | jq .filings" "company-goat"

# Pipeline (first cmd doesn't match — second does — should NOT detect; first cmd is what wins)
assert_match "pipeline-second-only" "echo hi | company-goat-pp-cli funding stripe" "null"

# Negative: printing-press meta tool (kind=meta-tool — excluded)
assert_match "meta-tool-excluded" "printing-press --version" "null"

# Negative: random command
assert_match "random-cmd" "ls -la mcp-servers/" "null"

# Negative: empty
assert_match "empty" "" "null"

# Negative: just whitespace
assert_match "whitespace" "   " "null"

echo ""
echo "All pp-detect tests passed."
