-- Add updated_at column to task_assignments table
-- Fix error: column "updated_at" of relation "task_assignments" does not exist

ALTER TABLE task_assignments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_task_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_assignments_updated_at_trigger ON task_assignments;
CREATE TRIGGER task_assignments_updated_at_trigger
  BEFORE UPDATE ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_task_assignments_updated_at();

COMMENT ON COLUMN task_assignments.updated_at IS 'Timestamp of last update';
