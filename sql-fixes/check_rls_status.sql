-- Check if RLS is enabled and current policies
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('memos', 'doc_receive', 'profiles');

-- Check current policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('memos', 'doc_receive', 'profiles')
ORDER BY tablename, policyname;

-- Check if the profiles table exists and has the telegram_chat_id column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles';
