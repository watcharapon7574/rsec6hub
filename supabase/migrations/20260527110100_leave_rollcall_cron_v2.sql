-- Replace daily roll-call cron to include X-Cron-Auth header.
-- The edge function now enforces role-based auth: HR head/admin for UI calls,
-- shared secret for cron. Without this header, the cron itself would be
-- rejected by the function's new authorize() guard.
--
-- Schedule unchanged: 01:30 UTC = 08:30 Asia/Bangkok, every day.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'leave-daily-rollcall') THEN
    PERFORM cron.unschedule('leave-daily-rollcall');
  END IF;
END $$;

-- NOTE: X-Cron-Auth value MUST match CRON_AUTH_TOKEN in
-- supabase/functions/leave-telegram-notify/index.ts. If rotated, update both.
-- Anon JWT is the same one used by health-check-otp / railway-scheduler.
SELECT cron.schedule(
  'leave-daily-rollcall',
  '30 1 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/leave-telegram-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MzQ3MTcsImV4cCI6MjA2NjQxMDcxN30.m0RHqLl6RmM5rTN-TU3YrcvHNpSB9FnH_XN_Y3uhhRc',
      'X-Cron-Auth', 'rsec6hub-leave-cron-2026'
    ),
    body := '{"type":"daily_rollcall"}'::jsonb
  ) AS request_id;
  $cmd$
);
