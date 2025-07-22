
-- Create storage bucket for profile pictures only (signatures bucket already exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('profile-pictures', 'profile-pictures', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

-- Create RLS policies for profile pictures bucket
CREATE POLICY "Anyone can view profile pictures" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-pictures');

CREATE POLICY "Authenticated users can upload profile pictures" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'profile-pictures' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own profile pictures" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'profile-pictures' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own profile pictures" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'profile-pictures' AND 
    auth.role() = 'authenticated'
  );

-- Create RLS policies for existing signatures bucket
CREATE POLICY "Anyone can view signatures" ON storage.objects
  FOR SELECT USING (bucket_id = 'signatures');

CREATE POLICY "Authenticated users can upload signatures" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'signatures' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own signatures" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'signatures' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own signatures" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'signatures' AND 
    auth.role() = 'authenticated'
  );
