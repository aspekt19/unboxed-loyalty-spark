# Smoke — autonomous workflow routes

After the owner deploys the edge functions, run these to prove the new
workflow surfaces work end-to-end. No secrets are baked into curl; export
`LSK_KEY` (merchant `lsk_…`) and `RWK_KEY` (recipient `rwk_…`) locally.

## 1. Merchant

```bash
# Planner: current lifecycle step + next_actions[]
curl -s "https://api.loyalspark.online/agent-api/workflow/program-status" \
  -H "x-api-key: $LSK_KEY" | jq .workflow

# Planner: propose program name / symbol / rewards from merchant context
curl -s -X POST "https://api.loyalspark.online/agent-api/workflow/generate-program-defaults" \
  -H "x-api-key: $LSK_KEY" -H "content-type: application/json" \
  -d '{"business_name":"Sunrise Coffee","category":"cafe"}' | jq .

# End-to-end auto: no name/symbol supplied → server generates + returns calldata
curl -s -X POST "https://api.loyalspark.online/agent-api/programs" \
  -H "x-api-key: $LSK_KEY" -H "content-type: application/json" \
  -d '{"auto_generate":true,"business_context":{"business_name":"Sunrise Coffee","category":"cafe"}}' \
  | jq '{workflow, calldata: (.calldata | length), token_standard}'
```

## 2. Recipient

```bash
# Planner: reward redemption workflow for a program the wallet holds
curl -s "https://api.loyalspark.online/recipient-api/workflow/reward-status?token_address=0xTOKEN" \
  -H "x-api-key: $RWK_KEY" | jq .workflow

# Planner: transfer calldata + workflow so agent can broadcast then redeem
curl -s -X POST "https://api.loyalspark.online/recipient-api/workflow/prepare-reward-redemption" \
  -H "x-api-key: $RWK_KEY" -H "content-type: application/json" \
  -d '{"reward_id":"REWARD_UUID"}' \
  | jq '{transfer: .transfer_preparation.transactions | length, next: .workflow.next_actions}'
```

## 3. x402 paid discovery (unauthenticated → expect 402, not 404)

```bash
for u in \
  "https://api.loyalspark.online/x402-gateway/workflow/program-status" \
  "https://api.loyalspark.online/x402-gateway/recipient-api/workflow/reward-status?token_address=0xTOKEN"; do
  echo "== GET $u"; curl -s -o /dev/null -w "%{http_code}\n" "$u"
done

for u in \
  "https://api.loyalspark.online/x402-gateway/workflow/generate-program-defaults" \
  "https://api.loyalspark.online/x402-gateway/recipient-api/workflow/prepare-reward-redemption" \
  "https://api.loyalspark.online/x402-gateway/mcp-tools/generate_program_defaults" \
  "https://api.loyalspark.online/x402-gateway/mcp-tools/get_program_workflow_status" \
  "https://api.loyalspark.online/x402-gateway/recipient-mcp-tools/get_reward_workflow_status" \
  "https://api.loyalspark.online/x402-gateway/recipient-mcp-tools/prepare_reward_redemption"; do
  echo "== POST $u"; curl -s -o /dev/null -w "%{http_code}\n" -X POST "$u"
done
```

All GET/POST should return `402 Payment Required` (with `accepts[]` body),
not `404 Unknown or unsupported route`. If any 404 shows, redeploy the
gateway — it was built before the workflow PRICING keys landed.

## 4. Owner deploy checklist

```bash
supabase functions deploy \
  agent-api recipient-api loyalty-mcp recipient-loyalty-mcp x402-gateway mpp-gateway
# then republish static assets: public/openapi.json, public/.well-known/*
```
