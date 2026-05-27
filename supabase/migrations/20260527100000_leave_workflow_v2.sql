-- Leave workflow v2 — multi-step approval + paper-form parity
-- - Drops the old single-step leave_requests (empty per stakeholder)
-- - 10 leave types per ระเบียบสำนักนายกฯ พ.ศ. 2555
-- - 2-step approval (HR head → Director) with separate signatures table
-- - Doc number auto-assigned at HR head sign (continuous 5-digit sequence)
-- - Storage bucket leave-attachments with per-user folder RLS
-- - SECURITY DEFINER RPCs (approve_leave_request / reject_leave_request) keep
--   sig insert + status update atomic and gate by role

BEGIN;

-- ─── Drop old single-step table + enum ───
DROP TABLE IF EXISTS public.leave_requests CASCADE;
DROP TYPE IF EXISTS public.leave_type;

-- ─── Enums ───
CREATE TYPE public.leave_type AS ENUM (
  'sick_leave',
  'personal_leave',
  'annual_leave',
  'maternity_leave',
  'paternity_leave',
  'ordination_leave',
  'military_leave',
  'study_leave',
  'spouse_follow_leave',
  'rehabilitation_leave'
);

CREATE TYPE public.leave_status AS ENUM (
  'draft', 'pending', 'in_progress', 'approved', 'rejected'
);

CREATE TYPE public.leave_signer_role AS ENUM ('hr_head', 'director');

CREATE TYPE public.leave_hr_decision AS ENUM (
  'acknowledge', 'consider', 'recommend_approve'
);

CREATE TYPE public.leave_entry_source AS ENUM ('system', 'manual');

-- ─── Doc number sequence (continuous 5-digit) ───
CREATE SEQUENCE IF NOT EXISTS public.leave_doc_number_seq START 1 INCREMENT 1;

-- ─── leave_requests ───
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_number TEXT UNIQUE,
  doc_number_at TIMESTAMPTZ,
  entry_source public.leave_entry_source NOT NULL DEFAULT 'system',
  leave_type public.leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL CHECK (days_count > 0),
  reason TEXT NOT NULL,
  status public.leave_status NOT NULL DEFAULT 'pending',
  fiscal_year INTEGER NOT NULL,
  fiscal_half SMALLINT NOT NULL CHECK (fiscal_half IN (1, 2)),
  current_signer_order SMALLINT NOT NULL DEFAULT 1
    CHECK (current_signer_order IN (1, 2)),
  form_data JSONB,
  rejection_reason TEXT,
  user_name TEXT,
  user_position TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX leave_requests_user_id_idx ON public.leave_requests(user_id);
CREATE INDEX leave_requests_status_signer_idx
  ON public.leave_requests(status, current_signer_order);
CREATE INDEX leave_requests_fiscal_year_idx ON public.leave_requests(fiscal_year);
CREATE INDEX leave_requests_dates_idx ON public.leave_requests(start_date, end_date);

-- ─── leave_signatures ───
CREATE TABLE public.leave_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID NOT NULL
    REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  signer_order SMALLINT NOT NULL CHECK (signer_order IN (1, 2)),
  signer_user_id UUID NOT NULL REFERENCES auth.users(id),
  signer_name TEXT NOT NULL,
  signer_role public.leave_signer_role NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature_url TEXT,
  comment TEXT,
  hr_decision public.leave_hr_decision,
  UNIQUE (leave_request_id, signer_order)
);

CREATE INDEX leave_signatures_request_idx
  ON public.leave_signatures(leave_request_id);

-- ─── updated_at trigger (reuses existing helper) ───
CREATE TRIGGER set_updated_at_leave_requests
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Auto-assign doc_number on HR head approval ───
-- Fires when signer_order=1 + status='approved'. Idempotent (skips if already set)
-- so re-signs / re-applies don't burn sequence numbers.
CREATE OR REPLACE FUNCTION public.assign_leave_doc_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.signer_order = 1 AND NEW.status = 'approved' THEN
    UPDATE public.leave_requests
    SET
      doc_number = LPAD(nextval('public.leave_doc_number_seq')::text, 5, '0'),
      doc_number_at = NOW()
    WHERE id = NEW.leave_request_id AND doc_number IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_assign_leave_doc_number
  AFTER INSERT ON public.leave_signatures
  FOR EACH ROW EXECUTE FUNCTION public.assign_leave_doc_number();

