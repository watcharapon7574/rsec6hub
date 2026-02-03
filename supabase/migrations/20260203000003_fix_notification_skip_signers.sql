-- Fix notification to handle skipped signers
-- When a signer is skipped, find the next available signer in signature_positions

CREATE OR REPLACE FUNCTION notify_telegram_on_memo_status_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  author_chat_id text;
  current_signer_chat_id text;
  current_signer_name text;
  current_signer_position text;
  current_signer_user_id text;
  current_signer_order_actual int;
  is_doc_receive boolean;
  sig_pos JSONB;
  found_signer boolean := false;
BEGIN
  -- Check if this is doc_receive or memos table
  is_doc_receive := (TG_TABLE_NAME = 'doc_receive');

  -- Skip if document is soft-deleted
  IF NEW.doc_del IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get author's telegram_chat_id from profiles table
  SELECT p.telegram_chat_id INTO author_chat_id
  FROM profiles p
  WHERE p.user_id = NEW.user_id;

  -- =====================================================
  -- CASE 1: Document was REJECTED (ตีกลับ)
  -- =====================================================
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    -- Only send if author has telegram_chat_id
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

  -- =====================================================
  -- CASE 2: Document is PENDING_SIGN (ถึงคิวลงนาม)
  -- =====================================================
  IF NEW.status = 'pending_sign' AND (OLD.status IS NULL OR OLD.status != 'pending_sign' OR OLD.current_signer_order != NEW.current_signer_order) THEN
    -- Get current signer info from signature_positions
    IF NEW.signature_positions IS NOT NULL THEN
      -- Try to find exact match first
      FOR sig_pos IN SELECT * FROM jsonb_array_elements(NEW.signature_positions)
      LOOP
        IF (sig_pos->'signer'->>'order')::int = NEW.current_signer_order THEN
          current_signer_user_id := sig_pos->'signer'->>'user_id';
          current_signer_name := sig_pos->'signer'->>'name';
          current_signer_position := sig_pos->'signer'->>'position';
          current_signer_order_actual := (sig_pos->'signer'->>'order')::int;
          found_signer := true;
          EXIT;
        END IF;
      END LOOP;

      -- If not found, find the next available signer with order >= current_signer_order
      IF NOT found_signer THEN
        RAISE LOG '⚠️  No exact match for order %, looking for next available signer...', NEW.current_signer_order;

        -- Find the signer with the smallest order that is >= current_signer_order
        FOR sig_pos IN
          SELECT * FROM jsonb_array_elements(NEW.signature_positions)
          ORDER BY (value->'signer'->>'order')::int ASC
        LOOP
          IF (sig_pos->'signer'->>'order')::int >= NEW.current_signer_order THEN
            current_signer_user_id := sig_pos->'signer'->>'user_id';
            current_signer_name := sig_pos->'signer'->>'name';
            current_signer_position := sig_pos->'signer'->>'position';
            current_signer_order_actual := (sig_pos->'signer'->>'order')::int;
            found_signer := true;
            RAISE LOG '✅ Found next available signer: % (order: %)', current_signer_name, current_signer_order_actual;
            EXIT;
          END IF;
        END LOOP;
      END IF;

      -- Get current signer's telegram_chat_id from profiles
      IF found_signer AND current_signer_user_id IS NOT NULL THEN
        SELECT p.telegram_chat_id INTO current_signer_chat_id
        FROM profiles p
        WHERE p.user_id::text = current_signer_user_id;

        -- Send notification to current signer
        IF current_signer_chat_id IS NOT NULL AND current_signer_chat_id != '' THEN
          payload := jsonb_build_object(
            'type', 'document_pending',
            'document_id', NEW.id,
            'document_type', CASE WHEN is_doc_receive THEN 'doc_receive' ELSE 'memo' END,
            'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
            'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
            'current_signer_name', COALESCE(current_signer_name, 'ไม่ระบุชื่อ'),
            'current_signer_position', COALESCE(current_signer_position, 'ไม่ระบุตำแหน่ง'),
            'current_signer_order', current_signer_order_actual,
            'chat_id', current_signer_chat_id
          );

          RAISE LOG '📤 Sending PENDING notification to signer: % (order: %, chat_id: %)', current_signer_name, current_signer_order_actual, current_signer_chat_id;
          PERFORM send_telegram_notification(payload);
        ELSE
          RAISE LOG '⚠️  Current signer % (user_id: %) has no telegram_chat_id, skipping notification', current_signer_name, current_signer_user_id;
        END IF;
      ELSE
        RAISE LOG '⚠️  Could not find any signer with order >= % in signature_positions', NEW.current_signer_order;
      END IF;
    ELSE
      RAISE LOG '⚠️  No signature_positions found for document %', NEW.id;
    END IF;
  END IF;

  -- =====================================================
  -- CASE 3: Document is COMPLETED (เสร็จสิ้น)
  -- =====================================================
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Send notification to author
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

COMMENT ON FUNCTION notify_telegram_on_memo_status_change() IS 'Trigger function to send Telegram notifications - handles skipped signers by finding next available order';
