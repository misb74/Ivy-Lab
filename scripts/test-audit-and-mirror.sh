#!/bin/bash
# Tests scripts/audit-and-mirror.js
set -e

HOOK="node /Users/moraybrown/Desktop/Ivy-Lab/scripts/audit-and-mirror.js"
TEST_DATA_DIR="/tmp/ivy-lab-hook-test-$$"
TEST_AUDIT_DB="$TEST_DATA_DIR/data/audit.db"
TEST_MIRRORS_DIR="$TEST_DATA_DIR/pp-mirrors"

# The hook reads its DB paths from env IVY_LAB_DATA_DIR and IVY_LAB_MIRRORS_DIR
# (defaults to repo's data/ and pp-mirrors/ if unset)
export IVY_LAB_DATA_DIR="$TEST_DATA_DIR/data"
export IVY_LAB_MIRRORS_DIR="$TEST_MIRRORS_DIR"

mkdir -p "$IVY_LAB_DATA_DIR" "$IVY_LAB_MIRRORS_DIR"

# Test 1: arbitrary tool produces an audit row
echo '{"tool_name":"Read","tool_input":{"file_path":"/tmp/foo"},"tool_response":{"output":"hello"},"session_id":"sess-123"}' | $HOOK
audit_count=$(sqlite3 "$TEST_AUDIT_DB" "SELECT count(*) FROM tool_calls WHERE tool='Read' AND session_id='sess-123'" 2>/dev/null || echo 0)
if [ "$audit_count" = "1" ]; then echo "PASS  audit-row-created"; else echo "FAIL  audit-row-created (got $audit_count)"; exit 1; fi

# Test 2: PP CLI Bash call produces audit row + mirror row
echo '{"tool_name":"Bash","tool_input":{"command":"company-goat-pp-cli funding stripe --agent"},"tool_response":{"output":"{\"filings\":[{\"amount_raised\":5300000}]}"},"session_id":"sess-456"}' | $HOOK
mirror_count=$(sqlite3 "$TEST_MIRRORS_DIR/company-goat.db" "SELECT count(*) FROM results WHERE invocation LIKE '%funding stripe%'" 2>/dev/null || echo 0)
if [ "$mirror_count" = "1" ]; then echo "PASS  mirror-row-created"; else echo "FAIL  mirror-row-created (got $mirror_count)"; exit 1; fi

# Test 3: Non-PP Bash call does NOT create mirror row
echo '{"tool_name":"Bash","tool_input":{"command":"ls -la"},"tool_response":{"output":"foo bar"},"session_id":"sess-789"}' | $HOOK
ls_mirror_count=$(sqlite3 "$TEST_MIRRORS_DIR/company-goat.db" "SELECT count(*) FROM results WHERE invocation LIKE '%ls -la%'" 2>/dev/null || echo 0)
if [ "$ls_mirror_count" = "0" ]; then echo "PASS  non-pp-no-mirror"; else echo "FAIL  non-pp-no-mirror (got $ls_mirror_count)"; exit 1; fi

# Test 4: Hook always exits 0 even on bad input
set +e
echo 'not json at all' | $HOOK
exit_status=$?
set -e
if [ "$exit_status" = "0" ]; then echo "PASS  malformed-input-exits-0"; else echo "FAIL  malformed-input-exits-0 (got $exit_status)"; exit 1; fi

# Test 5: Secrets in input are redacted in audit DB
echo '{"tool_name":"Bash","tool_input":{"command":"echo sk-ant-api03-AbCdEf1234567890_xyzABCDEFGHIJKLMNOPQRSTUVWXYZ-padpad here"},"tool_response":{"output":"ok"},"session_id":"sess-secret"}' | $HOOK
secret_in_db=$(sqlite3 "$TEST_AUDIT_DB" "SELECT input_redacted FROM tool_calls WHERE session_id='sess-secret'" 2>/dev/null)
if echo "$secret_in_db" | grep -q "REDACTED"; then echo "PASS  secret-scrubbed-in-audit"; else echo "FAIL  secret-scrubbed-in-audit (got: $secret_in_db)"; exit 1; fi
if echo "$secret_in_db" | grep -q "sk-ant"; then echo "FAIL  secret-leaked-in-audit (got: $secret_in_db)"; exit 1; fi

# Test 6: protected attributes column populated for EEOC-relevant input
echo '{"tool_name":"Bash","tool_input":{"command":"check hiring fairness by age and disability"},"tool_response":{"output":"ok"},"session_id":"sess-eeoc"}' | $HOOK
attrs=$(sqlite3 "$TEST_AUDIT_DB" "SELECT protected_attributes FROM tool_calls WHERE session_id='sess-eeoc'" 2>/dev/null)
if echo "$attrs" | grep -q "age" && echo "$attrs" | grep -q "disability"; then echo "PASS  eeoc-attrs-stored"; else echo "FAIL  eeoc-attrs-stored (got: $attrs)"; exit 1; fi

# Test 7: protected_attributes empty for non-EEOC input
echo '{"tool_name":"Read","tool_input":{"file_path":"/tmp/foo.txt"},"tool_response":{"output":"hello"},"session_id":"sess-noeeoc"}' | $HOOK
attrs=$(sqlite3 "$TEST_AUDIT_DB" "SELECT protected_attributes FROM tool_calls WHERE session_id='sess-noeeoc'" 2>/dev/null)
if [ -z "$attrs" ]; then echo "PASS  no-eeoc-empty"; else echo "FAIL  no-eeoc-empty (got: $attrs)"; exit 1; fi

# Cleanup
rm -rf "$TEST_DATA_DIR"

echo ""
echo "All audit-and-mirror tests passed."