-- ─── Role helpers (mirror frontend canHrHead / canDirector) ───
CREATE OR REPLACE FUNCTION public.is_leave_hr_head(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id
      AND (is_admin = TRUE OR org_structure_role ~ 'บุคคล')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_leave_director(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id
      AND (is_admin = TRUE OR position = 'director')
  );
$$;

-- ─── RLS: leave_requests ───
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_read_own_leave"
  ON public.leave_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "hr_head_read_all_leave"
  ON public.leave_requests FOR SELECT
  USING (public.is_leave_hr_head(auth.uid()));

CREATE POLICY "director_read_all_leave"
  ON public.leave_requests FOR SELECT
  USING (public.is_leave_director(auth.uid()));

CREATE POLICY "user_insert_own_leave"
  ON public.leave_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND entry_source = 'system');

-- HR head can register paper-backlog entries for any user
CREATE POLICY "hr_head_insert_manual_leave"
  ON public.leave_requests FOR INSERT
  WITH CHECK (
    public.is_leave_hr_head(auth.uid())
    AND entry_source = 'manual'
  );

-- self can edit while still pending HR (e.g. fix typos, add attachment)
CREATE POLICY "user_update_own_pending_leave"
  ON public.leave_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

-- approvers update via RPC (SECURITY DEFINER) — these policies cover the
-- write inside the function once it's running as the caller
CREATE POLICY "hr_head_update_leave"
  ON public.leave_requests FOR UPDATE
  USING (public.is_leave_hr_head(auth.uid()));

CREATE POLICY "director_update_leave"
  ON public.leave_requests FOR UPDATE
  USING (public.is_leave_director(auth.uid()));

-- ─── RLS: leave_signatures ───
ALTER TABLE public.leave_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_signatures_if_can_read_request"
  ON public.leave_signatures FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leave_requests r
      WHERE r.id = leave_request_id
        AND (
          r.user_id = auth.uid()
          OR public.is_leave_hr_head(auth.uid())
          OR public.is_leave_director(auth.uid())
        )
    )
  );

CREATE POLICY "hr_head_insert_step1_signature"
  ON public.leave_signatures FOR INSERT
  WITH CHECK (
    signer_order = 1
    AND signer_role = 'hr_head'
    AND signer_user_id = auth.uid()
    AND public.is_leave_hr_head(auth.uid())
  );

CREATE POLICY "director_insert_step2_signature"
  ON public.leave_signatures FOR INSERT
  WITH CHECK (
    signer_order = 2
    AND signer_role = 'director'
    AND signer_user_id = auth.uid()
    AND public.is_leave_director(auth.uid())
  );

-- ─── Atomic approve/reject RPCs (recommended path; clients should not
--     INSERT signatures + UPDATE status as separate ops — race risk) ───
CREATE OR REPLACE FUNCTION public.approve_leave_request(
  p_leave_id UUID,
  p_signer_name TEXT,
  p_signer_role public.leave_signer_role,
  p_comment TEXT DEFAULT NULL,
  p_hr_decision public.leave_hr_decision DEFAULT NULL,
  p_signature_url TEXT DEFAULT NULL
)
RETURNS public.leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order SMALLINT;
  v_req public.leave_requests;
