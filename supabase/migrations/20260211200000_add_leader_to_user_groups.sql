-- Migration: Add leader_user_id to user_groups
-- Description: เพิ่มคอลัมน์ leader_user_id สำหรับกำหนดหัวหน้ากลุ่ม

-- =====================================================
-- Add leader_user_id column to user_groups table
-- =====================================================

-- leader_user_id: หัวหน้ากลุ่ม (สำหรับกลุ่มประเภท 'group')
ALTER TABLE public.user_groups
ADD COLUMN IF NOT EXISTS leader_user_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.user_groups.leader_user_id IS 'หัวหน้ากลุ่ม (ใช้กับ group_type = group เท่านั้น)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_groups_leader_user_id
ON public.user_groups(leader_user_id);
