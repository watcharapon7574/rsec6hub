-- Drop existing restrictive policies and create more permissive ones
DROP POLICY IF EXISTS "Users can upload their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own signatures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own signatures" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own signatures" ON storage.objects;

-- Create more permissive policies for profile pictures
CREATE POLICY "Allow profile picture uploads" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'profile-pictures');

CREATE POLICY "Allow profile picture updates" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'profile-pictures');

CREATE POLICY "Allow profile picture deletions" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'profile-pictures');

-- Create more permissive policies for signatures
CREATE POLICY "Allow signature uploads" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'signatures');

CREATE POLICY "Allow signature updates" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'signatures');

CREATE POLICY "Allow signature deletions" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'signatures');