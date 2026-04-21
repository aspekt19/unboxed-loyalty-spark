#!/usr/bin/env bash
# Export your key first: export LOYAL_SPARK_API_KEY='lsk_...'
set -euo pipefail
BASE="${LOYAL_SPARK_API_BASE:-https://api.loyalspark.online/agent-api}"
if [[ -z "${LOYAL_SPARK_API_KEY:-}" ]]; then
  echo "Set LOYAL_SPARK_API_KEY to your lsk_... key" >&2
  exit 1
fi
curl -sS -H "x-api-key: ${LOYAL_SPARK_API_KEY}" "${BASE}/programs" | head -c 2000
echo
