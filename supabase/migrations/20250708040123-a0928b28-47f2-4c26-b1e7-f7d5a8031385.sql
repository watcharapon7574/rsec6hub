-- ปรับปรุง RLS policies สำหรับ user_sessions ให้รองรับการสร้าง session โดยไม่ต้องมี auth.uid()
-- เนื่องจากขณะ verify OTP ผู้ใช้ยังไม่ได้ authenticated

-- เพิ่ม policy สำหรับ service role ให้สามารถจัดการ sessions ได้
CREATE POLICY "Service role can manage all sessions"
ON public.user_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ปรับปรุง policy สำหรับการ insert เพื่อให้ edge function สามารถสร้าง session ได้
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.user_sessions;

CREATE POLICY "Allow session creation for authenticated users"
ON public.user_sessions
FOR INSERT
WITH CHECK (
  -- อนุญาตให้ service role สร้าง session ได้เสมอ
  current_setting('role') = 'service_role' 
  OR 
  -- หรือให้ authenticated user สร้าง session ของตัวเองได้
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

-- เพิ่ม logging สำหรับ debug OTP
CREATE OR REPLACE FUNCTION log_otp_verification(
  p_phone text,
  p_otp text,
  p_action text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- สร้าง log entry (ในการใช้งานจริงอาจใช้ separate logging table)
  RAISE NOTICE 'OTP_LOG: % - Phone: %, OTP: %, Details: %', p_action, p_phone, p_otp, p_details;
END;
$$;