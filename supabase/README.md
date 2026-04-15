# Supabase (backend)

- **`migrations/`** — PostgreSQL schema and RLS (ordered by timestamp prefix).  
  Merchant **team invite redemption** depends on RPC **`public.accept_merchant_invite(text)`** (see migration files whose names include `accept_merchant_invite`). Without them, the web UI will error when joining a team; apply migrations to every linked project (`supabase db push` / CI).
- **`functions/`** — Edge Functions (Deno). See **[functions/README.md](./functions/README.md)** for a full catalogue and roles.
- **Runbooks** moved to repo docs: [docs/supabase/EXPIRATION_SETUP.md](../docs/supabase/EXPIRATION_SETUP.md).
- **Portal UX (Profile, Team tab, invite flow):** [docs/development/PORTALS_AND_TEAM.md](../docs/development/PORTALS_AND_TEAM.md).
