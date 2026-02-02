-- Remove gender column from profiles table as it's redundant with prefix
ALTER TABLE profiles DROP COLUMN IF EXISTS gender;
