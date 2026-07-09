# Skill: Endpoint Workflows

## Goal
Teach AI agents how to compose Loyal Spark endpoints into complete business flows instead of calling isolated routes out of order.

## When to Use
- You know the endpoint name, but not the required follow-up steps
- You need to decide what to call next after a successful response
- You want to safely automate merchant or recipient operations end-to-end

## Core Rules

0. **External agents choose every value.**
   Loyal Spark workflow responses tell you *what to call next* and which fields are required. They do **not** assign your program name, symbol, or reward catalog. Pass explicit `name`, `symbol`, `cost`, and `amount` on write endpoints. `auto_generate` exists only for trusted internal automation — external agents should omit it.

1. **Do not treat one endpoint as the whole workflow.**
   Many Loyal Spark operations are multi-step: prepare onchain calldata, broadcast, wait for confirmation, then update database state or call the next endpoint.

2. **Always identify the actor first.**
   - Merchant / issuer agent: `lsk_`
   - Recipient / holder agent: `rwk_`

   Use workflow-aware helpers first when available:
   - Merchant REST: `GET /workflow/program-status`, `POST /workflow/generate-program-defaults`
   - Merchant MCP: `get_program_workflow_status`, `generate_program_defaults`
   - Recipient REST: `GET /recipient-api/workflow/reward-status`, `POST /recipient-api/workflow/prepare-reward-redemption`
   - Recipient MCP: `get_reward_workflow_status`, `prepare_reward_redemption`

3. **Always identify the program first.**
   Before minting, rewards, vouchers, analytics, or transfers, determine:
   - `token_address`
   - `token_standard` (`b20` or `erc20`)
   - `status`
   - `merchant_address`

4. **B20 is the default for new programs.**
   - `b20`: one deploy tx, active immediately after `register-program`
   - `erc20`: legacy path, requires explicit activation flow

5. **Onchain-first operations need confirmation before follow-up.**
   If a response returns calldata or depends on a tx hash, broadcast the tx, wait for confirmation, then continue.

## Workflow Map

### 1. Create a New Loyalty Program

Use when a merchant wants a fresh loyalty token.

#### B20 default flow
1. **You choose** program identity and economics:
   - `name` (required)
   - `symbol` (required)
   - `expiration_days`, `cashback_rate`, `points_per_dollar` (optional)
   - reward `name`, `description`, `cost` when creating catalog items
2. Optional planner (does not set values for you):
   - REST: `POST /workflow/generate-program-defaults`
   - MCP: `generate_program_defaults`
   Returns `field_catalog`, `workflow.next_actions`, and non-binding `examples`.
3. Call:
   - REST: `POST /programs`
   - MCP: `create_loyalty_program`
4. Broadcast returned `createB20(...)` calldata on Base.
5. Extract `token_address` from:
   - `B20Created` event, or
   - `GET /tx-receipt?tx_hash=...`
6. Call:
   - REST: `POST /register-program`
   - MCP: `register_loyalty_program`
   with `token_standard: "b20"`
7. Program is now **active**.
8. Recommended next step: create at least one reward before minting at scale.

#### Legacy ERC-20 flow
1. Call create with `token_standard: "erc20"`.
2. Broadcast factory deploy tx.
3. Extract `token_address`.
4. Register program with `token_standard: "erc20"`.
5. Call:
   - REST: `POST /activate-program`
   - MCP: `activate_loyalty_program`
6. Broadcast returned activation txs.
7. Call:
   - REST: `POST /program-status`
   - MCP: `update_program_status`
   with `status: "active"`

### 2. Create a Reward Catalog

Use when a merchant wants the program to have redeemable utility.

1. Confirm program exists and is active.
2. Optionally inspect current rewards:
   - REST: `GET /rewards`
   - MCP: `list_rewards`
3. Create reward:
   - REST: `POST /rewards`
   - MCP: `create_reward`
4. Recommended reward fields:
   - clear name
   - concise description
   - token cost aligned to earn rate

### 3. Mint Loyalty Tokens

Use only after the program is active.

1. Confirm merchant owns the program:
   - REST: `GET /programs`
   - MCP: `list_loyalty_programs`
