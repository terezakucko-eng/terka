#!/bin/bash
set -euo pipefail

# Run only in Claude Code Remote sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# 1. Restore Basecamp credentials from env var
if [ -n "${BASECAMP_CREDENTIALS:-}" ]; then
  mkdir -p "$HOME/.config/basecamp"
  echo "$BASECAMP_CREDENTIALS" > "$HOME/.config/basecamp/credentials.json"
fi

# 2. Put bundled binary in PATH
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINARY="$SCRIPT_DIR/../bin/basecamp"
if [ -f "$BINARY" ]; then
  mkdir -p "$HOME/.local/bin"
  cp "$BINARY" "$HOME/.local/bin/basecamp"
  chmod +x "$HOME/.local/bin/basecamp"
  echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "${CLAUDE_ENV_FILE:-/dev/null}"
fi
