-- Mini App ลงนามใบลา: ตาราง 🔔 แจ้งเจ้าของใบลา + trigger ยิง edge fn leave-sign-notify
-- เมื่อใบลาขยับคิวผู้ลงนาม (advanced) หรือผลออก (approved/rejected)

-- ─── 1. ตาราง in-app notification เฉพาะใบลา ───
CREATE TABLE IF NOT EXISTS public.leave_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type varchar NOT NULL,            -- leave_approved | leave_rejected
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_notifications_user_unread
  ON public.leave_notifications (user_id, is_read, created_at DESC);

ALTER TABLE public.leave_notifications ENABLE ROW LEVEL SECURITY;

-- เจ้าของเท่านั้นที่อ่าน/มาร์คอ่านได้; INSERT ทำผ่าน service role (edge fn) → bypass RLS
DROP POLICY IF EXISTS "leave_notifications_select_own" ON public.leave_notifications;
CREATE POLICY "leave_notifications_select_own" ON public.leave_notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "leave_notifications_update_own" ON public.leave_notifications;
CREATE POLICY "leave_notifications_update_own" ON public.leave_notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── 2. trigger function: ยิง edge fn ผ่าน pg_net (async, ไม่ block RPC) ───
-- gate ด้วย public.cron_auth_token() (X-Cron-Auth); fn deploy แบบ --no-verify-jwt
-- จึงไม่ต้องส่ง Authorization bearer (เลี่ยง hardcode anon JWT)
CREATE OR REPLACE FUNCTION public.notify_leave_signer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event text;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- ยื่นใบลาใหม่ที่เข้าคิวทันที (pending = รอ หน.บุคคล)
    IF NEW.status = 'pending' THEN v_event := 'advanced'; ELSE v_event := NULL; END IF;
  ELSE  -- UPDATE
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
    body := jsonb_build_object('leave_id', NEW.id, 'event', v_event),
    timeout_milliseconds := 12000  -- เผื่อ Telegram timeout 8s + overhead (default pg_net 5s สั้นไป)
  );

  RETURN NEW;
END;
$$;

-- ─── 3. trigger (INSERT เสมอ; UPDATE เฉพาะเมื่อ status/current_signer_order เปลี่ยน) ───
DROP TRIGGER IF EXISTS trg_notify_leave_signer ON public.leave_requests;
CREATE TRIGGER trg_notify_leave_signer
AFTER INSERT OR UPDATE OF status, current_signer_order ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_leave_signer();
