-- Fix RLS policies for memos table to handle UUID vs TEXT comparison
-- This fixes the "operator does not exist: uuid = text" error
-- Note: memos table uses 'created_by' field, not 'user_id'

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own memos or memos they need to sign" ON memos;
DROP POLICY IF EXISTS "Creators and clerks can update memos" ON memos;
DROP POLICY IF EXISTS "Users can create memos" ON memos;
DROP POLICY IF EXISTS "Creators and clerks can delete memos" ON memos;

-- Recreate INSERT policy
CREATE POLICY "Users can create memos"
ON memos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Recreate SELECT policy with proper handling
CREATE POLICY "Users can view their own memos or memos they need to sign"
ON memos
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(signature_positions) AS pos
    WHERE (pos->>'user_id')::uuid = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.position IN ('clerk_teacher', 'assistant_director', 'deputy_director', 'director')
  )
);

-- Recreate UPDATE policy to allow clerks and executives to update
CREATE POLICY "Creators and clerks can update memos"
ON memos
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND position IN ('clerk_teacher', 'assistant_director', 'deputy_director', 'director')
  )
  OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(signature_positions) AS pos
    WHERE (pos->>'user_id')::uuid = auth.uid()
  )
);

-- Add DELETE policy for soft delete
CREATE POLICY "Creators and clerks can delete memos"
ON memos
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.position IN ('clerk_teacher', 'director')
  )
);
