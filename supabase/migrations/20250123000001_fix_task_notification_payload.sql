-- Fix task assignment notification payload to include author_name
-- Edge Function requires author_name but trigger was sending assigned_by instead

CREATE OR REPLACE FUNCTION notify_on_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  doc_subject TEXT;
  doc_number TEXT;
  doc_author_name TEXT;
  assigner_name TEXT;
  assignee_telegram_id TEXT;
BEGIN
  RAISE LOG '🔔 [TASK NOTIFICATION] Trigger fired for assignment_id: %', NEW.id;
  RAISE LOG '🔔 [TASK NOTIFICATION] Document type: %, memo_id: %, doc_receive_id: %',
    NEW.document_type, NEW.memo_id, NEW.doc_receive_id;

  -- Get document details including author_name
  IF NEW.document_type = 'memo' THEN
    RAISE LOG '🔔 [TASK NOTIFICATION] Fetching memo details for id: %', NEW.memo_id;
    SELECT m.subject, m.doc_number, m.author_name INTO doc_subject, doc_number, doc_author_name
    FROM memos m WHERE m.id = NEW.memo_id;
    RAISE LOG '🔔 [TASK NOTIFICATION] Memo details - subject: %, doc_number: %, author_name: %',
      doc_subject, doc_number, doc_author_name;
  ELSIF NEW.document_type = 'doc_receive' THEN
    RAISE LOG '🔔 [TASK NOTIFICATION] Fetching doc_receive details for id: %', NEW.doc_receive_id;
    SELECT dr.subject, dr.doc_number, dr.author_name INTO doc_subject, doc_number, doc_author_name
    FROM doc_receive dr WHERE dr.id = NEW.doc_receive_id;
    RAISE LOG '🔔 [TASK NOTIFICATION] Doc_receive details - subject: %, doc_number: %, author_name: %',
      doc_subject, doc_number, doc_author_name;
  END IF;

  -- Get assigner name (person who assigned the task)
  RAISE LOG '🔔 [TASK NOTIFICATION] Fetching assigner name for user_id: %', NEW.assigned_by;
  SELECT (first_name || ' ' || last_name) INTO assigner_name
  FROM profiles WHERE user_id = NEW.assigned_by;
  RAISE LOG '🔔 [TASK NOTIFICATION] Assigner name: %', assigner_name;

  -- Get assignee telegram_chat_id
  RAISE LOG '🔔 [TASK NOTIFICATION] Fetching assignee telegram_chat_id for user_id: %', NEW.assigned_to;
  SELECT telegram_chat_id INTO assignee_telegram_id
  FROM profiles WHERE user_id = NEW.assigned_to;
  RAISE LOG '🔔 [TASK NOTIFICATION] Assignee telegram_chat_id: %', assignee_telegram_id;

  -- Create in-app notification
  BEGIN
    RAISE LOG '🔔 [TASK NOTIFICATION] Creating in-app notification...';
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
      'high',
      '/assigned-tasks',
      false
    );
    RAISE LOG '✅ [TASK NOTIFICATION] In-app notification created successfully';
  EXCEPTION
    WHEN undefined_table THEN
      RAISE LOG '⚠️  [TASK NOTIFICATION] notifications table does not exist, skipping in-app notification';
    WHEN OTHERS THEN
      RAISE LOG '⚠️  [TASK NOTIFICATION] Error creating in-app notification: %', SQLERRM;
  END;

  -- Send Telegram notification (if assignee has telegram_chat_id)
  IF assignee_telegram_id IS NOT NULL AND assignee_telegram_id != '' THEN
    BEGIN
      RAISE LOG '📤 [TASK NOTIFICATION] Sending Telegram notification to chat_id: %', assignee_telegram_id;
      RAISE LOG '📤 [TASK NOTIFICATION] Payload: type=task_assigned, subject=%, author_name=%, assigned_by=%',
        COALESCE(doc_subject, 'ไม่ระบุเรื่อง'), COALESCE(doc_author_name, 'ไม่ระบุชื่อ'), assigner_name;

      PERFORM send_telegram_notification(
        jsonb_build_object(
          'type', 'task_assigned',
          'document_id', COALESCE(NEW.memo_id, NEW.doc_receive_id),
          'document_type', NEW.document_type,
          'subject', COALESCE(doc_subject, 'ไม่ระบุเรื่อง'),
          'author_name', COALESCE(doc_author_name, 'ไม่ระบุชื่อ'),
          'doc_number', COALESCE(doc_number, 'ยังไม่มีเลขที่'),
          'assigned_by', COALESCE(assigner_name, 'ไม่ระบุชื่อ'),
          'note', NEW.note,
          'chat_id', assignee_telegram_id
        )
      );

      RAISE LOG '✅ [TASK NOTIFICATION] Telegram notification queued successfully';
    EXCEPTION
      WHEN undefined_function THEN
        RAISE LOG '⚠️  [TASK NOTIFICATION] send_telegram_notification function does not exist';
      WHEN OTHERS THEN
        RAISE LOG '⚠️  [TASK NOTIFICATION] Error sending Telegram notification: %', SQLERRM;
    END;
  ELSE
    RAISE LOG '⚠️  [TASK NOTIFICATION] Assignee has no telegram_chat_id, skipping Telegram notification';
  END IF;

  RAISE LOG '✅ [TASK NOTIFICATION] Trigger completed successfully for assignment_id: %', NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_on_task_assignment IS 'แจ้งเตือนผู้ที่ได้รับมอบหมายงานใหม่ (in-app + Telegram) - Fixed payload with author_name';
