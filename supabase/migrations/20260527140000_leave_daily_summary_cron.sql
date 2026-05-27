-- Second daily roll-call at 16:30 Asia/Bangkok ("สรุปการลาวันนี้")
-- Pairs with the existing 08:30 morning announcement (leave-daily-rollcall):
--   08:30 → "ผู้ลาวันนี้" (heads-up, who's planned to be out today)
--   16:30 → "สรุปการลาวันนี้" (end-of-day recap, includes same-day sick
--           leaves filed during the day)
--
-- Same query/payload as morning, only the title changes via variant=evening.
-- Schedule: 09:30 UTC = 16:30 Asia/Bangkok, every day.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'leave-daily-summary') THEN
    PERFORM cron.unschedule('leave-daily-summary');
  END IF;
END $$;

-- X-Cron-Auth header must match CRON_AUTH_TOKEN in
-- supabase/functions/leave-telegram-notify/index.ts. Same anon JWT as the
-- other cron jobs (rotates together).
SELECT cron.schedule(
  'leave-daily-summary',
  '30 9 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/leave-telegram-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MzQ3MTcsImV4cCI6MjA2NjQxMDcxN30.m0RHqLl6RmM5rTN-TU3YrcvHNpSB9FnH_XN_Y3uhhRc',
      'X-Cron-Auth', 'rsec6hub-leave-cron-2026'
    ),
    body := '{"type":"daily_rollcall","variant":"evening"}'::jsonb
  ) AS request_id;
  $cmd$
);
