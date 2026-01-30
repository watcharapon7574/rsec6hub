-- ========================================
-- FIND ALL REFERENCES TO "employees" TABLE
-- ========================================

-- 1. Check all views
SELECT
  table_name as view_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND view_definition ILIKE '%employees%';

-- 2. Check all materialized views
SELECT
  matviewname as view_name,
  definition
FROM pg_matviews
WHERE schemaname = 'public'
  AND definition ILIKE '%employees%';

-- 3. Check all functions (simple query without aggregate)
SELECT
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%employees%'
ORDER BY p.proname;

-- 4. Check all triggers
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND action_statement ILIKE '%employees%';

-- 5. List all tables to see if employees table exists
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'employees';
