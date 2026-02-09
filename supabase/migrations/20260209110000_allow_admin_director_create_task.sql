-- Allow admin and director to create task assignments
-- Previously only clerk_teacher could create task assignments

DROP FUNCTION IF EXISTS create_task_assignment(UUID, VARCHAR, UUID, TEXT);

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
  v_is_admin BOOLEAN;
  v_position VARCHAR;
BEGIN
  -- Get current user
  v_current_user := auth.uid();

  -- Get user info
  SELECT is_admin, position INTO v_is_admin, v_position
  FROM profiles
  WHERE user_id = v_current_user;

  -- Validate that current user is a clerk, admin, or director
  IF NOT (
    v_is_admin = true
    OR v_position = 'clerk_teacher'
    OR v_position = 'director'
    OR v_position = 'deputy_director'
  ) THEN
    RAISE EXCEPTION 'Only clerks, admins, or directors can create task assignments';
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

COMMENT ON FUNCTION create_task_assignment(UUID, VARCHAR, UUID, TEXT) IS 'สร้างงานมอบหมายใหม่ - ใช้ได้สำหรับธุรการ, admin, และผู้อำนวยการ';
