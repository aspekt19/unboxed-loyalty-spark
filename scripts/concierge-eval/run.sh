#!/usr/bin/env bash
# Runs the Concierge regression suite against the deployed concierge-eval function.
# Exit 1 if any case fails. Usage: scripts/concierge-eval/run.sh [base_url]
set -euo pipefail
BASE="${1:-https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1}"
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eG1lanpzc3hqYXpzd2d3cXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDI4NjcsImV4cCI6MjA3NjI3ODg2N30.U10RsJRxIm3zPWcJPHpHuKf0X6FGO6P1bj4c21PN42o"
OUT="${TMPDIR:-/tmp}/concierge-eval"
mkdir -p "$OUT"; rm -f "$OUT"/*.json
offset=0
while :; do
  curl -s -m 150 -X POST "$BASE/concierge-eval?offset=$offset&limit=6" \
    -H "Authorization: Bearer $ANON" -H "apikey: $ANON" > "$OUT/$offset.json"
  all=$(python3 -c "import json;print(json.load(open('$OUT/$offset.json')).get('all',0))")
  offset=$((offset+6))
  [ "$offset" -ge "$all" ] && break
done
python3 - "$OUT" <<'PY'
import json,sys,glob
res=[r for f in sorted(glob.glob(sys.argv[1]+"/*.json")) for r in json.load(open(f)).get("results",[])]
bad=[r for r in res if not r["pass"]]
for r in bad: print("FAIL",r["id"],r["fails"],r["tools"],r.get("ms"),r["reply"][:220].replace("\n"," "))
ms=[r.get("ms",0) for r in res]
print(f"passed {len(res)-len(bad)}/{len(res)}  avg {sum(ms)//max(1,len(ms))}ms  max {max(ms or [0])}ms")
sys.exit(1 if bad or not res else 0)
PY
