-- ========================================
-- FIX: Remove urgency field from trigger function
-- ========================================

CREATE OR REPLACE FUNCTION notify_telegram_on_memo_created()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  clerk_chat_id text;
  clerk_name text;
  is_doc_receive boolean;
BEGIN
  is_doc_receive := (TG_TABLE_NAME = 'doc_receive');

  -- Skip if document is soft-deleted
  IF NEW.doc_del IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get clerk's telegram_chat_id from PROFILES table
  BEGIN
    SELECT telegram_chat_id, first_name || ' ' || last_name
    INTO clerk_chat_id, clerk_name
    FROM profiles
    WHERE position = 'clerk_teacher'
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE LOG '⚠️  profiles table does not exist, skipping notification';
      RETURN NEW;
    WHEN undefined_column THEN
      RAISE LOG '⚠️  telegram_chat_id or position column does not exist in profiles';
      RETURN NEW;
  END;

  -- Send notification to clerk if chat_id exists
  IF clerk_chat_id IS NOT NULL AND clerk_chat_id != '' THEN
    payload := jsonb_build_object(
      'type', 'document_created',
      'document_id', NEW.id,
      'document_type', CASE WHEN is_doc_receive THEN 'doc_receive' ELSE 'memo' END,
      'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
      'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
      'chat_id', clerk_chat_id
    );

    RAISE LOG '📤 Sending NEW DOCUMENT notification to clerk: % (chat_id: %)', clerk_name, clerk_chat_id;
    PERFORM send_telegram_notification(payload);
  ELSE
    RAISE LOG '⚠️  No clerk with telegram_chat_id found';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Function has been fixed (removed urgency field)!' as status;
