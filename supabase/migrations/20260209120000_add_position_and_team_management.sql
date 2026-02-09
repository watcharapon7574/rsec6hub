-- Migration: Add Position Type and Team Management
-- Description: เพิ่มระบบ "หน้าที่" (position) และการจัดการทีม/ผู้รายงาน

-- =====================================================
-- PART 1: Add group_type to user_groups table
-- =====================================================
-- group_type: 'group' (กลุ่มหลายคน) หรือ 'position' (หน้าที่ 1 คน)
ALTER TABLE public.user_groups
ADD COLUMN IF NOT EXISTS group_type VARCHAR(20) DEFAULT 'group';

COMMENT ON COLUMN public.user_groups.group_type IS 'ประเภท: group = กลุ่มหลายคน, position = หน้าที่ 1 คน';

-- =====================================================
-- PART 2: Add columns to task_assignments table
-- =====================================================

-- assignment_source: วิธีการมอบหมาย
ALTER TABLE public.task_assignments
ADD COLUMN IF NOT EXISTS assignment_source VARCHAR(20);

COMMENT ON COLUMN public.task_assignments.assignment_source IS 'วิธีมอบหมาย: name = ค้นหาชื่อ, group = เลือกกลุ่ม, position = เลือกหน้าที่';

-- position_id: อ้างอิงหน้าที่ (ถ้ามอบหมายผ่านหน้าที่)
ALTER TABLE public.task_assignments
ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES public.user_groups(id);

COMMENT ON COLUMN public.task_assignments.position_id IS 'อ้างอิงหน้าที่ (ถ้า assignment_source = position)';

-- is_reporter: เป็นผู้รายงานไฟล์หรือไม่
ALTER TABLE public.task_assignments
ADD COLUMN IF NOT EXISTS is_reporter BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.task_assignments.is_reporter IS 'เป็นผู้รายงานไฟล์ (ต้องแนบไฟล์เมื่อรายงาน)';

-- is_team_leader: เป็นหัวหน้าทีมหรือไม่
ALTER TABLE public.task_assignments
ADD COLUMN IF NOT EXISTS is_team_leader BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.task_assignments.is_team_leader IS 'เป็นหัวหน้าทีม (มีสิทธิ์จัดการทีม/เลือก Reporter)';

-- parent_assignment_id: อ้างอิง assignment หลัก (ถ้าถูกเพิ่มเป็นทีม)
ALTER TABLE public.task_assignments
ADD COLUMN IF NOT EXISTS parent_assignment_id UUID REFERENCES public.task_assignments(id);

COMMENT ON COLUMN public.task_assignments.parent_assignment_id IS 'อ้างอิง assignment หลัก (ถ้าถูกเพิ่มเป็นสมาชิกทีมโดยหัวหน้า)';

-- group_id: อ้างอิงกลุ่ม (ถ้ามอบหมายผ่านกลุ่ม)
ALTER TABLE public.task_assignments
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.user_groups(id);

COMMENT ON COLUMN public.task_assignments.group_id IS 'อ้างอิงกลุ่ม (ถ้า assignment_source = group)';

-- =====================================================
-- PART 3: Create indexes for better performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_task_assignments_assignment_source
ON public.task_assignments(assignment_source);

CREATE INDEX IF NOT EXISTS idx_task_assignments_position_id
ON public.task_assignments(position_id);

CREATE INDEX IF NOT EXISTS idx_task_assignments_parent_assignment_id
ON public.task_assignments(parent_assignment_id);

CREATE INDEX IF NOT EXISTS idx_task_assignments_is_team_leader
ON public.task_assignments(is_team_leader);

CREATE INDEX IF NOT EXISTS idx_user_groups_group_type
ON public.user_groups(group_type);

-- =====================================================
-- PART 4: Add usage_count to user_groups if not exists
-- =====================================================
ALTER TABLE public.user_groups
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

COMMENT ON COLUMN public.user_groups.usage_count IS 'จำนวนครั้งที่ใช้งาน (สำหรับเรียงลำดับ)';
