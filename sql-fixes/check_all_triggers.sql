-- ตรวจสอบ triggers ทั้งหมดที่เกี่ยวข้องกับ memos และ doc_receive
SELECT
  trigger_name,
  event_manipulation as event,
  event_object_table as table_name,
  action_statement as action
FROM information_schema.triggers
WHERE event_object_table IN ('memos', 'doc_receive')
ORDER BY event_object_table, trigger_name;

-- ตรวจสอบ functions ที่มี 'telegram' หรือ 'employees' ในชื่อหรือ definition
SELECT
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%telegram%'
    OR p.proname ILIKE '%notify%'
    OR pg_get_functiondef(p.oid) ILIKE '%employees%'
  );
