-- Update storage policies to use user_id based paths for secure file access

-- Update profile pictures bucket policies
DROP POLICY IF EXISTS "Users can upload their own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own profile picture" ON storage.objects;

CREATE POLICY "Users can upload their own profile picture" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'profile-pictures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own profile picture" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'profile-pictures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own profile picture" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'profile-pictures' 
  AND (auth.uid()::text = (storage.foldername(name))[1] OR bucket_id = 'profile-pictures')
);

-- Update signatures bucket policies
DROP POLICY IF EXISTS "Users can upload their own signature" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own signature" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own signature" ON storage.objects;

CREATE POLICY "Users can upload their own signature" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'signatures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own signature" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'signatures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own signature" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'signatures' 
  AND (auth.uid()::text = (storage.foldername(name))[1] OR bucket_id = 'signatures')
);

-- Update profiles table to ensure proper linking with Supabase Auth
-- Add trigger to automatically create profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  phone_number TEXT;
  existing_profile RECORD;
BEGIN
  -- Extract phone from user metadata
  phone_number := NEW.raw_user_meta_data ->> 'phone';
  
  IF phone_number IS NOT NULL THEN
    -- Normalize phone number
    phone_number := regexp_replace(phone_number, '^\+66', '0');
    phone_number := regexp_replace(phone_number, '[^0-9]', '', 'g');
    
    -- Check if profile exists with this phone
    SELECT * INTO existing_profile 
    FROM public.profiles 
    WHERE phone = phone_number;
    
    IF FOUND THEN
      -- Update existing profile with user_id
      UPDATE public.profiles 
      SET user_id = NEW.id, updated_at = now()
      WHERE phone = phone_number;
    ELSE
      -- Create new profile
      INSERT INTO public.profiles (
        user_id, 
        phone, 
        employee_id,
        first_name, 
        last_name, 
        position
      ) VALUES (
        NEW.id,
        phone_number,
        COALESCE(NEW.raw_user_meta_data ->> 'employee_id', 'EMP_' || substring(NEW.id::text, 1, 8)),
        COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
        COALESCE((NEW.raw_user_meta_data ->> 'position')::position_type, 'government_employee')
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new auth users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();