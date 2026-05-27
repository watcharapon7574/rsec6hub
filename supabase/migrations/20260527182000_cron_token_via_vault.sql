-- GUC approach (20260527180000) doesn't work on Supabase — postgres role can't
-- ALTER DATABASE/ROLE to set custom parameters. Switch cron_auth_token() to
-- read from Supabase Vault (encrypted at rest, value never in committed SQL).
--
-- Vault row is created/updated out-of-band via:
--   SELECT vault.create_secret('<token>', 'cron_auth_token');
-- (or UPDATE vault.secrets if the row already exists). Rotate by running that
-- statement again in Dashboard SQL Editor + `supabase secrets set
-- CRON_AUTH_TOKEN=<token>` for the edge function side.

BEGIN;

CREATE OR REPLACE FUNCTION public.cron_auth_token()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER  -- vault.decrypted_secrets needs owner privileges
STABLE
SET search_path = ''  -- explicit schema-qualified references below
AS $$
  SELECT decrypted_secret::text
  FROM vault.decrypted_secrets
  WHERE name = 'cron_auth_token'
  LIMIT 1
$$;

COMMIT;
