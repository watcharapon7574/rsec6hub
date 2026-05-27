-- Move cron_auth_token off the committed literal in 20260527150000_cron_auth_token_helper
-- onto a Postgres GUC (app.cron_auth_token) that's set out-of-band — so future
-- rotations are one-liners in the Dashboard SQL Editor instead of a migration.
--
-- IMPORTANT — after this migration applies, the GUC MUST be set manually
-- (the previous literal token is exposed in the public repo and is treated as
-- compromised). Run this once in Supabase Dashboard → SQL Editor with the
-- rotated token:
--
--   ALTER DATABASE postgres SET app.cron_auth_token = '<new_token>';
--
-- Then update the CRON_AUTH_TOKEN edge-function secret to the same value via
-- `supabase secrets set CRON_AUTH_TOKEN=<new_token>` (no commit either way).
--
-- Until both sides are set, the daily cron Telegram posts will fail with 403
-- Forbidden — the edge function compares X-Cron-Auth (from GUC via this
-- function) to CRON_AUTH_TOKEN (env), and an empty GUC won't match.

BEGIN;

CREATE OR REPLACE FUNCTION public.cron_auth_token()
RETURNS TEXT
LANGUAGE sql
STABLE  -- depends on session GUC, not IMMUTABLE
SET search_path = public
AS $$
  SELECT current_setting('app.cron_auth_token', true)
$$;

COMMIT;
