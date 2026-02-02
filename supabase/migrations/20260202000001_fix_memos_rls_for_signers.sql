-- แก้ไข RLS policy ให้ผู้อนุมัติ (signers) สามารถอัปเดตเอกสารได้
-- ปัญหา: ผู้อนุมัติที่ไม่ใช่ staff หรือ owner ไม่สามารถตีกลับเอกสารได้

DROP POLICY IF EXISTS "Staff can update memos" ON memos;

CREATE POLICY "Staff and signers can update memos"
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
  OR
  -- Allow if user is in the signer list (ผู้ลงนาม/ผู้อนุมัติ)
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(signer_list_progress) AS signer
    WHERE (signer->>'userId')::uuid = auth.uid()
  )
);

COMMENT ON POLICY "Staff and signers can update memos" ON memos IS
'Allow staff, document owners, and signers (including approvers) to update memos';
