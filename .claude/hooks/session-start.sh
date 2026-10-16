#!/bin/bash
# SessionStart: Basecamp CLI a přihlášení z tajné proměnné prostředí.
# Přístup se nikdy neukládá do repozitáře, čte se jen z nastavení prostředí:
#   BASECAMP_TOKEN        osobní přístupový token (doporučeno, nerotuje)
#   BASECAMP_CREDENTIALS  obsah credentials.json z `basecamp auth login` (záloha)
# Hook nikdy neshodí start session; když něco chybí, jen to vypíše.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ENV_FILE="${CLAUDE_ENV_FILE:-/dev/null}"
GOBIN_DIR="$(go env GOPATH 2>/dev/null || echo "$HOME/go")/bin"
export PATH="$HOME/.local/bin:$GOBIN_DIR:$PATH"
{
  echo "export PATH=\"$HOME/.local/bin:$GOBIN_DIR:\$PATH\""
  echo 'export BASECAMP_NO_KEYRING=1'
} >> "$ENV_FILE"

# 1. CLI (stav kontejneru se po hooku ukládá, další session ho už mají)
if ! command -v basecamp >/dev/null 2>&1; then
  if command -v go >/dev/null 2>&1; then
    go install github.com/basecamp/basecamp-cli/cmd/basecamp@latest >/dev/null 2>&1 \
      || echo "basecamp-cli: instalace selhala" >&2
  else
    echo "basecamp-cli: chybí Go, CLI se nenainstalovalo" >&2
  fi
fi

# 2. Přihlášení
if [ -n "${BASECAMP_TOKEN:-}" ]; then
  : # CLI čte BASECAMP_TOKEN přímo
elif [ -n "${BASECAMP_CREDENTIALS:-}" ]; then
  CRED="$HOME/.config/basecamp/credentials.json"
  # Existující (obnovené) přihlášení nepřepisovat starší kopií z proměnné.
  if [ ! -s "$CRED" ]; then
    mkdir -p "$(dirname "$CRED")"
    (umask 077; printf '%s' "$BASECAMP_CREDENTIALS" > "$CRED")
  fi
else
  echo "Basecamp: chybí BASECAMP_TOKEN v nastavení prostředí, přihlášení jen ručně (basecamp auth login --device-code)" >&2
fi

exit 0
