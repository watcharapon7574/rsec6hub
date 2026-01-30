-- Fix RLS Policy for memos and doc_receive tables
-- Issue: Current policy only applies to 'public' role, but authenticated users have 'authenticated' role

-- =====================================================
-- PART 1: Drop old policies
-- =====================================================
DROP POLICY IF EXISTS "all" ON memos;
DROP POLICY IF EXISTS "all" ON doc_receive;

-- =====================================================
-- PART 2: Create new policies for authenticated users
-- =====================================================

-- Policy for memos table
CREATE POLICY "Enable all for authenticated users" ON memos
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy for doc_receive table
CREATE POLICY "Enable all for authenticated users" ON doc_receive
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =====================================================
-- PART 3: Verify policies were created
-- =====================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('memos', 'doc_receive')
ORDER BY tablename, policyname;
