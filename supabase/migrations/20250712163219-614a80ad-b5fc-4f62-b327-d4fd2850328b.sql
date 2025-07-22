-- Fix RLS policy for memos table to allow users to create memos
-- First check current policies
DROP POLICY IF EXISTS "Users can create memos" ON public.memos;

-- Create new policy that allows authenticated users to create memos
CREATE POLICY "Users can create memos" 
ON public.memos 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  created_by = auth.uid()
);

-- Also ensure the storage bucket allows uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create storage policies for documents bucket
INSERT INTO storage.objects (bucket_id, name, owner, created_at, updated_at)
SELECT 'documents', '', null, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'documents' LIMIT 1);

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;

-- Create storage policies for documents
CREATE POLICY "Users can upload their own documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' AND 
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'documents' AND 
  (auth.uid() IS NOT NULL OR bucket_id IN (SELECT id FROM storage.buckets WHERE public = true))
);

CREATE POLICY "Users can update their own documents" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'documents' AND 
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);