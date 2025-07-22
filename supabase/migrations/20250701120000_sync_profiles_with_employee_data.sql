
-- Create missing enum types if they don't exist
DO $$ BEGIN
    CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.marital_status_type AS ENUM ('single', 'married', 'divorced', 'widowed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Synchronize profiles table with EmployeeData TypeScript interface
-- Add missing columns that exist in EmployeeData but not in profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gender gender_type,
ADD COLUMN IF NOT EXISTS marital_status marital_status_type,
ADD COLUMN IF NOT EXISTS spouse VARCHAR(100),
ADD COLUMN IF NOT EXISTS number_of_children INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- Update existing columns to ensure proper constraints and defaults
ALTER TABLE public.profiles 
ALTER COLUMN nationality SET DEFAULT 'ไทย',
ALTER COLUMN ethnicity SET DEFAULT 'ไทย',
ALTER COLUMN religion SET DEFAULT 'พุทธ',
ALTER COLUMN number_of_children SET DEFAULT 0,
ALTER COLUMN is_admin SET DEFAULT FALSE;

-- Add indexes for better performance on commonly queried fields
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON public.profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_profiles_position ON public.profiles(position);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_workplace ON public.profiles(workplace);
CREATE INDEX IF NOT EXISTS idx_profiles_job_position ON public.profiles(job_position);

-- Seed the profiles table with data from EmployeeData
INSERT INTO public.profiles (
  user_id, employee_id, first_name, last_name, nickname, email, phone, birth_date, 
  gender, address, postal_code, position, job_position, academic_rank, org_structure_role,
  start_work_date, work_experience_years, current_position, workplace, education,
  father_name, father_occupation, mother_name, mother_occupation, marital_status,
  spouse, number_of_children, nationality, ethnicity, religion, emergency_contact,
  is_admin, profile_picture_url
) VALUES 
-- Admin account
(gen_random_uuid(), 'RSEC600', 'Admin', 'Developer', NULL, 'admin@rsec6.ac.th', NULL, NULL, 'male', NULL, NULL, 'director', 'ผู้ดูแลระบบ', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'single', NULL, 0, 'ไทย', 'ไทย', 'พุทธ', NULL, TRUE, NULL),

-- Director
(gen_random_uuid(), 'RSEC601', 'อานนท์', 'จ่าแก้ว', NULL, 'rsec601@rsec6.ac.th', NULL, NULL, 'male', NULL, NULL, 'director', 'ผู้อำนวยการ', 'ครูเชี่ยวชาญ', 'ผู้อำนวยการศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'married', NULL, 2, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

-- Deputy Directors
(gen_random_uuid(), 'RSEC602', 'อลงกรณ์', 'จุ้ยแก้ว', NULL, 'rsec602@rsec6.ac.th', NULL, NULL, 'male', NULL, NULL, 'deputy_director', 'รองผู้อำนวยการ', 'ครูเชี่ยวชาญ', 'รองผู้อำนวยการศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'married', NULL, 1, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

-- Assistant Directors
(gen_random_uuid(), 'RSEC609', 'ภาราดา', 'พัสลัง', NULL, 'rsec609@rsec6.ac.th', NULL, NULL, 'female', NULL, NULL, 'assistant_director', 'ผู้ช่วยผู้อำนวยการ', 'ครูชำนาญการพิเศษ', 'หัวหน้ากลุ่มบริหารแผนงานและงบประมาณ', NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'married', NULL, 2, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC613', 'สมพร', 'อิ่มพร้อม', NULL, 'rsec613@rsec6.ac.th', NULL, NULL, 'female', NULL, NULL, 'assistant_director', 'ผู้ช่วยผู้อำนวยการ', 'ครูชำนาญการพิเศษ', 'หัวหน้ากลุ่มบริหารงานบุคคล', NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'single', NULL, 0, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC615', 'วีรศักดิ์', 'มั่นประสงค์', NULL, 'rsec615@rsec6.ac.th', NULL, NULL, 'male', NULL, NULL, 'assistant_director', 'ผู้ช่วยผู้อำนวยการ', 'ครูชำนาญการ', 'หัวหน้ากลุ่มบริหารกิจการพิเศษ', NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'married', NULL, 1, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC633', 'ภัชรกุล', 'ม่วงงาม', NULL, 'rsec633@rsec6.ac.th', NULL, NULL, 'female', NULL, NULL, 'assistant_director', 'ผู้ช่วยผู้อำนวยการ', 'ครูชำนาญการ', 'หัวหน้ากลุ่มบริหารทั่วไป', NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'divorced', NULL, 1, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC649', 'ธีรภัทร', 'เลียงวัฒนชัย', NULL, 'rsec649@rsec6.ac.th', NULL, NULL, 'male', NULL, NULL, 'assistant_director', 'ผู้ช่วยผู้อำนวยการ', 'ครูชำนาญการ', 'หัวหน้ากลุ่มบริหารวิชาการ', NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'single', NULL, 0, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

-- Teachers and staff
(gen_random_uuid(), 'RSEC603', 'เจษฎา', 'มั่งมูล', NULL, 'rsec603@rsec6.ac.th', NULL, NULL, 'male', NULL, NULL, 'deputy_director', 'รองผู้อำนวยการ', 'ครูชำนาญการ', NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'married', NULL, 2, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC605', 'กาญจนา', 'จันทอุปรี', NULL, 'rsec605@rsec6.ac.th', NULL, NULL, 'female', NULL, NULL, 'deputy_director', 'รองผู้อำนวยการ', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'married', NULL, 1, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC604', 'ภัทราพร', 'ฝั้นอิ่นแก้ว', NULL, 'rsec604@rsec6.ac.th', NULL, NULL, 'female', NULL, NULL, 'government_teacher', 'ครู', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'single', NULL, 0, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC606', 'นาวิน', 'นาคดี', NULL, 'rsec606@rsec6.ac.th', NULL, NULL, 'male', NULL, NULL, 'government_teacher', 'ครู', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'single', NULL, 0, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC607', 'ณัฐิยา', 'พูลทอง', NULL, 'rsec607@rsec6.ac.th', NULL, NULL, 'female', NULL, NULL, 'government_teacher', 'ครู', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'married', NULL, 3, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC608', 'ภิชดา', 'สีดำ', NULL, 'rsec608@rsec6.ac.th', NULL, NULL, 'female', NULL, NULL, 'clerk_teacher', 'ธุรการ', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'single', NULL, 0, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC610', 'ชูชีพ', 'ร่มโพธิ์', NULL, 'rsec610@rsec6.ac.th', NULL, NULL, 'male', NULL, NULL, 'government_teacher', 'ครู', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'widowed', NULL, 2, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC611', 'ครรชิต', 'มหาโคตร', NULL, 'rsec611@rsec6.ac.th', NULL, NULL, 'male', NULL, NULL, 'government_teacher', 'ครู', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'married', NULL, 1, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC612', 'จิระ', 'ม่วงมา', NULL, 'rsec612@rsec6.ac.th', NULL, NULL, 'female', NULL, NULL, 'government_teacher', 'ครู', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'single', NULL, 0, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC614', 'ศุภณัฎ', 'คลังกรณ์', NULL, 'rsec614@rsec6.ac.th', NULL, NULL, 'male', NULL, NULL, 'government_teacher', 'ครู', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'married', NULL, 2, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC616', 'อัจฉราพรรณ', 'แสนอะทะ', NULL, 'rsec616@rsec6.ac.th', NULL, NULL, 'female', NULL, NULL, 'government_teacher', 'ครู', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'married', NULL, 1, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC617', 'นภาวัลย์', 'ซิ่วนัส', NULL, 'rsec617@rsec6.ac.th', NULL, NULL, 'female', NULL, NULL, 'government_teacher', 'ครู', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'single', NULL, 0, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC618', 'รังสินี', 'ตุ่นทอง', NULL, 'rsec618@rsec6.ac.th', NULL, NULL, 'female', NULL, NULL, 'clerk_teacher', 'ธุรการ', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'divorced', NULL, 1, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC619', 'ปวีนา', 'จ่าแก้ว', NULL, 'rsec619@rsec6.ac.th', NULL, NULL, 'female', NULL, NULL, 'government_teacher', 'ครู', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'married', NULL, 2, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC620', 'พงศกร', 'สมบัติพิบูลย์', NULL, 'rsec620@rsec6.ac.th', NULL, NULL, 'male', NULL, NULL, 'government_teacher', 'ครู', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'single', NULL, 0, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC660', 'โสภิชา', 'บุญถาวร', NULL, 'rsec660@rsec6.ac.th', NULL, NULL, 'female', NULL, NULL, 'clerk_teacher', 'ธุรการ', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'married', NULL, 1, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL),

(gen_random_uuid(), 'RSEC674', 'ณัฐิดา', 'ศิริมงคล', NULL, 'rsec674@rsec6.ac.th', NULL, NULL, 'female', NULL, NULL, 'clerk_teacher', 'ธุรการ', NULL, NULL, NULL, NULL, NULL, 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', NULL, NULL, NULL, NULL, NULL, 'single', NULL, 0, 'ไทย', 'ไทย', 'พุทธ', NULL, FALSE, NULL)

ON CONFLICT (employee_id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  nickname = EXCLUDED.nickname,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  birth_date = EXCLUDED.birth_date,
  gender = EXCLUDED.gender,
  address = EXCLUDED.address,
  postal_code = EXCLUDED.postal_code,
  position = EXCLUDED.position,
  job_position = EXCLUDED.job_position,
  academic_rank = EXCLUDED.academic_rank,
  org_structure_role = EXCLUDED.org_structure_role,
  start_work_date = EXCLUDED.start_work_date,
  work_experience_years = EXCLUDED.work_experience_years,
  current_position = EXCLUDED.current_position,
  workplace = EXCLUDED.workplace,
  education = EXCLUDED.education,
  father_name = EXCLUDED.father_name,
  father_occupation = EXCLUDED.father_occupation,
  mother_name = EXCLUDED.mother_name,
  mother_occupation = EXCLUDED.mother_occupation,
  marital_status = EXCLUDED.marital_status,
  spouse = EXCLUDED.spouse,
  number_of_children = EXCLUDED.number_of_children,
  nationality = EXCLUDED.nationality,
  ethnicity = EXCLUDED.ethnicity,
  religion = EXCLUDED.religion,
  emergency_contact = EXCLUDED.emergency_contact,
  is_admin = EXCLUDED.is_admin,
  profile_picture_url = EXCLUDED.profile_picture_url,
  updated_at = now();
