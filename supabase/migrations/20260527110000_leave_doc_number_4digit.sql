-- Switch leave doc_number padding from 5 digits to 4 digits per spec.
-- User originally specified "เลข 4 หลักล้วน" — v2 migration accidentally
-- shipped with LPAD(..., 5, '0'). Sequence values are unaffected; only the
-- display padding of newly assigned doc_numbers changes.
--
-- Existing 5-digit doc_numbers (if any) remain as-is — backfill is intentional
-- no-op since each request keeps its assigned identifier for audit purposes.

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
      doc_number = LPAD(nextval('public.leave_doc_number_seq')::text, 4, '0'),
      doc_number_at = NOW()
    WHERE id = NEW.leave_request_id AND doc_number IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.peek_leave_doc_number()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT LPAD((last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::text, 4, '0')
  FROM public.leave_doc_number_seq;
$$;
