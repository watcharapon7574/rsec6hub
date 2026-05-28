-- =========================================================
-- Make notify_telegram_on_memo_created deterministic:
-- ORDER BY user_id so the chosen clerk is stable across runs
-- now that multiple is_clerk users may exist.
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_telegram_on_memo_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  payload JSONB;
  clerk_chat_id text;
  clerk_name text;
  is_doc_receive boolean;
BEGIN
  is_doc_receive := (TG_TABLE_NAME = 'doc_receive');

  IF NEW.doc_del IS NOT NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT telegram_chat_id, first_name || ' ' || last_name
    INTO clerk_chat_id, clerk_name
    FROM profiles
    WHERE is_clerk = true
      AND telegram_chat_id IS NOT NULL
      AND telegram_chat_id != ''
    ORDER BY user_id ASC
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE LOG '⚠️  profiles table does not exist, skipping notification';
      RETURN NEW;
    WHEN undefined_column THEN
      RAISE LOG '⚠️  telegram_chat_id or is_clerk column does not exist in profiles';
      RETURN NEW;
  END;

  IF clerk_chat_id IS NOT NULL AND clerk_chat_id != '' THEN
    payload := jsonb_build_object(
      'type', 'document_created',
      'document_id', NEW.id,
      'document_type', CASE WHEN is_doc_receive THEN 'doc_receive' ELSE 'memo' END,
      'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
      'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
      'chat_id', clerk_chat_id
    );

    PERFORM send_telegram_notification(payload);
  END IF;

  RETURN NEW;
END;
$function$;
