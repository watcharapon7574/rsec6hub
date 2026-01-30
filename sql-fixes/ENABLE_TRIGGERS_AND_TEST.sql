-- Enable triggers back
ALTER TABLE memos ENABLE TRIGGER USER;
ALTER TABLE doc_receive ENABLE TRIGGER USER;

-- Check what triggers are currently active
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('memos', 'doc_receive')
ORDER BY event_object_table, trigger_name;
