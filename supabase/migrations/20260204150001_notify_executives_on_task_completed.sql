-- Migration: Notify executives when task is completed (reported)
-- Description: แจ้งเตือนผู้บริหารที่มีส่วนในการลงนามเมื่อผู้รับมอบหมายรายงานผลสำเร็จ

-- =====================================================
-- PART 1: Create notification trigger function
-- =====================================================
CREATE OR REPLACE FUNCTION notify_executives_on_task_completed()
RETURNS TRIGGER AS $$
DECLARE
  doc_subject TEXT;
  doc_number TEXT;
  signer_list JSONB;
  signer_record JSONB;
  signer_user_id UUID;
  signer_telegram_id TEXT;
  signer_name TEXT;
  reporter_name TEXT;
  doc_id UUID;
  doc_type TEXT;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get reporter name
  SELECT (first_name || ' ' || last_name) INTO reporter_name
  FROM profiles WHERE user_id = NEW.assigned_to;

  -- Get document details and signer_list_progress
  IF NEW.document_type = 'memo' THEN
    SELECT id, subject, doc_number, signer_list_progress
    INTO doc_id, doc_subject, doc_number, signer_list
    FROM memos WHERE id = NEW.memo_id;
  ELSIF NEW.document_type = 'doc_receive' THEN
    SELECT id, subject, doc_number, signer_list_progress
    INTO doc_id, doc_subject, doc_number, signer_list
    FROM doc_receive WHERE id = NEW.doc_receive_id;
  END IF;

  doc_type := NEW.document_type;

  -- If no signer_list_progress, skip
  IF signer_list IS NULL OR jsonb_array_length(signer_list) = 0 THEN
    RAISE LOG '⚠️ No signer_list_progress found for document %', doc_id;
    RETURN NEW;
  END IF;

  -- Loop through each signer in signer_list_progress
  FOR signer_record IN SELECT * FROM jsonb_array_elements(signer_list)
  LOOP
    -- Get signer user_id (skip author and clerk)
    IF signer_record->>'role' IN ('author', 'clerk') THEN
      CONTINUE;
    END IF;

    signer_user_id := (signer_record->>'user_id')::UUID;

    -- Skip if signer_user_id is null
    IF signer_user_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Get signer's telegram_chat_id and name
    SELECT telegram_chat_id, (first_name || ' ' || last_name)
    INTO signer_telegram_id, signer_name
    FROM profiles WHERE user_id = signer_user_id;

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
        signer_user_id,
        '📝 มีรายงานผลงานใหม่',
        COALESCE(reporter_name, 'ไม่ระบุ') || ' รายงานผลงาน เรื่อง: ' || COALESCE(doc_subject, 'ไม่ระบุ') ||
        CASE WHEN NEW.completion_note IS NOT NULL
          THEN ' - ' || LEFT(NEW.completion_note, 100)
          ELSE ''
        END,
        'task_completed',
        NEW.id,
        'normal',
        '/official-documents',
        false
      );
    EXCEPTION
      WHEN undefined_table THEN
        RAISE LOG '⚠️ notifications table does not exist, skipping in-app notification';
      WHEN OTHERS THEN
        RAISE LOG '⚠️ Error creating in-app notification: %', SQLERRM;
    END;

    -- Send Telegram notification (if signer has telegram_chat_id)
    IF signer_telegram_id IS NOT NULL AND signer_telegram_id != '' THEN
      BEGIN
        PERFORM send_telegram_notification(
          jsonb_build_object(
            'type', 'task_completed',
            'document_id', doc_id,
            'document_type', doc_type,
            'subject', COALESCE(doc_subject, 'ไม่ระบุเรื่อง'),
            'doc_number', COALESCE(doc_number, 'ยังไม่มีเลขที่'),
            'reporter_name', COALESCE(reporter_name, 'ไม่ระบุ'),
            'completion_note', COALESCE(NEW.completion_note, ''),
            'chat_id', signer_telegram_id
          )
        );

        RAISE LOG '📤 Sending TASK COMPLETED notification to signer % (chat_id: %)', signer_name, signer_telegram_id;
      EXCEPTION
        WHEN undefined_function THEN
          RAISE LOG '⚠️ send_telegram_notification function does not exist';
        WHEN OTHERS THEN
          RAISE LOG '⚠️ Error sending Telegram notification: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 2: Attach trigger to table
-- =====================================================
DROP TRIGGER IF EXISTS trigger_notify_executives_on_task_completed ON task_assignments;
CREATE TRIGGER trigger_notify_executives_on_task_completed
  AFTER UPDATE ON task_assignments
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.deleted_at IS NULL)
  EXECUTE FUNCTION notify_executives_on_task_completed();

-- =====================================================
-- PART 3: Update telegram-notify function to handle new type
-- =====================================================
-- Note: The telegram-notify edge function needs to be updated to handle 'task_completed' type
-- This is done in the Edge Function code

-- =====================================================
-- PART 4: Add comments for documentation
-- =====================================================
COMMENT ON FUNCTION notify_executives_on_task_completed IS 'แจ้งเตือนผู้บริหารที่ลงนามในเอกสาร เมื่อมีผู้รายงานผลงานสำเร็จ (in-app + Telegram)';
COMMENT ON TRIGGER trigger_notify_executives_on_task_completed ON task_assignments IS 'แจ้งเตือนเมื่อมีการรายงานผลงานสำเร็จ';
