-- Fix RLS policies for memos table with explicit UUID casting
-- The error "operator does not exist: uuid = text" suggests we need explicit type casting

-- Drop existing policies
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

-- Create permissive SELECT policy with explicit UUID casting
CREATE POLICY "Users can view memos"
ON memos
FOR SELECT
TO authenticated
USING (
  true -- Allow all authenticated users to view
);

-- Create UPDATE policy with explicit UUID casting for user_id comparison
CREATE POLICY "Staff can update memos"
ON memos
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id::text = auth.uid()::text
    AND profiles.position IN ('clerk_teacher', 'assistant_director', 'deputy_director', 'director', 'government_employee')
  )
);

-- Create DELETE policy with explicit UUID casting
CREATE POLICY "Staff can delete memos"
ON memos
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id::text = auth.uid()::text
    AND profiles.position IN ('clerk_teacher', 'director')
  )
);
