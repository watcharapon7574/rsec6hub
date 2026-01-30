-- ========================================
-- UPDATE: Fix all functions to use text type for telegram_chat_id
-- ========================================

-- Function 1: notify_telegram_on_memo_created (for INSERT)
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
    SELECT telegram_chat_id::text, first_name || ' ' || last_name
    INTO clerk_chat_id, clerk_name
    FROM profiles
    WHERE position = 'clerk_teacher'
      AND telegram_chat_id IS NOT NULL
      AND telegram_chat_id != ''
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

-- Function 2: notify_telegram_on_memo_status_change (for UPDATE)
CREATE OR REPLACE FUNCTION notify_telegram_on_memo_status_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  author_chat_id text;
  current_signer_chat_id text;
  current_signer_name text;
  current_signer_position text;
  current_signer_user_id text;
  is_doc_receive boolean;
BEGIN
  is_doc_receive := (TG_TABLE_NAME = 'doc_receive');

  IF NEW.doc_del IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get author's telegram_chat_id from PROFILES table
  BEGIN
    SELECT telegram_chat_id::text INTO author_chat_id
    FROM profiles
    WHERE user_id = NEW.user_id;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE LOG '⚠️  profiles table does not exist, skipping notification';
      RETURN NEW;
    WHEN undefined_column THEN
      RAISE LOG '⚠️  telegram_chat_id column does not exist in profiles, skipping notification';
      RETURN NEW;
  END;

  -- CASE 1: Document was REJECTED
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    IF author_chat_id IS NOT NULL AND author_chat_id != '' THEN
      payload := jsonb_build_object(
        'type', 'document_rejected',
        'document_id', NEW.id,
        'document_type', CASE WHEN is_doc_receive THEN 'doc_receive' ELSE 'memo' END,
        'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
        'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
        'reject_reason', COALESCE(NEW.reject_reason, 'ไม่ระบุเหตุผล'),
        'chat_id', author_chat_id
      );

      RAISE LOG '📤 Sending REJECTED notification to author: % (chat_id: %)', NEW.author_name, author_chat_id;
      PERFORM send_telegram_notification(payload);
    ELSE
      RAISE LOG '⚠️  Author % has no telegram_chat_id, skipping notification', NEW.author_name;
    END IF;
  END IF;

  -- CASE 2: Document is PENDING_SIGN
  IF NEW.status = 'pending_sign' AND (OLD.status IS NULL OR OLD.status != 'pending_sign') THEN
    IF NEW.signer_list_progress IS NOT NULL THEN
      SELECT
        signer->>'user_id',
        signer->>'signer_name',
        signer->>'signer_position'
      INTO
        current_signer_user_id,
        current_signer_name,
        current_signer_position
      FROM jsonb_array_elements(NEW.signer_list_progress) AS signer
      WHERE (signer->>'order')::int = NEW.current_signer_order;

      IF current_signer_user_id IS NOT NULL THEN
        BEGIN
          SELECT telegram_chat_id::text INTO current_signer_chat_id
          FROM profiles
          WHERE user_id = current_signer_user_id;
        EXCEPTION
          WHEN undefined_table THEN
            RAISE LOG '⚠️  profiles table does not exist';
            RETURN NEW;
          WHEN undefined_column THEN
            RAISE LOG '⚠️  telegram_chat_id column does not exist in profiles, skipping notification';
            RETURN NEW;
        END;

        IF current_signer_chat_id IS NOT NULL AND current_signer_chat_id != '' THEN
          payload := jsonb_build_object(
            'type', 'document_pending',
            'document_id', NEW.id,
            'document_type', CASE WHEN is_doc_receive THEN 'doc_receive' ELSE 'memo' END,
            'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
            'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
            'current_signer_name', COALESCE(current_signer_name, 'ไม่ระบุชื่อ'),
            'current_signer_position', COALESCE(current_signer_position, 'ไม่ระบุตำแหน่ง'),
            'chat_id', current_signer_chat_id
          );

          RAISE LOG '📤 Sending PENDING notification to signer: % (chat_id: %)', current_signer_name, current_signer_chat_id;
          PERFORM send_telegram_notification(payload);
        ELSE
          RAISE LOG '⚠️  Current signer % has no telegram_chat_id, skipping notification', current_signer_name;
        END IF;
      END IF;
    END IF;
  END IF;

  -- CASE 3: Document is COMPLETED
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    IF author_chat_id IS NOT NULL AND author_chat_id != '' THEN
      payload := jsonb_build_object(
        'type', 'document_approved',
        'document_id', NEW.id,
        'document_type', CASE WHEN is_doc_receive THEN 'doc_receive' ELSE 'memo' END,
        'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
        'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
        'doc_number', COALESCE(NEW.doc_number, 'ยังไม่มีเลขที่หนังสือ'),
        'chat_id', author_chat_id
      );

      RAISE LOG '📤 Sending COMPLETED notification to author: % (chat_id: %)', NEW.author_name, author_chat_id;
      PERFORM send_telegram_notification(payload);
    ELSE
      RAISE LOG '⚠️  Author % has no telegram_chat_id, skipping notification', NEW.author_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'All functions have been updated to use text type for telegram_chat_id!' as status;
