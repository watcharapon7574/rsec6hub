-- รายชื่อผู้ทดสอบที่ยกเว้นให้เข้าใช้งานได้ระหว่างปิดปรับปรุง (เหมือนแอดมิน แต่เลือกเองได้)
--   maintenance_test_user_ids : JSON array ของ user_id เช่น ["uuid1","uuid2"]
-- เพิ่ม key นี้เข้า anon SELECT policy ด้วย เพื่อให้ดึงพร้อม key อื่นในคิวรีเดียว (.in)

INSERT INTO app_settings (key, value, description) VALUES
  ('maintenance_test_user_ids', '[]', 'user_id ที่ยกเว้นให้เข้าใช้งานได้ระหว่างปิดปรับปรุง (JSON array) — สำหรับทดสอบระบบ')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Allow anon to read maintenance settings" ON app_settings;
CREATE POLICY "Allow anon to read maintenance settings"
  ON app_settings FOR SELECT
  TO anon
  USING (key IN (
    'maintenance_enabled',
    'maintenance_reopen_at',
    'maintenance_message',
    'maintenance_test_user_ids'
  ));
