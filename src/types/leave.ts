export type LeaveType =
  | 'sick_leave'
  | 'personal_leave'
  | 'annual_leave'
  | 'maternity_leave'
  | 'paternity_leave'
  | 'ordination_leave'
  | 'military_leave'
  | 'study_leave'
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
  'spouse_follow_leave',
  'rehabilitation_leave',
];

// เพดานวันลาสูงสุดต่อปีงบประมาณ ตามระเบียบสำนักนายกฯ ว่าด้วยการลาของข้าราชการ พ.ศ. 2555
// ใช้เป็นทั้งโควต้าใน UI และ cap ตอน validate — ค่าเป็นรายปี (รวม 2 ครึ่งปีงบประมาณ)
export const LEAVE_TYPE_QUOTAS_PER_YEAR: Record<LeaveType, number> = {
  sick_leave: 60,
  personal_leave: 45,
  annual_leave: 10,
  maternity_leave: 90,
  paternity_leave: 15,
  ordination_leave: 120,
  military_leave: 60,
  study_leave: 1460, // 4 ปี
  spouse_follow_leave: 730, // 2 ปี
  rehabilitation_leave: 365, // 12 เดือน
};

// ระเบียบ/เงื่อนไขการลา (ข้อความทางการจาก Excel ของฝ่ายบุคคล)
export interface LeaveRegulation {
  maxDays: number;
  rule: string;
  extendable?: string;
}

