import { supabase } from '@/integrations/supabase/client';
import {
  HrDecision,
  LEAVE_TYPE_ORDER,
  LEAVE_TYPE_QUOTAS_PER_YEAR,
  LeaveBalance,
  LeaveRequest,
  LeaveSignature,
  LeaveSignerOrder,
  LeaveSignerRole,
  LeaveStatus,
  LeaveType,
  NewLeaveRequestInput,
  NewManualRegistryEntryInput,
} from '@/types/leave';
import {
  calculateLeaveDays,
  getFiscalPeriod,
  toLocalISODate,
} from '@/utils/fiscalYear';
import { isGovernmentOfficial, type Position } from '@/types/database';

const sb = supabase;

type DbSignature = {
  id: string;
  leave_request_id: string;
  signer_order: LeaveSignerOrder;
  signer_user_id: string;
  signer_name: string;
  signer_role: LeaveSignerRole;
  status: 'approved' | 'rejected';
  signed_at: string;
  signature_url: string | null;
  comment: string | null;
  hr_decision: HrDecision | null;
};

type DbLeaveRequest = {
  id: string;
  user_id: string;
  doc_number: string | null;
  doc_number_at: string | null;
  entry_source: 'system' | 'manual';
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: LeaveStatus;
  fiscal_year: number;
  fiscal_half: 1 | 2;
  current_signer_order: LeaveSignerOrder;
  form_data: Record<string, unknown> | null;
  rejection_reason: string | null;
  user_name: string | null;
  user_position: string | null;
  created_at: string;
  updated_at: string;
};

function mapDbSignature(row: DbSignature): LeaveSignature {
  return {
    order: row.signer_order,
    signer_user_id: row.signer_user_id,
    signer_name: row.signer_name,
    signer_role: row.signer_role,
    status: row.status,
    signed_at: row.signed_at,
    signature_url: row.signature_url,
    comment: row.comment,
    hr_decision: row.hr_decision,
  };
}

function mapDbRequest(row: DbLeaveRequest, sigs: DbSignature[] = []): LeaveRequest {
  return {
    id: row.id,
    user_id: row.user_id,
    doc_number: row.doc_number,
    doc_number_at: row.doc_number_at,
    entry_source: row.entry_source,
    leave_type: row.leave_type,
    start_date: row.start_date,
    end_date: row.end_date,
    days_count: row.days_count,
    reason: row.reason,
    status: row.status,
    fiscal_year: row.fiscal_year,
    fiscal_half: row.fiscal_half,
    current_signer_order: row.current_signer_order,
    signatures: sigs.map(mapDbSignature),
    form_data: row.form_data as LeaveRequest['form_data'],
    rejection_reason: row.rejection_reason,
    user_name: row.user_name ?? undefined,
    user_position: row.user_position ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function fetchSignaturesFor(
  requestIds: string[],
): Promise<Map<string, DbSignature[]>> {
  const map = new Map<string, DbSignature[]>();
  if (requestIds.length === 0) return map;
  const { data, error } = await sb
    .from('leave_signatures')
    .select('*')
    .in('leave_request_id', requestIds)
    .order('signer_order', { ascending: true });
  if (error) throw new Error(error.message ?? 'fetchSignaturesFor failed');
  for (const sig of (data as DbSignature[] | null) ?? []) {
    const arr = map.get(sig.leave_request_id) ?? [];
    arr.push(sig);
    map.set(sig.leave_request_id, arr);
  }
  return map;
}

async function getCurrentAuthUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  return data.user.id;
}

async function hydrate(rows: DbLeaveRequest[]): Promise<LeaveRequest[]> {
  if (rows.length === 0) return [];
  const sigs = await fetchSignaturesFor(rows.map((r) => r.id));
  return rows.map((r) => mapDbRequest(r, sigs.get(r.id) ?? []));
}

export async function getLeavesInRange(
  startDate: string,
  endDate: string,
): Promise<LeaveRequest[]> {
  const { data, error } = await sb
    .from('leave_requests')
    .select('*')
    .in('status', ['approved', 'in_progress'])
    .gte('end_date', startDate)
    .lte('start_date', endDate)
    .order('start_date', { ascending: true });
  if (error) throw new Error(error.message ?? 'getLeavesInRange failed');
  return hydrate((data as DbLeaveRequest[]) ?? []);
}

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

export async function getOverviewStats(): Promise<LeaveOverviewStats> {
  const period = getFiscalPeriod();
  const { data, error } = await sb
    .from('leave_requests')
    .select('*')
    .eq('fiscal_year', period.year)
    .eq('fiscal_half', period.half);
  if (error) throw new Error(error.message ?? 'getOverviewStats failed');
  const requests = await hydrate((data as DbLeaveRequest[]) ?? []);
  const today = toLocalISODate(new Date());
  const currentlyOnLeave = requests.filter(
    (r) => r.status === 'approved' && r.start_date <= today && r.end_date >= today,
  );

  const byTypeMap = new Map<LeaveType, { count: number; days: number }>();
  for (const r of requests.filter((r) => r.status === 'approved')) {
    const cur = byTypeMap.get(r.leave_type) ?? { count: 0, days: 0 };
    cur.count += 1;
    cur.days += r.days_count;
    byTypeMap.set(r.leave_type, cur);
  }

  return {
    fiscalYear: period.year,
    fiscalHalf: period.half,
    totalRequests: requests.length,
    pending: requests.filter(
      (r) => r.status === 'pending' || r.status === 'in_progress',
    ).length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
    onLeaveToday: currentlyOnLeave.length,
    byType: Array.from(byTypeMap.entries())
      .map(([leave_type, v]) => ({ leave_type, ...v }))
      .sort((a, b) => b.days - a.days),
    recent: [...requests]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 5),
    currentlyOnLeave,
  };
}

