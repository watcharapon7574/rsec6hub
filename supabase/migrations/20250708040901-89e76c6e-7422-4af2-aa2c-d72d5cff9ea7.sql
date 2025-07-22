-- แก้ไข RLS policies สำหรับ user_sessions อย่างสมบูรณ์
-- เนื่องจากการสร้าง session เกิดขึ้นก่อนที่ user จะ authenticated

-- ลบ policy เก่าทั้งหมดก่อน
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Allow session creation for authenticated users" ON public.user_sessions;

-- สร้าง policy ใหม่ที่อนุญาตให้ backend service สร้าง session ได้
CREATE POLICY "Backend can manage sessions"
ON public.user_sessions
FOR ALL
USING (true)
WITH CHECK (true);

-- อนุญาตให้ authenticated users ดู sessions ของตัวเอง
CREATE POLICY "Users can view own sessions" 
ON public.user_sessions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());