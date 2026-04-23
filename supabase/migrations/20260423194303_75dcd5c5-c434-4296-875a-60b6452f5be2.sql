
-- Merge duplicate user accounts:
--   A = 4c5ebcd9-df3d-4b7d-abcf-0e1d24106eec (Google login, embedded wallet 0x0a54)
--   B = 630a07df-55e1-40e3-a316-65cdc8183bb0 (legacy admin, external wallet 0x5cc0)
-- Keep B as canonical (it owns loyalty_programs + admin role).
-- Move email/privy_did/embedded wallet from A into B, then delete A.

DO $$
DECLARE
  user_a uuid := '4c5ebcd9-df3d-4b7d-abcf-0e1d24106eec';
  user_b uuid := '630a07df-55e1-40e3-a316-65cdc8183bb0';
BEGIN
  -- 1. Demote primary flags on B's existing wallet link (we'll re-set after)
  UPDATE identity_links SET is_primary = false WHERE user_id = user_b;

  -- 2. Re-point all of A's identity_links to B (skip duplicates)
  UPDATE identity_links
     SET user_id = user_b, is_primary = false
   WHERE user_id = user_a
     AND value_normalized NOT IN (
       SELECT value_normalized FROM identity_links WHERE user_id = user_b
     );

  -- 3. Drop any remaining A-only links that collided (shouldn't be any here)
  DELETE FROM identity_links WHERE user_id = user_a;

  -- 4. Set primaries: 0x5cc0 wallet, gerassyk@gmail.com email, privy_did, profile email
  UPDATE identity_links SET is_primary = true
   WHERE user_id = user_b AND link_type = 'wallet'
     AND value_normalized = '0x5cc0aa9ed773f413f81f78a62f2e94109ce26205';

  UPDATE identity_links SET is_primary = true
   WHERE user_id = user_b AND link_type = 'email'
     AND value_normalized = 'gerassyk@gmail.com';

  UPDATE identity_links SET is_primary = true
   WHERE user_id = user_b AND link_type = 'privy_did';

  -- 5. Move profile row (B has none, A has one). Repoint to B and update wallet/email.
  UPDATE profiles
     SET user_id = user_b,
         wallet_address = '0x5cc0aa9ed773f413f81f78a62f2e94109ce26205',
         email = 'gerassyk@gmail.com',
         updated_at = now()
   WHERE user_id = user_a;

  -- 6. Delete the now-empty auth user A so future Google logins resolve to B via privy_did link
  DELETE FROM auth.users WHERE id = user_a;
END $$;
