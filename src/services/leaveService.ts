import {
  LEAVE_TYPE_ORDER,
  LEAVE_TYPE_QUOTAS_PER_HALF,
  LeaveBalance,
  LeaveRequest,
  LeaveSignature,
  LeaveStatus,
  LeaveType,
  NewLeaveRequestInput,
} from '@/types/leave';
import {
  calculateLeaveDays,
  FiscalHalf,
  getFiscalPeriod,
} from '@/utils/fiscalYear';

// TODO: เปลี่ยน mock เป็น call Supabase เมื่อ schema ลงตัว
const _mockStore: { requests: LeaveRequest[] } = {
  requests: [
    {
      id: 'mock-1',
      user_id: 'me',
      leave_type: 'sick_leave',
      start_date: '2026-01-15',
      end_date: '2026-01-16',
      days_count: 2,
      reason: 'ไข้หวัด มีใบรับรองแพทย์',
      status: 'approved',
      fiscal_year: 2569,
      fiscal_half: 1,
      current_signer_order: 2,
      signatures: [
        {
          order: 1,
          signer_user_id: 'hr-head',
          signer_name: 'นายสมชาย ใจดี',
          signer_role: 'hr_head',
          status: 'approved',
          signed_at: '2026-01-13T09:00:00Z',
          comment: 'อนุมัติตามขั้นตอน',
        },
        {
          order: 2,
          signer_user_id: 'director',
          signer_name: 'นางสาวสุดา ปกครอง',
          signer_role: 'director',
          status: 'approved',
          signed_at: '2026-01-13T14:30:00Z',
        },
      ],
      form_data: {
        contact_phone: '081-234-5678',
        attachments: ['ใบรับรองแพทย์_2026-01-15.pdf'],
      },
      created_at: '2026-01-12T08:00:00Z',
      updated_at: '2026-01-13T14:30:00Z',
      user_name: 'นายทดสอบ ระบบ',
      user_position: 'ครู',
    },
    {
      id: 'mock-2',
      user_id: 'me',
      leave_type: 'personal_leave',
      start_date: '2026-03-10',
      end_date: '2026-03-10',
      days_count: 1,
      reason: 'ธุระส่วนตัวเร่งด่วน',
      status: 'in_progress',
      fiscal_year: 2569,
      fiscal_half: 1,
      current_signer_order: 2,
      signatures: [
        {
          order: 1,
          signer_user_id: 'hr-head',
          signer_name: 'นายสมชาย ใจดี',
          signer_role: 'hr_head',
          status: 'approved',
          signed_at: '2026-03-08T10:00:00Z',
        },
      ],
      created_at: '2026-03-07T15:00:00Z',
      updated_at: '2026-03-08T10:00:00Z',
      user_name: 'นายทดสอบ ระบบ',
      user_position: 'ครู',
    },
    {
      id: 'mock-3',
      user_id: 'me',
      leave_type: 'personal_leave',
      start_date: '2026-05-20',
      end_date: '2026-05-22',
      days_count: 3,
      reason: 'ไปงานบวชญาติ',
      status: 'pending',
      fiscal_year: 2569,
      fiscal_half: 2,
      current_signer_order: 1,
      signatures: [],
      created_at: '2026-05-12T08:00:00Z',
      updated_at: '2026-05-12T08:00:00Z',
      user_name: 'นายทดสอบ ระบบ',
      user_position: 'ครู',
    },
    {
      id: 'mock-4',
      user_id: 'teacher-a',
      leave_type: 'sick_leave',
      start_date: '2026-05-14',
      end_date: '2026-05-14',
      days_count: 1,
      reason: 'ปวดหัว',
      status: 'approved',
      fiscal_year: 2569,
      fiscal_half: 2,
      current_signer_order: 2,
      signatures: [],
      created_at: '2026-05-13T07:00:00Z',
      updated_at: '2026-05-13T15:00:00Z',
      user_name: 'นางสาวมาลี สวัสดี',
      user_position: 'ครู คศ.1',
    },
    {
      id: 'mock-5',
      user_id: 'teacher-b',
      leave_type: 'annual_leave',
      start_date: '2026-05-12',
      end_date: '2026-05-15',
      days_count: 4,
      reason: 'พาครอบครัวไปทะเล',
      status: 'approved',
      fiscal_year: 2569,
      fiscal_half: 2,
      current_signer_order: 2,
      signatures: [],
      created_at: '2026-05-05T08:00:00Z',
      updated_at: '2026-05-08T10:00:00Z',
      user_name: 'นายอนันต์ ใจเย็น',
      user_position: 'ครู คศ.2',
    },
    {
      id: 'mock-6',
      user_id: 'teacher-c',
      leave_type: 'personal_leave',
      start_date: '2026-05-14',
      end_date: '2026-05-14',
      days_count: 1,
      reason: 'ไปทำธุระที่ธนาคาร',
      status: 'pending',
      fiscal_year: 2569,
      fiscal_half: 2,
      current_signer_order: 1,
      signatures: [],
      created_at: '2026-05-13T09:00:00Z',
      updated_at: '2026-05-13T09:00:00Z',
      user_name: 'นางสุดา พิทักษ์',
      user_position: 'ครูพี่เลี้ยง',
    },
    {
      id: 'mock-7',
      user_id: 'teacher-d',
      leave_type: 'sick_leave',
      start_date: '2026-04-25',
      end_date: '2026-04-27',
      days_count: 3,
      reason: 'ผ่าตัดเล็ก',
      status: 'rejected',
      fiscal_year: 2569,
      fiscal_half: 2,
      current_signer_order: 1,
      signatures: [
        {
          order: 1,
          signer_user_id: 'hr-head',
          signer_name: 'นายสมชาย ใจดี',
          signer_role: 'hr_head',
          status: 'rejected',
          signed_at: '2026-04-21T13:00:00Z',
          comment: 'เอกสารแพทย์ไม่ครบ',
        },
      ],
      rejection_reason: 'เอกสารแพทย์ไม่ครบ',
      created_at: '2026-04-20T08:00:00Z',
      updated_at: '2026-04-21T13:00:00Z',
      user_name: 'นายสมชาย รักงาน',
      user_position: 'ครู คศ.3',
    },
  ],
};

