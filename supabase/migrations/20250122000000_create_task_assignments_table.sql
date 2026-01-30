-- Migration: Create task_assignments table for document task assignment system
-- Description: สร้างตารางสำหรับเก็บข้อมูลการมอบหมายงานจากเอกสารที่ผ่านการอนุมัติแล้ว

-- =====================================================
-- PART 1: Create task_assignments table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Document reference (either memo_id or doc_receive_id, not both)
  memo_id UUID REFERENCES public.memos(id) ON DELETE CASCADE,
  doc_receive_id UUID REFERENCES public.doc_receive(id) ON DELETE CASCADE,
  document_type VARCHAR(20) NOT NULL, -- 'memo' or 'doc_receive'

  -- Assignment details
  assigned_by UUID REFERENCES auth.users(id) NOT NULL, -- ธุรการที่มอบหมาย
  assigned_to UUID REFERENCES auth.users(id) NOT NULL, -- คนที่ได้รับมอบหมาย

  -- Metadata
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, cancelled

  -- Additional info
  note TEXT, -- หมายเหตุจากธุรการ
  completion_note TEXT, -- หมายเหตุจากผู้รับมอบหมาย

  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Constraint: มีได้แค่ memo_id หรือ doc_receive_id อย่างใดอย่างหนึ่ง
  CONSTRAINT check_document_reference CHECK (
    (memo_id IS NOT NULL AND doc_receive_id IS NULL) OR
    (memo_id IS NULL AND doc_receive_id IS NOT NULL)
  )
);

-- =====================================================
-- PART 2: Create indexes for performance
-- =====================================================
CREATE INDEX idx_task_assignments_assigned_to ON task_assignments(assigned_to);
CREATE INDEX idx_task_assignments_assigned_by ON task_assignments(assigned_by);
CREATE INDEX idx_task_assignments_memo_id ON task_assignments(memo_id);
CREATE INDEX idx_task_assignments_doc_receive_id ON task_assignments(doc_receive_id);
CREATE INDEX idx_task_assignments_status ON task_assignments(status);
CREATE INDEX idx_task_assignments_deleted_at ON task_assignments(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_task_assignments_assigned_at ON task_assignments(assigned_at DESC);

-- =====================================================
-- PART 3: Add comments for documentation
-- =====================================================
COMMENT ON TABLE task_assignments IS 'งานที่ได้รับมอบหมายจากเอกสารที่ผ่านการอนุมัติแล้ว';
COMMENT ON COLUMN task_assignments.memo_id IS 'อ้างอิงไปยัง memos table (ถ้าเป็นบันทึกข้อความ)';
COMMENT ON COLUMN task_assignments.doc_receive_id IS 'อ้างอิงไปยัง doc_receive table (ถ้าเป็นหนังสือรับ)';
COMMENT ON COLUMN task_assignments.document_type IS 'ประเภทเอกสาร: memo หรือ doc_receive';
COMMENT ON COLUMN task_assignments.assigned_by IS 'ธุรการที่ทำการมอบหมาย';
COMMENT ON COLUMN task_assignments.assigned_to IS 'บุคลากรที่ได้รับมอบหมาย';
COMMENT ON COLUMN task_assignments.status IS 'สถานะของงาน: pending (รอดำเนินการ), in_progress (กำลังดำเนินการ), completed (เสร็จสิ้น), cancelled (ยกเลิก)';
COMMENT ON COLUMN task_assignments.note IS 'หมายเหตุจากธุรการที่มอบหมาย';
COMMENT ON COLUMN task_assignments.completion_note IS 'หมายเหตุจากผู้รับมอบหมายเมื่อทำงานเสร็จ';
COMMENT ON COLUMN task_assignments.deleted_at IS 'Soft delete timestamp - null = ยังใช้งาน, not null = ถูกลบแล้ว';
