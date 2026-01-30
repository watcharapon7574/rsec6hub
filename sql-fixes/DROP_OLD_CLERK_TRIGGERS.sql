-- ========================================
-- DROP OLD CLERK NOTIFICATION TRIGGERS
-- ========================================

-- Drop the old triggers
DROP TRIGGER IF EXISTS telegram_notify_clerks_on_new_memo ON memos CASCADE;
DROP TRIGGER IF EXISTS telegram_notify_clerks_on_new_doc_receive ON doc_receive CASCADE;

-- Drop the old function that references employees table
DROP FUNCTION IF EXISTS notify_clerks_on_new_document() CASCADE;

-- Verify triggers are removed
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('memos', 'doc_receive')
ORDER BY event_object_table, trigger_name;

SELECT 'Old clerk notification triggers have been removed!' as status;
