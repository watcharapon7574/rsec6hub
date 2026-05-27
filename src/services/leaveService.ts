import { supabase } from '@/integrations/supabase/client';
import {
  HrDecision,
  LEAVE_TYPE_ORDER,
  LEAVE_TYPE_QUOTAS_PER_YEAR,
  LeaveBalance,
  LeaveRequest,
  LeaveSignature,
  LeaveSignerOrder,
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

const sb = supabase;

type DbSignature = {
  id: string;
  leave_request_id: string;
  signer_order: LeaveSignerOrder;
  signer_user_id: string;
  signer_name: string;
  signer_role: 'hr_head' | 'director';
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
    const used = filtered
      .filter((r) => r.status === 'approved')
      .reduce((sum, r) => sum + r.days_count, 0);
    const pending = filtered
      .filter((r) => r.status === 'pending' || r.status === 'in_progress')
      .reduce((sum, r) => sum + r.days_count, 0);
    return {
      leave_type: leaveType,
      fiscal_year: year,
      quota_days: LEAVE_TYPE_QUOTAS_PER_YEAR[leaveType],
      used_days: used,
      pending_days: pending,
    };
  });
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

  // ลาป่วยที่ start_date <= วันนี้ → ประกาศกลุ่ม Telegram ทันที (best-effort,
  // ไม่ block: ถ้า notify ล้มเหลว ใบลายังถูกสร้างสำเร็จ)
  if (
    created.leave_type === 'sick_leave' &&
    created.start_date <= toLocalISODate(new Date())
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
  role: 'hr_head' | 'director';
  signature_url?: string | null;
}

export async function getPendingApprovals(
  approver: ApproverContext,
): Promise<LeaveRequest[]> {
  const targetOrder = approver.role === 'hr_head' ? 1 : 2;
  const targetStatus: LeaveStatus[] =
    approver.role === 'hr_head' ? ['pending'] : ['in_progress'];
  const { data, error } = await sb
    .from('leave_requests')
    .select('*')
    .eq('current_signer_order', targetOrder)
    .in('status', targetStatus)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message ?? 'getPendingApprovals failed');
  return hydrate((data as DbLeaveRequest[]) ?? []);
}

export async function getPendingApprovalsByRoles(
  roles: ('hr_head' | 'director')[],
): Promise<LeaveRequest[]> {
  const orders = new Set<number>(roles.map((r) => (r === 'hr_head' ? 1 : 2)));
  const statuses = new Set<LeaveStatus>();
  if (roles.includes('hr_head')) statuses.add('pending');
  if (roles.includes('director')) statuses.add('in_progress');
  if (orders.size === 0 || statuses.size === 0) return [];
  const { data, error } = await sb
    .from('leave_requests')
    .select('*')
    .in('current_signer_order', Array.from(orders))
    .in('status', Array.from(statuses))
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message ?? 'getPendingApprovalsByRoles failed');
  return hydrate((data as DbLeaveRequest[]) ?? []);
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
  allowedRoles: Array<'hr_head' | 'director'>,
): boolean {
  if (allowedRoles.length === 0) return false;
  if (req.current_signer_order === 1) return allowedRoles.includes('hr_head');
  if (req.current_signer_order === 2) return allowedRoles.includes('director');
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
