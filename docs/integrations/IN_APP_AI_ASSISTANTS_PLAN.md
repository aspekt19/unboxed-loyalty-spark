# In-app AI Assistants (OpenServ-backed) — Research & Implementation Plan

> **Status:** Research only. No code changes yet. Revisit when ready to build.
> **Architecture decision:** go **straight to Option B** — OpenServ-hosted agents as the "brain" from day one. The Lovable AI Gateway fallback (Option A) is intentionally skipped to avoid throwaway code and to lock in OpenServ's lower per-request cost from the start. These costs are borne by the protocol, not by merchants.

## TL;DR — Is it possible?

**Yes, technically possible.** OpenServ is a **backend agent orchestrator** (our CEO/SEO/Growth/Analyst team already runs on it), **not a drop-in chat widget**. There is no ready-made "embed this component" UI from OpenServ, so the integration means we build our own chat / voice surface inside Lovable, and **a new hosted OpenServ agent (`Merchant Concierge` / `Shopper Concierge`) acts as the brain** via HTTP, calling our MCP and REST tools.

## What we already have (foundation)

- **MCP servers** (38 merchant tools, 20 recipient tools) — `supabase/functions/loyalty-mcp` and `recipient-loyalty-mcp`. Ready-made function-calling toolset for any LLM/agent. Already integrated with OpenServ via `mcp-http-api-key.ts`.
- **REST agent-api / recipient-api** — same actions over HTTP with `lsk_` / `rwk_` keys.
- **OpenServ team** (CEO / SEO / Growth / Analyst) — already calls our MCP. Today they run as **batch jobs** (reports), but the same runtime supports interactive request/response, so we can add two new realtime agents to the same stack.
- **Privy auth** (humans) + **CDP MPC wallets** (agents) — identity ready.
- **`mcp-http-api-key.ts`** — already supports both `x-api-key` and `Authorization: Bearer` (needed because OpenServ doesn't always forward custom headers).

## Target architecture (Option B only)

```
[Chat UI in Lovable] ──Privy JWT──▶ [edge function chat-bridge]
                                            │
                                            │ HTTP (SSE if available, else chunked polling)
                                            ▼
                                  [OpenServ Agent (hosted)]
                                  • Merchant Concierge
                                  • Shopper Concierge
                                            │
                            ┌───────────────┼────────────────┐
                            ▼               ▼                ▼
                       loyalty-mcp   recipient-mcp   delegate → CEO/Analyst/Growth
                       (lsk_ scoped) (rwk_ scoped)   (heavy reports, async)
```

### Why Option B (not A)

- **Cost at scale**: OpenServ per-request pricing is materially cheaper than running every turn through the Lovable AI Gateway once chat volume grows. The protocol pays, so cost is the deciding factor.
- **Reuse**: OpenServ already knows our MCP, auth, and rate limits. No second LLM stack to maintain.
- **Multi-agent delegation**: "Show me last month's churn risks" → Concierge can delegate to **Analyst** (already built) instead of re-implementing the analysis in the chat agent.
- **Avoid throwaway code**: building Option A first and migrating later would mean replacing the model-call layer, retesting all tool flows, and migrating message persistence. Going straight to B eliminates that churn.

### Trade-offs we accept

- **Higher first-token latency** than direct Gateway streaming. Mitigation: skeleton + "thinking…" indicator from the moment `sendMessage` fires (per chat-agent UI contract).
- **Streaming depends on OpenServ**: if the hosted agent doesn't expose SSE for chat responses, the bridge falls back to chunked polling. The UI contract is the same either way (AI SDK `useChat` + `parts`).
- **Hard dependency on OpenServ availability**: if it's down, the assistant is down. Mitigation: a small in-edge-function **kill-switch** that hides the chat UI ("Assistant temporarily unavailable") instead of erroring inside the chat.
- **Prerequisite work**: a new OpenServ-hosted agent (Merchant Concierge / Shopper Concierge) must be deployed before Phase 1 ships. This is **blocking** for Phase 1.

## Voice

- **Speech-to-text:** browser `webkitSpeechRecognition` for free (Chrome/Safari/mobile). For higher quality later, Whisper via an external provider.
- **Text-to-speech:** `SpeechSynthesisUtterance` (native browser, free, instant) for MVP. Production-grade voice → **ElevenLabs** (separate secret) or OpenAI TTS.
- Realtime voice-to-voice (WebRTC + Realtime API) is **out of scope** for this plan.

---

## Two personas

### 1. Merchant Concierge (for sellers)
- **OpenServ agent**: new `merchant-concierge` agent, system prompt scoped to a single merchant context (`merchant_id`, `wallet`, active programs, last 30 days of metrics).
- **Scenarios**: "create a program with 5% cashback", "how many new customers today", "launch a campaign for the VIP tier", "issue 50 gift certificates of $10".
- **Tools**: subset of merchant MCP (`create_loyalty_program`, `mint_loyalty_tokens`, `list_customers`, `create_personalized_offer`, `issue_gift_certificate_batch`, `get_platform_stats` for admins).
- **Delegation**: can call `delegate_to_analyst` / `delegate_to_growth` for heavy/async work that returns as an `agent_reports` row.
- **Permissions**: money-actions require **`needsApproval: true`** — modal "Confirm mint 1000 LOYAL → 0xAbc…?".

### 2. Shopper Assistant (for customers)
- **OpenServ agent**: new `shopper-concierge` agent, scoped to one `wallet`.
- **Scenarios**: "how many points do I have at Starbucks", "what rewards can I redeem right now", "find merchants with > 10% discount nearby", "redeem my 500 points for a voucher".
- **Tools**: recipient MCP (`get_balance`, `list_rewards`, `redeem_reward`, `list_p2p_offers`, `accept_p2p_offer`, `prepare_loyalty_token_transfer`).
- **Permissions**: redeem / accept / transfer require confirmation + signature (Privy embedded wallet → **sync gesture**, per Core memory rule).

---

## Implementation plan (when greenlit)

### Phase 0 — OpenServ agent provisioning (BLOCKING, ≈ 1–2 days infra)
Outside this repo (OpenServ stack):
1. Create two new hosted agents: `merchant-concierge`, `shopper-concierge`.
2. Reuse existing MCP wiring (`mcp-http-api-key.ts` — Bearer-compatible).
3. System prompts: role scope, refusal rules, tool whitelist, language = caller's locale.
4. Expose a single inbound endpoint per agent: `POST /chat` accepting `{ session_id, messages[], context: { wallet, merchant_id?, role } }` returning either SSE or JSON.
5. Issue a service `lsk_` (and `rwk_` for shopper) keypair scoped to "concierge" usage, stored as Lovable secret `OPENSERV_CONCIERGE_API_KEY` (+ `OPENSERV_CONCIERGE_URL`).

### Phase 1 — Merchant Concierge MVP (≈ 2–3 days)
1. **Edge function `supabase/functions/chat-bridge/index.ts`** (thin bridge, no LLM call locally):
   - Verifies Privy JWT (PATCH workaround like `agent-reports`).
   - Resolves caller → `wallet_address` → `merchant_id` (if any) → role.
   - Forwards `messages[]` + `context` to OpenServ `merchant-concierge` `/chat` with `Authorization: Bearer ${OPENSERV_CONCIERGE_API_KEY}`.
   - **Streaming**: passes through SSE when OpenServ supports it; otherwise polls and emits AI SDK UI message stream chunks via `toUIMessageStreamResponse`.
   - **Kill-switch**: if OpenServ returns 5xx or times out (>8s for first byte), responds 503 with `{ disabled: true }` → UI hides the input and shows "Assistant temporarily unavailable".
2. **UI** (`/merchant/assistant` page + floating button in `MerchantPanel`):
   - AI SDK UI: `useChat` + `DefaultChatTransport`, render `message.parts` (text + tool + error).
   - AI Elements: `Conversation`, `Message`, `PromptInput` (with `PromptInputTextarea` + `PromptInputFooter` + `PromptInputSubmit` inside footer), `Tool`, `Shimmer`.
   - **Optimistic UI**: user message + typing indicator visible from `status === 'submitted'`, before any token streams.
   - History in **localStorage** (one conversation per merchant, per Core memory rule).
   - Microphone button → `webkitSpeechRecognition` → text into input → submit.
   - "Speak responses" toggle → `SpeechSynthesis` reads completed assistant turns.
3. **Tool approval UI**: destructive tool parts (`state === 'input-available'` with `needsApproval`) render a "Confirm" card showing parameters. On approve → resume; on reject → reply "user declined".
4. **Sync wallet gestures**: `mint_loyalty_tokens` / `redeem_reward` tools return **prepared calldata**. UI shows a "Sign" button → user clicks → `sendTransaction` in the same React event handler.

### Phase 2 — Shopper Assistant (≈ 1–2 days)
- Same `chat-bridge` endpoint; routes to `shopper-concierge` agent based on `role` (from Privy claim or query param `?role=shopper`).
- Embed on `/customer` page: bottom dock-chat on mobile, sidebar on desktop.
- Same tool-approval pattern; recipient MCP whitelist.

### Phase 3 — Multi-agent delegation polish (≈ 1 day)
- Add `delegate_to_analyst` / `delegate_to_growth` tools inside the Concierge agent prompts.
- UI: when Concierge delegates, render a "Working with Analyst…" tool part; the eventual report shows up as a normal `agent_reports` row + a chat link.

### Phase 4 — Production voice (optional)
- Add ElevenLabs (requires `ELEVENLABS_API_KEY` secret) for premium TTS.
- Cache frequent responses.
- Realtime voice-to-voice (WebRTC) — separate project.

---

## Technical details (engineer-facing)

- **No tool deferral needed in-app**: tools live inside the OpenServ agent, not in our edge function — input-token bloat is OpenServ's problem to solve, not ours. We just forward messages.
- **MCP transport**: OpenServ already uses our MCP over HTTP with Bearer auth (`mcp-http-api-key.ts`). No new transport work.
- **Privacy / RLS**: `chat-bridge` injects the verified caller `wallet` into the OpenServ `context`. The agent's tool calls go through MCP, which enforces `lower(wallet) = lower($caller)` server-side. **Never trust wallet from the LLM args.**
- **Rate limiting**: new counter `chat_messages_per_day` in `agent_rate_limit.ts`, keyed by `wallet`. Protects both Lovable edge quota and the OpenServ bill.
- **Persistence**: localStorage for MVP. If cross-device wanted later → tables `chat_conversations` + `chat_messages` with RLS by `user_id` / `wallet` (validate with `validateUIMessages` on restore).
- **Streaming contract**: bridge always emits the AI SDK UI message stream format, regardless of whether OpenServ gave us SSE or JSON. UI never sees the difference.
- **Kill-switch + health**: `chat-bridge` keeps a 30s in-memory health flag on OpenServ. On 3 consecutive failures → hide chat globally for 5 minutes.

## Cost

- **OpenServ** (Phase 1+): per-request pricing, **the reason this path was chosen**. Materially cheaper than OpenAI Assistants or running every turn through Lovable AI Gateway at scale. Exact monthly cost depends on the OpenServ plan; recheck before launch and budget against `chat_messages_per_day` cap.
- **Lovable AI Gateway**: ~$0 in this architecture — we don't call it from `chat-bridge`. (Still used by other parts of the app.)
- **ElevenLabs** (Phase 4, optional): from $5/month starter.

## Risks

- **OpenServ availability/latency**: single point of failure for chat. Mitigated by kill-switch + clear "temporarily unavailable" UI. No silent broken state.
- **First-token latency higher than direct Gateway streaming**: mitigated by aggressive optimistic UI (loader from `submitted`, not from first token).
- **Argument hallucination by the agent**: MCP tools validate with Zod + check DB ownership before executing. Wallet is **never** taken from LLM args — only from verified Privy JWT.
- **Privy session inside edge function**: must verify JWT the same way `agent-reports` does (PATCH workaround). Reuse that code path.
- **Voice on iOS Safari**: `webkitSpeechRecognition` doesn't work there. On native Capacitor builds, use `@capacitor-community/speech-recognition`.
- **Phase 0 is blocking**: no OpenServ Concierge agent → no Phase 1. Coordinate timeline with OpenServ stack work.

## What we are NOT doing

- **Not building Option A** (Lovable AI Gateway + local tool-deferral). Decision: skip to avoid throwaway code.
- No code changes yet — this is a research plan.
- Not touching existing OpenServ agents (CEO / SEO / Growth / Analyst) — they keep running in the background. Concierge agents are **new** and additive.

---

**Decision when revisiting:** kick off **Phase 0** (OpenServ Concierge agent provisioning) first; in parallel, start UI scaffolding in Phase 1 against a mocked `chat-bridge` so frontend and infra land together.
