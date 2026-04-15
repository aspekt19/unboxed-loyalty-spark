# Merchant & customer portals — UI, auth, and team invites

Human-facing behaviour for `/merchant` and `/customer` (web and Capacitor shells). Keep this file aligned with `MerchantPage`, `CustomerPage`, `WalletConnectButton`, and team components.

## Routes

| Path | Portal |
|------|--------|
| `/merchant` | Merchant Portal — programs, CRM, marketing, **Team**, AI Agents, etc. |
| `/customer` | Customer Portal — loyalty balances, exchange tab, profile |

Native wrapper routes may use the `/native/...` prefix; header behaviour is the same.

## Header action cluster (merchant & customer)

Reading **left → right** in the top-right group:

1. **Theme toggle** (light / dark)
2. **Profile** — only when there is an active **Supabase session** (`useAuth().user`). Hidden while the user must sign in.
3. **Wallet / Sign in** — Privy login, SIWE completion, or connected account chip (`WalletConnectButton`)

Do not reorder this cluster without an explicit product decision.

### Sizing (implementation detail)

- **Profile** uses a compact chip (`HEADER_PROFILE_BUTTON_CLASSNAME` in `WalletConnectButton.tsx`): same height as the wallet control, **auto width** so the label is not stretched.
- **Sign in / Signing in… / address** use a fixed-width chip (`HEADER_CLUSTER_ACTION_CLASSNAME`) so truncated addresses line up.
- In-card auth CTAs (`AuthPrompt`) share height/typography via `INLINE_AUTH_CTA_CLASSNAME`.
- `Button` merges `className` **after** `buttonVariants({ variant, size })` so header overrides (e.g. `h-8`) always win — see `src/components/ui/button.tsx`.

## Profile visibility and navigation

### Merchant (`src/pages/MerchantPage.tsx`)

- **Profile** button: rendered **only if `user`** (Supabase session).
- Toggling profile uses local `showProfile`; on **sign-out**, `showProfile` is reset so the dashboard is not left on a profile-only layout.

### Customer (`src/pages/CustomerPage.tsx`)

- Desktop **Profile** header button: same rule — **only if `user`**.
- **Tabs:** `profile` **TabsContent** is not mounted until `user` exists.
- **Mobile:** `BottomNavBar` receives `showProfileNav={Boolean(user)}` so the **Profile** nav item is hidden until signed in. If the user signs out while on profile, `activeTab` is forced back to **`loyalty`**.
- `renderContent()` for mobile: `profile` returns `null` when there is no `user`.

## Team invites (merchant)

### Owner (generate code)

1. Open **`/merchant`** and sign in as the merchant owner.
2. Go to the **Team** tab.
3. Under **Team Members**, choose role / branch, then **Invite Code** (or equivalent) and **Generate Invite Code**.
4. Send the code to the employee (short TTL; status `pending` in `merchant_invites`).

### Employee / manager (redeem code)

1. Open **`/merchant`**, sign in with the **same wallet** they will use at work (profile `wallet_address` must match the SIWE / session path expected by the backend).
2. Open the **Team** tab.
3. Use **Team invite code** → paste code → **Join team**.

This calls Supabase RPC **`public.accept_merchant_invite(p_invite_code text)`** (`SECURITY DEFINER`, `GRANT EXECUTE` to `authenticated`). Migrations live under `supabase/migrations/` (files containing `accept_merchant_invite`). If the API error mentions **schema cache** or the function is **not found**, the linked Supabase project has not applied those migrations.

**RLS note:** non-owners cannot `INSERT` into `merchant_employees` directly; redemption must go through this RPC.

## Related source files

| Area | Files |
|------|--------|
| Pages | `MerchantPage.tsx`, `CustomerPage.tsx` |
| Header / wallet | `WalletConnectButton.tsx`, `ThemeToggle.tsx` |
| Auth banners | `AuthPrompt.tsx` |
| shadcn Button merge | `components/ui/button.tsx` |
| Team UI | `merchant/tabs/TeamTab.tsx`, `team/EmployeeManagement.tsx`, `team/AcceptMerchantInviteCard.tsx`, `team/BranchManagement.tsx`, … |
| Mobile nav | `mobile/BottomNavBar.tsx` |

## Ops checklist (Lovable / CI / manual)

1. After pulling UI that depends on new RPCs, run **`supabase db push`** (or your pipeline) so **production** Postgres matches `migrations/`.
2. Confirm `accept_merchant_invite` exists: SQL Editor → `select proname from pg_proc join pg_namespace n on n.oid = pronamespace where n.nspname = 'public' and proname = 'accept_merchant_invite';`
3. If `public/` assets were deleted locally but not committed, restore with `git restore public/` before shipping — see repo **README** / release process.
