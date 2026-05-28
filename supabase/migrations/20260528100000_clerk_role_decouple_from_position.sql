-- =========================================================
-- Decouple "ธุรการ" role from position='clerk_teacher'
-- Now driven by profiles.is_clerk flag (anyone can be assigned)
-- =========================================================

-- 1) is_clerk_or_admin(): consult is_clerk flag instead of position
CREATE OR REPLACE FUNCTION public.is_clerk_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND (is_admin = true OR is_clerk = true)
  );
$$;

-- 2) create_task_assignment(): allow is_clerk users to assign tasks
CREATE OR REPLACE FUNCTION public.create_task_assignment(
  p_document_id uuid,
  p_document_type character varying,
  p_assigned_to uuid,
  p_note text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_assignment_id UUID;
  v_current_user UUID;
  v_is_report_memo BOOLEAN;
  v_existing_assignment UUID;
BEGIN
  v_current_user := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = v_current_user
      AND (is_clerk = true OR is_admin = true OR position = 'director')
  ) THEN
    RAISE EXCEPTION 'Only clerks, admins, or directors can create task assignments';
  END IF;

  IF p_document_type NOT IN ('memo', 'doc_receive') THEN
    RAISE EXCEPTION 'Invalid document type. Must be either "memo" or "doc_receive"';
  END IF;

  IF p_document_type = 'memo' THEN
    SELECT EXISTS (
      SELECT 1 FROM task_assignments ta
      WHERE ta.report_memo_id = p_document_id
        AND ta.deleted_at IS NULL
    ) INTO v_is_report_memo;

    IF v_is_report_memo THEN
      RAISE EXCEPTION 'ไม่สามารถมอบหมายงานให้กับบันทึกข้อความรายงานผลได้ (report memo)';
    END IF;
  END IF;

  IF p_document_type = 'memo' THEN
    SELECT id INTO v_existing_assignment
    FROM task_assignments
    WHERE memo_id = p_document_id
      AND assigned_to = p_assigned_to
      AND deleted_at IS NULL
    LIMIT 1;
  ELSIF p_document_type = 'doc_receive' THEN
    SELECT id INTO v_existing_assignment
    FROM task_assignments
    WHERE doc_receive_id = p_document_id
      AND assigned_to = p_assigned_to
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_existing_assignment IS NOT NULL THEN
    RAISE EXCEPTION 'ผู้ใช้คนนี้ได้รับมอบหมายงานในเอกสารนี้แล้ว';
  END IF;

  IF p_document_type = 'memo' THEN
    INSERT INTO task_assignments (memo_id, document_type, assigned_by, assigned_to, note, status)
    VALUES (p_document_id, p_document_type, v_current_user, p_assigned_to, p_note, 'pending')
    RETURNING id INTO v_assignment_id;

    UPDATE memos SET is_assigned = true WHERE id = p_document_id;
  ELSIF p_document_type = 'doc_receive' THEN
    INSERT INTO task_assignments (doc_receive_id, document_type, assigned_by, assigned_to, note, status)
    VALUES (p_document_id, p_document_type, v_current_user, p_assigned_to, p_note, 'pending')
    RETURNING id INTO v_assignment_id;

    UPDATE doc_receive SET is_assigned = true WHERE id = p_document_id;
  END IF;

  RETURN v_assignment_id;
END;
$function$;

-- 3) Notification triggers: target is_clerk users instead of clerk_teacher position
CREATE OR REPLACE FUNCTION public.notify_clerks_on_document_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  clerk_record RECORD;
  doc_type_text TEXT;
  is_report_memo BOOLEAN;
