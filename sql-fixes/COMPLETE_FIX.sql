-- ========================================
-- COMPLETE FIX: Run this entire script in Supabase SQL Editor
-- ========================================
-- This will:
-- 1. Drop ALL old triggers and functions
-- 2. Recreate them with correct table references (profiles instead of employees)
-- 3. Add INSERT trigger for notifying clerk on new documents
-- 4. Re-enable triggers

-- =====================================================
-- STEP 1: Drop ALL old triggers and functions
-- =====================================================
DROP TRIGGER IF EXISTS telegram_notify_on_memo_status_change ON memos CASCADE;
DROP TRIGGER IF EXISTS telegram_notify_on_doc_receive_status_change ON doc_receive CASCADE;
DROP TRIGGER IF EXISTS telegram_notify_on_memo_created ON memos CASCADE;

DROP FUNCTION IF EXISTS notify_telegram_on_memo_status_change() CASCADE;
DROP FUNCTION IF EXISTS notify_telegram_on_memo_created() CASCADE;
DROP FUNCTION IF EXISTS send_telegram_notification(JSONB) CASCADE;

-- =====================================================
-- STEP 2: Recreate send_telegram_notification function
-- =====================================================
CREATE OR REPLACE FUNCTION send_telegram_notification(payload JSONB)
RETURNS VOID AS $$
DECLARE
  request_id bigint;
  supabase_url text := 'https://ikfioqvjrhquiyeylmsv.supabase.co';
  supabase_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MzQ3MTcsImV4cCI6MjA2NjQxMDcxN30.m0RHqLl6RmM5rTN-TU3YrcvHNpSB9FnH_XN_Y3uhhRc';
BEGIN
  BEGIN
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/telegram-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_anon_key
      ),
      body := payload
    ) INTO request_id;

    RAISE LOG 'Telegram notification queued with request_id: %, payload: %', request_id, payload;
  EXCEPTION
    WHEN undefined_function THEN
      RAISE WARNING 'pg_net extension not available, skipping notification';
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to send Telegram notification: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 3: Create UPDATE trigger function (for status changes)
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
  is_doc_receive := (TG_TABLE_NAME = 'doc_receive');

  IF NEW.doc_del IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get author's telegram_chat_id from PROFILES table (NOT employees!)
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

      -- Get current signer's telegram_chat_id from PROFILES (NOT employees!)
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
-- STEP 4: Create INSERT trigger function (for new documents - notify clerk)
-- =====================================================
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
      'urgency', COALESCE(NEW.urgency, 'normal'),
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

-- =====================================================
-- STEP 5: Create all triggers
-- =====================================================

-- UPDATE triggers for status changes on memos
CREATE TRIGGER telegram_notify_on_memo_status_change
  AFTER UPDATE ON memos
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    AND NEW.doc_del IS NULL
  )
  EXECUTE FUNCTION notify_telegram_on_memo_status_change();

-- UPDATE triggers for status changes on doc_receive
CREATE TRIGGER telegram_notify_on_doc_receive_status_change
  AFTER UPDATE ON doc_receive
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    AND NEW.doc_del IS NULL
  )
  EXECUTE FUNCTION notify_telegram_on_memo_status_change();

-- INSERT trigger for new memos (notify clerk)
CREATE TRIGGER telegram_notify_on_memo_created
  AFTER INSERT ON memos
  FOR EACH ROW
  WHEN (NEW.doc_del IS NULL)
  EXECUTE FUNCTION notify_telegram_on_memo_created();

-- INSERT trigger for new doc_receive (notify clerk)
CREATE TRIGGER telegram_notify_on_doc_receive_created
  AFTER INSERT ON doc_receive
  FOR EACH ROW
  WHEN (NEW.doc_del IS NULL)
  EXECUTE FUNCTION notify_telegram_on_memo_created();

-- =====================================================
-- STEP 6: Re-enable triggers (if they were disabled)
-- =====================================================
ALTER TABLE memos ENABLE TRIGGER USER;
ALTER TABLE doc_receive ENABLE TRIGGER USER;

-- =====================================================
-- STEP 7: Grant permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION send_telegram_notification(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION notify_telegram_on_memo_status_change() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_telegram_on_memo_created() TO authenticated;

-- =====================================================
-- STEP 8: Add comments
-- =====================================================
COMMENT ON FUNCTION send_telegram_notification(JSONB) IS 'Helper function to send notifications to Telegram Edge Function';
COMMENT ON FUNCTION notify_telegram_on_memo_status_change() IS 'Trigger function to send Telegram notifications when document status changes (rejected, pending_sign, completed)';
COMMENT ON FUNCTION notify_telegram_on_memo_created() IS 'Trigger function to send Telegram notifications to clerk when new document is created';
COMMENT ON TRIGGER telegram_notify_on_memo_status_change ON memos IS 'Automatically send Telegram notifications for memo status changes';
COMMENT ON TRIGGER telegram_notify_on_doc_receive_status_change ON doc_receive IS 'Automatically send Telegram notifications for doc_receive status changes';
COMMENT ON TRIGGER telegram_notify_on_memo_created ON memos IS 'Automatically send Telegram notifications to clerk when new memo is created';
COMMENT ON TRIGGER telegram_notify_on_doc_receive_created ON doc_receive IS 'Automatically send Telegram notifications to clerk when new doc_receive is created';

-- =====================================================
-- Done!
-- =====================================================
SELECT 'All triggers and functions have been recreated successfully!' as status;
