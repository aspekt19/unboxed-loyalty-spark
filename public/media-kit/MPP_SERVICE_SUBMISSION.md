# How to Add Loyal Spark to mpp.dev Service Catalog (+ x402 Support)

## Prerequisites
- GitHub account
- Working MPP gateway endpoint

## Steps

### 1. Fork the Repository
Go to https://github.com/tempoxyz/mpp and fork it.

### 2. Add Service Entry
Edit `schemas/services.ts` (or the appropriate registry file) and add:

```typescript
{
  id: "loyal-spark",
  name: "Loyal Spark",
  url: "https://loyalspark.online",
  serviceUrl: "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/mpp-gateway",
  description: "Onchain loyalty protocol for AI agents — create ERC-20 programs, mint tokens, manage rewards, and trade on P2P marketplace. All on Base L2.",
  category: "Blockchain",
  docs: "https://loyalspark.online/llms.txt",
  website: "https://loyalspark.online",
}
```

### 3. Create Pull Request
- Title: `feat: add Loyal Spark — onchain loyalty protocol for AI agents`
- Description:
```
Loyal Spark is a Web3 loyalty ecosystem on Base L2 that enables AI agents to autonomously create ERC-20 loyalty programs, mint tokens, manage rewards, and trade on a P2P marketplace.

- Gateway URL: https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/mpp-gateway
- Payment: pathUSD on Tempo
- Docs: https://loyalspark.online/llms.txt
- Agent manifest: https://loyalspark.online/.well-known/agent.json
- 18 API endpoints with per-request pricing ($0.001–$0.05)
- Also supports MCP Server for tool-based integration
```

### 4. Test with mppx CLI
Before submitting PR, verify the gateway works:
```bash
npx mppx account create
npx mppx https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/mpp-gateway/programs -H "x-api-key: YOUR_KEY"
```

### 5. Register on MPPScan (Optional)
Visit MPPScan to register the endpoint for instant discoverability by agents, even before the PR is merged.

## Pricing Summary

| Endpoint | Method | Price (USD) |
|---|---|---|
| /me | GET | Free |
| /programs | GET | $0.001 |
| /rewards | GET | $0.001 |
| /balance | GET | $0.001 |
| /customers | GET | $0.002 |
| /vouchers | GET | $0.001 |
| /analytics | GET | $0.005 |
| /offers | GET | $0.001 |
| /programs | POST | $0.05 |
| /register-program | POST | $0.01 |
| /activate-program | POST | $0.01 |
| /program-status | POST | $0.005 |
| /rewards | POST | $0.01 |
| /mint | POST | $0.01 |
| /transfer | POST | $0.005 |
| /offers | POST | $0.01 |
| /accept-offer | POST | $0.01 |
| /cancel-offer | POST | $0.005 |
