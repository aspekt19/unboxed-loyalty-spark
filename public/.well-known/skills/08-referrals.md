# Skill: Referral Programs

## Goal
Set up and manage referral programs where existing customers bring new ones, earning bonus tokens for both parties.

## Required Scopes
`read`, `mint`

## When to Use
- You want organic customer growth through word-of-mouth
- Reward existing customers for bringing friends
- Track referral effectiveness and conversion rates

## How Referrals Work
1. Merchant sets up referral program with bonus amounts
2. Existing customer generates a referral code
3. New customer uses the code when joining
4. Both referrer and referee receive bonus tokens

## Steps

### Step 1: Check Existing Referral Program
Query referral programs for your token:

```bash
curl -H "x-api-key: lsk_..." \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/programs"
```

### Step 2: Configure Referral Bonuses
Referral programs are configured per loyalty program with:
- **referrer_bonus**: Tokens the referrer earns (e.g., 20)
- **referee_bonus**: Tokens the new user earns (e.g., 10)
- **max_referrals_per_user**: Cap to prevent abuse (e.g., 50)
- **min_purchase_required**: Optional minimum to qualify

### Step 3: Generate Referral Code
Referral codes are generated per customer per program using the database function `generate_referral_code`.

### Step 4: Process Referral
When a new customer uses a referral code, the system:
1. Validates the code and checks limits
2. Records the referral relationship
3. Mints bonus tokens to both parties

### Step 5: Track Referral Performance
Monitor referral metrics through analytics:
- Total referrals generated
- Conversion rate (codes used / codes generated)
- Top referrers by count
- Revenue attributed to referrals

## Best Practices
- Set referee bonus ≥ 50% of referrer bonus to incentivize new users
- Cap max referrals to prevent gaming (50-100 is typical)
- Increase bonuses during launch phases for faster growth
- Track which referrers drive the most valuable customers

## Success Criteria
- ✅ Referral program configured with appropriate bonuses
- ✅ Codes generated and shareable
- ✅ Both parties receive bonuses on successful referral
- ✅ Abuse prevention via max referral caps

## Next Skills
- [Analytics & CRM](./07-analytics-crm.md) — track referral ROI
- [Mint Tokens](./02-mint-tokens.md) — distribute referral bonuses
