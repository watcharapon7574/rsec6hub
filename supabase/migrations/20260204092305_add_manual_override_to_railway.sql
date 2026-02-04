-- Add manual_override_until column to railway_schedules
-- This allows users to override the scheduler temporarily
ALTER TABLE railway_schedules
ADD COLUMN IF NOT EXISTS manual_override_until TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN railway_schedules.manual_override_until IS 'เมื่อผู้ใช้สั่งเปิด/ปิดด้วยตนเอง scheduler จะไม่แทรกแซงจนกว่าจะถึงเวลานี้';
