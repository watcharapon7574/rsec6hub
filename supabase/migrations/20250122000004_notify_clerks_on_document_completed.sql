-- Migration: Notify clerks when document is completed and ready for assignment
-- Description: แจ้งเตือนธุรการทุกคนเมื่อเอกสารเกษียนหนังสือแล้ว (current_signer_order = 5)

-- =====================================================
-- PART 1: Create notification trigger function
-- =====================================================
CREATE OR REPLACE FUNCTION notify_clerks_on_document_completed()
RETURNS TRIGGER AS $$
DECLARE
  clerk_record RECORD;
  doc_type_text TEXT;
BEGIN
  -- Only trigger when document just became completed (current_signer_order = 5)
  -- AND has NOT been assigned yet (is_assigned = false)
  IF NEW.current_signer_order = 5 AND
     (OLD.current_signer_order IS NULL OR OLD.current_signer_order != 5) AND
     (NEW.is_assigned IS NULL OR NEW.is_assigned = false) AND
     NEW.doc_del IS NULL THEN

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
-- PART 2: Attach triggers to tables
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

-- Trigger for doc_receive table
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
-- PART 3: Add comments for documentation
-- =====================================================
COMMENT ON FUNCTION notify_clerks_on_document_completed IS 'แจ้งเตือนธุรการทุกคนเมื่อเอกสารเกษียนแล้ว พร้อมมอบหมายงาน (current_signer_order = 5 AND is_assigned = false)';
COMMENT ON TRIGGER trigger_notify_clerks_on_memo_completed ON memos IS 'แจ้งเตือนธุรการเมื่อบันทึกข้อความเกษียนแล้ว';
COMMENT ON TRIGGER trigger_notify_clerks_on_doc_receive_completed ON doc_receive IS 'แจ้งเตือนธุรการเมื่อหนังสือรับเกษียนแล้ว';
