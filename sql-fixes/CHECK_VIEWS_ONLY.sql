-- Check views only (no aggregate functions)
SELECT
  table_name as view_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND view_definition ILIKE '%employees%';