BEGIN
  IF NEW.current_signer_order = 5 AND
     (OLD.current_signer_order IS NULL OR OLD.current_signer_order != 5) AND
     (NEW.is_assigned IS NULL OR NEW.is_assigned = false) AND
     NEW.doc_del IS NULL THEN

    is_report_memo := FALSE;
    IF TG_TABLE_NAME = 'memos' THEN
      SELECT EXISTS (
        SELECT 1 FROM task_assignments ta
        WHERE ta.report_memo_id = NEW.id AND ta.deleted_at IS NULL
      ) INTO is_report_memo;
    END IF;

    IF is_report_memo THEN
      RAISE LOG '📋 Skipping notification for report memo: %', NEW.id;
      RETURN NEW;
    END IF;

    doc_type_text := CASE
      WHEN TG_TABLE_NAME = 'doc_receive' THEN 'หนังสือรับ'
      ELSE 'บันทึกข้อความ'
    END;

    FOR clerk_record IN
      SELECT user_id, telegram_chat_id, first_name, last_name
      FROM profiles
      WHERE is_clerk = true
        AND user_id IS NOT NULL
    LOOP
      BEGIN
        INSERT INTO notifications (
          user_id, title, message, type, reference_id, priority, action_url, read
        ) VALUES (
          clerk_record.user_id,
          '📋 เอกสารรอการมอบหมาย',
          doc_type_text || ' เรื่อง: ' || COALESCE(NEW.subject, 'ไม่ระบุเรื่อง') || ' พร้อมมอบหมายงานแล้ว',
          'document_ready_for_assignment',
          NEW.id, 'medium', '/documents', false
        );
      EXCEPTION
        WHEN undefined_table THEN
          RAISE LOG '⚠️  notifications table does not exist, skipping in-app notification';
        WHEN OTHERS THEN
          RAISE LOG '⚠️  Error creating in-app notification: %', SQLERRM;
      END;

      IF clerk_record.telegram_chat_id IS NOT NULL AND clerk_record.telegram_chat_id != '' THEN
        BEGIN
          PERFORM send_telegram_notification(
            jsonb_build_object(
              'type', 'document_completed_clerk',
              'document_id', NEW.id,
              'document_type', CASE WHEN TG_TABLE_NAME = 'doc_receive' THEN 'doc_receive' ELSE 'memo' END,
              'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
              'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
              'doc_number', COALESCE(NEW.doc_number, 'ยังไม่มีเลขที่'),
              'chat_id', clerk_record.telegram_chat_id
            )
          );
        EXCEPTION
          WHEN undefined_function THEN
            RAISE LOG '⚠️  send_telegram_notification function does not exist';
          WHEN OTHERS THEN
            RAISE LOG '⚠️  Error sending Telegram notification: %', SQLERRM;
        END;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.notify_telegram_on_memo_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
  clerk_record RECORD;
  rejection_comment text;
  rejector_name text;
  rejector_position text;
  additional_signer_count int := 0;
BEGIN
  is_doc_receive := (TG_TABLE_NAME = 'doc_receive');

  IF NEW.doc_del IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.telegram_chat_id INTO author_chat_id
  FROM profiles p
  WHERE p.user_id = NEW.user_id;

  IF NEW.status = 'draft' AND OLD.status = 'rejected' THEN
    FOR clerk_record IN
      SELECT profiles.user_id, telegram_chat_id, first_name, last_name
      FROM profiles
      WHERE is_clerk = true
        AND telegram_chat_id IS NOT NULL
        AND telegram_chat_id != ''
    LOOP
      payload := jsonb_build_object(
        'type', 'document_created',
        'document_id', NEW.id,
        'document_type', CASE WHEN is_doc_receive THEN 'doc_receive' ELSE 'memo' END,
        'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
        'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
        'chat_id', clerk_record.telegram_chat_id
      );

      PERFORM send_telegram_notification(payload);
    END LOOP;
  END IF;

  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    IF NEW.rejected_name_comment IS NOT NULL THEN
      BEGIN
        rejection_comment := NEW.rejected_name_comment::jsonb->>'comment';
        rejector_name := NEW.rejected_name_comment::jsonb->>'name';
        rejector_position := NEW.rejected_name_comment::jsonb->>'position';
      EXCEPTION WHEN OTHERS THEN
        rejection_comment := 'ไม่ระบุเหตุผล';
        rejector_name := NULL;
        rejector_position := NULL;
      END;
    ELSE
      rejection_comment := 'ไม่ระบุเหตุผล';
      rejector_name := NULL;
      rejector_position := NULL;
    END IF;

    IF author_chat_id IS NOT NULL AND author_chat_id != '' THEN
      payload := jsonb_build_object(
        'type', 'document_rejected',
        'document_id', NEW.id,
        'document_type', CASE WHEN is_doc_receive THEN 'doc_receive' ELSE 'memo' END,
        'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
        'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
        'reject_reason', COALESCE(rejection_comment, 'ไม่ระบุเหตุผล'),
        'rejector_name', COALESCE(rejector_name, 'ไม่ทราบชื่อ'),
        'rejector_position', COALESCE(rejector_position, ''),
        'chat_id', author_chat_id
      );

      PERFORM send_telegram_notification(payload);
    END IF;
  END IF;

  IF NEW.status = 'pending_sign' AND (OLD.status IS NULL OR OLD.status != 'pending_sign' OR OLD.current_signer_order != NEW.current_signer_order) THEN
    IF NEW.signature_positions IS NOT NULL THEN
      current_signer_order_actual := NEW.current_signer_order;

      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW.signature_positions) AS sp
        WHERE (sp->'signer'->>'order')::int = NEW.current_signer_order
      ) THEN
        SELECT MIN((sp->'signer'->>'order')::int) INTO current_signer_order_actual
        FROM jsonb_array_elements(NEW.signature_positions) AS sp
        WHERE (sp->'signer'->>'order')::int >= NEW.current_signer_order;
      END IF;

      IF current_signer_order_actual IS NOT NULL THEN
        found_signer := false;

        SELECT COUNT(DISTINCT sp->'signer'->>'user_id') INTO additional_signer_count
        FROM jsonb_array_elements(NEW.signature_positions) AS sp
        WHERE (sp->'signer'->>'order')::int = current_signer_order_actual;

        additional_signer_count := GREATEST(additional_signer_count - 1, 0);

        FOR sig_pos IN SELECT * FROM jsonb_array_elements(NEW.signature_positions)
        LOOP
          IF (sig_pos->'signer'->>'order')::int = current_signer_order_actual AND NOT found_signer THEN
            current_signer_user_id := sig_pos->'signer'->>'user_id';
            current_signer_name := sig_pos->'signer'->>'name';
            found_signer := true;
            EXIT;
          END IF;
        END LOOP;

        IF found_signer AND current_signer_user_id IS NOT NULL THEN
          SELECT p.telegram_chat_id INTO current_signer_chat_id
          FROM profiles p
          WHERE p.user_id::text = current_signer_user_id;

          IF current_signer_chat_id IS NOT NULL AND current_signer_chat_id != '' THEN
            payload := jsonb_build_object(
              'type', 'document_pending',
              'document_id', NEW.id,
              'document_type', CASE WHEN is_doc_receive THEN 'doc_receive' ELSE 'memo' END,
              'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
              'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
              'current_signer_name', COALESCE(current_signer_name, 'ไม่ระบุชื่อ'),
              'current_signer_order', current_signer_order_actual,
              'additional_signers', additional_signer_count,
              'chat_id', current_signer_chat_id
            );

            PERFORM send_telegram_notification(payload);
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

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

      PERFORM send_telegram_notification(payload);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) RLS policies — replace position='clerk_teacher' with is_clerk_or_admin()

