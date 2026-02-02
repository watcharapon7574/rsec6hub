
export type Position = 
  | 'director' 
  | 'deputy_director'
  | 'assistant_director'
  | 'government_teacher'
  | 'government_employee'
  | 'contract_teacher'
  | 'clerk_teacher'
  | 'disability_aide';

export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'in_progress';
export type LeaveType = 'sick_leave' | 'personal_leave' | 'annual_leave' | 'maternity_leave' | 'ordination_leave';

export interface Profile {
  id: string;
  user_id: string;
  employee_id: string;
  
  // Basic Information
  prefix?: string; // คำนำหน้าชื่อ เช่น นาย, นาง, นางสาว
  first_name: string;
  last_name: string;
  nickname?: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  address?: string;
  postal_code?: string;
  profile_picture_url?: string;
  signature_url?: string;
  
  // Position & Role
  position: Position;
  job_position?: string; // Full position name like "รองผู้อำนวยการ"
  org_structure_role?: string; // Department/group head role
  academic_rank?: string; // ครูชำนาญการ, etc.
  
  // Government Service Info
  start_work_date?: string;
  work_experience_years?: number;
  current_position?: string;
  workplace?: string;
  education?: string;
  education_history?: any;
  work_history?: any;
  
  // Family Information
  father_name?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_occupation?: string;
  marital_status?: MaritalStatus;
  spouse?: string;
  number_of_children?: number;
  
  // Additional Information
  nationality?: string;
  ethnicity?: string;
  religion?: string;
  emergency_contact?: string;
  documents?: any;
  
  // System fields
  is_admin?: boolean; // Superuser override
  created_at: string;
  updated_at: string;
}

// Utility functions for role checking
export const isAdmin = (profile: Profile): boolean => {
  return profile.is_admin || profile.position === 'director';
};

export const isExecutive = (position: Position): boolean => {
  return ['director', 'deputy_director', 'assistant_director'].includes(position);
};

export const isClerk = (position: Position): boolean => {
  return ['clerk_teacher'].includes(position);
};

export const isTeacher = (position: Position): boolean => {
  return ['government_teacher', 'contract_teacher'].includes(position);
};

export const getPositionDisplayName = (position: Position, orgStructureRole?: string): string => {
  switch (position) {
    case 'director':
      return 'ผู้อำนวยการ';
    case 'deputy_director':
      return 'รองผู้อำนวยการ';
    case 'assistant_director':
      // ใช้ org_structure_role แทน "ผู้ช่วยผู้อำนวยการ"
      return orgStructureRole || 'หัวหน้าฝ่าย';
    case 'government_teacher':
      return 'ครูข้าราชการ';
    case 'government_employee':
      return 'ข้าราชการ';
    case 'contract_teacher':
      return 'ครูอัตราจ้าง';
    case 'clerk_teacher':
      return 'ธุรการ';
    case 'disability_aide':
      return 'ผู้ช่วยเหลือคนพิการ';
    default:
      return 'ไม่ระบุ';
  }
};

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: ApprovalStatus;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface DailyReport {
  id: string;
  user_id: string;
  report_date: string;
  description: string;
  images?: any;
  location?: any;
  created_at: string;
  updated_at: string;
}

export interface OfficialDocument {
  id: string;
  user_id: string;
  document_number?: string;
  document_date: string;
  subject: string;
  content: string;
  recipient: string;
  status: ApprovalStatus;
  current_approver_level: number;
  clerk_approved_at?: string;
  clerk_approved_by?: string;
  assistant_approved_at?: string;
  assistant_approved_by?: string;
  deputy_approved_at?: string;
  deputy_approved_by?: string;
  director_approved_at?: string;
  director_approved_by?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}
