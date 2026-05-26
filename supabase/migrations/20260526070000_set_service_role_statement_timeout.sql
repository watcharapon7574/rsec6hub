-- Set statement_timeout on service_role so edge functions can't hold a DB
-- connection forever when a query goes slow. anon/authenticated already
-- have 3s/8s configured; service_role was unbounded.
--
-- 30s is generous for any normal edge-function query. Heavy/batch jobs
-- (railway-scheduler, stu-verify-otp) should `SET LOCAL statement_timeout`
-- to a higher value at the start of the function if they need longer.
--
-- This is the postgres-level safety net. The withAbort wrapper in
-- supabase/functions/telegram-otp/index.ts is the primary defense at the
-- application level (6s); statement_timeout catches cases where withAbort
-- isn't used (auth.admin.* fallbacks, future edge functions, etc).

ALTER ROLE service_role SET statement_timeout = '30s';
