# Loyal Spark Tokenomics

> **Status.** The allocation below is the **final** configuration for the `$LOYAL` launch on
> [Vibestarter](https://app.vibestarter.xyz) and is enforced by the launch contract on Base.
> Until that contract is deployed there is no LOYAL token in circulation.
>
> **`$LOYAL` is not the revenue model.** Platform revenue is USDC — merchant SaaS and agent
> subscriptions plus x402 / MPP per-request payments — and is described in
> [`docs/business/MONETIZATION_AND_PRICING.md`](../business/MONETIZATION_AND_PRICING.md).
> `$LOYAL` is a governance and liquidity instrument, not a fee rail. Do not present it as ARR.

## Token: LOYAL (ERC-20 governance token)

**Total supply:** 1,000,000,000 LOYAL (fixed, 18 decimals)

**Chain:** Base mainnet (8453)

**Distribution:** Vibestarter launch contract with verifiable AI-agent provenance

**Purpose:** Governance over the protocol treasury, permanent DEX liquidity for the token, and
ecosystem incentives. Supply is fixed at launch — there is no ongoing emission and no minting key.

---

## 1. Token Allocation

Set in the Vibestarter launch contract. Percentages are fixed at deployment and cannot be changed
afterwards.

| Category | Share | Amount (LOYAL) | Unlock conditions |
|----------|-------|----------------|-------------------|
| **Backers** | 65.0% | 650,000,000 | Distributed to raise contributors per the launch contract's emission schedule |
| **Liquidity** | 15.0% | 150,000,000 | **Permanently locked** in an Aerodrome pool — never withdrawable |
| **Treasury** | 10.0% | 100,000,000 | Locked; released **only** through governance proposals voted on by token holders |
| **Founder** | 7.5% | 75,000,000 | Time-locked, then linear vesting per the launch contract |
| **Ecosystem (airdrop)** | 2.5% | 25,000,000 | Growth and adoption incentives |

Two properties worth stating plainly to any investor:

- **Backers hold the supermajority.** 65% goes to contributors, not to insiders. Founder allocation
  is capped at 7.5% by the contract, so it cannot be raised later.
- **Liquidity cannot be pulled.** The 15% liquidity allocation is locked permanently in Aerodrome,
  which removes the standard rug vector.

---

## 2. Governance

**Voting:** Token holders vote on treasury proposals. Voting does **not** require staking or locking
tokens — there is no staking contract.

**What governance controls:** release of the 10% treasury allocation. Each disbursement is a separate
proposal with a separate vote.

**What governance does not control:** total supply (fixed), the allocation split (fixed at
deployment), the locked liquidity position (permanent), and platform pricing (a business decision
settled in USDC, not a token parameter).

---

## 3. Token Utility

1. **Governance** — vote on treasury proposals.
2. **Liquidity** — LOYAL is the tradable asset in the permanently locked Aerodrome pool.
3. **Ecosystem incentives** — the 2.5% airdrop allocation funds adoption campaigns.

`$LOYAL` is deliberately **not** used for: paying platform fees, gating merchant access, or
collateralising loyalty programs. Those all work in USDC or in the merchant's own loyalty token, and
keeping them separate means the product does not depend on token price.

---

## 4. Relationship to platform revenue

| Flow | Currency | Bypassable? |
|------|----------|-------------|
| Merchant SaaS subscriptions ($39 / $79 / $149 per month) | **USDC** on Base | No — prepaid |
| Agent subscriptions ($49 / $129 per month) | **USDC** on Base | No — prepaid |
| x402 / MPP per-request payments | **USDC** on Base | No — prepaid per call |
| Mint protocol fee (1.25% / 0.5% / 0.25%) | Merchant's **own loyalty tokens** | Yes — off-chain enforcement only |
| `$LOYAL` | — | Not a revenue flow at all |

Full detail, including why the mint fee is not counted as revenue, is in
[`MONETIZATION_AND_PRICING.md`](../business/MONETIZATION_AND_PRICING.md) §3.1.

---

## 5. Removed from earlier drafts — do not reintroduce

Earlier versions of this document described a different, more complex token model. It has been
dropped in favour of the Vibestarter launch above. These mechanics **do not exist** and should not
appear in any deck, doc, or contract:

| Removed | Why |
|---------|-----|
| Merchant collateral staking ($1,000 / $5,000 / $15,000 tiers) | Access is sold as a USDC subscription; requiring merchants to buy and lock a volatile token to run a loyalty program is a hard blocker for SMB adoption |
| 8% burn on M-token → LOYAL swaps | Depended on the hub-and-spoke DEX, which is frozen (`src/components/marketplace/`); no burn mechanism exists in the launch contract |
| 0.5% fee on LOYAL → M-token swaps | Same — no swap-fee mechanism in the launch contract |
| LOYAL as hub currency between loyalty tokens | The DEX module is frozen; P2P trading today is a direct escrow swap with a 0.5% fee taken by `LoyaltyTokenEscrow`, unrelated to LOYAL |
| Staking-based voting rights | Governance is by token holding, not staking |
| "No monthly fees, only a staking requirement" | Factually wrong: the product is sold on monthly USDC subscriptions |
| 10 billion supply, 41 / 30 / 20 / 5 / 4 split | Superseded by the fixed 1 billion supply and the allocation in §1 |

---

## 6. Seed Round Funding: $3.5M - $4M

### Use of Funds Breakdown

**Total Raise:** $3.5M - $4M  
**Valuation:** Pre-money $12M-15M  
**Runway:** 18 months to product-market fit & Series A

| Category | Percentage | Amount | Description |
|----------|-----------|---------|-------------|
| **Team & Talent** | 70% | $2.75M | Building a 14-person team across Product, Engineering, Marketing, Sales, and Operations |
| **Community Building** | 8% | $300K | Merchant community, developer ecosystem, engagement programs |
| **Infrastructure & Operations** | 10% | $400K | Cloud infrastructure, development tools, office, software licenses |
| **Legal, Compliance & Audits** | 7% | $250K | Token legal structure, smart contract audits, regulatory compliance |
| **Reserve & Contingency** | 5% | $200K | Buffer for unforeseen expenses and opportunities |

---

## 7. Team Structure (14 People)

### Product & Design (2 people - $450K/18 months)
- **Product Manager:** Define roadmap, prioritize features for SMB merchants, user research
- **Product Designer:** UX/UI design, merchant onboarding flows, brand consistency

### Engineering (4 people - $840K/18 months)
- **2 Backend/Smart Contract Engineers:** Smart contracts development, security, DEX integration, backend APIs
- **2 Frontend Engineers:** React/Web3 development, wallet integration, responsive UI

### Marketing & Community (3 people - $540K/18 months)
- **Head of Marketing:** Brand strategy, go-to-market, content strategy, partnerships
- **Community Manager:** Discord/Telegram moderation, merchant support, engagement campaigns
- **Content Creator:** Blog posts, tutorials, social media, video content

### Sales & Business Development (3 people - $585K/18 months)
- **Head of Sales:** Sales strategy, enterprise deals, partnership negotiations
- **2 Business Development Reps:** SMB merchant outreach, demos, onboarding, territory management

### Operations & Support (2 people - $330K/18 months)
- **Head of Operations:** Infrastructure, security, quality assurance, vendor management
- **Customer Support Specialist:** Merchant support tickets, documentation, training materials

**Total Team Cost:** $2.75M for 18 months

---

## 8. Community Building Strategy ($300K Budget)

### Merchant Community ($100K)
- Early adopter program with bonus LOYAL rewards
- Merchant success stories and case studies
- Monthly webinars and training sessions
- Dedicated Discord/Telegram channels for support
- Merchant-to-merchant networking events

### Developer Ecosystem ($80K)
- Open-source SDK and comprehensive API documentation
- Quarterly hackathons with prize pools ($15K each)
- Integration grants for third-party tools ($5K-$15K per project)
- Developer ambassador program with monthly stipends
- Bug bounty program

### Token Holder Community ($70K)
- DAO governance participation rewards
- Educational content about tokenomics and DeFi
- Community-driven feature voting and proposals
- Quarterly AMAs with leadership team

### Content & Social Media ($50K)
- Regular blog posts and video tutorials
- Social media engagement campaigns
- Influencer partnerships in SMB and crypto space
- Community-generated content rewards program
- Conference sponsorships and speaking opportunities

---

## 9. Target Market

**Initial Focus:** Small and Medium Businesses (SMBs)

**Market Size:** 50M+ SMB merchants worldwide

**Adoption Strategy:**
- Low barrier to entry — $39/month, no token purchase and no collateral required
- Clear ROI through reduced loyalty program costs
- Customers own their points onchain and can transfer them
- AI agents can run the whole loop through REST / MCP without a human operator

---

## 10. 18-Month Milestones

By end of seed funding period, we aim to achieve:

1. **1,000+ Active SMB Merchants** onboarded across multiple verticals
2. **Recurring USDC revenue** from merchant and agent subscriptions with positive unit economics
3. **$500K+ Transaction Volume** through the platform
4. **Product-Market Fit Validated**
5. **Clear Path to Profitability** on subscription and per-request revenue
6. **Series A Ready** with strong metrics and growth trajectory

---

*The product earns in USDC from subscriptions and per-request payments, so it does not depend on
token price. `$LOYAL` adds governance over the treasury and permanently locked liquidity on top of a
business that already works without it.*
