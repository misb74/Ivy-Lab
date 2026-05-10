#!/bin/bash
# Tests scripts/preflight.js
set -e

PREFLIGHT="node /Users/moraybrown/Desktop/Ivy-Lab/scripts/preflight.js"

assert_exit() {
  local name="$1" expected_exit="$2" stdin_json="$3" env_kv="$4"
  set +e
  if [ -n "$env_kv" ]; then
    actual_exit=$(eval "export $env_kv; echo '$stdin_json' | $PREFLIGHT >/dev/null 2>&1; echo \$?")
  else
    actual_exit=$(echo "$stdin_json" | $PREFLIGHT >/dev/null 2>&1; echo $?)
  fi
  set -e
  if [ "$expected_exit" = "$actual_exit" ]; then
    echo "PASS  $name (exit $actual_exit)"
  else
    echo "FAIL  $name"
    echo "  expected exit: $expected_exit"
    echo "  actual exit:   $actual_exit"
    exit 1
  fi
}

# Allow harmless Bash
assert_exit "harmless-bash" 0 '{"tool_name":"Bash","tool_input":{"command":"ls -la"}}'

# Allow non-Bash tools regardless of input
assert_exit "non-bash-allowed" 0 '{"tool_name":"Read","tool_input":{"file_path":"/tmp/foo"}}'

# Kill switch: IVY_LAB_BASH_DISABLED=1 + Bash → block
assert_exit "kill-switch-blocks-bash" 1 '{"tool_name":"Bash","tool_input":{"command":"ls"}}' "IVY_LAB_BASH_DISABLED=1"

# Kill switch does NOT block non-Bash
assert_exit "kill-switch-allows-read" 0 '{"tool_name":"Read","tool_input":{"file_path":"/tmp/foo"}}' "IVY_LAB_BASH_DISABLED=1"

# Secret leak in Bash command → WARN (exit 0) — was block, downgraded post-Phase-5
# because the audit hook downstream already scrubs and false positives were too common.
assert_exit "secret-leak-anthropic-warn" 0 '{"tool_name":"Bash","tool_input":{"command":"echo sk-ant-api03-AbCdEf1234567890_xyzABCDEFGHIJKLMNOPQRSTUVWXYZ-padpad"}}'

assert_exit "secret-leak-aws-warn" 0 '{"tool_name":"Bash","tool_input":{"command":"aws s3 ls --access-key AKIAIOSFODNN7EXAMPLE"}}'

# Verify the warn message is emitted to stderr (not silent)
assert_stderr() {
  local name="$1" expected_pattern="$2" stdin_json="$3"
  set +e
  actual_stderr=$(echo "$stdin_json" | $PREFLIGHT 2>&1 >/dev/null)
  set -e
  if echo "$actual_stderr" | grep -qE "$expected_pattern"; then
    echo "PASS  $name"
  else
    echo "FAIL  $name (stderr was: $actual_stderr)"
    exit 1
  fi
}
assert_stderr "secret-leak-emits-warn" "WARN.*secret pattern" '{"tool_name":"Bash","tool_input":{"command":"echo AKIAIOSFODNN7EXAMPLE"}}'

# Empty input — should not crash
assert_exit "empty-input" 0 ''

echo ""
echo "All preflight tests passed."
