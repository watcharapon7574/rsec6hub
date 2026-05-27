-- Manual leave entry: capture the actual director's user_id on the step-2
-- signature instead of conflating it with the HR head's auth.uid.
-- Reason: future reports / audit that filter by signer_user_id would otherwise
-- attribute paper-backlog approvals to the HR head, not the director.

BEGIN;

-- Drop the old signature so the new one with extra params doesn't overload
DROP FUNCTION IF EXISTS public.register_manual_leave_entry(
  TEXT, TEXT, public.leave_type, DATE, DATE, INTEGER, INTEGER, SMALLINT,
  TEXT, TEXT, TEXT, TEXT
);

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
  p_director_user_id UUID,
  p_director_signer_name TEXT,
  p_remarks TEXT DEFAULT NULL,
  p_hr_signer_name TEXT DEFAULT NULL
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

  IF p_director_user_id IS NULL THEN
    RAISE EXCEPTION 'director_user_id is required';
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

  -- Step 2: Director signature with the real director's user_id
  INSERT INTO public.leave_signatures (
    leave_request_id, signer_order, signer_user_id, signer_name,
    signer_role, status, comment
  ) VALUES (
    v_req.id, 2, p_director_user_id, p_director_signer_name,
    'director', 'approved', 'ลงทะเบียนจากใบลากระดาษ'
  );

  SELECT * INTO v_req FROM public.leave_requests WHERE id = v_req.id;
  RETURN v_req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_manual_leave_entry(
  TEXT, TEXT, public.leave_type, DATE, DATE, INTEGER, INTEGER, SMALLINT,
  TEXT, UUID, TEXT, TEXT, TEXT
) TO authenticated;

COMMIT;
