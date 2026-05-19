# In-app AI Assistants (OpenServ-backed) — Research & Implementation Plan

> **Status:** Research only. No code changes yet. Revisit when ready to build.
> **Why OpenServ:** chosen primarily for cost — OpenServ runtime / per-request pricing is significantly lower than alternatives (OpenAI Assistants, dedicated AI agent platforms), and these costs are borne by the protocol, not by merchants.

## TL;DR — Is it possible?

**Yes, technically possible**, with one important caveat: OpenServ is a **backend agent orchestrator** (our CEO/SEO/Growth/Analyst team already runs on it), **not a drop-in chat widget**. There is no ready-made "embed this component" UI from OpenServ. So the integration means we build our own chat / voice surface inside Lovable, and OpenServ acts as the "brain" via HTTP API.

Alternative (simpler) path: **Lovable AI Gateway directly** + our existing MCP as tools, without OpenServ runtime at all. Both options are described below.

---

## What we already have (foundation)

- **MCP servers** (28 merchant tools + recipient tools) — `supabase/functions/loyalty-mcp` and `recipient-loyalty-mcp`. This is a **ready-made function-calling tool set** for any LLM.
- **REST agent-api / recipient-api** — same actions over HTTP with `lsk_` / `rwk_` keys.
- **OpenServ team** (CEO / SEO / Growth / Analyst) — already knows how to call our MCP via `mcp-http-api-key.ts`. But these are **batch jobs**, not realtime chat.
- **Privy auth** (humans) + **CDP MPC wallets** (agents) — identity ready.
- **Lovable AI Gateway** (`LOVABLE_API_KEY`) — access to Gemini / GPT-5 without a separate key.

## What needs to be built

### Architectural options

**Option A — Lovable AI + MCP-as-tools (recommended to start with)**
```
[Chat UI in Lovable] → [edge function chat-assistant] → [Lovable AI Gateway + streamText]
                                                              │
                                                              └─ tools = our own MCP tools
```
- Pros: 1 edge function, native streaming, low latency, no external runtime, cheap on gateway.
- Cons: no built-in "agent team" — this is one assistant with tools.

