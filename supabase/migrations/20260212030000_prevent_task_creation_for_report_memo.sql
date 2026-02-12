-- Migration: Prevent task creation for report memos
-- Description: เพิ่มการตรวจสอบใน create_task_assignment เพื่อป้องกันการสร้าง task ให้ report memo
-- ป้องกันการ loop มอบหมายงานไม่รู้จบ

-- =====================================================
-- Update create_task_assignment function to reject report memos
-- =====================================================
CREATE OR REPLACE FUNCTION create_task_assignment(
  p_document_id UUID,
  p_document_type VARCHAR,
  p_assigned_to UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_assignment_id UUID;
  v_current_user UUID;
  v_is_report_memo BOOLEAN;
BEGIN
  -- Get current user
  v_current_user := auth.uid();

  -- Validate that current user is a clerk, admin, or director
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = v_current_user
      AND (position = 'clerk_teacher' OR position = 'director' OR is_admin = true)
  ) THEN
    RAISE EXCEPTION 'Only clerks, admins, or directors can create task assignments';
  END IF;

  -- Validate document type
  IF p_document_type NOT IN ('memo', 'doc_receive') THEN
    RAISE EXCEPTION 'Invalid document type. Must be either "memo" or "doc_receive"';
  END IF;

  -- =====================================================
  -- CHECK: Prevent creating task for report memos
  -- Report memo = memo that is linked via task_assignments.report_memo_id
  -- =====================================================
  IF p_document_type = 'memo' THEN
    SELECT EXISTS (
      SELECT 1 FROM task_assignments ta
      WHERE ta.report_memo_id = p_document_id
        AND ta.deleted_at IS NULL
    ) INTO v_is_report_memo;

    IF v_is_report_memo THEN
      RAISE EXCEPTION 'ไม่สามารถมอบหมายงานให้กับบันทึกข้อความรายงานผลได้ (report memo)';
    END IF;
  END IF;

  -- Create the task assignment
  IF p_document_type = 'memo' THEN
    INSERT INTO task_assignments (
      memo_id,
      document_type,
      assigned_by,
      assigned_to,
      note,
      status
    ) VALUES (
      p_document_id,
      p_document_type,
      v_current_user,
      p_assigned_to,
      p_note,
      'pending'
    )
    RETURNING id INTO v_assignment_id;

    -- Update is_assigned flag in memos
    UPDATE memos
    SET is_assigned = true
    WHERE id = p_document_id;

  ELSIF p_document_type = 'doc_receive' THEN
    INSERT INTO task_assignments (
      doc_receive_id,
      document_type,
      assigned_by,
      assigned_to,
      note,
      status
    ) VALUES (
      p_document_id,
      p_document_type,
      v_current_user,
      p_assigned_to,
      p_note,
      'pending'
    )
    RETURNING id INTO v_assignment_id;

    -- Update is_assigned flag in doc_receive
    UPDATE doc_receive
    SET is_assigned = true
    WHERE id = p_document_id;
  END IF;

  RETURN v_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Add comment for documentation
-- =====================================================
COMMENT ON FUNCTION create_task_assignment(UUID, VARCHAR, UUID, TEXT) IS 'สร้างงานมอบหมายใหม่ - ใช้ได้เฉพาะธุรการ/admin/director, ไม่อนุญาตให้มอบหมายงานให้ report memo';
