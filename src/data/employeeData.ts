
import { Profile, Position, MaritalStatus } from '@/types/database';

interface EmployeeData {
  employee_id: string;
  first_name: string;
  last_name: string;
  nickname?: string;
  email: string;
  phone?: string;
  birth_date?: string;
  address?: string;
  postal_code?: string;
  position: Position;
  job_position?: string;
  academic_rank?: string;
  org_structure_role?: string;
  start_work_date?: string;
  work_experience_years?: number;
  current_position?: string;
  workplace?: string;
  education?: string;
  father_name?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_occupation?: string;
  marital_status?: MaritalStatus;
  spouse?: string;
  number_of_children?: number;
  nationality?: string;
  ethnicity?: string;
  religion?: string;
  emergency_contact?: string;
  is_admin?: boolean;
  profile_picture_url?: string;
}

// Enhanced employee data with comprehensive mapping - Updated to use Supabase Position enum
export const EMPLOYEES: Record<string, EmployeeData> = {
  // Admin account
  'RSEC600': { 
    employee_id: 'RSEC600', 
    first_name: 'Admin', 
    last_name: 'Developer', 
    email: 'admin@rsec6.ac.th',
    position: 'director',
    job_position: 'ผู้ดูแลระบบ',
    is_admin: true,
    workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6',
    nationality: 'ไทย',
    ethnicity: 'ไทย',
    religion: 'พุทธ',
    marital_status: 'single',
    number_of_children: 0
  },
  
  // Director
  'RSEC601': { 
    employee_id: 'RSEC601', 
    first_name: 'อานนท์', 
    last_name: 'จ่าแก้ว', 
    email: 'rsec601@rsec6.ac.th',
    position: 'director',
    job_position: 'ผู้อำนวยการ',
    org_structure_role: 'ผู้อำนวยการศูนย์การศึกษาพิเศษ เขตการศึกษา 6',
    academic_rank: 'ครูเชี่ยวชาญ',
    workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6',
    nationality: 'ไทย',
    ethnicity: 'ไทย',
    religion: 'พุทธ',
    marital_status: 'married',
    number_of_children: 2
  },
  
  // Deputy Directors
  'RSEC602': { 
    employee_id: 'RSEC602', 
    first_name: 'อลงกรณ์', 
    last_name: 'จุ้ยแก้ว', 
    email: 'rsec602@rsec6.ac.th',
    position: 'deputy_director',
    job_position: 'รองผู้อำนวยการ',
    org_structure_role: 'รองผู้อำนวยการศูนย์การศึกษาพิเศษ เขตการศึกษา 6',
    academic_rank: 'ครูเชี่ยวชาญ',
    workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6',
    nationality: 'ไทย',
    ethnicity: 'ไทย',
    religion: 'พุทธ',
    marital_status: 'married',
    number_of_children: 1
  },
  
  // Assistant Directors with detailed roles
  'RSEC609': { 
    employee_id: 'RSEC609', 
    first_name: 'ภาราดา', 
    last_name: 'พัสลัง', 
    email: 'rsec609@rsec6.ac.th',
    position: 'assistant_director',
    job_position: 'ผู้ช่วยผู้อำนวยการ',
    academic_rank: 'ครูชำนาญการพิเศษ',
    org_structure_role: 'หัวหน้ากลุ่มบริหารแผนงานและงบประมาณ',
    workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6',
    nationality: 'ไทย',
    ethnicity: 'ไทย',
    religion: 'พุทธ',
    marital_status: 'married',
    number_of_children: 2
  },
  
  'RSEC613': { 
    employee_id: 'RSEC613', 
    first_name: 'สมพร', 
    last_name: 'อิ่มพร้อม', 
    email: 'rsec613@rsec6.ac.th',
    position: 'assistant_director',
    job_position: 'ผู้ช่วยผู้อำนวยการ',
    academic_rank: 'ครูชำนาญการพิเศษ',
    org_structure_role: 'หัวหน้ากลุ่มบริหารงานบุคคล',
    workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6',
    nationality: 'ไทย',
    ethnicity: 'ไทย',
    religion: 'พุทธ',
    marital_status: 'single',
    number_of_children: 0
  },
  
  'RSEC615': { 
    employee_id: 'RSEC615', 
    first_name: 'วีรศักดิ์', 
    last_name: 'มั่นประสงค์', 
    email: 'rsec615@rsec6.ac.th',
    position: 'assistant_director',
    job_position: 'ผู้ช่วยผู้อำนวยการ',
    academic_rank: 'ครูชำนาญการ',
    org_structure_role: 'หัวหน้ากลุ่มบริหารกิจการพิเศษ',
    workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6',
    nationality: 'ไทย',
    ethnicity: 'ไทย',
    religion: 'พุทธ',
    marital_status: 'married',
    number_of_children: 1
  },
  
  'RSEC633': { 
    employee_id: 'RSEC633', 
    first_name: 'ภัชรกุล', 
    last_name: 'ม่วงงาม', 
    email: 'rsec633@rsec6.ac.th',
    position: 'assistant_director',
    job_position: 'ผู้ช่วยผู้อำนวยการ',
    academic_rank: 'ครูชำนาญการ',
    org_structure_role: 'หัวหน้ากลุ่มบริหารทั่วไป',
    workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6',
    nationality: 'ไทย',
    ethnicity: 'ไทย',
    religion: 'พุทธ',
    marital_status: 'divorced',
    number_of_children: 1
  },
  
  'RSEC649': { 
    employee_id: 'RSEC649', 
    first_name: 'ธีรภัทร', 
    last_name: 'เลียงวัฒนชัย', 
    email: 'rsec649@rsec6.ac.th',
    position: 'assistant_director',
    job_position: 'ผู้ช่วยผู้อำนวยการ',
    academic_rank: 'ครูชำนาญการ',
    org_structure_role: 'หัวหน้ากลุ่มบริหารวิชาการ',
    workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6',
    nationality: 'ไทย',
    ethnicity: 'ไทย',
    religion: 'พุทธ',
    marital_status: 'single',
    number_of_children: 0
  },
  
  // Teachers and other staff with enhanced data
  'RSEC603': { 
    employee_id: 'RSEC603', 
    first_name: 'เจษฎา', 
    last_name: 'มั่งมูล', 
    email: 'rsec603@rsec6.ac.th',
    position: 'government_teacher',
    job_position: 'ครู',
    academic_rank: 'ครูชำนาญการ',
    workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6',
    nationality: 'ไทย',
    ethnicity: 'ไทย',
    religion: 'พุทธ',
    marital_status: 'married',
    number_of_children: 2
  },
  
  // Enhanced remaining employees with complete data
  'RSEC604': { employee_id: 'RSEC604', first_name: 'ภัทราพร', last_name: 'ฝั้นอิ่นแก้ว', email: 'rsec604@rsec6.ac.th', position: 'government_teacher', workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', marital_status: 'single', number_of_children: 0 },
  'RSEC605': { employee_id: 'RSEC605', first_name: 'กาญจนา', last_name: 'จันทอุปรี', email: 'rsec605@rsec6.ac.th', position: 'government_teacher', workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', marital_status: 'married', number_of_children: 1 },
  'RSEC606': { employee_id: 'RSEC606', first_name: 'นาวิน', last_name: 'นาคดี', email: 'rsec606@rsec6.ac.th', position: 'government_teacher', workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', marital_status: 'single', number_of_children: 0 },
  'RSEC607': { employee_id: 'RSEC607', first_name: 'ณัฐิยา', last_name: 'พูลทอง', email: 'rsec607@rsec6.ac.th', position: 'government_teacher', workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', marital_status: 'married', number_of_children: 3 },
  'RSEC608': { employee_id: 'RSEC608', first_name: 'ภิชดา', last_name: 'สีดำ', email: 'rsec608@rsec6.ac.th', position: 'clerk_teacher', job_position: 'ธุรการ', workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', marital_status: 'single', number_of_children: 0 },
  'RSEC610': { employee_id: 'RSEC610', first_name: 'ชูชีพ', last_name: 'ร่มโพธิ์', email: 'rsec610@rsec6.ac.th', position: 'government_teacher', workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', marital_status: 'widowed', number_of_children: 2 },
  'RSEC611': { employee_id: 'RSEC611', first_name: 'ครรชิต', last_name: 'มหาโคตร', email: 'rsec611@rsec6.ac.th', position: 'government_teacher', workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', marital_status: 'married', number_of_children: 1 },
  'RSEC612': { employee_id: 'RSEC612', first_name: 'จิระ', last_name: 'ม่วงมา', email: 'rsec612@rsec6.ac.th', position: 'government_teacher', workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', marital_status: 'single', number_of_children: 0 },
  'RSEC614': { employee_id: 'RSEC614', first_name: 'ศุภณัฎ', last_name: 'คลังกรณ์', email: 'rsec614@rsec6.ac.th', position: 'government_teacher', workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', marital_status: 'married', number_of_children: 2 },
  'RSEC616': { employee_id: 'RSEC616', first_name: 'อัจฉราพรรณ', last_name: 'แสนอะทะ', email: 'rsec616@rsec6.ac.th', position: 'government_teacher', workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', marital_status: 'married', number_of_children: 1 },
  'RSEC617': { employee_id: 'RSEC617', first_name: 'นภาวัลย์', last_name: 'ซิ่วนัส', email: 'rsec617@rsec6.ac.th', position: 'government_teacher', workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', marital_status: 'single', number_of_children: 0 },
  'RSEC618': { employee_id: 'RSEC618', first_name: 'รังสินี', last_name: 'ตุ่นทอง', email: 'rsec618@rsec6.ac.th', position: 'government_teacher', workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', marital_status: 'divorced', number_of_children: 1 },
  'RSEC619': { employee_id: 'RSEC619', first_name: 'ปวีนา', last_name: 'จ่าแก้ว', email: 'rsec619@rsec6.ac.th', position: 'government_teacher', workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', marital_status: 'married', number_of_children: 2 },
  'RSEC620': { employee_id: 'RSEC620', first_name: 'พงศกร', last_name: 'สมบัติพิบูลย์', email: 'rsec620@rsec6.ac.th', position: 'government_teacher', workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', marital_status: 'single', number_of_children: 0 }
};

// Helper function to get employee data as Profile format with all required fields
export const getEmployeeAsProfile = (employeeKey: string): Partial<Profile> | null => {
  const employee = EMPLOYEES[employeeKey];
  if (!employee) return null;

  return {
    employee_id: employee.employee_id,
    first_name: employee.first_name,
    last_name: employee.last_name,
    nickname: employee.nickname,
    email: employee.email,
    phone: employee.phone,
    birth_date: employee.birth_date,
    address: employee.address,
    postal_code: employee.postal_code,
    position: employee.position,
    job_position: employee.job_position,
    academic_rank: employee.academic_rank,
    org_structure_role: employee.org_structure_role,
    start_work_date: employee.start_work_date,
    work_experience_years: employee.work_experience_years,
    current_position: employee.current_position,
    workplace: employee.workplace,
    education: employee.education,
    father_name: employee.father_name,
    father_occupation: employee.father_occupation,
    mother_name: employee.mother_name,
    mother_occupation: employee.mother_occupation,
    marital_status: employee.marital_status,
    spouse: employee.spouse,
    number_of_children: employee.number_of_children,
    nationality: employee.nationality,
    ethnicity: employee.ethnicity,
    religion: employee.religion,
    emergency_contact: employee.emergency_contact,
    is_admin: employee.is_admin,
    profile_picture_url: employee.profile_picture_url,
  };
};

// Helper function to convert Profile to database insert format
export const profileToDbFormat = (profile: Partial<Profile>) => {
  const {
    // Remove client-only fields that shouldn't go to database
    id,
    user_id,
    created_at,
    updated_at,
    ...dbFields
  } = profile;

  return {
    user_id: profile.user_id || crypto.randomUUID(),
    employee_id: profile.employee_id || '',
    first_name: profile.first_name || '',
    last_name: profile.last_name || '',
    position: profile.position || 'government_employee',
    ...dbFields,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
};
