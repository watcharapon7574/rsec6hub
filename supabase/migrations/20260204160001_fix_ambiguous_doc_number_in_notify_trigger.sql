-- Fix: Ambiguous column reference "doc_number" in notify_executives_on_task_completed
-- Use table aliases to avoid ambiguity between variable and column names

CREATE OR REPLACE FUNCTION notify_executives_on_task_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_doc_subject TEXT;
  v_doc_number TEXT;
  v_signer_list JSONB;
  v_signer_record JSONB;
  v_signer_user_id UUID;
  v_signer_telegram_id TEXT;
  v_signer_name TEXT;
  v_reporter_name TEXT;
  v_doc_id UUID;
  v_doc_type TEXT;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get reporter name
  SELECT (p.first_name || ' ' || p.last_name) INTO v_reporter_name
  FROM profiles p WHERE p.user_id = NEW.assigned_to;

  -- Get document details and signer_list_progress
  IF NEW.document_type = 'memo' THEN
    SELECT m.id, m.subject, m.doc_number, m.signer_list_progress
    INTO v_doc_id, v_doc_subject, v_doc_number, v_signer_list
    FROM memos m WHERE m.id = NEW.memo_id;
  ELSIF NEW.document_type = 'doc_receive' THEN
    SELECT d.id, d.subject, d.doc_number, d.signer_list_progress
    INTO v_doc_id, v_doc_subject, v_doc_number, v_signer_list
    FROM doc_receive d WHERE d.id = NEW.doc_receive_id;
  END IF;

  v_doc_type := NEW.document_type;

  -- If no signer_list_progress, skip
  IF v_signer_list IS NULL OR jsonb_array_length(v_signer_list) = 0 THEN
    RAISE LOG '⚠️ No signer_list_progress found for document %', v_doc_id;
    RETURN NEW;
  END IF;

  -- Loop through each signer in signer_list_progress
  FOR v_signer_record IN SELECT * FROM jsonb_array_elements(v_signer_list)
  LOOP
    -- Get signer user_id (skip author and clerk)
    IF v_signer_record->>'role' IN ('author', 'clerk') THEN
      CONTINUE;
    END IF;

    v_signer_user_id := (v_signer_record->>'user_id')::UUID;

    -- Skip if signer_user_id is null
    IF v_signer_user_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Get signer's telegram_chat_id and name
    SELECT p.telegram_chat_id, (p.first_name || ' ' || p.last_name)
    INTO v_signer_telegram_id, v_signer_name
    FROM profiles p WHERE p.user_id = v_signer_user_id;

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
        v_signer_user_id,
        '📝 มีรายงานผลงานใหม่',
        COALESCE(v_reporter_name, 'ไม่ระบุ') || ' รายงานผลงาน เรื่อง: ' || COALESCE(v_doc_subject, 'ไม่ระบุ') ||
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
    IF v_signer_telegram_id IS NOT NULL AND v_signer_telegram_id != '' THEN
      BEGIN
        PERFORM send_telegram_notification(
          jsonb_build_object(
            'type', 'task_completed',
            'document_id', v_doc_id,
            'document_type', v_doc_type,
            'subject', COALESCE(v_doc_subject, 'ไม่ระบุเรื่อง'),
            'doc_number', COALESCE(v_doc_number, 'ยังไม่มีเลขที่'),
            'reporter_name', COALESCE(v_reporter_name, 'ไม่ระบุ'),
            'completion_note', COALESCE(NEW.completion_note, ''),
            'chat_id', v_signer_telegram_id
          )
        );

        RAISE LOG '📤 Sending TASK COMPLETED notification to signer % (chat_id: %)', v_signer_name, v_signer_telegram_id;
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

COMMENT ON FUNCTION notify_executives_on_task_completed IS 'แจ้งเตือนผู้บริหารที่ลงนามในเอกสาร เมื่อมีผู้รายงานผลงานสำเร็จ (in-app + Telegram) - Fixed ambiguous column reference';