export const LEAVE_TYPE_REGULATION: Record<LeaveType, LeaveRegulation> = {
  sick_leave: {
    maxDays: 60,
    rule: 'ปีละไม่เกิน 60 วันทำการ',
    extendable: 'กรณีจำเป็น ผู้มีอำนาจอนุญาตให้ลาต่อได้อีกไม่เกิน 60 วันทำการ',
  },
  personal_leave: {
    maxDays: 45,
    rule: 'ปีละไม่เกิน 45 วันทำการ',
    extendable: 'ปีแรกที่เข้ารับราชการ ลาได้ไม่เกิน 15 วัน',
  },
  annual_leave: {
    maxDays: 10,
    rule: 'ปีละ 10 วันทำการ',
    extendable: 'สะสมได้ไม่เกิน 20 วัน (รับราชการ 10 ปีขึ้นไป สะสมได้ไม่เกิน 30 วัน) — หยุดภาคการศึกษาเกินวันลาพักผ่อน จะไม่มีสิทธิลาพักผ่อน',
  },
  maternity_leave: {
    maxDays: 90,
    rule: 'ไม่เกิน 90 วัน/ครั้ง',
    extendable: 'ลาต่อเนื่องเป็นลากิจส่วนตัวเพื่อเลี้ยงดูบุตรได้ไม่เกิน 150 วันทำการ (ไม่ได้รับเงินเดือนระหว่างลา)',
  },
  paternity_leave: {
    maxDays: 15,
    rule: '15 วันทำการ',
  },
  ordination_leave: {
    maxDays: 120,
    rule: 'ไม่เกิน 120 วัน',
  },
  military_leave: {
    maxDays: 60,
    rule: 'ตรวจเลือก: รายงานผู้บังคับบัญชาก่อนไม่น้อยกว่า 48 ชม. / เตรียมพล: รายงานภายใน 48 ชม. เสร็จภารกิจกลับภายใน 7 วัน',
    extendable: 'กรณีเตรียมพล ต่อได้ไม่เกิน 15 วัน',
  },
  study_leave: {
    maxDays: 365 * 4,
    rule: 'ไม่เกิน 4 ปี',
    extendable: 'ต่อได้ไม่เกิน 6 ปี',
  },
  spouse_follow_leave: {
    maxDays: 365 * 2,
    rule: 'ไม่เกิน 2 ปี',
    extendable: 'ต่อได้ไม่เกิน 4 ปี',
  },
  rehabilitation_leave: {
    maxDays: 365,
    rule: 'ไม่เกิน 12 เดือน',
  },
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

// ความเห็นของ หน.บุคคล ตามใบลา (3 ตัวเลือก) — ทุกตัวส่งต่อให้ ผอ. ตัดสินใจ
export type HrDecision = 'acknowledge' | 'consider' | 'recommend_approve';

export const HR_DECISION_LABELS: Record<HrDecision, string> = {
  acknowledge: 'เพื่อโปรดทราบ',
  consider: 'เพื่อโปรดพิจารณา',
  recommend_approve: 'เห็นควรอนุญาต',
};

export const HR_DECISION_ORDER: HrDecision[] = [
  'acknowledge',
  'consider',
  'recommend_approve',
];

export interface LeaveSignature {
  order: LeaveSignerOrder;
  signer_user_id: string;
  signer_name: string;
  signer_role: 'hr_head' | 'director';
  status: 'approved' | 'rejected';
  signed_at: string;
  signature_url?: string | null;
  comment?: string | null;
  hr_decision?: HrDecision | null;
}

// มอบหมายหน้าที่ระหว่างลา (ตามใบลาบุคลากร ศกศ.6 ลพบุรี)
export type DelegationArea =
  | 'daily_student_care'
  | 'teaching'
  | 'classroom'
  | 'service_unit';

export const DELEGATION_AREA_LABELS: Record<DelegationArea, string> = {
  daily_student_care: 'ครูดูแลนักเรียนประจำวัน',
  teaching: 'การจัดการเรียนการสอน',
  classroom: 'ห้องเรียน',
  service_unit: 'หน่วยบริการ',
};

export const DELEGATION_AREA_ORDER: DelegationArea[] = [
  'daily_student_care',
  'teaching',
  'classroom',
  'service_unit',
];

export interface Delegation {
  area: DelegationArea;
  delegate_name: string;
}

// path คือ key ใน bucket leave-attachments (relative ไม่รวม bucket name)
// name คือชื่อไฟล์ที่ผู้ใช้แสดง (เพื่อโชว์ใน UI)
export interface LeaveAttachment {
  path: string;
  name: string;
  uploaded_at?: string;
}

export interface LeaveFormData {
  contact_address?: string;
  contact_phone?: string;
  delegate_user_id?: string | null;
  delegate_name?: string | null;
  delegations?: Delegation[];
  medical_certificate_url?: string | null;
  attachments?: LeaveAttachment[];
  notes?: string | null;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  doc_number?: string | null;
  doc_number_at?: string | null; // ตอน หน.บุคคล ลงนามแล้ว → ระบบรันเลข
  entry_source?: 'system' | 'manual'; // manual = หน.บุคคลกรอกลงทะเบียนเอง (เคสกระดาษย้อนหลัง)
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

export interface NewManualRegistryEntryInput {
  user_name: string;
  user_position: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  director_user_id: string;
  director_name: string;
  remarks?: string;
}

export interface LeaveBalance {
  leave_type: LeaveType;
  fiscal_year: number;
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
// after_approval_ok: ระบบบังคับให้แนบในที่สุด แต่ตอนยื่นไม่ block
//   (เคสลาป่วยที่ยังไม่มีใบรับรองแพทย์ในมือ — นำมาแนบหลังอนุมัติได้)
export interface AttachmentRequirement {
  required: 'always' | 'never' | 'conditional' | 'after_approval_ok';
  label: string;
  conditionDays?: number;
  hint?: string;
}

// อ้างอิงจากระเบียบสำนักนายกฯ ว่าด้วยการลาของข้าราชการ พ.ศ. 2555
export const LEAVE_TYPE_ATTACHMENTS: Record<LeaveType, AttachmentRequirement> = {
  sick_leave: {
    required: 'after_approval_ok',
    label: 'ใบรับรองแพทย์',
    hint: 'แนบได้เลย หรือนำมาแนบหลังได้รับอนุมัติ',
  },
  personal_leave: { required: 'never', label: '' },
  annual_leave: { required: 'never', label: '' },
  maternity_leave: {
    required: 'always',
    label: 'ใบรับรองแพทย์ / สูติบัตร',
  },
  paternity_leave: { required: 'always', label: 'สูติบัตรบุตร' },
  ordination_leave: { required: 'never', label: '' },
  military_leave: { required: 'always', label: 'หมายเรียก' },
  study_leave: {
    required: 'always',
    label: 'หนังสือตอบรับการเข้าศึกษา/อบรม',
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

// บังคับ ณ ตอนยื่นใบลา (after_approval_ok = ไม่บังคับช่วงยื่น แต่ต้องแนบหลังอนุมัติ)
export function isAttachmentRequired(
  leave_type: LeaveType,
  days: number,
): boolean {
  const cfg = LEAVE_TYPE_ATTACHMENTS[leave_type];
  if (cfg.required === 'always') return true;
  if (cfg.required === 'never') return false;
  if (cfg.required === 'after_approval_ok') return false;
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
