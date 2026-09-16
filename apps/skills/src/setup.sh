#!/usr/bin/env bash
# One-command agent setup (D-016): install CLI, register skill, authenticate. Idempotent.
set -euo pipefail

if ! command -v threadcap >/dev/null 2>&1; then
  echo "Installing ThreadCap CLI..." >&2
  npm install -g @threadcap/cli || { echo "Install failed — set THREADCAP_SKIP_INSTALL=1 to skip"; exit 1; }
fi

echo "Registering skill..." >&2
mkdir -p "$HOME/.claude/skills/threadcap"
cp -r "$(dirname "$0")/threadcap" "$HOME/.claude/skills/"

echo "Authenticating..." >&2
threadcap auth login || threadcap auth status
echo "ThreadCap ready. Run 'threadcap setup' again anytime to re-verify."