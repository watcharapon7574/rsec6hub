-- Migration: Use report_memo_id instead of subject prefix to identify report memos
-- Description: เปลี่ยนวิธีระบุ report memo จากการเช็ค subject prefix เป็นเช็ค task_assignments.report_memo_id
-- เพราะไม่ต้องการให้ "รายงานผล:" แทรกแซงเนื้อหาของ subject

-- =====================================================
-- PART 1: Update get_documents_ready_for_assignment function
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
  last_comment TEXT,
  has_in_progress_task BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  -- Get completed memos (EXCLUDE report memos - check via task_assignments.report_memo_id)
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
    )::TEXT AS last_comment,
    EXISTS (
      SELECT 1 FROM task_assignments ta
      WHERE ta.memo_id = m.id
        AND ta.status = 'in_progress'
        AND ta.deleted_at IS NULL
    ) AS has_in_progress_task
  FROM memos m
  WHERE m.status = 'completed'
    AND m.current_signer_order = 5
    AND m.doc_del IS NULL
    -- EXCLUDE report memos: check if this memo is linked as report_memo_id in any task_assignment
    AND NOT EXISTS (
      SELECT 1 FROM task_assignments ta
      WHERE ta.report_memo_id = m.id
        AND ta.deleted_at IS NULL
    )

  UNION ALL

  -- Get completed doc_receive (doc_receive can't be report memos)
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
    )::TEXT AS last_comment,
    EXISTS (
      SELECT 1 FROM task_assignments ta
      WHERE ta.doc_receive_id = dr.id
        AND ta.status = 'in_progress'
        AND ta.deleted_at IS NULL
    ) AS has_in_progress_task
  FROM doc_receive dr
  WHERE dr.status = 'completed'
    AND dr.current_signer_order = 5
    AND dr.doc_del IS NULL

  ORDER BY completed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 2: Update notify_clerks_on_document_completed function
-- =====================================================
CREATE OR REPLACE FUNCTION notify_clerks_on_document_completed()
RETURNS TRIGGER AS $$
DECLARE
  clerk_record RECORD;
  doc_type_text TEXT;
  is_report_memo BOOLEAN;
BEGIN
  -- Only trigger when document just became completed (current_signer_order = 5)
  -- AND has NOT been assigned yet (is_assigned = false)
  IF NEW.current_signer_order = 5 AND
     (OLD.current_signer_order IS NULL OR OLD.current_signer_order != 5) AND
     (NEW.is_assigned IS NULL OR NEW.is_assigned = false) AND
     NEW.doc_del IS NULL THEN

    -- Check if this is a report memo (linked via task_assignments.report_memo_id)
    -- Only check for memos table, doc_receive can't be report memos
    is_report_memo := FALSE;
    IF TG_TABLE_NAME = 'memos' THEN
      SELECT EXISTS (
        SELECT 1 FROM task_assignments ta
        WHERE ta.report_memo_id = NEW.id
          AND ta.deleted_at IS NULL
      ) INTO is_report_memo;
    END IF;

    -- Skip notification for report memos
    IF is_report_memo THEN
      RAISE LOG '📋 Skipping notification for report memo: %', NEW.id;
      RETURN NEW;
    END IF;

    -- Determine document type text
    doc_type_text := CASE
      WHEN TG_TABLE_NAME = 'doc_receive' THEN 'หนังสือรับ'
      ELSE 'บันทึกข้อความ'
    END;

    -- Notify all clerks
    FOR clerk_record IN
      SELECT user_id, telegram_chat_id, first_name, last_name
      FROM profiles
      WHERE position = 'clerk_teacher'
        AND user_id IS NOT NULL
    LOOP
      -- Create in-app notification
      BEGIN
        INSERT INTO notifications (
          user_id,
          title,
          message,
          type,
          reference_id,
          priority,
          action_url,
          read
        ) VALUES (
          clerk_record.user_id,
          '📋 เอกสารรอการมอบหมาย',
          doc_type_text || ' เรื่อง: ' || COALESCE(NEW.subject, 'ไม่ระบุเรื่อง') || ' พร้อมมอบหมายงานแล้ว',
          'document_ready_for_assignment',
          NEW.id,
          'medium',
          '/documents',
          false
        );
      EXCEPTION
        WHEN undefined_table THEN
          RAISE LOG '⚠️  notifications table does not exist, skipping in-app notification';
        WHEN OTHERS THEN
          RAISE LOG '⚠️  Error creating in-app notification: %', SQLERRM;
      END;

      -- Send Telegram notification (if clerk has telegram_chat_id)
      IF clerk_record.telegram_chat_id IS NOT NULL AND clerk_record.telegram_chat_id != '' THEN
        BEGIN
          PERFORM send_telegram_notification(
            jsonb_build_object(
              'type', 'document_completed_clerk',
              'document_id', NEW.id,
              'document_type', CASE WHEN TG_TABLE_NAME = 'doc_receive' THEN 'doc_receive' ELSE 'memo' END,
              'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
              'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
              'doc_number', COALESCE(NEW.doc_number, 'ยังไม่มีเลขที่'),
              'chat_id', clerk_record.telegram_chat_id
            )
          );

          RAISE LOG '📤 Sending COMPLETED notification to clerk: % % (chat_id: %)',
            clerk_record.first_name, clerk_record.last_name, clerk_record.telegram_chat_id;
        EXCEPTION
          WHEN undefined_function THEN
            RAISE LOG '⚠️  send_telegram_notification function does not exist';
          WHEN OTHERS THEN
            RAISE LOG '⚠️  Error sending Telegram notification: %', SQLERRM;
        END;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 3: Recreate triggers (simplified - no subject check)
-- =====================================================

-- Trigger for memos table
DROP TRIGGER IF EXISTS trigger_notify_clerks_on_memo_completed ON memos;
CREATE TRIGGER trigger_notify_clerks_on_memo_completed
  AFTER UPDATE ON memos
  FOR EACH ROW
  WHEN (
    NEW.current_signer_order = 5 AND
    (OLD.current_signer_order IS NULL OR OLD.current_signer_order != 5) AND
    (NEW.is_assigned IS NULL OR NEW.is_assigned = false) AND
    NEW.doc_del IS NULL
  )
  EXECUTE FUNCTION notify_clerks_on_document_completed();

-- Trigger for doc_receive table (unchanged)
DROP TRIGGER IF EXISTS trigger_notify_clerks_on_doc_receive_completed ON doc_receive;
CREATE TRIGGER trigger_notify_clerks_on_doc_receive_completed
  AFTER UPDATE ON doc_receive
  FOR EACH ROW
  WHEN (
    NEW.current_signer_order = 5 AND
    (OLD.current_signer_order IS NULL OR OLD.current_signer_order != 5) AND
    (NEW.is_assigned IS NULL OR NEW.is_assigned = false) AND
    NEW.doc_del IS NULL
  )
  EXECUTE FUNCTION notify_clerks_on_document_completed();

-- =====================================================
-- PART 4: Add comments for documentation
-- =====================================================
COMMENT ON FUNCTION get_documents_ready_for_assignment IS 'ดึงรายการเอกสารที่พร้อมสำหรับการมอบหมาย - ไม่รวม report memo (เช็คจาก task_assignments.report_memo_id)';
COMMENT ON FUNCTION notify_clerks_on_document_completed IS 'แจ้งเตือนธุรการเมื่อเอกสารเกษียนแล้ว - ไม่รวม report memo (เช็คจาก task_assignments.report_memo_id)';
