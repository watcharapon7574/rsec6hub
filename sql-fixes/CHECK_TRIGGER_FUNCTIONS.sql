-- Check all trigger functions that might have uuid = text issue
SELECT
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'notify_telegram_on_memo_status_change',
    'notify_telegram_on_memo_created',
    'send_telegram_notification',
    'handle_updated_at'
  )
ORDER BY p.proname;