export async function getMyBalance(
  fiscalYear?: number,
): Promise<LeaveBalance[]> {
  const period = getFiscalPeriod();
  const year = fiscalYear ?? period.year;
  const authId = await getCurrentAuthUserId();
  const { data, error } = await sb
    .from('leave_requests')
    .select('leave_type, days_count, status')
    .eq('user_id', authId)
    .eq('fiscal_year', year);
  if (error) throw new Error(error.message ?? 'getMyBalance failed');
  const rows =
    (data as Array<Pick<DbLeaveRequest, 'leave_type' | 'days_count' | 'status'>>) ??
    [];

  return LEAVE_TYPE_ORDER.map((leaveType) => {
    const filtered = rows.filter((r) => r.leave_type === leaveType);
    const approved = filtered.filter((r) => r.status === 'approved');
    const pending = filtered.filter(
      (r) => r.status === 'pending' || r.status === 'in_progress',
    );
    return {
      leave_type: leaveType,
      fiscal_year: year,
      quota_days: LEAVE_TYPE_QUOTAS_PER_YEAR[leaveType],
      used_days: approved.reduce((s, r) => s + r.days_count, 0),
      pending_days: pending.reduce((s, r) => s + r.days_count, 0),
      used_count: approved.length,
      pending_count: pending.length,
    };
  });
}

// สถิติการลา "ประเภทที่กำลังขอ" ของผู้ขอลาคนหนึ่ง ในปีงบเดียวกัน — ใช้โดยหน้าผู้ลงนาม
// (signer roles มี RLS read_all_leave อยู่แล้ว จึง query ใบลาของผู้ขอได้)
// ไม่รวมใบปัจจุบัน (excludeRequestId) เพื่อให้เป็น "ประวัติที่ผ่านมา" ล้วน ๆ
export interface RequesterLeaveTypeStats {
  leave_type: LeaveType;
  fiscal_year: number;
  is_official: boolean;
  quota_days: number;
  approved_count: number;
  approved_days: number;
  pending_count: number;
  pending_days: number;
}

