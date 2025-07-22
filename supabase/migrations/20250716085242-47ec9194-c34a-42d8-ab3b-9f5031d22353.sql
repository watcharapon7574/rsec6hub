-- ลบ policy ที่ซ้ำซ้อนและเขียนใหม่ให้ชัดเจน
DROP POLICY IF EXISTS "memo-docV1 flreew_0" ON storage.objects;
DROP POLICY IF EXISTS "memo-docV1 flreew_1" ON storage.objects;
DROP POLICY IF EXISTS "memo-docV1 flreew_2" ON storage.objects;
DROP POLICY IF EXISTS "memo-docV1 flreew_3" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- สร้าง policy ใหม่ที่ชัดเจนสำหรับ documents bucket
CREATE POLICY "Public read access for documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'documents');

CREATE POLICY "Authenticated upload for documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated update for documents" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'documents' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated delete for documents" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'documents' AND 
  auth.uid() IS NOT NULL
);