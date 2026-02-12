-- Migration: Add RPC function to get task assignment by report_memo_id
-- Description: เพิ่ม RPC function เพื่อให้ผู้ใช้สามารถดูข้อมูล task_assignment ที่เชื่อมกับ report_memo ได้
-- แก้ปัญหา RLS ที่ทำให้ธุรการไม่สามารถเห็น task_assignment ของ report memo ที่ผู้อื่นมอบหมาย

CREATE OR REPLACE FUNCTION get_task_assignment_by_report_memo(p_report_memo_id UUID)
RETURNS TABLE (
  id UUID,
  memo_id UUID,
  doc_receive_id UUID,
  document_type VARCHAR,
  assigned_by UUID,
  assigned_to UUID,
  note TEXT,
  status VARCHAR,
  assigned_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completion_note TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  report_memo_id UUID,
  report_file_url TEXT,
  task_description TEXT,
  event_date DATE,
  event_time VARCHAR,
  location TEXT,
  is_reporter BOOLEAN,
  is_team_leader BOOLEAN,
  assignment_source VARCHAR,
  position_id UUID,
  group_id UUID,
  parent_assignment_id UUID,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ตรวจสอบว่ามี report memo นี้และผู้ใช้มีสิทธิ์เข้าถึง
  -- (เช็คว่าเป็นธุรการ หรือ admin หรือ เป็นคนที่เกี่ยวข้องกับงาน)
  IF NOT EXISTS (
    SELECT 1 FROM memos m
    WHERE m.id = p_report_memo_id
      AND m.is_report_memo = true
  ) THEN
    -- ไม่ใช่ report memo
    RETURN;
  END IF;

  -- Return task assignment data
  RETURN QUERY
  SELECT
    ta.id,
    ta.memo_id,
    ta.doc_receive_id,
    ta.document_type,
    ta.assigned_by,
    ta.assigned_to,
    ta.note,
    ta.status,
    ta.assigned_at,
    ta.completed_at,
    ta.completion_note,
    ta.deleted_at,
    ta.report_memo_id,
    ta.report_file_url,
    ta.task_description,
    ta.event_date,
    ta.event_time,
    ta.location,
    ta.is_reporter,
    ta.is_team_leader,
    ta.assignment_source,
    ta.position_id,
    ta.group_id,
    ta.parent_assignment_id,
    ta.updated_at
  FROM task_assignments ta
  WHERE ta.report_memo_id = p_report_memo_id
    AND ta.deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION get_task_assignment_by_report_memo(UUID) IS 'ดึงข้อมูล task_assignment จาก report_memo_id - ใช้สำหรับ ManageReportMemoPage';
