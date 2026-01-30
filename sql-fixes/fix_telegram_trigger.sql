-- Fix: Drop old triggers and recreate with correct table reference (profiles instead of employees)

-- ลบ triggers และ functions เก่าทั้งหมด
DROP TRIGGER IF EXISTS telegram_notify_on_memo_status_change ON memos;
DROP TRIGGER IF EXISTS telegram_notify_on_doc_receive_status_change ON doc_receive;
DROP FUNCTION IF EXISTS notify_telegram_on_memo_status_change();
DROP FUNCTION IF EXISTS send_telegram_notification(JSONB);

-- ตอนนี้ให้รัน migration ใหม่จากไฟล์ 20250114000002_telegram_notifications_hardcoded.sql
-- Copy-paste เนื้อหาทั้งหมดจากไฟล์นั้นมาที่นี่และรัน

-- หรือถ้าต้องการแก้เฉพาะส่วนที่ผิด ให้เปลี่ยนจาก employees เป็น profiles:
-- ในไฟล์ 20250114000001_telegram_notifications.sql
-- บรรทัด 63: FROM employees → FROM profiles
-- บรรทัด 110: FROM employees → FROM profiles
