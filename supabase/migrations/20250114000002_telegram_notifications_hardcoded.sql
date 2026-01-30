-- Migration: Telegram Notifications System (with hardcoded values)
-- Description: Automatically send Telegram notifications when document status changes

-- =====================================================
-- PART 1: Helper function to send HTTP POST requests
-- =====================================================
-- This function sends notifications to the Edge Function
CREATE OR REPLACE FUNCTION send_telegram_notification(payload JSONB)
RETURNS VOID AS $$
DECLARE
  request_id bigint;
  supabase_url text := 'https://ikfioqvjrhquiyeylmsv.supabase.co';
  supabase_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MzQ3MTcsImV4cCI6MjA2NjQxMDcxN30.m0RHqLl6RmM5rTN-TU3YrcvHNpSB9FnH_XN_Y3uhhRc';
BEGIN
  -- Make async HTTP request using pg_net (non-blocking)
  BEGIN
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/telegram-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_anon_key
      ),
      body := payload
    ) INTO request_id;

    -- Log the request for debugging
    RAISE LOG 'Telegram notification queued with request_id: %, payload: %', request_id, payload;
  EXCEPTION
    WHEN undefined_function THEN
      RAISE WARNING 'pg_net extension not available, skipping notification';
    WHEN OTHERS THEN
      -- Log error but don't fail the main transaction
      RAISE WARNING 'Failed to send Telegram notification: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 2: Main notification trigger function
-- =====================================================
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
  -- Check if this is doc_receive or memos table
  is_doc_receive := (TG_TABLE_NAME = 'doc_receive');

  -- Skip if document is soft-deleted
  IF NEW.doc_del IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get author's telegram_chat_id from profiles table
  BEGIN
    SELECT telegram_chat_id INTO author_chat_id
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
  IF NEW.status = 'pending_sign' AND (OLD.status IS NULL OR OLD.status != 'pending_sign') THEN
    -- Get current signer info from signer_list_progress
    IF NEW.signer_list_progress IS NOT NULL THEN
      -- Find the current signer based on current_signer_order
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

      -- Get current signer's telegram_chat_id
      IF current_signer_user_id IS NOT NULL THEN
        BEGIN
          SELECT telegram_chat_id INTO current_signer_chat_id
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

-- =====================================================
-- PART 3: Create triggers for both tables
-- =====================================================

-- Trigger for memos table
DROP TRIGGER IF EXISTS telegram_notify_on_memo_status_change ON memos;
CREATE TRIGGER telegram_notify_on_memo_status_change
  AFTER UPDATE ON memos
  FOR EACH ROW
  WHEN (
    -- Only trigger when status actually changes
    OLD.status IS DISTINCT FROM NEW.status
    AND NEW.doc_del IS NULL  -- Skip soft-deleted documents
  )
  EXECUTE FUNCTION notify_telegram_on_memo_status_change();

-- Trigger for doc_receive table
DROP TRIGGER IF EXISTS telegram_notify_on_doc_receive_status_change ON doc_receive;
CREATE TRIGGER telegram_notify_on_doc_receive_status_change
  AFTER UPDATE ON doc_receive
  FOR EACH ROW
  WHEN (
    -- Only trigger when status actually changes
    OLD.status IS DISTINCT FROM NEW.status
    AND NEW.doc_del IS NULL  -- Skip soft-deleted documents
  )
  EXECUTE FUNCTION notify_telegram_on_memo_status_change();

-- =====================================================
-- PART 4: Add comments for documentation
-- =====================================================
COMMENT ON FUNCTION send_telegram_notification(JSONB) IS 'Helper function to send notifications to Telegram Edge Function';
COMMENT ON FUNCTION notify_telegram_on_memo_status_change() IS 'Trigger function to send Telegram notifications when document status changes (rejected, pending_sign, completed)';
COMMENT ON TRIGGER telegram_notify_on_memo_status_change ON memos IS 'Automatically send Telegram notifications for memo status changes';
COMMENT ON TRIGGER telegram_notify_on_doc_receive_status_change ON doc_receive IS 'Automatically send Telegram notifications for doc_receive status changes';

-- =====================================================
-- PART 5: Grant necessary permissions
-- =====================================================
-- Grant execute permission on the functions
GRANT EXECUTE ON FUNCTION send_telegram_notification(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION notify_telegram_on_memo_status_change() TO authenticated;
