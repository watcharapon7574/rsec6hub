-- อัปเดต RLS policies สำหรับ documents bucket ให้เข้าถึงได้ง่ายขึ้น
-- ลบ policies เก่าที่อาจจะจำกัดเกินไป
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;

-- สร้าง policies ใหม่ที่อนุญาตให้เข้าถึงได้ทุกไฟล์ใน documents bucket
CREATE POLICY "Anyone can view documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can upload documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can update documents" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'documents' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can delete documents" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'documents' AND 
  auth.uid() IS NOT NULL
);

-- ตรวจสอบว่า documents bucket เป็น public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'documents';