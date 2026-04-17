# x402 v2, paid MCP, and Bazaar (for AI agents)

## Status

End-to-end flow is **production-ready** when the gateway is deployed with CDP credentials:

1. Client requests `POST …/x402-gateway/mcp-tools/<tool_name>` with JSON-RPC `tools/call` and `x-api-key: lsk_…`.
2. Server responds **402** with **x402 v2** `accepts` (USDC on Base, CAIP-2 `eip155:8453`).
3. Client uses `@x402/fetch` + `@x402/evm` to sign and retry; facilitator **verify** → **settle**.
4. Gateway proxies to `loyalty-mcp` after successful settlement.

Smoke test in repo: `scripts/x402-paid-mcp-test/run.mjs` (see file header for `MCP_TOOL` / `MCP_ARGS`).

## Can we say “payment works”?

**Yes**, for the path above: successful **HTTP 200**, `X-Payment-Response: settled`, and a real **USDC** transfer on Base (e.g. on Basescan for the payer wallet) mean **x402 payment + MCP invocation** behave correctly.

## What agents need (found via Bazaar or any x402 client)

| Need | Why |
|------|-----|
| **Merchant API key** `lsk_…` | Required header on the MCP request **after** payment (merchant identity, scopes). |
| **USDC on Base** + wallet that can sign x402 (e.g. `@x402/fetch`) | Pays the per-call price in the 402 body (~**$0.01** per MCP tool in current catalog). |
| **Tool name + arguments** | Same as direct `loyalty-mcp`: JSON-RPC `tools/call` with `name` and `arguments`. |

**Bazaar** does not replace the API key: it helps **discovery** and documents **how** to call the resource. On-chain you only see USDC movement; **`extensions.bazaar`** lives in the **402 JSON**, not in the transaction.

## Parameter reference (source of truth)

Do **not** duplicate long lists only in marketing copy. Canonical data:

| What | Where |
|------|--------|
| Tool id, USD price, **JSON Schema for arguments**, descriptions | `supabase/functions/_shared/mcp-bazaar-tools.ts` |
| MCP implementation | `supabase/functions/loyalty-mcp/index.ts` |
| x402 **accepts** + **Bazaar** `extensions.bazaar` | `supabase/functions/_shared/x402-bazaar-accept.ts` |

Agents (and humans writing prompts) should use **schemas** from `mcp-bazaar-tools.ts`: required fields, types, and which tools need `token_address`, etc.

## Facilitator (Base mainnet)

- **Base mainnet** USDC verify/settle in production use **Coinbase CDP**  
  `https://api.cdp.coinbase.com/platform/v2/x402` when the gateway has `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` (or compatible CDP bearer).
- The public **`https://x402.org/facilitator`** is useful as a reference; **v2 `exact` on Base mainnet** is not the same as Sepolia-only listings — use CDP for mainnet per gateway config.

## Discovery checklist

- **402** responses for `mcp-tools/*` already include **Bazaar-oriented** metadata (`discoverable`, `inputSchema` for headers/body).
- **CDP discovery** (`/platform/v2/x402/discovery/resources`) may **lag**; listing is not guaranteed only from traffic.
- Keep **`.well-known/agent.json`**, **`llms.txt`**, and **this doc** aligned with `mcp-bazaar-tools.ts` when tools change.
