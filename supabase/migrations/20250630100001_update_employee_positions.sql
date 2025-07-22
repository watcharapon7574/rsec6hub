
-- อัปเดตตำแหน่งของพนักงานตามโครงสร้างองค์กร

-- 1. ผู้อำนวยการ (Director)
UPDATE profiles SET position = 'director' WHERE employee_id = 'RSEC601'; -- นายอานนท์ จ่าแก้ว

-- 2. รองผู้อำนวยการ (Deputy Director)
UPDATE profiles SET position = 'deputy_director' WHERE employee_id = 'RSEC603'; -- นายเจษฎา มั่งมูล
UPDATE profiles SET position = 'deputy_director' WHERE employee_id = 'RSEC605'; -- นางกาญจนา จันทอุปรี

-- 3. ผู้ช่วยผู้อำนวยการ (Assistant Director)
UPDATE profiles SET position = 'assistant_director' WHERE employee_id = 'RSEC609'; -- นางภาราดา พัสลัง
UPDATE profiles SET position = 'assistant_director' WHERE employee_id = 'RSEC633'; -- นายภัชรกุล ม่วงงาม
UPDATE profiles SET position = 'assistant_director' WHERE employee_id = 'RSEC613'; -- นายสมพร อิ่มพร้อม
UPDATE profiles SET position = 'assistant_director' WHERE employee_id = 'RSEC615'; -- นายวีรศักดิ์ มั่นประสงค์
UPDATE profiles SET position = 'assistant_director' WHERE employee_id = 'RSEC649'; -- นายธีรภัทร เลียงวัฒนชัย

-- 4. ธุรการ (Clerk Teacher) - ครูที่ทำหน้าที่ธุรการด้วย
UPDATE profiles SET position = 'clerk_teacher' WHERE employee_id = 'RSEC618'; -- นางสาวรังสินี ตุ่นทอง
UPDATE profiles SET position = 'clerk_teacher' WHERE employee_id = 'RSEC660'; -- นางโสภิชา บุญถาวร
UPDATE profiles SET position = 'clerk_teacher' WHERE employee_id = 'RSEC674'; -- นางสาวณัฐิดา ศิริมงคล

-- 5. กำหนด Admin (สำหรับ developer account)
UPDATE profiles SET position = 'director' WHERE employee_id = 'RSEC600' AND first_name = 'Admin';

-- 6. ให้คนที่เหลือเป็น government_teacher (ครู/บุคลากร) - เป็น default
UPDATE profiles SET position = 'government_teacher' 
WHERE position NOT IN ('director', 'deputy_director', 'assistant_director', 'clerk_teacher')
AND employee_id NOT IN ('RSEC600');

-- ตรวจสอบการอัปเดต
SELECT employee_id, first_name, last_name, position, workplace 
FROM profiles 
WHERE position IN ('director', 'deputy_director', 'assistant_director', 'clerk_teacher')
ORDER BY 
  CASE position 
    WHEN 'director' THEN 1
    WHEN 'deputy_director' THEN 2
    WHEN 'assistant_director' THEN 3
    WHEN 'clerk_teacher' THEN 4
    ELSE 5
  END,
  first_name;
