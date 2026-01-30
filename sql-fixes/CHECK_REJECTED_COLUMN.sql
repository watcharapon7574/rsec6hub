-- Check column type of rejected_name_comment
SELECT
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'memos'
  AND column_name = 'rejected_name_comment';
