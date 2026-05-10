#!/usr/bin/env bash
# Launchd wrapper for the Ivy-Lab Telegram bot.
# Invoked by ~/Library/LaunchAgents/com.ivy-lab.bot.plist.
# Also runnable by hand for parity testing.

set -euo pipefail

LAB_ROOT="/Users/moraybrown/Desktop/Ivy-Lab"
BOT_DIR="$LAB_ROOT/bot"

# launchd gives us a minimal PATH; npm/node live in /usr/local/bin.
# ~/.local/bin holds Lab CLIs (e.g. google-places-pp-cli) symlinked from pp-tools/.
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin"

cd "$BOT_DIR"
exec npm start
