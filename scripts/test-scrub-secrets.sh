#!/bin/bash
# Tests scripts/lib/scrub-secrets.js
# Usage: ./scripts/test-scrub-secrets.sh
set -e

SCRUB="node /Users/moraybrown/Desktop/Ivy-Lab/scripts/lib/scrub-secrets.js"

assert_eq() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "PASS  $name"
  else
    echo "FAIL  $name"
    echo "  expected: $expected"
    echo "  actual:   $actual"
    exit 1
  fi
}

# Anthropic key
out=$(echo 'foo sk-ant-api03-AbCdEf1234567890_xyzABCDEFGHIJKLMNOPQRSTUVWXYZ-extra-pad-pad bar' | $SCRUB)
assert_eq "anthropic-key-redacted" "foo [REDACTED] bar" "$out"

# OpenAI key
out=$(echo 'token=sk-AbCdEf1234567890ABCDEFGHIJKLMNOPQRSTUVWX go' | $SCRUB)
assert_eq "openai-key-redacted" "token=[REDACTED] go" "$out"

# AWS key
out=$(echo 'AKIAIOSFODNN7EXAMPLE here' | $SCRUB)
assert_eq "aws-key-redacted" "[REDACTED] here" "$out"

# GitHub PAT
out=$(echo 'gh_PAT gho_AbCdEf1234567890ABCDEFGHIJKLMNOPQR live' | $SCRUB)
assert_eq "github-pat-redacted" "gh_PAT [REDACTED] live" "$out"

# Supabase JWT (base64 header)
out=$(echo 'auth eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.signature_here' | $SCRUB)
assert_eq "supabase-jwt-redacted" "auth [REDACTED]" "$out"

# Pass-through: no secret
out=$(echo 'just regular text without secrets' | $SCRUB)
assert_eq "no-secret-passthrough" "just regular text without secrets" "$out"

# Multi-line input
out=$(printf 'line1\nsk-ant-api03-AbCdEf1234567890_xyzABCDEFGHIJKLMNOPQRSTUVWXYZ-pad-pad\nline3\n' | $SCRUB)
expected=$(printf 'line1\n[REDACTED]\nline3\n')
assert_eq "multi-line-redacted" "$expected" "$out"

# Idempotent — running scrub twice equals running once
once=$(echo 'sk-AbCdEf1234567890ABCDEFGHIJKLMNOPQRSTUVWX' | $SCRUB)
twice=$(echo "$once" | $SCRUB)
assert_eq "idempotent" "$once" "$twice"

echo ""
echo "All scrub-secrets tests passed."
