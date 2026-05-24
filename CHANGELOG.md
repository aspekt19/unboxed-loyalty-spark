# Changelog

All notable changes to the Loyal Spark agent-facing API surface (REST, MCP, x402) are documented here.

Format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.2.1] – 2026-05-24

### Fixed — agentic.market "INPUT SCHEMA PRESENT: no" for REST resources

- All 12 REST x402 resources now expose `extensions.bazaar.info.inputSchema` at the `info` level (previously only present for MCP tools), so the agentic.market validator sees `INPUT SCHEMA PRESENT: yes` for the full 77-resource catalog.
- Added `REST_INPUT_SCHEMAS` map in `supabase/functions/_shared/x402-bazaar-accept.ts` with per-route JSON Schemas (EVM address regex `^0x[a-fA-F0-9]{40}$`, required fields, enums) for 30+ merchant and recipient routes; non-enumerated routes fall back to a valid generic JSON Schema (never `additionalProperties: true` alone).
- Updated `bazaarSchemaHttpQuery` / `bazaarSchemaHttpBody` meta-schemas to explicitly allow `inputSchema` at the `info` level for strict CDP validation.
- Edge functions redeployed: `x402-gateway`, `well-known-x402`.

### Version bumps for integrators

| File | Old | New |
|------|-----|-----|
| `public/.well-known/mpp.json` | 2.2.0 | **2.2.1** |
| `public/.well-known/agent.json` | 2.2.0 | **2.2.1** |
| `public/openapi.json` | 2.2.0 | **2.2.1** |

## [2.2.0] – 2026-05-23


### Fixed — count discrepancies across discovery files

- **MCP tools:** corrected merchant MCP tool count from 28 → **32** and recipient MCP from 11 → **14** across all discovery documents.
- **REST routes:** documented merchant REST as **23** routes and recipient REST as **12** routes (previously under-counted or inconsistent).
- **x402 resources:** total is now **77** paid resources (was previously documented as "70+")
- Files updated: `public/llms-full.txt`, `public/.well-known/mpp.json`, `public/.well-known/x402` (no extension), `public/.well-known/x402.json`, `supabase/functions/well-known-x402/index.ts`, `docs/pitch-deck/PITCH_DECK_PRESENTATION.md`, `docs/integrations/OPENSERV_AGENTS_SETUP.md`.

### Changed — x402 discovery (CDP v2 alignment)

- `well-known-x402` response now returns `serviceName`, `tags`, and `iconUrl` as **top-level per-item fields** per updated CDP v2 spec. Previously these were nested inside `metadata`.
- `x402Version` remains `1` for backward compatibility.

### Version bumps for integrators

| File | Old | New |
|------|-----|-----|
| `public/.well-known/mpp.json` | 2.1.0 | **2.2.0** |
| `public/.well-known/agent.json` | 2.1.0 | **2.2.0** |

## [2.1.0] – 2026-05-15

### Added
- Recipient agent persona (`rwk_`) with 12 REST routes + 14 MCP tools.
- Gift certificates (`LOYAL-XXXXXX` batch generation).
- x402 v2 pay-per-request gateway with Bazaar metadata.
- `recipient-mcp-tools/` corridor in x402 gateway.
- `well-known-x402` discovery endpoint.

### Changed
- OpenAPI upgraded to 2.2.0 to reflect new routes.

## [2.0.0] – 2026-04-01

### Added
- Merchant agent persona (`lsk_`) with SIWE registration.
- `loyalty-mcp` server with 32+ tools.
- MPP gateway (pathUSD/USDC on Tempo).
- P2P marketplace escrow on Base.
- CDP MPC server wallets for AI agents.

### Changed
- A2A protocol shift: all agent APIs now require `x-api-key`.

---

[2.2.0]: https://loyalspark.online
[2.1.0]: https://loyalspark.online
[2.0.0]: https://loyalspark.online