2. Confirm active state:
   - `b20`: active after register
   - `erc20`: active only after activation flow
3. Choose one:
   - `POST /mint` / `mint_loyalty_tokens`
   - `POST /earn` / `earn_points` when mint amount depends on purchase amount
4. Broadcast returned calldata if the route returns unsigned tx data.
5. Verify result:
   - `GET /balance`
   - `GET /customers`
   - recipient balance endpoints

### 4. Transfer Tokens

#### Merchant-side transfer
1. Confirm merchant controls the program.
2. Call:
   - REST: `POST /transfer`
   - MCP: `transfer_loyalty_tokens`
3. Broadcast calldata.
4. Verify recipient balance.

#### Recipient-side transfer
1. Confirm holder has balance:
   - REST: `GET /recipient-api/balance`
   - MCP: `get_my_loyalty_balance`
2. Call:
   - REST: `POST /recipient-api/prepare-transfer`
   - MCP: `prepare_loyalty_token_transfer`
3. Holder signs and broadcasts calldata.

### 5. Redeem Reward into Voucher

This is always a multi-step flow.

1. Discover reward:
   - merchant: `GET /rewards`
   - recipient: `GET /recipient-api/rewards`
2. Prefer helper endpoints/tools to get merchant target address and ready-to-broadcast calldata.
3. Transfer the required token amount onchain to the merchant.
4. Wait for confirmation.
5. Call:
   - merchant REST/MCP reward redemption route
   - recipient reward redemption route if acting as holder
   passing the onchain `transaction_hash`
6. Receive voucher code.
7. Merchant later marks it used:
   - REST: `POST /vouchers/use`
   - MCP: `use_voucher`

### 6. Marketplace / P2P Offers

1. Inspect existing offers:
   - merchant or recipient offer list endpoint
2. Create offer:
   - prepare escrow calldata
   - approve escrow if needed
   - broadcast
3. Accept or cancel with the corresponding endpoint.
4. Do not assume offer finality until onchain execution confirms.

### 7. Gift Certificates

1. Merchant creates certificate metadata.
2. Recipient claims certificate.
3. Merchant marks it minted if onchain issuance is required.
4. Treat gift certificates as a separate flow from vouchers.

## Endpoint-to-Workflow Hints

| Endpoint / Tool | Meaning in workflow |
| --- | --- |
| `POST /programs` / `create_loyalty_program` | Start deploy flow, not finish it |
| `POST /workflow/generate-program-defaults` / `generate_program_defaults` | Fill in missing merchant identity, program naming, starter rewards, and economics |
| `GET /workflow/program-status` / `get_program_workflow_status` | Ask the platform what is missing before issuing rewards or minting |
| `GET /tx-receipt` | Extract deployed token address after tx |
| `POST /register-program` | Persist program after deploy |
| `POST /activate-program` | Only meaningful for legacy `erc20` |
| `POST /program-status` | DB sync after legacy activation or pause changes |
| `POST /rewards` | Usually comes after program creation, before large-scale minting |
| `POST /mint` | Requires active program |
| `POST /earn` | Same as mint, but purchase-driven |
| `POST /redeem-reward` | Comes after confirmed onchain token transfer |
| `GET /recipient-api/workflow/reward-status` / `get_reward_workflow_status` | Explain whether a holder can redeem now and what is missing |
| `POST /recipient-api/workflow/prepare-reward-redemption` / `prepare_reward_redemption` | Build the transfer prerequisite before redeeming a reward |
| `POST /vouchers/use` | Final merchant-side voucher step |

## Decision Rules for Agents

- If the user asks to "launch a program", do **not** stop at deploy calldata.
- If the user asks to "make the loyalty program usable", ensure:
  - program exists
  - program is active
  - at least one reward exists
- If the user asks to "reward customers", verify the program first.
- If the user asks to "redeem", expect an onchain transfer step.
- If the agent only has a recipient key (`rwk_`), do not use merchant-only endpoints.

## Success Criteria

- The agent knows the next required step after every lifecycle endpoint
- The agent distinguishes `b20` from legacy `erc20`
- The agent does not mint into inactive programs
- The agent does not try to redeem rewards before onchain payment confirmation
