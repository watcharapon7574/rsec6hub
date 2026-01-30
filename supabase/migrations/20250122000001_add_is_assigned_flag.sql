-- Migration: Add is_assigned flag to memos and doc_receive tables
-- Description: เพิ่มฟิลด์ is_assigned เพื่อระบุว่าเอกสารถูกมอบหมายงานแล้วหรือยัง

-- =====================================================
-- PART 1: Add is_assigned to memos table
-- =====================================================
ALTER TABLE public.memos
ADD COLUMN IF NOT EXISTS is_assigned BOOLEAN DEFAULT false;

-- =====================================================
-- PART 2: Add is_assigned to doc_receive table
-- =====================================================
ALTER TABLE public.doc_receive
ADD COLUMN IF NOT EXISTS is_assigned BOOLEAN DEFAULT false;

-- =====================================================
-- PART 3: Create indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_memos_is_assigned
  ON memos(is_assigned)
  WHERE is_assigned = true;

CREATE INDEX IF NOT EXISTS idx_doc_receive_is_assigned
  ON doc_receive(is_assigned)
  WHERE is_assigned = true;

-- =====================================================
-- PART 4: Add comments for documentation
-- =====================================================
COMMENT ON COLUMN memos.is_assigned IS 'ระบุว่าเอกสารนี้ได้รับการมอบหมายงานแล้วหรือไม่ (true = มอบหมายแล้ว, false = ยังไม่ได้มอบหมาย)';
COMMENT ON COLUMN doc_receive.is_assigned IS 'ระบุว่าเอกสารนี้ได้รับการมอบหมายงานแล้วหรือไม่ (true = มอบหมายแล้ว, false = ยังไม่ได้มอบหมาย)';