export interface LeaveOverviewStats {
  fiscalYear: number;
  fiscalHalf: 1 | 2;
  totalRequests: number;
  pending: number;
  approved: number;
  rejected: number;
  onLeaveToday: number;
  byType: Array<{ leave_type: LeaveType; count: number; days: number }>;
  recent: LeaveRequest[];
  currentlyOnLeave: LeaveRequest[];
}

export async function getLeavesInRange(
  startDate: string,
  endDate: string,
): Promise<LeaveRequest[]> {
  return _mockStore.requests.filter(
    (r) =>
      (r.status === 'approved' || r.status === 'in_progress') &&
      r.start_date <= endDate &&
      r.end_date >= startDate,
  );
}

export async function getOverviewStats(): Promise<LeaveOverviewStats> {
  const period = getFiscalPeriod();
  const inPeriod = _mockStore.requests.filter(
    (r) => r.fiscal_year === period.year && r.fiscal_half === period.half,
  );
  const today = new Date().toISOString().slice(0, 10);
  const currentlyOnLeave = inPeriod.filter(
    (r) => r.status === 'approved' && r.start_date <= today && r.end_date >= today,
  );

  const byTypeMap = new Map<LeaveType, { count: number; days: number }>();
  for (const r of inPeriod.filter((r) => r.status === 'approved')) {
    const cur = byTypeMap.get(r.leave_type) ?? { count: 0, days: 0 };
    cur.count += 1;
    cur.days += r.days_count;
    byTypeMap.set(r.leave_type, cur);
  }

  return {
    fiscalYear: period.year,
    fiscalHalf: period.half,
    totalRequests: inPeriod.length,
    pending: inPeriod.filter(
      (r) => r.status === 'pending' || r.status === 'in_progress',
    ).length,
    approved: inPeriod.filter((r) => r.status === 'approved').length,
    rejected: inPeriod.filter((r) => r.status === 'rejected').length,
    onLeaveToday: currentlyOnLeave.length,
    byType: Array.from(byTypeMap.entries())
      .map(([leave_type, v]) => ({ leave_type, ...v }))
      .sort((a, b) => b.days - a.days),
    recent: [...inPeriod]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 5),
    currentlyOnLeave,
  };
}

export async function getMyBalance(
  _userId: string,
  fiscalYear?: number,
  fiscalHalf?: FiscalHalf,
): Promise<LeaveBalance[]> {
  const period = getFiscalPeriod();
  const year = fiscalYear ?? period.year;
  const half = fiscalHalf ?? period.half;

  return LEAVE_TYPE_ORDER.map((leaveType) => {
    const rows = _mockStore.requests.filter(
      (r) =>
        r.leave_type === leaveType &&
        r.fiscal_year === year &&
        r.fiscal_half === half,
    );
    const used = rows
      .filter((r) => r.status === 'approved')
      .reduce((sum, r) => sum + r.days_count, 0);
    const pending = rows
      .filter((r) => r.status === 'pending' || r.status === 'in_progress')
      .reduce((sum, r) => sum + r.days_count, 0);
    return {
      leave_type: leaveType,
      fiscal_year: year,
      fiscal_half: half,
      quota_days: LEAVE_TYPE_QUOTAS_PER_HALF[leaveType],
      used_days: used,
      pending_days: pending,
    };
  });
}

