-- Migration: Create RLS policies for task_assignments table
-- Description: สร้าง Row Level Security policies สำหรับควบคุมการเข้าถึงข้อมูลในตาราง task_assignments

-- =====================================================
-- PART 1: Enable RLS on task_assignments table
-- =====================================================
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 2: Create RLS Policies
-- =====================================================

-- Policy 1: ผู้ใช้สามารถดูงานที่ได้รับมอบหมาย (assigned_to)
CREATE POLICY "Users can view their assigned tasks"
  ON task_assignments
  FOR SELECT
  USING (
    assigned_to = auth.uid()
    AND deleted_at IS NULL
  );

-- Policy 2: ธุรการสามารถดูงานทั้งหมดที่ตนเองมอบหมาย (assigned_by)
CREATE POLICY "Clerks can view tasks they assigned"
  ON task_assignments
  FOR SELECT
  USING (
    assigned_by = auth.uid()
    AND deleted_at IS NULL
  );

-- Policy 3: ธุรการสามารถสร้างงานมอบหมายใหม่ (ต้องเป็น clerk_teacher)
CREATE POLICY "Clerks can create task assignments"
  ON task_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND position = 'clerk_teacher'
    )
    AND assigned_by = auth.uid()
  );

-- Policy 4: ผู้รับมอบหมายสามารถอัปเดตสถานะงานของตนเอง
CREATE POLICY "Assignees can update their task status"
  ON task_assignments
  FOR UPDATE
  USING (
    assigned_to = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    assigned_to = auth.uid()
    AND deleted_at IS NULL
  );

-- Policy 5: ธุรการสามารถอัปเดตงานที่ตนเองมอบหมาย
CREATE POLICY "Clerks can update tasks they assigned"
  ON task_assignments
  FOR UPDATE
  USING (
    assigned_by = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    assigned_by = auth.uid()
    AND deleted_at IS NULL
  );

-- Policy 6: ธุรการสามารถลบงาน (soft delete) ที่ตนเองมอบหมาย
CREATE POLICY "Clerks can delete tasks they assigned"
  ON task_assignments
  FOR UPDATE
  USING (
    assigned_by = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    assigned_by = auth.uid()
  );

-- Policy 7: ผู้ดูแลระบบสามารถดูงานทั้งหมด
CREATE POLICY "Admins can view all tasks"
  ON task_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND position IN ('director', 'deputy_director', 'assistant_director')
    )
  );

-- Policy 8: ผู้ดูแลระบบสามารถจัดการงานทั้งหมด
CREATE POLICY "Admins can manage all tasks"
  ON task_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND position IN ('director', 'deputy_director', 'assistant_director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND position IN ('director', 'deputy_director', 'assistant_director')
    )
  );

-- =====================================================
-- PART 3: Add comments for documentation
-- =====================================================
COMMENT ON POLICY "Users can view their assigned tasks" ON task_assignments IS 'อนุญาตให้ผู้ใช้ดูงานที่ได้รับมอบหมาย (assigned_to)';
COMMENT ON POLICY "Clerks can view tasks they assigned" ON task_assignments IS 'อนุญาตให้ธุรการดูงานที่ตนเองมอบหมาย';
COMMENT ON POLICY "Clerks can create task assignments" ON task_assignments IS 'อนุญาตให้ธุรการสร้างงานมอบหมายใหม่';
COMMENT ON POLICY "Assignees can update their task status" ON task_assignments IS 'อนุญาตให้ผู้รับมอบหมายอัปเดตสถานะงานของตนเอง';
COMMENT ON POLICY "Clerks can update tasks they assigned" ON task_assignments IS 'อนุญาตให้ธุรการอัปเดตงานที่ตนเองมอบหมาย';
COMMENT ON POLICY "Clerks can delete tasks they assigned" ON task_assignments IS 'อนุญาตให้ธุรการลบงานที่ตนเองมอบหมาย (soft delete)';
COMMENT ON POLICY "Admins can view all tasks" ON task_assignments IS 'อนุญาตให้ผู้บริหารดูงานทั้งหมด';
COMMENT ON POLICY "Admins can manage all tasks" ON task_assignments IS 'อนุญาตให้ผู้บริหารจัดการงานทั้งหมด';
