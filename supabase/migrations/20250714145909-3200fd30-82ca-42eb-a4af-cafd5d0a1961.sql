-- แก้ไข RLS policy สำหรับ memos table
DROP POLICY IF EXISTS "Users can create memos" ON public.memos;

-- สร้าง policy ใหม่ที่ใช้ได้
CREATE POLICY "Users can create memos" 
ON public.memos 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  created_by = auth.uid()
);