**Option B — OpenServ runtime on top (the user's preferred long-term path due to cost)**
```
[Chat UI] → [edge function bridge] → [OpenServ Agent (hosted)] → MCP/REST Loyal Spark
```
- Pros: can delegate between our agents (Merchant Concierge → Analyst → Growth) for complex tasks. OpenServ stores context and logs. **Costs are noticeably lower than OpenAI Assistants or commercial agent platforms** — the deciding factor here since the protocol pays.
- Cons: needs a hosted agent (our OpenServ stack is not self-hosted in this repo today), higher latency, harder to stream tokens to UI.

**Recommendation:** start with **A** as a 1–2 day MVP to validate UX and tool-calling, then migrate to **B** for production once OpenServ-hosted agents are deployed. Option A's code (edge function + UI) is reusable — only the model call layer swaps.

### Voice

- **Speech-to-text:** browser `webkitSpeechRecognition` for free (Chrome / Safari / mobile). For higher quality, OpenAI Whisper through an external provider.
- **Text-to-speech:** `SpeechSynthesisUtterance` (native browser, free, instant) for MVP. For production-grade voice — **ElevenLabs** (separate API key, needs a secret) or OpenAI TTS.
- Realtime voice chat (like ChatGPT Voice Mode) requires WebRTC + a Realtime API → separate large project, **not for MVP**.

---

## Two personas

### 1. Merchant Concierge (for sellers)
- Context: `merchant_id`, `wallet`, active programs, last 30 days of metrics.
- Scenarios: "create a program with 5% cashback", "how many new customers today", "launch a campaign for the VIP tier", "issue 50 gift certificates of $10".
- Tools: subset of MCP (`create_loyalty_program`, `mint_tokens`, `list_customers`, `create_campaign`, `issue_gift_certificate_batch`, `get_platform_stats` for admins).
- Permissions: tool execute requires **confirmation** for money-actions (`needsApproval: true`) — modal "Confirm mint 1000 LOYAL → 0xAbc...?".

### 2. Shopper Assistant (for customers)
- Context: `wallet`, balances across all tokens, available rewards, tiers.
- Scenarios: "how many points do I have at Starbucks", "what rewards can I redeem right now", "find merchants with > 10% discount nearby", "redeem my 500 points for a voucher".
- Tools: recipient MCP (`get_balance`, `list_rewards`, `redeem_reward`, `list_p2p_offers`, `accept_p2p_offer`).
- Permissions: redeem / accept require confirmation + signature (Privy embedded wallet → sync gesture, per our Core memory rule).

---

## Implementation plan (when greenlit)

### Phase 1 — Merchant Concierge MVP (≈ 2–3 days)
1. `supabase/functions/chat-assistant/index.ts` — streaming endpoint:
   - AI SDK + Lovable Gateway (`openai/gpt-5-mini` or `google/gemini-3-flash-preview`).
   - System prompt with role + scope restrictions.
   - Tools = whitelist of MCP merchant tools (via `tool-deferral` pattern, since we have 28+ tools — otherwise context bloats).
   - Auth: Privy JWT → derive `wallet_address` → inject as context into every tool call.
2. UI: new page `/merchant/assistant` or a floating button inside `MerchantPanel`:
   - AI Elements (`Conversation`, `Message`, `PromptInput`, `Tool`, `Shimmer`).
   - History in **localStorage** (per our rule — one conversation per merchant, not threads).
   - Microphone button → `webkitSpeechRecognition` → text into input → submit.
   - "Speak responses" toggle → `SpeechSynthesis` reads responses aloud.
3. Tool approval UI: for destructive tools, show a "Confirm" card with the parameters before execution.

### Phase 2 — Shopper Assistant (≈ 1–2 days)
- Same endpoint, switching system prompt + tool whitelist by caller role (Privy claim or query param `?role=shopper`).
- Embed on `/customer` page as a bottom dock-chat on mobile / sidebar on desktop.

### Phase 3 — Migrate "brain" to OpenServ (cost-driven)
- Replace the direct Lovable Gateway call in `chat-assistant` with a thin HTTP bridge to a hosted OpenServ agent (Merchant Concierge / Shopper Concierge).
- The OpenServ agent owns the tool list and can **delegate** to existing CEO / Analyst / Growth agents for heavy reports.
- Streaming: if OpenServ doesn't expose SSE for chat responses, fall back to chunked polling with a "thinking…" indicator.
- This is the **target architecture** because OpenServ usage is cheaper than running everything through the Lovable Gateway when chat volume scales.

### Phase 4 — Production voice (optional)
- Add ElevenLabs (requires `ELEVENLABS_API_KEY` secret) for premium voice.
- Cache frequent responses.
- Optionally — Realtime API (WebRTC) for voice-to-voice as a separate feature.

---

## Technical details (for the engineer, not for the deck)

- **Tool deferral is mandatory**: 28 MCP tools × JSON schema = ~15–20k input tokens per turn. Implement the `tool_search` + `tool_invoke` meta-pattern (see ai-sdk-tool-deferral knowledge).
- **MCP loading**: we don't need a real MCP-over-HTTP client — we own the code, so we import tool descriptors directly from `_shared/mcp-bazaar-tools.ts` and wrap them in AI SDK `tool()`. Cheaper and faster.
- **Synchronous wallet gestures** (our Core memory): `mint_tokens` / `redeem_reward` tools cannot sign tx from an edge function for merchants with Privy embedded wallets. Solution: the tool returns **prepared calldata** + UI shows a "Sign" button → user clicks (sync gesture) → `sendTransaction`. For CDP-wallet agents — sign server-side.
- **Privacy context**: shopper chat must **not** see data of other users. All DB queries in tools go through an RLS-aware service with `lower(wallet) = lower($caller)`.
- **Rate limiting**: new counter `chat_messages_per_day` in `agent_rate_limit.ts` to avoid bleeding the gateway / OpenServ balance.
- **Persistence**: localStorage for MVP. If cross-device is wanted later — add a `chat_conversations` + `chat_messages` table with RLS by `user_id` / `wallet`.

## Cost

- **Lovable AI** (Phase 1–2): ~$0.0001–0.001 per turn on flash models. 1000 active merchants × 20 turns/day ≈ $20–100/month.
- **OpenServ** (Phase 3, the target): pricing is the **reason this path was chosen** — materially cheaper than OpenAI Assistants or other agent platforms once volume grows. Exact monthly cost depends on the OpenServ plan; recheck before migration.
- **ElevenLabs** (Phase 4, optional): from $5/month starter.

## Risks

- **Argument hallucination**: the model may invent a `token_address` or `customer_wallet`. Mitigation: tool execute validates with Zod + checks ownership in DB before executing.
- **Privy session inside edge function**: must verify Privy JWT in `chat-assistant` the same way `agent-reports` already does (PATCH workaround).
- **Voice on iOS Safari**: `webkitSpeechRecognition` does not work on iOS Safari (only Chrome iOS, and even there with limits). On native Capacitor builds, use a plugin (`@capacitor-community/speech-recognition`).
- **OpenServ availability / latency**: if OpenServ goes down or is slow, the assistant is unusable. Fallback to Lovable Gateway as automatic degradation.

## What we are NOT doing now

- No code changes — this is a research plan.
- Not creating the `chat-assistant` edge function.
- Not touching OpenServ agents CEO / SEO / Growth / Analyst — they keep running in the background.

---

**Decision when revisiting:** start Phase 1 (Merchant Concierge via Lovable AI + our MCP tools) to validate UX, then transition the brain to OpenServ in Phase 3 for sustainable cost.
