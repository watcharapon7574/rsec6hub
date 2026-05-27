-- Daily roll-call cron job — calls leave-telegram-notify edge function
-- to post today's approved leaves into the Telegram group "วันนี้ใครลา?".
--
-- Schedule: 01:30 UTC = 08:30 Asia/Bangkok, every day.
-- Even if no one is on leave today, the function sends "วันนี้ไม่มีผู้ลา"
-- (user wanted a daily signal regardless).

-- Idempotent: remove any prior schedule with the same name
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'leave-daily-rollcall') THEN
    PERFORM cron.unschedule('leave-daily-rollcall');
  END IF;
END $$;

-- NOTE: anon JWT identical to the one in health-check-otp / railway-scheduler.
-- If keys rotate, update all cron jobs together.
SELECT cron.schedule(
  'leave-daily-rollcall',
  '30 1 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/leave-telegram-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MzQ3MTcsImV4cCI6MjA2NjQxMDcxN30.m0RHqLl6RmM5rTN-TU3YrcvHNpSB9FnH_XN_Y3uhhRc'
    ),
    body := '{"type":"daily_rollcall"}'::jsonb
  ) AS request_id;
  $cmd$
);
