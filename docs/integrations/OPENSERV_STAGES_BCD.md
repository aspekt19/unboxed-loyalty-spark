# OpenServ Stages B–D — Concierge + AI ops packaging

Loyal Spark–only. Protocol pays OpenServ. Stage A Analyst: [OPENSERV_STAGE_A.md](./OPENSERV_STAGE_A.md).  
Concierge prompts: [OPENSERV_CONCIERGE_PROMPTS.md](./OPENSERV_CONCIERGE_PROMPTS.md).

## Architecture (B + C)

```
Merchant / Customer UI (button only after sign-in)
  → supabase.functions.invoke("chat-bridge")  [JWT]
    → daily quota (chat_bridge_usage)
    → account snapshot for this wallet
    → SERV Reasoning understands the question, answers if it is Loyal Spark, otherwise refuses
```

SERV is the same product AllowLatch used for drafting: `POST https://inference-api.openserv.ai/v1/chat/completions` with a required system prompt and `serv_prompt_guard`. The key stays in Supabase (`SERV_API_KEY`).

**Intent routing (shopper):** SERV understands the question first and may call tools (`issue_loyalty_voucher`, `list_my_vouchers`, `report_last_spend`). `chat-bridge` then runs the matching deterministic path on the agent-context snapshot (redeem UI, voucher list, last spend). Phrase-regex routing is only a fallback when SERV is down. Off-topic is refused by SERV after reading the question.

| Piece | Location |
|-------|----------|
| Scope gate | `supabase/functions/_shared/loyal-spark-scope.ts` |
| Bridge | `supabase/functions/chat-bridge/index.ts` |
| Usage table | `supabase/migrations/20261001120000_chat_bridge_usage.sql` |
| Merchant UI | Merchant portal → Business → **Assistant** (`?tab=assistant`) |
| Shopper UI | Customer portal → **Shopper assistant** dock |
| Chat component | `src/components/assistant/LoyalSparkConcierge.tsx` |

### Secrets (Supabase)

| Secret | Purpose |
|--------|---------|
| `SERV_API_KEY` | OpenServ Reasoning key (console.openserv.ai → Reasoning). Primary chat brain. |
| `SERV_MODEL` | Optional; default `gpt-5.5`. A saved `gpt-5.4-mini` overrides the default. |
| `OPENSERV_CONCIERGE_URL` | Fallback hosted Concierge HTTP API (no trailing slash) |
| `OPENSERV_CONCIERGE_API_KEY` | Bearer token for that fallback |
| `CHAT_MESSAGES_PER_DAY` | Optional; default `40` per signed-in actor |

Without OpenServ secrets, or if SERV fails, the bridge returns this user's account snapshot (balances, vouchers, certificates) instead of a generic stub. When SERV is up, it refuses off-topic only after reading the question.

### Deploy

```bash
supabase db push   # or apply migration
supabase functions deploy chat-bridge
```

### Definition of Done — Stage B

- [ ] Merchant sees Assistant tab; signed-in chat works.
- [ ] Off-topic refused in UI (and at bridge) with no OpenServ spend intent.
- [ ] With secrets set: replies come from OpenServ (`source: "openserv"`).
- [ ] Mint guidance never auto-broadcasts; confirms first.

### Definition of Done — Stage C

- [x] Shopper dock visible when signed in on customer portal.
- [x] Same HARD SCOPE; spend questions answered from Base logs.
- [x] Shopper can redeem from Concierge: pick reward → confirm → wallet sign → `verify-voucher` → code in chat / My Vouchers.
- [ ] Hosted OpenServ Shopper agent with MCP (optional parallel path) when secrets are set.

## Shopper redeem (in-app)

1. User asks for a voucher / reward / redeem.
2. `chat-bridge` lists affordable rewards (`source: "redeem"`, `action: pick_reward`) or prepares one match (`action: confirm_redeem`).
3. UI shows pick buttons or **Подписать и выпустить**.
4. Wallet signs ERC-20 transfer to merchant (same path as Activate Voucher).
5. Client calls `verify-voucher`; Concierge shows the code and fires `vouchersUpdated`.

Signing never happens server-side. `SERV_API_KEY` is unchanged.

## Stage D — Growth / Scale AI ops packaging

Product packaging (not a new runtime):

| Audience | What ships |
|----------|------------|
| **Merchant Growth+** | In-app Merchant Concierge + Stage A Analyst reports in portal |
| **Merchant Scale** | Priority Concierge routing (ops), dedicated onboarding; higher chat quota via `CHAT_MESSAGES_PER_DAY` / plan policy later |
| **Agent Pro / Enterprise** | Same MCP/REST; OpenServ ops agents (CEO/SEO/Growth/Analyst) remain protocol-ops, not sold as “unlimited chat” |

Public copy: Pricing page features + [MONETIZATION_AND_PRICING.md](../business/MONETIZATION_AND_PRICING.md) §2.1.

**Do not** market OpenServ as general-purpose AI. Refuse off-topic at Concierge and ops agents.

## Manual OpenServ Phase 0 (outside this repo)

1. Provision Merchant + Shopper Concierge agents from Concierge prompts doc.  
2. Point secrets at their chat URLs.  
3. Keep Analyst Stage A green before turning on Growth/SEO automation.

## Smoke (scope unit)

```bash
cd examples/openserv-analyst && npm run smoke
```

Bridge off-topic probe (with session JWT):

```bash
curl -sS "$SUPABASE_URL/functions/v1/chat-bridge" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"role":"merchant","messages":[{"role":"user","content":"What is the weather in Berlin?"}]}'
# expect refused: true
```

## Concierge agent context (read-model)

`supabase/functions/_shared/agent-context.ts` builds one snapshot per chat turn for the signed-in user.

- **Who builds it:** `chat-bridge`, once per message after JWT + wallet resolution (`buildShopperAgentContext` / `buildMerchantAgentContext`). In-isolate TTL 15 s.
- **Shopper contract:** `identity`, `balances` (portal multicall over `loyalty_programs`, Blockscout token-balances fallback, sorted desc), `rewards_affordable` (active rewards with cost ≤ balance), `vouchers_recent` (last 5 from DB), `last_outgoing` (Base RPC `eth_getLogs`, from = wallet), `capabilities`, `as_of`, `source_notes`.
- **Who reads it:** SERV first (tool calls or text). Tools map to redeem (`rewards_affordable`), voucher history (`vouchers_recent` / DB), last spend (`last_outgoing`). Regex phrase routes are fallback only. SERV ACCOUNT DATA is `contextText` from the same object.
- **Failure rule:** a failed source yields empty/null plus a note; replies say the lookup failed instead of "none".
- **Not:** a replacement for MCP/REST (`lsk_`/`rwk_`), nor server-side signing. Writes stay action → UI confirm → user wallet.
- **Merchant:** minimal in this pass (identity + text from the existing merchant DB snapshot).
