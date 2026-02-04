-- เพิ่ม 'vacant' เข้าไปใน position_type enum
-- ใช้สำหรับกรณีที่ admin ต้องการล้างข้อมูล profile เพื่อรอใส่คนใหม่

ALTER TYPE position_type ADD VALUE IF NOT EXISTS 'vacant';

COMMENT ON TYPE position_type IS 'Position types including vacant for empty slots waiting for new person';
