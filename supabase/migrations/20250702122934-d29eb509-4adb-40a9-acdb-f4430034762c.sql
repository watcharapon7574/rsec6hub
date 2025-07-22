
-- Add telegram_chat_id to profiles table
ALTER TABLE public.profiles 
ADD COLUMN telegram_chat_id bigint;

-- Create table for OTP management
CREATE TABLE public.otp_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone varchar NOT NULL,
  otp_code varchar(6) NOT NULL,
  telegram_chat_id bigint,
  expires_at timestamp with time zone NOT NULL,
  is_used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  attempts integer DEFAULT 0
);

-- Add RLS policies for otp_codes table
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Policy to allow reading OTP codes for verification
CREATE POLICY "Allow OTP verification" ON public.otp_codes 
FOR SELECT USING (true);

-- Policy to allow inserting OTP codes
CREATE POLICY "Allow OTP creation" ON public.otp_codes 
FOR INSERT WITH CHECK (true);

-- Policy to allow updating OTP codes (for marking as used)
CREATE POLICY "Allow OTP updates" ON public.otp_codes 
FOR UPDATE USING (true);

-- Create index for better performance
CREATE INDEX idx_otp_codes_phone_expires ON public.otp_codes(phone, expires_at);
CREATE INDEX idx_otp_codes_telegram_chat_id ON public.otp_codes(telegram_chat_id);

-- Add index for telegram_chat_id in profiles
CREATE INDEX idx_profiles_telegram_chat_id ON public.profiles(telegram_chat_id);
