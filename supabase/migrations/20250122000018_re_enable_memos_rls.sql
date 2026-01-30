-- Re-enable RLS on memos table
-- Now that we've fixed the trigger function issues, it's safe to enable RLS again
-- Migration 20250122000013 temporarily disabled RLS to fix UPDATE issues
-- The real problem was the trigger function using wrong field names, which has been fixed

-- Enable RLS back on memos table
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;

-- Ensure all policies are in place (re-create them to be safe)
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view memos" ON memos;
DROP POLICY IF EXISTS "Staff can update memos" ON memos;
DROP POLICY IF EXISTS "Users can create memos" ON memos;
DROP POLICY IF EXISTS "Staff can delete memos" ON memos;

-- Create permissive INSERT policy
CREATE POLICY "Users can create memos"
ON memos
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create permissive SELECT policy
CREATE POLICY "Users can view memos"
ON memos
FOR SELECT
TO authenticated
USING (true); -- Allow all authenticated users to view

-- Create UPDATE policy with explicit UUID casting
-- Allow staff and document owners to update
CREATE POLICY "Staff can update memos"
ON memos
FOR UPDATE
TO authenticated
USING (
  -- Allow if user is staff (clerk, director, etc.)
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.position IN ('clerk_teacher', 'assistant_director', 'deputy_director', 'director', 'government_employee')
  )
  OR
  -- Allow if user is the document owner
  user_id = auth.uid()
);

-- Create DELETE policy (soft delete via doc_del field)
CREATE POLICY "Staff can delete memos"
ON memos
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.position IN ('clerk_teacher', 'director')
  )
);

COMMENT ON TABLE memos IS 'Memos table with RLS enabled - allows staff to manage documents and owners to update their own';
