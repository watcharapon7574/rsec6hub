
-- Add missing columns to profiles table to match TypeScript interface
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20) CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
ADD COLUMN IF NOT EXISTS spouse VARCHAR(100),
ADD COLUMN IF NOT EXISTS number_of_children INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Update existing columns to match TypeScript interface requirements
ALTER TABLE public.profiles 
ALTER COLUMN employee_id SET NOT NULL,
ALTER COLUMN first_name SET NOT NULL,
ALTER COLUMN last_name SET NOT NULL,
ALTER COLUMN position SET NOT NULL;

-- Add indexes for better performance on commonly queried fields
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON public.profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_profiles_position ON public.profiles(position);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = TRUE;

-- Drop existing trigger if it exists and recreate it
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
