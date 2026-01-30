-- Migration: Notify assigned users when they receive new task
-- Description: แจ้งเตือนผู้ที่ได้รับมอบหมายงานใหม่

-- =====================================================
-- PART 1: Create notification trigger function
-- =====================================================
CREATE OR REPLACE FUNCTION notify_on_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  doc_subject TEXT;
  doc_number TEXT;
  assigner_name TEXT;
  assignee_telegram_id TEXT;
BEGIN
  -- Get document details
  IF NEW.document_type = 'memo' THEN
    SELECT subject, doc_number INTO doc_subject, doc_number
    FROM memos WHERE id = NEW.memo_id;
  ELSIF NEW.document_type = 'doc_receive' THEN
    SELECT subject, doc_number INTO doc_subject, doc_number
    FROM doc_receive WHERE id = NEW.doc_receive_id;
  END IF;

  -- Get assigner name
  SELECT (first_name || ' ' || last_name) INTO assigner_name
  FROM profiles WHERE user_id = NEW.assigned_by;

  -- Get assignee telegram_chat_id
  SELECT telegram_chat_id INTO assignee_telegram_id
  FROM profiles WHERE user_id = NEW.assigned_to;

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
      NEW.assigned_to,
      '📋 มีงานใหม่มอบหมายให้คุณ',
      'เรื่อง: ' || COALESCE(doc_subject, 'ไม่ระบุ') ||
      ' เลขที่: ' || COALESCE(doc_number, 'ยังไม่มีเลขที่') ||
      ' โดย ' || COALESCE(assigner_name, 'ไม่ระบุ'),
      'task_assigned',
      NEW.id,
      'high', -- High priority for new task assignments
      '/assigned-tasks',
      false
    );
  EXCEPTION
    WHEN undefined_table THEN
      RAISE LOG '⚠️  notifications table does not exist, skipping in-app notification';
    WHEN OTHERS THEN
      RAISE LOG '⚠️  Error creating in-app notification: %', SQLERRM;
  END;

  -- Send Telegram notification (if assignee has telegram_chat_id)
  IF assignee_telegram_id IS NOT NULL AND assignee_telegram_id != '' THEN
    BEGIN
      PERFORM send_telegram_notification(
        jsonb_build_object(
          'type', 'task_assigned',
          'document_id', COALESCE(NEW.memo_id, NEW.doc_receive_id),
          'document_type', NEW.document_type,
          'subject', COALESCE(doc_subject, 'ไม่ระบุเรื่อง'),
          'doc_number', COALESCE(doc_number, 'ยังไม่มีเลขที่'),
          'assigned_by', assigner_name,
          'note', NEW.note,
          'chat_id', assignee_telegram_id
        )
      );

      RAISE LOG '📤 Sending TASK ASSIGNMENT notification to user (chat_id: %)', assignee_telegram_id;
    EXCEPTION
      WHEN undefined_function THEN
        RAISE LOG '⚠️  send_telegram_notification function does not exist';
      WHEN OTHERS THEN
        RAISE LOG '⚠️  Error sending Telegram notification: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 2: Attach trigger to table
-- =====================================================
DROP TRIGGER IF EXISTS trigger_notify_on_task_assignment ON task_assignments;
CREATE TRIGGER trigger_notify_on_task_assignment
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NULL)
  EXECUTE FUNCTION notify_on_task_assignment();

-- =====================================================
-- PART 3: Add comments for documentation
-- =====================================================
COMMENT ON FUNCTION notify_on_task_assignment IS 'แจ้งเตือนผู้ที่ได้รับมอบหมายงานใหม่ (in-app + Telegram)';
COMMENT ON TRIGGER trigger_notify_on_task_assignment ON task_assignments IS 'แจ้งเตือนเมื่อมีการสร้างงานมอบหมายใหม่';
