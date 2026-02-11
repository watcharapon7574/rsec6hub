-- Migration: Allow team members to view all assignments for the same document
-- Description: อนุญาตให้สมาชิกทีมเห็นรายชื่อผู้รับมอบหมายทั้งหมดในเอกสารเดียวกัน
-- Note: ใช้ security definer function เพื่อหลีกเลี่ยง infinite recursion

-- Drop existing policy if any
DROP POLICY IF EXISTS "Team members can view same document assignments" ON task_assignments;

-- Create a security definer function to check if user is assigned to same document
-- This bypasses RLS to avoid infinite recursion
CREATE OR REPLACE FUNCTION user_shares_document_with_assignment(
  p_memo_id UUID,
  p_doc_receive_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_assignments
    WHERE assigned_to = auth.uid()
      AND deleted_at IS NULL
      AND (
        (p_memo_id IS NOT NULL AND memo_id = p_memo_id)
        OR
        (p_doc_receive_id IS NOT NULL AND doc_receive_id = p_doc_receive_id)
      )
  );
$$;

COMMENT ON FUNCTION user_shares_document_with_assignment(UUID, UUID) IS 'ตรวจสอบว่าผู้ใช้ถูกมอบหมายในเอกสารเดียวกันหรือไม่ (ใช้ bypass RLS)';

-- Create policy using the security definer function to avoid recursion
CREATE POLICY "Team members can view same document assignments"
  ON task_assignments
  FOR SELECT
  USING (
    user_shares_document_with_assignment(memo_id, doc_receive_id)
    AND deleted_at IS NULL
  );

COMMENT ON POLICY "Team members can view same document assignments" ON task_assignments IS 'อนุญาตให้สมาชิกทีมดูผู้รับมอบหมายทั้งหมดในเอกสารเดียวกัน';
