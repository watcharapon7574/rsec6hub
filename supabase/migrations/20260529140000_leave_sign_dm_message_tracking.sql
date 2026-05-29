-- เก็บ message_id ของ DM ที่ส่งหาผู้ลงนามแต่ละขั้น เพื่อ "ลบปุ่ม" ทีหลังเมื่อเซ็นแล้ว
CREATE TABLE IF NOT EXISTS public.leave_sign_messages (
  leave_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  signer_order smallint NOT NULL,
  chat_id text NOT NULL,
  message_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (leave_id, signer_order)
);
ALTER TABLE public.leave_sign_messages ENABLE ROW LEVEL SECURITY;

-- trigger ส่ง prev_order (ขั้นที่เพิ่งเซ็น/ปฏิเสธ) เพิ่ม เพื่อให้ fn ไปลบปุ่มของ DM ขั้นนั้น
CREATE OR REPLACE FUNCTION public.notify_leave_signer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event text;
  v_prev_order smallint;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_prev_order := NULL;
    IF NEW.status = 'pending' THEN v_event := 'advanced'; ELSE v_event := NULL; END IF;
  ELSE
    v_prev_order := OLD.current_signer_order;
    IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
      v_event := 'approved';
    ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
      v_event := 'rejected';
    ELSIF NEW.current_signer_order IS DISTINCT FROM OLD.current_signer_order
          AND NEW.status IN ('pending', 'in_progress') THEN
      v_event := 'advanced';
    ELSE
      v_event := NULL;
    END IF;
  END IF;

  IF v_event IS NULL THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := 'https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/leave-sign-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Auth', public.cron_auth_token()
    ),
    body := jsonb_build_object('leave_id', NEW.id, 'event', v_event, 'prev_order', v_prev_order),
    timeout_milliseconds := 12000
  );

  RETURN NEW;
END;
$$;
