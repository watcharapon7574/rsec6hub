export type LeaveType =
  | 'sick_leave'
  | 'personal_leave'
  | 'annual_leave'
  | 'maternity_leave'
  | 'paternity_leave'
  | 'ordination_leave'
  | 'military_leave'
  | 'study_leave'
  | 'international_org_leave'
  | 'spouse_follow_leave'
  | 'rehabilitation_leave';

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  sick_leave: 'ลาป่วย',
  personal_leave: 'ลากิจส่วนตัว',
  annual_leave: 'ลาพักผ่อน',
  maternity_leave: 'ลาคลอดบุตร',
  paternity_leave: 'ลาไปช่วยภริยาดูแลบุตร',
  ordination_leave: 'ลาอุปสมบท / ไปประกอบพิธีฮัจย์',
  military_leave: 'ลาเข้ารับการตรวจเลือก/เตรียมพล',
  study_leave: 'ลาไปศึกษา ฝึกอบรม ดูงาน',
  international_org_leave: 'ลาไปปฏิบัติงานในองค์การระหว่างประเทศ',
  spouse_follow_leave: 'ลาติดตามคู่สมรส',
  rehabilitation_leave: 'ลาฟื้นฟูสมรรถภาพด้านอาชีพ',
};

export const LEAVE_TYPE_ORDER: LeaveType[] = [
  'sick_leave',
  'personal_leave',
  'annual_leave',
  'maternity_leave',
  'paternity_leave',
  'ordination_leave',
  'military_leave',
  'study_leave',
  'international_org_leave',
  'spouse_follow_leave',
  'rehabilitation_leave',
];

// TODO ยืนยันกับฝ่ายบุคคล: โควต้า/ครึ่งปีงบประมาณ (6 เดือน เริ่ม 1 ต.ค.)
export const LEAVE_TYPE_QUOTAS_PER_HALF: Record<LeaveType, number> = {
  sick_leave: 30,
  personal_leave: 23,
  annual_leave: 10,
  maternity_leave: 90,
  paternity_leave: 15,
  ordination_leave: 120,
  military_leave: 60,
  study_leave: 180,
  international_org_leave: 365,
  spouse_follow_leave: 365,
  rehabilitation_leave: 180,
};

export type LeaveStatus = 'draft' | 'pending' | 'in_progress' | 'approved' | 'rejected';

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  draft: 'ร่าง',
  pending: 'รอ หน.บุคคล',
  in_progress: 'รอ ผอ.',
  approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
};

export const LEAVE_STATUS_COLORS: Record<LeaveStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export type LeaveSignerOrder = 1 | 2;

export interface LeaveSignature {
  order: LeaveSignerOrder;
  signer_user_id: string;
  signer_name: string;
  signer_role: 'hr_head' | 'director';
  status: 'approved' | 'rejected';
  signed_at: string;
  signature_url?: string | null;
  comment?: string | null;
}

export interface LeaveFormData {
  contact_address?: string;
  contact_phone?: string;
  delegate_user_id?: string | null;
  delegate_name?: string | null;
  medical_certificate_url?: string | null;
  attachments?: string[];
  notes?: string | null;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  doc_number?: string | null;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: LeaveStatus;
  fiscal_year: number;
  fiscal_half: 1 | 2;
  current_signer_order: LeaveSignerOrder;
  signatures: LeaveSignature[];
  form_data?: LeaveFormData | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_position?: string;
}

export interface LeaveBalance {
  leave_type: LeaveType;
  fiscal_year: number;
  fiscal_half: 1 | 2;
  quota_days: number;
  used_days: number;
  pending_days: number;
}

export interface NewLeaveRequestInput {
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  form_data?: LeaveFormData;
}

// ─── เอกสารแนบ (ตามประเภท) ───
export interface AttachmentRequirement {
  required: 'always' | 'never' | 'conditional';
  label: string;
  conditionDays?: number; // ถ้า conditional: บังคับเมื่อจำนวนวัน > นี้
  hint?: string;
}

// TODO ยืนยันกับฝ่ายบุคคลว่าประเภทไหนต้องแนบอะไร
export const LEAVE_TYPE_ATTACHMENTS: Record<LeaveType, AttachmentRequirement> = {
  sick_leave: {
    required: 'conditional',
    conditionDays: 3,
    label: 'ใบรับรองแพทย์',
    hint: 'จำเป็นเมื่อลาเกิน 3 วัน',
  },
  personal_leave: { required: 'never', label: '' },
  annual_leave: { required: 'never', label: '' },
  maternity_leave: {
    required: 'always',
    label: 'ใบรับรองแพทย์ / สูติบัตร',
  },
  paternity_leave: { required: 'always', label: 'สูติบัตรบุตร' },
  ordination_leave: {
    required: 'always',
    label: 'หนังสือยืนยันจากวัด/มัสยิด',
  },
  military_leave: { required: 'always', label: 'หมายเรียก' },
  study_leave: {
    required: 'always',
    label: 'หนังสือตอบรับการเข้าศึกษา/อบรม',
  },
  international_org_leave: {
    required: 'always',
    label: 'หนังสือเชิญจากองค์การระหว่างประเทศ',
  },
  spouse_follow_leave: {
    required: 'always',
    label: 'หนังสือคำสั่งย้ายของคู่สมรส',
  },
  rehabilitation_leave: {
    required: 'always',
    label: 'ใบรับรองแพทย์ / เอกสารฟื้นฟู',
  },
};

export function isAttachmentRequired(
  leave_type: LeaveType,
  days: number,
): boolean {
  const cfg = LEAVE_TYPE_ATTACHMENTS[leave_type];
  if (cfg.required === 'always') return true;
  if (cfg.required === 'never') return false;
  return days > (cfg.conditionDays ?? 0);
}

// ─── Steps สำหรับ stepper UI ───
export type LeaveStepState = 'done' | 'current' | 'pending' | 'rejected';

export interface LeaveSteps {
  step1: LeaveStepState; // หน.บุคคล
  step2: LeaveStepState; // ผอ.
  step3: LeaveStepState; // อนุมัติเสร็จสิ้น
}

export function getLeaveSteps(
  req: Pick<LeaveRequest, 'status' | 'signatures'>,
): LeaveSteps {
  const sig1 = req.signatures.find((s) => s.order === 1);
  const sig2 = req.signatures.find((s) => s.order === 2);

  const step1: LeaveStepState =
    sig1?.status === 'rejected'
      ? 'rejected'
      : sig1?.status === 'approved'
        ? 'done'
        : req.status === 'pending'
          ? 'current'
          : 'pending';

  const step2: LeaveStepState =
    sig2?.status === 'rejected'
      ? 'rejected'
      : sig2?.status === 'approved'
        ? 'done'
        : req.status === 'in_progress'
          ? 'current'
          : 'pending';

  // step3 (อนุมัติเสร็จสิ้น) — done เฉพาะตอน approved เท่านั้น
  // ถ้าถูกปฏิเสธ X จะแสดงที่ step ของคนที่กดปฏิเสธจริง ไม่ใช่ที่ขั้นสุดท้าย
  const step3: LeaveStepState =
    req.status === 'approved' ? 'done' : 'pending';

  return { step1, step2, step3 };
}
