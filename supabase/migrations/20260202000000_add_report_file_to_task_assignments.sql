-- เพิ่ม column report_file_url ลงในตาราง task_assignments
ALTER TABLE task_assignments
ADD COLUMN IF NOT EXISTS report_file_url TEXT;

-- Comment
COMMENT ON COLUMN task_assignments.report_file_url IS 'URL ของไฟล์รายงานที่ผู้รับมอบหมายอัปโหลด';

-- แก้ไข RPC function update_task_status ให้รองรับ report_file_url
CREATE OR REPLACE FUNCTION update_task_status(
  p_assignment_id UUID,
  p_new_status TEXT,
  p_completion_note TEXT DEFAULT NULL,
  p_report_file_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID;
  v_assigned_to_user_id UUID;
BEGIN
  -- Get current user ID
  v_current_user_id := auth.uid();

  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get assigned_to user_id
  SELECT assigned_to INTO v_assigned_to_user_id
  FROM task_assignments
  WHERE id = p_assignment_id;

  -- Check if user is the assignee
  IF v_assigned_to_user_id != v_current_user_id THEN
    RAISE EXCEPTION 'You can only update your own assigned tasks';
  END IF;

  -- Update task status
  UPDATE task_assignments
  SET
    status = p_new_status,
    completion_note = COALESCE(p_completion_note, completion_note),
    report_file_url = COALESCE(p_report_file_url, report_file_url),
    completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE id = p_assignment_id;

  RETURN TRUE;
END;
$$;