export async function getRequesterLeaveTypeStats(
  userId: string,
  leaveType: LeaveType,
  fiscalYear: number,
  excludeRequestId?: string,
): Promise<RequesterLeaveTypeStats> {
  const [reqRes, profRes] = await Promise.all([
    sb
      .from('leave_requests')
      .select('id, days_count, status')
      .eq('user_id', userId)
      .eq('leave_type', leaveType)
      .eq('fiscal_year', fiscalYear),
    sb.from('profiles').select('position').eq('user_id', userId).maybeSingle(),
  ]);
  if (reqRes.error)
    throw new Error(reqRes.error.message ?? 'getRequesterLeaveTypeStats failed');

  const rows = (
    (reqRes.data as Array<
      Pick<DbLeaveRequest, 'id' | 'days_count' | 'status'>
    >) ?? []
  ).filter((r) => r.id !== excludeRequestId);
  const approved = rows.filter((r) => r.status === 'approved');
  const pending = rows.filter(
    (r) => r.status === 'pending' || r.status === 'in_progress',
  );

  // profile อ่านไม่ได้ก็ถือว่าไม่ใช่ข้าราชการ (ไม่โชว์โควต้าวัน) — ไม่ทำให้ทั้งฟังก์ชันพัง
  const position = (profRes.data as { position?: string } | null)?.position;

  return {
    leave_type: leaveType,
    fiscal_year: fiscalYear,
    is_official: position
      ? isGovernmentOfficial(position as Position)
      : false,
    quota_days: LEAVE_TYPE_QUOTAS_PER_YEAR[leaveType],
    approved_count: approved.length,
    approved_days: approved.reduce((s, r) => s + r.days_count, 0),
    pending_count: pending.length,
    pending_days: pending.reduce((s, r) => s + r.days_count, 0),
  };
}

// สรุปโควต้า/สถิติการลาของ "ทุกคน" ในปีงบประมาณเดียว — ใช้โดยหน้าอนุมัติลา
// (ผู้ลงนามมี RLS hr_head/director_read_all_leave อยู่แล้ว และ profiles อ่านได้ public)
// คำนวณ balance ต่อคนต่อประเภทด้วย logic เดียวกับ getMyBalance
export interface UserLeaveSummary {
  user_id: string;
  name: string;
  prefix: string | null;
  position: string | null;
  job_position: string | null;
  is_official: boolean;
  balances: LeaveBalance[];
  total_used_days: number;
  total_pending_days: number;
  total_used_count: number;
  total_pending_count: number;
}

