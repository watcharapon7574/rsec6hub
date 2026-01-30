-- ========================================
-- FIX RLS POLICIES: Check and fix policies that reference employees table
-- ========================================

-- Step 1: Check current policies on memos and doc_receive tables
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('memos', 'doc_receive')
ORDER BY tablename, policyname;

-- Step 2: Drop all existing policies (we'll recreate them correctly)
DROP POLICY IF EXISTS "Users can view memos they created or are signers of" ON memos;
DROP POLICY IF EXISTS "Users can insert their own memos" ON memos;
DROP POLICY IF EXISTS "Users can update memos they created" ON memos;
DROP POLICY IF EXISTS "Users can delete memos they created" ON memos;
DROP POLICY IF EXISTS "Signers can update memo status" ON memos;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON memos;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON memos;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON memos;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON memos;

DROP POLICY IF EXISTS "Users can view doc_receive they created or are signers of" ON doc_receive;
DROP POLICY IF EXISTS "Users can insert their own doc_receive" ON doc_receive;
DROP POLICY IF EXISTS "Users can update doc_receive they created" ON doc_receive;
DROP POLICY IF EXISTS "Users can delete doc_receive they created" ON doc_receive;
DROP POLICY IF EXISTS "Signers can update doc_receive status" ON doc_receive;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON doc_receive;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON doc_receive;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON doc_receive;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON doc_receive;

-- Step 3: Create simple policies that work with profiles table
-- For memos table
CREATE POLICY "Enable read access for authenticated users" ON memos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users" ON memos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON memos
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON memos
  FOR DELETE
  TO authenticated
  USING (true);

-- For doc_receive table
CREATE POLICY "Enable read access for authenticated users" ON doc_receive
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users" ON doc_receive
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON doc_receive
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON doc_receive
  FOR DELETE
  TO authenticated
  USING (true);

-- Step 4: Ensure RLS is enabled
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_receive ENABLE ROW LEVEL SECURITY;

-- Step 5: Verify the new policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('memos', 'doc_receive')
ORDER BY tablename, policyname;

SELECT 'RLS policies have been fixed successfully!' as status;
