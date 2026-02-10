-- Migration: Allow team leaders to manage team members
-- Description: อนุญาตให้หัวหน้าทีมลบสมาชิกทีมที่ยัง pending ได้

-- Drop existing policies if any
DROP POLICY IF EXISTS "Team leaders can manage pending team members" ON task_assignments;
DROP POLICY IF EXISTS "Team leaders can add team members" ON task_assignments;

-- Policy: หัวหน้าทีมสามารถอัปเดต (soft delete) สมาชิกทีมที่ยัง pending ได้
CREATE POLICY "Team leaders can manage pending team members"
  ON task_assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM task_assignments leader
      WHERE leader.assigned_to = auth.uid()
        AND leader.is_team_leader = true
        AND leader.deleted_at IS NULL
        AND (
          (leader.memo_id IS NOT NULL AND leader.memo_id = task_assignments.memo_id)
          OR
          (leader.doc_receive_id IS NOT NULL AND leader.doc_receive_id = task_assignments.doc_receive_id)
        )
    )
    AND deleted_at IS NULL
    AND status = 'pending'
    AND is_team_leader = false
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_assignments leader
      WHERE leader.assigned_to = auth.uid()
        AND leader.is_team_leader = true
        AND leader.deleted_at IS NULL
        AND (
          (leader.memo_id IS NOT NULL AND leader.memo_id = task_assignments.memo_id)
          OR
          (leader.doc_receive_id IS NOT NULL AND leader.doc_receive_id = task_assignments.doc_receive_id)
        )
    )
  );

-- Policy: หัวหน้าทีมสามารถเพิ่มสมาชิกทีมใหม่ได้
CREATE POLICY "Team leaders can add team members"
  ON task_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_assignments leader
      WHERE leader.assigned_to = auth.uid()
        AND leader.is_team_leader = true
        AND leader.deleted_at IS NULL
        AND (
          (leader.memo_id IS NOT NULL AND leader.memo_id = memo_id)
          OR
          (leader.doc_receive_id IS NOT NULL AND leader.doc_receive_id = doc_receive_id)
        )
    )
    AND is_team_leader = false
  );

COMMENT ON POLICY "Team leaders can manage pending team members" ON task_assignments IS 'อนุญาตให้หัวหน้าทีมลบสมาชิกทีมที่ยัง pending ได้';
COMMENT ON POLICY "Team leaders can add team members" ON task_assignments IS 'อนุญาตให้หัวหน้าทีมเพิ่มสมาชิกทีมใหม่ได้';