DROP POLICY IF EXISTS "Clerks can create task assignments" ON public.task_assignments;
CREATE POLICY "Clerks can create task assignments"
  ON public.task_assignments
  FOR INSERT
  WITH CHECK (public.is_clerk_or_admin() AND assigned_by = auth.uid());

DROP POLICY IF EXISTS "Clerks can view all task assignments" ON public.task_assignments;
CREATE POLICY "Clerks can view all task assignments"
  ON public.task_assignments
  FOR SELECT
  USING (public.is_clerk_or_admin());

DROP POLICY IF EXISTS "Admin and clerks can manage register extra" ON public.document_register_extra;
CREATE POLICY "Admin and clerks can manage register extra"
  ON public.document_register_extra
  FOR ALL
  USING (public.is_clerk_or_admin())
  WITH CHECK (public.is_clerk_or_admin());

DROP POLICY IF EXISTS "Admin and clerks can manage register manual" ON public.document_register_manual;
CREATE POLICY "Admin and clerks can manage register manual"
  ON public.document_register_manual
  FOR ALL
  USING (public.is_clerk_or_admin())
  WITH CHECK (public.is_clerk_or_admin());

DROP POLICY IF EXISTS "Staff and signers can update memos" ON public.memos;
CREATE POLICY "Staff and signers can update memos"
  ON public.memos
  FOR UPDATE
  USING (
    public.is_clerk_or_admin()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles."position" = ANY (ARRAY[
          'assistant_director'::position_type,
          'deputy_director'::position_type,
          'director'::position_type,
          'government_employee'::position_type
        ])
    )
    OR (user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(memos.signer_list_progress) signer(value)
      WHERE ((signer.value ->> 'userId'::text))::uuid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can delete memos" ON public.memos;
CREATE POLICY "Staff can delete memos"
  ON public.memos
  FOR DELETE
  USING (
    public.is_clerk_or_admin()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles."position" = 'director'::position_type
    )
  );

DROP POLICY IF EXISTS "Creators and clerks can update doc_receive" ON public.doc_receive;
CREATE POLICY "Creators and clerks can update doc_receive"
  ON public.doc_receive
  FOR UPDATE
  USING (
    (created_by = auth.uid())
    OR (user_id = auth.uid())
    OR public.is_clerk_or_admin()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles."position" = 'government_employee'::position_type
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(doc_receive.signature_positions) pos(value)
      WHERE ((((pos.value -> 'signer'::text) ->> 'user_id'::text))::uuid = auth.uid())
    )
  );
