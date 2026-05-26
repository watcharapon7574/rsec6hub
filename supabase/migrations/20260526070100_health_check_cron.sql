-- Health-check table + pg_cron job that pings the health-check edge function
-- every 5 minutes. The edge function probes the OTP endpoint and alerts on
-- healthy → unhealthy transitions (see supabase/functions/health-check/).
--
-- Why a synthetic check instead of monitoring pg_stat_statements / WAL counts:
-- pg_stat_statements resets on project restart, and "calls > 1M" is an
-- absolute threshold that drifts. A 5-min synthetic probe of the actual
-- user-facing endpoint measures the symptom we care about (can users log in?)
-- regardless of which underlying resource is exhausted.

CREATE TABLE IF NOT EXISTS public.health_check_log (
  id bigserial PRIMARY KEY,
  checked_at timestamptz NOT NULL DEFAULT now(),
  status_code int NOT NULL,
  latency_ms int NOT NULL,
  healthy boolean NOT NULL,
  details jsonb
);

CREATE INDEX IF NOT EXISTS idx_health_check_log_checked_at
  ON public.health_check_log (checked_at DESC);

-- Keep at most ~30 days of history; cron'd daily.
CREATE OR REPLACE FUNCTION public.prune_health_check_log()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.health_check_log
  WHERE checked_at < now() - interval '30 days';
$$;

-- Lock the table down — only service_role and health-check function should
-- touch it. No RLS policies = no anon/authenticated access.
ALTER TABLE public.health_check_log ENABLE ROW LEVEL SECURITY;

-- Idempotent: remove any prior schedule under the same names before re-creating
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'health-check-otp') THEN
    PERFORM cron.unschedule('health-check-otp');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'health-check-prune') THEN
    PERFORM cron.unschedule('health-check-prune');
  END IF;
END $$;

-- Schedule: every 5 minutes, call the health-check edge function.
-- NOTE: the anon JWT below is identical to the one already embedded in
-- the existing railway-scheduler / auto-checkout-teachers cron jobs.
-- If the project ref / keys ever rotate, update all cron jobs together.
SELECT cron.schedule(
  'health-check-otp',
  '*/5 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/health-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MzQ3MTcsImV4cCI6MjA2NjQxMDcxN30.m0RHqLl6RmM5rTN-TU3YrcvHNpSB9FnH_XN_Y3uhhRc'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cmd$
);

-- Daily prune at 04:00 to keep table small
SELECT cron.schedule(
  'health-check-prune',
  '0 4 * * *',
  $cmd$ SELECT public.prune_health_check_log(); $cmd$
);