export async function getMyRequests(_userId: string): Promise<LeaveRequest[]> {
  return [..._mockStore.requests].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function createLeaveRequest(
  userId: string,
  userName: string,
  userPosition: string,
  input: NewLeaveRequestInput,
): Promise<LeaveRequest> {
  const days = calculateLeaveDays(input.start_date, input.end_date);
  const period = getFiscalPeriod(new Date(input.start_date));
  const req: LeaveRequest = {
    id: `mock-${Date.now()}`,
    user_id: userId,
    leave_type: input.leave_type,
    start_date: input.start_date,
    end_date: input.end_date,
    days_count: days,
    reason: input.reason,
    status: 'pending',
    fiscal_year: period.year,
    fiscal_half: period.half,
    current_signer_order: 1,
    signatures: [],
    form_data: input.form_data ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_name: userName,
    user_position: userPosition,
  };
  _mockStore.requests.unshift(req);
  return req;
}

export interface ApproverContext {
  user_id: string;
  user_name: string;
  role: 'hr_head' | 'director';
  signature_url?: string | null;
}

export async function getPendingApprovals(
  approver: ApproverContext,
): Promise<LeaveRequest[]> {
  const targetOrder = approver.role === 'hr_head' ? 1 : 2;
  const targetStatus: LeaveStatus[] =
    approver.role === 'hr_head' ? ['pending'] : ['in_progress'];
  return _mockStore.requests
    .filter(
      (r) =>
        r.current_signer_order === targetOrder &&
        targetStatus.includes(r.status),
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
}

// admin ที่มีทั้ง 2 role: ดึงใบลาที่อยู่ใน step ที่ตัวเองอนุมัติได้ทั้งหมด
export async function getPendingApprovalsByRoles(
  roles: ('hr_head' | 'director')[],
): Promise<LeaveRequest[]> {
  const acceptOrders = new Set<number>(
    roles.map((r) => (r === 'hr_head' ? 1 : 2)),
  );
  const acceptStatus = new Set<LeaveStatus>();
  if (roles.includes('hr_head')) acceptStatus.add('pending');
  if (roles.includes('director')) acceptStatus.add('in_progress');
  return _mockStore.requests
    .filter(
      (r) => acceptOrders.has(r.current_signer_order) && acceptStatus.has(r.status),
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
}

export async function approveLeave(
  requestId: string,
  approver: ApproverContext,
  comment?: string,
): Promise<LeaveRequest> {
  const req = _mockStore.requests.find((r) => r.id === requestId);
  if (!req) throw new Error('ไม่พบใบลา');
  const order: 1 | 2 = approver.role === 'hr_head' ? 1 : 2;
  const sig: LeaveSignature = {
    order,
    signer_user_id: approver.user_id,
    signer_name: approver.user_name,
    signer_role: approver.role,
    status: 'approved',
    signed_at: new Date().toISOString(),
    signature_url: approver.signature_url,
    comment: comment ?? null,
  };
  req.signatures = [...req.signatures.filter((s) => s.order !== order), sig];
  if (order === 1) {
    req.current_signer_order = 2;
    req.status = 'in_progress';
  } else {
    req.status = 'approved';
  }
  req.updated_at = new Date().toISOString();
  return req;
}

export async function rejectLeave(
  requestId: string,
  approver: ApproverContext,
  reason: string,
): Promise<LeaveRequest> {
  const req = _mockStore.requests.find((r) => r.id === requestId);
  if (!req) throw new Error('ไม่พบใบลา');
  const order: 1 | 2 = approver.role === 'hr_head' ? 1 : 2;
  const sig: LeaveSignature = {
    order,
    signer_user_id: approver.user_id,
    signer_name: approver.user_name,
    signer_role: approver.role,
    status: 'rejected',
    signed_at: new Date().toISOString(),
    signature_url: approver.signature_url,
    comment: reason,
  };
  req.signatures = [...req.signatures.filter((s) => s.order !== order), sig];
  req.status = 'rejected';
  req.rejection_reason = reason;
  req.updated_at = new Date().toISOString();
  return req;
}

export async function generateLeavePdf(req: LeaveRequest): Promise<void> {
  // TODO: ใช้ pdf-lib ลง template จริง — ปัจจุบันแค่ placeholder
  console.log('[mock] generateLeavePdf', req);
}
