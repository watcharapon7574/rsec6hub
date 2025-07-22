-- Create storage policies for profile-pictures bucket
CREATE POLICY "Anyone can view profile pictures" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'profile-pictures');

CREATE POLICY "Users can upload their own profile pictures" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'profile-pictures');

CREATE POLICY "Users can update their own profile pictures" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'profile-pictures');

CREATE POLICY "Users can delete their own profile pictures" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'profile-pictures');

-- Create storage policies for signatures bucket
CREATE POLICY "Anyone can view signatures" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'signatures');

CREATE POLICY "Users can upload their own signatures" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'signatures');

CREATE POLICY "Users can update their own signatures" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'signatures');

CREATE POLICY "Users can delete their own signatures" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'signatures');