export async function getAllUsersLeaveSummary(
  fiscalYear?: number,
): Promise<UserLeaveSummary[]> {
  const period = getFiscalPeriod();
  const year = fiscalYear ?? period.year;

  type ProfRow = {
    user_id: string;
    prefix: string | null;
    first_name: string;
    last_name: string;
    position: string | null;
    job_position: string | null;
  };
  type ReqRow = Pick<DbLeaveRequest, 'user_id' | 'leave_type' | 'days_count' | 'status'>;

  const [profRes, reqRes] = await Promise.all([
    sb
      .from('profiles')
      .select('user_id, prefix, first_name, last_name, position, job_position')
      .not('user_id', 'is', null),
    sb
      .from('leave_requests')
      .select('user_id, leave_type, days_count, status')
      .eq('fiscal_year', year),
  ]);
  if (profRes.error)
    throw new Error(profRes.error.message ?? 'getAllUsersLeaveSummary: profiles failed');
  if (reqRes.error)
    throw new Error(reqRes.error.message ?? 'getAllUsersLeaveSummary: requests failed');

  const byUser = new Map<string, ReqRow[]>();
  for (const r of ((reqRes.data as ReqRow[]) ?? [])) {
    const arr = byUser.get(r.user_id) ?? [];
    arr.push(r);
    byUser.set(r.user_id, arr);
  }

  const summaries: UserLeaveSummary[] = ((profRes.data as ProfRow[]) ?? []).map((p) => {
    const rows = byUser.get(p.user_id) ?? [];
    const balances: LeaveBalance[] = LEAVE_TYPE_ORDER.map((leaveType) => {
      const filtered = rows.filter((r) => r.leave_type === leaveType);
      const approved = filtered.filter((r) => r.status === 'approved');
      const pending = filtered.filter(
        (r) => r.status === 'pending' || r.status === 'in_progress',
      );
      return {
        leave_type: leaveType,
        fiscal_year: year,
        quota_days: LEAVE_TYPE_QUOTAS_PER_YEAR[leaveType],
        used_days: approved.reduce((s, r) => s + r.days_count, 0),
        pending_days: pending.reduce((s, r) => s + r.days_count, 0),
        used_count: approved.length,
        pending_count: pending.length,
      };
    });
    return {
      user_id: p.user_id,
      name: `${p.prefix ?? ''}${p.first_name} ${p.last_name}`.trim(),
      prefix: p.prefix,
      position: p.position,
      job_position: p.job_position,
      is_official: p.position ? isGovernmentOfficial(p.position as Position) : false,
      balances,
      total_used_days: balances.reduce((s, b) => s + b.used_days, 0),
      total_pending_days: balances.reduce((s, b) => s + b.pending_days, 0),
      total_used_count: balances.reduce((s, b) => s + b.used_count, 0),
      total_pending_count: balances.reduce((s, b) => s + b.pending_count, 0),
    };
  });

  // คนที่ใช้วันลามากสุดก่อน แล้วเรียงตามชื่อ
  summaries.sort(
    (a, b) =>
      b.total_used_days - a.total_used_days || a.name.localeCompare(b.name, 'th'),
  );
  return summaries;
}

export async function getMyRequests(): Promise<LeaveRequest[]> {
  const authId = await getCurrentAuthUserId();
  const { data, error } = await sb
    .from('leave_requests')
    .select('*')
    .eq('user_id', authId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message ?? 'getMyRequests failed');
  return hydrate((data as DbLeaveRequest[]) ?? []);
}

