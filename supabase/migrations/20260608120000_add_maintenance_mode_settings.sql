-- โหมดปิดปรับปรุงระบบ (maintenance mode) — เก็บใน app_settings (key/value)
--   maintenance_enabled   : 'true' | 'false'  — เปิด/ปิดโหมด
--   maintenance_reopen_at  : ISO timestamp หรือ '' — เวลาที่ระบบจะกลับมาเปิดอัตโนมัติ (countdown ถึงเวลานี้)
--   maintenance_message    : ข้อความแจ้งผู้ใช้บนหน้าปิดปรับปรุง
--
-- หน้า login (ผู้ใช้ยังไม่ authenticate) ต้องอ่านค่านี้ได้ → เพิ่ม SELECT policy ให้ role anon
-- เฉพาะ 3 key นี้เท่านั้น (กันไม่ให้ anon อ่าน railway_api_token ฯลฯ ที่อยู่ตารางเดียวกัน)

INSERT INTO app_settings (key, value, description) VALUES
  ('maintenance_enabled', 'false', 'เปิด/ปิดโหมดปิดปรับปรุงระบบ (true/false)'),
  ('maintenance_reopen_at', '', 'เวลาที่ระบบจะกลับมาเปิดอัตโนมัติ (ISO timestamp) — ว่าง = ปิดไม่มีกำหนด'),
  ('maintenance_message', 'ระบบกำลังปิดปรับปรุงชั่วคราว ขออภัยในความไม่สะดวก', 'ข้อความแจ้งผู้ใช้บนหน้าปิดปรับปรุง')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Allow anon to read maintenance settings" ON app_settings;
CREATE POLICY "Allow anon to read maintenance settings"
  ON app_settings FOR SELECT
  TO anon
  USING (key IN ('maintenance_enabled', 'maintenance_reopen_at', 'maintenance_message'));
