-- Centralize cron auth token so rotation needs one SQL update + one
-- secret update instead of touching every cron migration.
--
-- Two cron jobs (leave-daily-rollcall, leave-daily-summary) embed the
-- same shared secret in their X-Cron-Auth header. Previously the literal
-- 'rsec6hub-leave-cron-2026' was hardcoded in 2 migrations + the function's
-- CRON_AUTH_TOKEN secret. Now the cron jobs call public.cron_auth_token()
-- which is resolved each time the job fires — rotate by CREATE OR REPLACE
-- this function + update the function secret.

CREATE OR REPLACE FUNCTION public.cron_auth_token()
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'rsec6hub-leave-cron-2026'::text
$$;

-- ─── Reschedule both cron jobs to call cron_auth_token() at fire time ───
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'leave-daily-rollcall') THEN
    PERFORM cron.unschedule('leave-daily-rollcall');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'leave-daily-summary') THEN
    PERFORM cron.unschedule('leave-daily-summary');
  END IF;
END $$;

-- morning: 01:30 UTC = 08:30 Asia/Bangkok
SELECT cron.schedule(
  'leave-daily-rollcall',
  '30 1 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/leave-telegram-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MzQ3MTcsImV4cCI6MjA2NjQxMDcxN30.m0RHqLl6RmM5rTN-TU3YrcvHNpSB9FnH_XN_Y3uhhRc',
      'X-Cron-Auth', public.cron_auth_token()
    ),
    body := '{"type":"daily_rollcall"}'::jsonb
  ) AS request_id;
  $cmd$
);

-- evening: 09:30 UTC = 16:30 Asia/Bangkok
SELECT cron.schedule(
  'leave-daily-summary',
  '30 9 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/leave-telegram-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MzQ3MTcsImV4cCI6MjA2NjQxMDcxN30.m0RHqLl6RmM5rTN-TU3YrcvHNpSB9FnH_XN_Y3uhhRc',
      'X-Cron-Auth', public.cron_auth_token()
    ),
    body := '{"type":"daily_rollcall","variant":"evening"}'::jsonb
  ) AS request_id;
  $cmd$
);
