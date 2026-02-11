-- Add report_memo_id to task_assignments for linking report memos
ALTER TABLE public.task_assignments
ADD COLUMN IF NOT EXISTS report_memo_id UUID REFERENCES public.memos(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_assignments_report_memo_id
ON public.task_assignments(report_memo_id);

-- Add comment
COMMENT ON COLUMN public.task_assignments.report_memo_id IS 'Reference to the memo created as a report for this task assignment';