BEGIN
  v_order := CASE p_signer_role WHEN 'hr_head' THEN 1 ELSE 2 END;

  IF p_signer_role = 'hr_head' AND NOT public.is_leave_hr_head(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized as HR head';
  ELSIF p_signer_role = 'director' AND NOT public.is_leave_director(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized as director';
  END IF;

  SELECT * INTO v_req FROM public.leave_requests WHERE id = p_leave_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;
  IF v_req.current_signer_order <> v_order THEN
    RAISE EXCEPTION 'Request not at this signer order (expected %, got %)',
      v_req.current_signer_order, v_order;
  END IF;

  INSERT INTO public.leave_signatures (
    leave_request_id, signer_order, signer_user_id, signer_name,
    signer_role, status, signature_url, comment, hr_decision
  ) VALUES (
    p_leave_id, v_order, auth.uid(), p_signer_name,
    p_signer_role, 'approved', p_signature_url, p_comment,
    CASE WHEN p_signer_role = 'hr_head' THEN p_hr_decision ELSE NULL END
  );

  UPDATE public.leave_requests
  SET
    status = CASE
      WHEN v_order = 1 THEN 'in_progress'::public.leave_status
      ELSE 'approved'::public.leave_status
    END,
    current_signer_order = 2
  WHERE id = p_leave_id
  RETURNING * INTO v_req;

  RETURN v_req;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_leave_request(
  p_leave_id UUID,
  p_signer_name TEXT,
  p_signer_role public.leave_signer_role,
  p_reason TEXT,
  p_signature_url TEXT DEFAULT NULL
)
RETURNS public.leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order SMALLINT;
  v_req public.leave_requests;
BEGIN
  v_order := CASE p_signer_role WHEN 'hr_head' THEN 1 ELSE 2 END;

  IF p_signer_role = 'hr_head' AND NOT public.is_leave_hr_head(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized as HR head';
  ELSIF p_signer_role = 'director' AND NOT public.is_leave_director(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized as director';
  END IF;

  SELECT * INTO v_req FROM public.leave_requests WHERE id = p_leave_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;
  IF v_req.current_signer_order <> v_order THEN
    RAISE EXCEPTION 'Request not at this signer order';
  END IF;

  INSERT INTO public.leave_signatures (
    leave_request_id, signer_order, signer_user_id, signer_name,
    signer_role, status, signature_url, comment
  ) VALUES (
    p_leave_id, v_order, auth.uid(), p_signer_name,
    p_signer_role, 'rejected', p_signature_url, p_reason
  );

  UPDATE public.leave_requests
  SET status = 'rejected'::public.leave_status,
      rejection_reason = p_reason
  WHERE id = p_leave_id
  RETURNING * INTO v_req;

  RETURN v_req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_leave_request(
  UUID, TEXT, public.leave_signer_role, TEXT, public.leave_hr_decision, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_leave_request(
  UUID, TEXT, public.leave_signer_role, TEXT, TEXT
) TO authenticated;

-- HR head registers a paper-backlog leave entry (already signed on paper).
-- Inserts the request + both signatures + sets status='approved' atomically.
-- Doc number assigned by the existing trigger when the step-1 signature lands.
CREATE OR REPLACE FUNCTION public.register_manual_leave_entry(
  p_user_name TEXT,
  p_user_position TEXT,
  p_leave_type public.leave_type,
  p_start_date DATE,
  p_end_date DATE,
  p_days_count INTEGER,
  p_fiscal_year INTEGER,
  p_fiscal_half SMALLINT,
  p_reason TEXT,
  p_remarks TEXT DEFAULT NULL,
  p_hr_signer_name TEXT DEFAULT NULL,
  p_director_signer_name TEXT DEFAULT 'ลงนามกระดาษ'
)
RETURNS public.leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_req public.leave_requests;
  v_hr_name TEXT;
BEGIN
  v_caller := auth.uid();
  IF NOT public.is_leave_hr_head(v_caller) THEN
    RAISE EXCEPTION 'Only HR head may register manual entries';
  END IF;

  v_hr_name := COALESCE(p_hr_signer_name,
    (SELECT (first_name || ' ' || last_name) FROM public.profiles WHERE user_id = v_caller LIMIT 1),
    'หน.บุคคล');

  INSERT INTO public.leave_requests (
    user_id, entry_source, leave_type,
    start_date, end_date, days_count, reason,
    status, fiscal_year, fiscal_half, current_signer_order,
    form_data, user_name, user_position
  ) VALUES (
    v_caller, 'manual', p_leave_type,
    p_start_date, p_end_date, p_days_count, p_reason,
    'approved', p_fiscal_year, p_fiscal_half, 2,
    CASE WHEN p_remarks IS NOT NULL THEN jsonb_build_object('notes', p_remarks) ELSE NULL END,
    p_user_name, p_user_position
  )
  RETURNING * INTO v_req;

  -- Step 1: HR head signature — triggers doc_number assignment
  INSERT INTO public.leave_signatures (
    leave_request_id, signer_order, signer_user_id, signer_name,
    signer_role, status, comment, hr_decision
  ) VALUES (
    v_req.id, 1, v_caller, v_hr_name,
    'hr_head', 'approved', 'ลงทะเบียนจากใบลากระดาษ', 'recommend_approve'
  );

  -- Step 2: Director signature (placeholder — already signed on paper)
  INSERT INTO public.leave_signatures (
    leave_request_id, signer_order, signer_user_id, signer_name,
    signer_role, status, comment
  ) VALUES (
    v_req.id, 2, v_caller, p_director_signer_name,
    'director', 'approved', 'ลงทะเบียนจากใบลากระดาษ'
  );

  -- Re-read to pick up doc_number set by the step-1 trigger
  SELECT * INTO v_req FROM public.leave_requests WHERE id = v_req.id;
  RETURN v_req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_manual_leave_entry(
  TEXT, TEXT, public.leave_type, DATE, DATE, INTEGER, INTEGER, SMALLINT,
  TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- Peek next doc number without burning a sequence value.
CREATE OR REPLACE FUNCTION public.peek_leave_doc_number()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT LPAD((last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::text, 5, '0')
  FROM public.leave_doc_number_seq;
$$;

GRANT EXECUTE ON FUNCTION public.peek_leave_doc_number() TO authenticated;

-- ─── Storage bucket for attachments ───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'leave-attachments',
  'leave-attachments',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {auth.uid}/{leave_id}/{filename}
CREATE POLICY "user_read_own_leave_attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'leave-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_leave_hr_head(auth.uid())
      OR public.is_leave_director(auth.uid())
    )
  );

CREATE POLICY "user_upload_own_leave_attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'leave-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "user_delete_own_leave_attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'leave-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
