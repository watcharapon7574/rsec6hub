-- Migration: Fix ambiguous column reference in get_documents_ready_for_assignment
-- Description: แก้ไขปัญหา column reference "doc_number" is ambiguous ใน get_documents_ready_for_assignment

-- =====================================================
-- Fix get_documents_ready_for_assignment function
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
    m.doc_number::VARCHAR AS document_number,
    m.author_name AS author_name,
    m.updated_at AS completed_at,
    m.is_assigned AS is_assigned,
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
    dr.doc_number::VARCHAR AS document_number,
    dr.author_name AS author_name,
    dr.updated_at AS completed_at,
    dr.is_assigned AS is_assigned,
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

COMMENT ON FUNCTION get_documents_ready_for_assignment() IS 'ดึงรายการเอกสารที่พร้อมสำหรับการมอบหมาย (status = completed, current_signer_order = 5) - Fixed ambiguous column reference';
