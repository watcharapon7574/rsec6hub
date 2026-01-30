-- Migration: Create helper functions for task assignment operations
-- Description: สร้างฟังก์ชันช่วยเหลือสำหรับการมอบหมายงานและการจัดการงาน

-- =====================================================
-- PART 1: Function to create task assignment
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
BEGIN
  -- Get current user
  v_current_user := auth.uid();

  -- Validate that current user is a clerk
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = v_current_user
      AND position = 'clerk_teacher'
  ) THEN
    RAISE EXCEPTION 'Only clerks can create task assignments';
  END IF;

  -- Validate document type
  IF p_document_type NOT IN ('memo', 'doc_receive') THEN
    RAISE EXCEPTION 'Invalid document type. Must be either "memo" or "doc_receive"';
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
-- PART 2: Function to get user's assigned tasks
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_assigned_tasks(
  p_user_id UUID DEFAULT NULL,
  p_status VARCHAR DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  assignment_id UUID,
  document_id UUID,
  document_type VARCHAR,
  document_subject TEXT,
  document_number VARCHAR,
  assigned_by_id UUID,
  assigned_by_name TEXT,
  assigned_to_id UUID,
  assigned_to_name TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR,
  note TEXT,
  completion_note TEXT
) AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Use provided user_id or current user
  v_user_id := COALESCE(p_user_id, auth.uid());

  RETURN QUERY
  SELECT
    ta.id AS assignment_id,
    COALESCE(ta.memo_id, ta.doc_receive_id) AS document_id,
    ta.document_type,
    COALESCE(m.subject, dr.subject) AS document_subject,
    COALESCE(m.doc_number, dr.doc_number) AS document_number,
    ta.assigned_by AS assigned_by_id,
    (p_by.first_name || ' ' || p_by.last_name) AS assigned_by_name,
    ta.assigned_to AS assigned_to_id,
    (p_to.first_name || ' ' || p_to.last_name) AS assigned_to_name,
    ta.assigned_at,
    ta.completed_at,
    ta.status,
    ta.note,
    ta.completion_note
  FROM task_assignments ta
  LEFT JOIN memos m ON ta.memo_id = m.id
  LEFT JOIN doc_receive dr ON ta.doc_receive_id = dr.id
  LEFT JOIN profiles p_by ON ta.assigned_by = p_by.user_id
  LEFT JOIN profiles p_to ON ta.assigned_to = p_to.user_id
  WHERE ta.deleted_at IS NULL
    AND ta.assigned_to = v_user_id
    AND (p_status IS NULL OR ta.status = p_status)
  ORDER BY ta.assigned_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 3: Function to update task status
-- =====================================================
CREATE OR REPLACE FUNCTION update_task_status(
  p_assignment_id UUID,
  p_new_status VARCHAR,
  p_completion_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  -- Validate status
  IF p_new_status NOT IN ('pending', 'in_progress', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status. Must be one of: pending, in_progress, completed, cancelled';
  END IF;

  -- Update the task assignment
  UPDATE task_assignments
  SET
    status = p_new_status,
    completion_note = COALESCE(p_completion_note, completion_note),
    completed_at = CASE
      WHEN p_new_status = 'completed' THEN now()
      ELSE completed_at
    END
  WHERE id = p_assignment_id
    AND assigned_to = v_current_user
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task assignment not found or you do not have permission to update it';
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 4: Function to get documents ready for assignment
-- =====================================================
CREATE OR REPLACE FUNCTION get_documents_ready_for_assignment()
RETURNS TABLE (
  document_id UUID,
  document_type VARCHAR,
  document_subject TEXT,
  document_number VARCHAR,
  author_name TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  is_assigned BOOLEAN,
  last_comment TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- Get completed memos
  SELECT
    m.id AS document_id,
    'memo'::VARCHAR AS document_type,
    m.subject AS document_subject,
    m.doc_number AS document_number,
    m.author_name,
    m.updated_at AS completed_at,
    m.is_assigned,
    (
      SELECT jsonb_array_element_text(
        m.signer_list_progress,
        jsonb_array_length(m.signer_list_progress) - 1
      ) -> 'comment'
    )::TEXT AS last_comment
  FROM memos m
  WHERE m.status = 'completed'
    AND m.current_signer_order = 5
    AND m.doc_del IS NULL

  UNION ALL

  -- Get completed doc_receive
  SELECT
    dr.id AS document_id,
    'doc_receive'::VARCHAR AS document_type,
    dr.subject AS document_subject,
    dr.doc_number AS document_number,
    dr.author_name,
    dr.updated_at AS completed_at,
    dr.is_assigned,
    (
      SELECT jsonb_array_element_text(
        dr.signer_list_progress,
        jsonb_array_length(dr.signer_list_progress) - 1
      ) -> 'comment'
    )::TEXT AS last_comment
  FROM doc_receive dr
  WHERE dr.status = 'completed'
    AND dr.current_signer_order = 5
    AND dr.doc_del IS NULL

  ORDER BY completed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 5: Function to soft delete task assignment
-- =====================================================
CREATE OR REPLACE FUNCTION soft_delete_task_assignment(
  p_assignment_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  -- Update deleted_at timestamp
  UPDATE task_assignments
  SET deleted_at = now()
  WHERE id = p_assignment_id
    AND assigned_by = v_current_user
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task assignment not found or you do not have permission to delete it';
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 6: Add comments for documentation
-- =====================================================
COMMENT ON FUNCTION create_task_assignment(UUID, VARCHAR, UUID, TEXT) IS 'สร้างงานมอบหมายใหม่ - ใช้ได้เฉพาะธุรการ';
COMMENT ON FUNCTION get_user_assigned_tasks(UUID, VARCHAR, INT, INT) IS 'ดึงรายการงานที่ได้รับมอบหมายของผู้ใช้';
COMMENT ON FUNCTION update_task_status(UUID, VARCHAR, TEXT) IS 'อัปเดตสถานะของงานมอบหมาย';
COMMENT ON FUNCTION get_documents_ready_for_assignment() IS 'ดึงรายการเอกสารที่พร้อมสำหรับการมอบหมาย (status = completed, current_signer_order = 5)';
COMMENT ON FUNCTION soft_delete_task_assignment(UUID) IS 'ลบงานมอบหมาย (soft delete) - ใช้ได้เฉพาะผู้ที่มอบหมาย';
