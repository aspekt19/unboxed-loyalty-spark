# Edge Functions — agent rules

## In-app Concierge (chat-bridge) rules

- Concierge answers via a tool-using agent loop on OpenServ SERV (`_shared/concierge-agent.ts`); keyword routers in `concierge-redeem.ts` / `concierge-merchant.ts` are fallback only — why: keyword routing caused endless regressions; fix behaviour via tool descriptions/system prompt, not new regexes.
- Concierge product knowledge is generated from site docs by `node scripts/build-concierge-knowledge.mjs` into `_shared/concierge-knowledge-data.ts` — why: one source of truth; rerun after editing guide/skills/pricing docs.
- Every Concierge behaviour change must pass `scripts/concierge-eval/run.sh` (cases in `_shared/concierge-eval-cases.ts`, mock data, live SERV) before deploying chat-bridge; add a case for every reported bug — why: prevents re-fixing the same bugs. Each run costs SERV credits.

## API & MCP (source of truth)

- **REST (merchants):** `supabase/functions/agent-api/index.ts` — count routes here if docs disagree.
- **MCP (merchants):** `supabase/functions/loyalty-mcp/index.ts` — each `mcpServer.tool("name", …)` is one tool.
- **REST (recipients):** `supabase/functions/recipient-api/index.ts` — wallet-bound `rwk_` keys (balances, rewards, vouchers, redeem, **`POST /prepare-transfer`** for holder ERC-20 send calldata, P2P offers list/create/accept/cancel). **Paid corridor:** `mpp-gateway` / `x402-gateway` + paths in `_shared/recipient-paid-routes.ts`.
- **MCP (recipients):** `supabase/functions/recipient-loyalty-mcp/index.ts` — holder tools including **`prepare_loyalty_token_transfer`** (same calldata path as merchant `transfer_loyalty_tokens`, but authenticated with `rwk_`) and P2P (`list_p2p_offers`, `create_p2p_offer`, `accept_p2p_offer`, `cancel_p2p_offer`). **Paid x402 MCP:** `x402-gateway/recipient-mcp-tools/<name>` — prices in `_shared/recipient-mcp-bazaar-tools.ts`.
- **Base MCP custom plugin (calldata → `send_calls`):** `supabase/functions/agent-prepare/index.ts` — GET endpoints at `https://api.loyalspark.online/agent-prepare/<action>` returning `{ chainId, description, transactions:[{to,data,value}], builder_code }` for Base MCP `send_calls`. Actions: `create-program`, `activate-program`, `mint`, `transfer` (`lsk_`) · `recipient-transfer`, `recipient-approve` (`rwk_`). Plugin spec: `skills/loyal-spark/plugins/loyal-spark.md`.

## Gas sponsorship (Paymaster)

- Wallets use `paymaster-proxy` as their ERC-7677 `paymasterService`; it forwards to `CDP_PAYMASTER_URL` only when `_shared/paymaster-policy.ts` confirms every inner call targets Loyal Spark contracts (registered tokens, factories, escrow) with zero ETH value — why: an open paymaster URL would let anyone spend our gas budget.
- Frontend onchain buttons send via `useSponsoredSendTransaction` (Coinbase smart account → paymaster, plain tx otherwise); paid flows that move USDC/ETH to treasury stay on plain `useSendTransaction` — why: the proxy refuses non-Loyal-Spark targets.
- Free gas is smart-wallet only: plain wallets (MetaMask etc.) always pay their own gas. Direct ETH top-ups to user wallets were removed (the `gas-drip` function is gone) — why: bots could mass-create accounts and drain the gas wallet; never re-add wallet top-ups.
- `paymaster-proxy` enforces the single admin-editable monthly budget in `gas_settings` via `_shared/gas-budget.ts`; `gas-status` (admin-only) reports month spend and paymaster configuration for the admin Gas tab — why: one capped budget with admin visibility, without open-ended spend.
- Humans sign in with Coinbase CDP Embedded Wallets; `cdp-auth` validates the CDP access token server-side and issues the app session (`<cdp user id>@cdp.auth`) — why: Privy removed, CDP Paymaster sponsorship is free.

## CI

- All Edge Function code must pass `deno check` (CI job "Deno _shared unit tests") — why: type errors fail CI even when the function deploys fine.