// ดึงใบลาเดี่ยวตาม id (ใช้โดย Telegram Mini App หน้าลงนาม)
export async function getLeaveRequestById(
  id: string,
): Promise<LeaveRequest | null> {
  const { data, error } = await sb
    .from('leave_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message ?? 'getLeaveRequestById failed');
  if (!data) return null;
  const row = data as DbLeaveRequest;
  const sigsMap = await fetchSignaturesFor([row.id]);
  return mapDbRequest(row, sigsMap.get(row.id) ?? []);
}

export async function createLeaveRequest(
  userName: string,
  userPosition: string,
  input: NewLeaveRequestInput,
): Promise<LeaveRequest> {
  const authId = await getCurrentAuthUserId();
  const days = calculateLeaveDays(input.start_date, input.end_date);
  const period = getFiscalPeriod(new Date(input.start_date));
  const { data, error } = await sb
    .from('leave_requests')
    .insert({
      user_id: authId,
      entry_source: 'system',
      leave_type: input.leave_type,
      start_date: input.start_date,
      end_date: input.end_date,
      days_count: days,
      reason: input.reason,
      status: 'pending',
      fiscal_year: period.year,
      fiscal_half: period.half,
      current_signer_order: 1,
      form_data: input.form_data ?? null,
      user_name: userName,
      user_position: userPosition,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message ?? 'createLeaveRequest failed');
  const created = mapDbRequest(data as DbLeaveRequest, []);

  // ลาป่วยที่ครอบคลุมวันนี้ → ประกาศกลุ่ม Telegram ทันที (best-effort,
  // ไม่ block: ถ้า notify ล้มเหลว ใบลายังถูกสร้างสำเร็จ)
  // ต้อง check ทั้ง start_date <= today AND end_date >= today เพราะใบลาที่
  // ลาจบไปแล้ว (e.g., ย้อนหลังเมื่อวาน) ไม่ควรขึ้นข้อความ "ลาป่วยวันนี้"
  const todayStr = toLocalISODate(new Date());
  if (
    created.leave_type === 'sick_leave' &&
    created.start_date <= todayStr &&
    created.end_date >= todayStr
  ) {
    void supabase.functions
      .invoke('leave-telegram-notify', {
        body: { type: 'sick_immediate', request_id: created.id },
      })
      .catch((err) =>
        console.warn('[leave] sick-immediate notify failed:', err),
      );
  }

  return created;
}

// HR head registers paper-backlog leave (entry_source='manual')
export async function createManualLeaveEntry(
  input: NewManualRegistryEntryInput,
): Promise<LeaveRequest> {
  const authId = await getCurrentAuthUserId();
  const days = calculateLeaveDays(input.start_date, input.end_date);
  const period = getFiscalPeriod(new Date(input.start_date));
  const { data, error } = await sb
    .from('leave_requests')
    .insert({
      user_id: authId, // logged by HR head against their own auth; UI can extend to choose target user later
      entry_source: 'manual',
      leave_type: input.leave_type,
      start_date: input.start_date,
      end_date: input.end_date,
      days_count: days,
      reason: input.reason,
      status: 'pending',
      fiscal_year: period.year,
      fiscal_half: period.half,
      current_signer_order: 1,
      form_data: input.remarks ? { notes: input.remarks } : null,
      user_name: input.user_name,
      user_position: input.user_position,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message ?? 'createManualLeaveEntry failed');
  return mapDbRequest(data as DbLeaveRequest, []);
}

export interface ApproverContext {
  user_id: string;
  user_name: string;
  role: LeaveSignerRole;
  signature_url?: string | null;
}

// order 1 = hr_head (pending), 2 = deputy_director (in_progress), 3 = director (in_progress)
const ROLE_TO_ORDER: Record<LeaveSignerRole, LeaveSignerOrder> = {
  hr_head: 1,
  deputy_director: 2,
  director: 3,
};
const ROLE_TO_STATUS: Record<LeaveSignerRole, LeaveStatus> = {
  hr_head: 'pending',
  deputy_director: 'in_progress',
  director: 'in_progress',
};

export async function getPendingApprovals(
  approver: ApproverContext,
): Promise<LeaveRequest[]> {
  const targetOrder = ROLE_TO_ORDER[approver.role];
  const targetStatus = ROLE_TO_STATUS[approver.role];
  const { data, error } = await sb
    .from('leave_requests')
    .select('*')
    .eq('current_signer_order', targetOrder)
    .eq('status', targetStatus)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message ?? 'getPendingApprovals failed');
  return hydrate((data as DbLeaveRequest[]) ?? []);
}

export async function getPendingApprovalsByRoles(
  roles: LeaveSignerRole[],
): Promise<LeaveRequest[]> {
  if (roles.length === 0) return [];
  const orders = Array.from(new Set(roles.map((r) => ROLE_TO_ORDER[r])));
  const statuses = Array.from(new Set(roles.map((r) => ROLE_TO_STATUS[r])));
  const { data, error } = await sb
    .from('leave_requests')
    .select('*')
    .in('current_signer_order', orders)
    .in('status', statuses)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message ?? 'getPendingApprovalsByRoles failed');
  // กรอง row ที่ order/status ไม่ตรง role ที่ caller ถือจริงๆ
  // (เช่น hr_head ไม่ควรเห็น order=2/in_progress ที่ deputy ถืออยู่)
  const allowed = new Set(roles.map((r) => `${ROLE_TO_ORDER[r]}|${ROLE_TO_STATUS[r]}`));
  const rows = await hydrate((data as DbLeaveRequest[]) ?? []);
  return rows.filter((r) => allowed.has(`${r.current_signer_order}|${r.status}`));
}

export async function approveLeave(
  requestId: string,
  approver: ApproverContext,
  options?: { comment?: string; hrDecision?: HrDecision },
): Promise<LeaveRequest> {
  const { data, error } = await sb.rpc('approve_leave_request', {
    p_leave_id: requestId,
    p_signer_name: approver.user_name,
    p_signer_role: approver.role,
    p_comment: options?.comment ?? null,
    p_hr_decision: options?.hrDecision ?? null,
    p_signature_url: approver.signature_url ?? null,
  });
  if (error) throw new Error(error.message ?? 'approveLeave failed');
  const sigsMap = await fetchSignaturesFor([requestId]);
  return mapDbRequest(data as DbLeaveRequest, sigsMap.get(requestId) ?? []);
}

export async function rejectLeave(
  requestId: string,
  approver: ApproverContext,
  reason: string,
): Promise<LeaveRequest> {
  const { data, error } = await sb.rpc('reject_leave_request', {
    p_leave_id: requestId,
    p_signer_name: approver.user_name,
    p_signer_role: approver.role,
    p_reason: reason,
    p_signature_url: approver.signature_url ?? null,
  });
  if (error) throw new Error(error.message ?? 'rejectLeave failed');
  const sigsMap = await fetchSignaturesFor([requestId]);
  return mapDbRequest(data as DbLeaveRequest, sigsMap.get(requestId) ?? []);
}

export async function generateLeavePdf(req: LeaveRequest): Promise<void> {
  // TODO: ใช้ pdf-lib ลง template ใบลาบุคลากร ศกศ.6 ลพบุรี — ปัจจุบันยังเป็น placeholder
  console.log('[mock] generateLeavePdf', req);
}

// Pure-logic gate: can the caller sign right now given the request's current
// step and their allowed roles? Used by approval row UI + tests.
export function canSignNow(
  req: { current_signer_order: number },
  allowedRoles: LeaveSignerRole[],
): boolean {
  if (allowedRoles.length === 0) return false;
  if (req.current_signer_order === 1) return allowedRoles.includes('hr_head');
  if (req.current_signer_order === 2) return allowedRoles.includes('deputy_director');
  if (req.current_signer_order === 3) return allowedRoles.includes('director');
  return false;
}

// Returns the doc_number that will be assigned to the next leave that gets
// HR-head-approved. Used for previewing in the manual-entry form.
export async function getNextDocNumber(): Promise<string> {
  const { data, error } = await sb.rpc('peek_leave_doc_number', {});
  if (error) throw new Error(error.message ?? 'getNextDocNumber failed');
  return (data as string) ?? '00001';
}

// HR head registers a paper-backlog leave entry (status=approved + doc_number).
export async function addManualRegistryEntry(
  input: import('@/types/leave').NewManualRegistryEntryInput,
): Promise<LeaveRequest> {
  const days = calculateLeaveDays(input.start_date, input.end_date);
  const period = getFiscalPeriod(new Date(input.start_date));
  const { data, error } = await sb.rpc('register_manual_leave_entry', {
    p_user_name: input.user_name,
    p_user_position: input.user_position,
    p_leave_type: input.leave_type,
    p_start_date: input.start_date,
    p_end_date: input.end_date,
    p_days_count: days,
    p_fiscal_year: period.year,
    p_fiscal_half: period.half,
    p_reason: input.reason,
    p_director_user_id: input.director_user_id,
    p_director_signer_name: input.director_name,
    p_remarks: input.remarks ?? null,
  });
  if (error) throw new Error(error.message ?? 'addManualRegistryEntry failed');
  const sigsMap = await fetchSignaturesFor([(data as DbLeaveRequest).id]);
  return mapDbRequest(
    data as DbLeaveRequest,
    sigsMap.get((data as DbLeaveRequest).id) ?? [],
  );
}

// Lists every leave that has a doc_number assigned (i.e. HR-head approved or
// manually registered), most recent number first.
export async function getLeaveRegistry(): Promise<LeaveRequest[]> {
  const { data, error } = await sb
    .from('leave_requests')
    .select('*')
    .not('doc_number', 'is', null)
    .order('doc_number', { ascending: false });
  if (error) throw new Error(error.message ?? 'getLeaveRegistry failed');
  return hydrate((data as DbLeaveRequest[]) ?? []);
}
