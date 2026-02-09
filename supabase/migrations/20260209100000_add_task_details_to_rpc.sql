-- Add task detail fields (task_description, event_date, event_time, location) to get_user_assigned_tasks function

DROP FUNCTION IF EXISTS get_user_assigned_tasks(UUID, VARCHAR, INT, INT);

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
  document_pdf_url TEXT,
  assigned_by_id UUID,
  assigned_by_name TEXT,
  assigned_to_id UUID,
  assigned_to_name TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR,
  note TEXT,
  completion_note TEXT,
  -- New task detail fields
  task_description TEXT,
  event_date DATE,
  event_time VARCHAR,
  location TEXT
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
    COALESCE(m.pdf_draft_path, dr.pdf_draft_path, dr.pdf_final_path) AS document_pdf_url,
    ta.assigned_by AS assigned_by_id,
    (p_by.first_name || ' ' || p_by.last_name) AS assigned_by_name,
    ta.assigned_to AS assigned_to_id,
    (p_to.first_name || ' ' || p_to.last_name) AS assigned_to_name,
    ta.assigned_at,
    ta.completed_at,
    ta.status,
    ta.note,
    ta.completion_note,
    -- New task detail fields
    ta.task_description,
    ta.event_date,
    ta.event_time,
    ta.location
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

COMMENT ON FUNCTION get_user_assigned_tasks(UUID, VARCHAR, INT, INT) IS 'ดึงรายการงานที่ได้รับมอบหมายของผู้ใช้ - รวม PDF URL และข้อมูล task details (task_description, event_date, event_time, location)';
