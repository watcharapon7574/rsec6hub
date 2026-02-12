-- Migration: Add is_report_memo flag to memos table
-- Description: เพิ่ม flag is_report_memo เพื่อระบุว่า memo นั้นเป็นบันทึกข้อความรายงานผลหรือไม่
-- วิธีเดิมใช้การ query task_assignments.report_memo_id แต่มีปัญหา RLS policy ทำให้บางคนเห็นไม่ตรงกัน

-- =====================================================
-- Add is_report_memo column to memos table
-- =====================================================
ALTER TABLE public.memos
ADD COLUMN IF NOT EXISTS is_report_memo BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN public.memos.is_report_memo IS 'Flag บอกว่า memo นี้เป็นบันทึกข้อความรายงานผล (สร้างจาก CreateReportMemoPage)';

-- =====================================================
-- Backfill existing report memos
-- อัปเดต memos ที่มี task_assignments.report_memo_id ชี้มา
-- =====================================================
UPDATE public.memos m
SET is_report_memo = TRUE
WHERE EXISTS (
  SELECT 1 FROM public.task_assignments ta
  WHERE ta.report_memo_id = m.id
    AND ta.deleted_at IS NULL
);

-- =====================================================
-- Create index for faster queries
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_memos_is_report_memo
ON public.memos(is_report_memo)
WHERE is_report_memo = TRUE;
