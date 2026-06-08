-- ── ให้เจ้าของใบลาแนบเอกสารเพิ่มได้หลังยื่น (เช่น ลาป่วยแล้วตามใบรับรองแพทย์มาทีหลัง) ──
--
-- ทำไมต้องใช้ RPC แทนการเปิด RLS UPDATE:
--   policy "user_update_own_pending_leave" เปิดเฉพาะ status='pending' และเป็น UPDATE
--   ระดับแถว (column-blind) — ถ้าขยายให้ครอบ 'approved' ด้วย เจ้าของจะแก้ reason/
--   start_date/status ของใบที่อนุมัติแล้วได้ด้วย ซึ่งไม่ปลอดภัย
--   จึงใช้ SECURITY DEFINER RPC ที่ append เฉพาะ form_data.attachments เท่านั้น
--
-- หมายเหตุ: storage policy "user_upload_own_leave_attachments" อนุญาตให้ผู้ใช้
--   อัปโหลดไฟล์เข้าโฟลเดอร์ {auth.uid}/... ได้อยู่แล้วไม่ว่าใบลาจะสถานะใด — ฝั่ง
--   client จึง upload ไฟล์ตรงได้ แล้วเรียก RPC นี้เพื่อผูก metadata เข้าใบลา

CREATE OR REPLACE FUNCTION public.add_leave_attachment(
  p_leave_id UUID,
  p_path TEXT,
  p_name TEXT
)
RETURNS public.leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.leave_requests;
  v_entry JSONB;
BEGIN
  SELECT * INTO v_req FROM public.leave_requests WHERE id = p_leave_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  -- เฉพาะเจ้าของใบลาเท่านั้น
  IF v_req.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- ใบที่ถูกปฏิเสธแล้ว ไม่ให้แนบเพิ่ม (pending / in_progress / approved แนบได้)
  IF v_req.status = 'rejected' THEN
    RAISE EXCEPTION 'Cannot attach to a rejected request';
  END IF;

  -- กันแนบ path ของคนอื่น — โฟลเดอร์แรกต้องเป็น auth.uid ของผู้เรียก
  IF split_part(p_path, '/', 1) <> auth.uid()::text THEN
    RAISE EXCEPTION 'Attachment path does not belong to caller';
  END IF;

  v_entry := jsonb_build_object(
    'path', p_path,
    'name', p_name,
    'uploaded_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  UPDATE public.leave_requests
  SET
    form_data = jsonb_set(
      COALESCE(form_data, '{}'::jsonb),
      '{attachments}',
      COALESCE(form_data -> 'attachments', '[]'::jsonb) || v_entry,
      true
    ),
    updated_at = now()
  WHERE id = p_leave_id
  RETURNING * INTO v_req;

  RETURN v_req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_leave_attachment(UUID, TEXT, TEXT) TO authenticated;
