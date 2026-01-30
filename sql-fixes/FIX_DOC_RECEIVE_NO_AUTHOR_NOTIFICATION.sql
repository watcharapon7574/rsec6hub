-- ========================================
-- FIX: Doc Receive - ไม่ส่งแจ้งเตือนไปหาผู้เขียน (เพราะผู้เขียนคือธุรการอยู่แล้ว)
-- ========================================
-- Changes:
-- 1. สำหรับ doc_receive ที่ completed ไม่ส่งไปหาผู้เขียน (author) เพราะจะซ้ำกับธุรการ
-- 2. สำหรับ memos ปกติ ยังคงส่งไปหาผู้เขียนตามปกติ

CREATE OR REPLACE FUNCTION notify_telegram_on_memo_status_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  author_chat_id text;
  clerk_record RECORD;
  current_signer_chat_id text;
  current_signer_first_name text;
  current_signer_last_name text;
  current_signer_full_name text;
  current_signer_position text;
  current_signer_position_thai text;
  current_signer_user_id text;
  is_doc_receive boolean;
  reject_comment text;
  rejected_data jsonb;
BEGIN
  is_doc_receive := (TG_TABLE_NAME = 'doc_receive');

  IF NEW.doc_del IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get author's telegram_chat_id from PROFILES table
  BEGIN
    SELECT telegram_chat_id INTO author_chat_id
    FROM profiles
    WHERE user_id::text = NEW.user_id::text;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE LOG '⚠️  profiles table does not exist, skipping notification';
      RETURN NEW;
    WHEN undefined_column THEN
      RAISE LOG '⚠️  telegram_chat_id column does not exist in profiles, skipping notification';
      RETURN NEW;
  END;

  -- =====================================================
  -- CASE 1: Document was REJECTED
  -- =====================================================
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    -- Parse reject reason from rejected_name_comment
    IF NEW.rejected_name_comment IS NOT NULL THEN
      BEGIN
        IF jsonb_typeof(NEW.rejected_name_comment) = 'string' THEN
          rejected_data := (NEW.rejected_name_comment #>> '{}')::jsonb;
          reject_comment := rejected_data->>'comment';
        ELSE
          reject_comment := NEW.rejected_name_comment->>'comment';
        END IF;
        RAISE LOG 'Parsed reject comment: %', reject_comment;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'Error parsing rejected_name_comment: %', SQLERRM;
          reject_comment := 'ไม่ระบุเหตุผล';
      END;
    ELSE
      reject_comment := 'ไม่ระบุเหตุผล';
    END IF;

    -- Send to AUTHOR (always)
    IF author_chat_id IS NOT NULL AND author_chat_id != '' THEN
      payload := jsonb_build_object(
        'type', 'document_rejected',
        'document_id', NEW.id,
        'document_type', CASE WHEN is_doc_receive THEN 'doc_receive' ELSE 'memo' END,
        'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
        'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
        'reject_reason', COALESCE(reject_comment, 'ไม่ระบุเหตุผล'),
        'chat_id', author_chat_id
      );

      RAISE LOG '📤 Sending REJECTED notification to author: % (chat_id: %, reason: %)', NEW.author_name, author_chat_id, reject_comment;
      PERFORM send_telegram_notification(payload);
    ELSE
      RAISE LOG '⚠️  Author % has no telegram_chat_id, skipping notification', NEW.author_name;
    END IF;

    -- Send to ALL CLERKS (only for doc_receive)
    IF is_doc_receive THEN
      FOR clerk_record IN
        SELECT telegram_chat_id, first_name || ' ' || last_name as name
        FROM profiles
        WHERE position = 'clerk_teacher'
          AND telegram_chat_id IS NOT NULL
          AND telegram_chat_id != ''
      LOOP
        payload := jsonb_build_object(
          'type', 'document_rejected',
          'document_id', NEW.id,
          'document_type', 'doc_receive',
          'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
          'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
          'reject_reason', COALESCE(reject_comment, 'ไม่ระบุเหตุผล'),
          'chat_id', clerk_record.telegram_chat_id
        );

        RAISE LOG '📤 Sending REJECTED notification to clerk: % (chat_id: %)', clerk_record.name, clerk_record.telegram_chat_id;
        PERFORM send_telegram_notification(payload);
      END LOOP;
    END IF;
  END IF;

  -- =====================================================
  -- CASE 2: Document is PENDING_SIGN
  -- =====================================================
  IF NEW.status = 'pending_sign' AND (
    (OLD.status IS NULL OR OLD.status != 'pending_sign') OR
    (OLD.current_signer_order IS DISTINCT FROM NEW.current_signer_order)
  ) THEN
    IF NEW.signer_list_progress IS NOT NULL THEN
      SELECT
        signer->>'user_id',
        signer->>'position'
      INTO
        current_signer_user_id,
        current_signer_position
      FROM jsonb_array_elements(NEW.signer_list_progress) AS signer
      WHERE (signer->>'order')::int = NEW.current_signer_order;

      IF current_signer_user_id IS NOT NULL THEN
        BEGIN
          SELECT
            telegram_chat_id,
            first_name,
            last_name
          INTO
            current_signer_chat_id,
            current_signer_first_name,
            current_signer_last_name
          FROM profiles
          WHERE user_id::text = current_signer_user_id::text;

          current_signer_full_name := COALESCE(current_signer_first_name, '') || ' ' || COALESCE(current_signer_last_name, '');
        EXCEPTION
          WHEN undefined_table THEN
            RAISE LOG '⚠️  profiles table does not exist';
            RETURN NEW;
          WHEN undefined_column THEN
            RAISE LOG '⚠️  Required columns do not exist in profiles, skipping notification';
            RETURN NEW;
        END;

        current_signer_position_thai := CASE current_signer_position
          WHEN 'director' THEN 'ผู้อำนวยการ'
          WHEN 'deputy_director' THEN 'รองผู้อำนวยการ'
          WHEN 'assistant_director' THEN 'ผู้ช่วยผู้อำนวยการ'
          WHEN 'government_teacher' THEN 'ครูผู้สอน'
          WHEN 'contract_teacher' THEN 'ครูอัตราจ้าง'
          WHEN 'government_employee' THEN 'เจ้าหน้าที่'
          WHEN 'clerk_teacher' THEN 'ธุรการ'
          WHEN 'disability_aide' THEN 'ผู้ช่วยนักเรียน'
          ELSE current_signer_position
        END;

        IF current_signer_chat_id IS NOT NULL AND current_signer_chat_id != '' THEN
          payload := jsonb_build_object(
            'type', 'document_pending',
            'document_id', NEW.id,
            'document_type', CASE WHEN is_doc_receive THEN 'doc_receive' ELSE 'memo' END,
            'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
            'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
            'current_signer_name', COALESCE(TRIM(current_signer_full_name), 'ไม่ระบุชื่อ'),
            'current_signer_position', COALESCE(current_signer_position_thai, 'ไม่ระบุตำแหน่ง'),
            'chat_id', current_signer_chat_id
          );

          RAISE LOG '📤 Sending PENDING notification to signer: % (order: %, chat_id: %)', current_signer_full_name, NEW.current_signer_order, current_signer_chat_id;
          PERFORM send_telegram_notification(payload);
        ELSE
          RAISE LOG '⚠️  Current signer % (order: %) has no telegram_chat_id, skipping notification', current_signer_full_name, NEW.current_signer_order;
        END IF;
      ELSE
        RAISE LOG '⚠️  No signer found for order: %', NEW.current_signer_order;
      END IF;
    END IF;
  END IF;

  -- =====================================================
  -- CASE 3: Document is COMPLETED
  -- =====================================================
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Send to AUTHOR (both memos and doc_receive)
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

    -- Send to ALL CLERKS (both memos and doc_receive)
    FOR clerk_record IN
      SELECT telegram_chat_id, first_name || ' ' || last_name as name
      FROM profiles
      WHERE position = 'clerk_teacher'
        AND telegram_chat_id IS NOT NULL
        AND telegram_chat_id != ''
    LOOP
      payload := jsonb_build_object(
        'type', 'document_completed_clerk',
        'document_id', NEW.id,
        'document_type', CASE WHEN is_doc_receive THEN 'doc_receive' ELSE 'memo' END,
        'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
        'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
        'doc_number', COALESCE(NEW.doc_number, 'ยังไม่มีเลขที่หนังสือ'),
        'chat_id', clerk_record.telegram_chat_id
      );

      RAISE LOG '📤 Sending COMPLETED notification to clerk: % (chat_id: %)', clerk_record.name, clerk_record.telegram_chat_id;
      PERFORM send_telegram_notification(payload);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Doc Receive notification system updated - no author notification for completed doc_receive!' as status;
