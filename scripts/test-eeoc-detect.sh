#!/bin/bash
# Tests scripts/lib/eeoc-detect.js
set -e

DETECT="node /Users/moraybrown/Desktop/Ivy-Lab/scripts/lib/eeoc-detect.js"

assert_eq() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "PASS  $name"
  else
    echo "FAIL  $name"
    echo "  expected: '$expected'"
    echo "  actual:   '$actual'"
    exit 1
  fi
}

# Single attribute
out=$(echo "What is the median age of software engineers?" | $DETECT)
assert_eq "single-age" "age" "$out"

# Multiple attributes
out=$(echo "Audit hiring fairness by race and gender" | $DETECT)
assert_eq "multi-race-gender" "gender,race" "$out"

# Case insensitive
out=$(echo "RELIGION and Sex categories" | $DETECT)
assert_eq "case-insensitive" "religion,sex" "$out"

# No protected attributes
out=$(echo "What is the wage for occupation 15-1252.00?" | $DETECT)
assert_eq "no-attrs" "" "$out"

# Compound terms
out=$(echo "sexual orientation and gender identity protections" | $DETECT)
assert_eq "compound-orientation-identity" "gender identity,sexual orientation" "$out"

# Empty input
out=$(echo "" | $DETECT)
assert_eq "empty" "" "$out"

# Word-boundary safety (don't match "agen" inside "agenda")
out=$(echo "Set the agenda for the meeting" | $DETECT)
assert_eq "no-false-match-agenda" "" "$out"

echo ""
echo "All eeoc-detect tests passed."
