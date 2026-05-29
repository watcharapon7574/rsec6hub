-- ผู้ลงนามขั้น รอง ผอ. (deputy_director) ต้องเปิดดูเอกสารแนบใบลาได้ด้วย
-- เดิม policy อนุญาตเฉพาะ owner / hr_head / director → deputy เปิดไม่ได้
DROP POLICY IF EXISTS "user_read_own_leave_attachments" ON storage.objects;
CREATE POLICY "user_read_own_leave_attachments" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'leave-attachments'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_leave_hr_head(auth.uid())
      OR public.is_leave_deputy_director(auth.uid())
      OR public.is_leave_director(auth.uid())
    )
  );
