#!/usr/bin/env bash
# Deploy rate-limit / paid-gateway / admin-wallet changes to Supabase prod.
# Requires: npx supabase + SUPABASE_ACCESS_TOKEN (or `supabase login` in a TTY).
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-bzxmejzssxjazswgwqqs}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Set SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens) or run: supabase login"
  exit 1
fi

FUNCS=(
  x402-gateway
  mpp-gateway
  agent-api
  loyalty-mcp
  recipient-api
  recipient-loyalty-mcp
  agent-prepare
  agent-wallet
  privy-auth
  siwe-verify
)

echo "Deploying ${#FUNCS[@]} edge functions to ${PROJECT_REF}..."
npx supabase functions deploy "${FUNCS[@]}" --project-ref "$PROJECT_REF"

KEY_FILE="scripts/.admin-wallets-decrypt.key"
if [[ -f "$KEY_FILE" ]]; then
  echo "Setting ADMIN_WALLETS_DECRYPT_KEY from local gitignored key file..."
  KEY_HEX="$(tr -d '[:space:]' < "$KEY_FILE")"
  npx supabase secrets set "ADMIN_WALLETS_DECRYPT_KEY=${KEY_HEX}" --project-ref "$PROJECT_REF"
  echo "Secret updated. Encrypted list is bundled in supabase/functions/_shared/admin-wallets.bundle"
else
  echo "Skip secrets: add scripts/.admin-wallets-decrypt.key or set ADMIN_WALLETS_DECRYPT_KEY in Supabase manually."
fi

echo "Done."
