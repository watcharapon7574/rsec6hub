import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  CalendarDays,
  Clock,
  FileText,
  Plus,
  LogIn,
  LogOut,
  UserCheck,
  Users,
  ShieldCheck,
  Download,
  CheckCircle2,
  XCircle,
  Stethoscope,
  Briefcase,
  Palmtree,
  Baby,
  Heart,
  Flower,
  Shield,
  GraduationCap,
  HeartPulse,
  LayoutDashboard,
  TrendingUp,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Paperclip,
  Upload,
  ExternalLink,
  Eye,
  PenLine,
  BookOpen,
  Megaphone,
  Loader2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  DELEGATION_AREA_LABELS,
  getLeaveSteps,
  HR_DECISION_LABELS,
  HR_DECISION_ORDER,
  HrDecision,
  inferLeaveGender,
  isAttachmentRequired,
  getLeaveStatusLabel,
  LEAVE_STATUS_COLORS,
  LEAVE_TYPE_ATTACHMENTS,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_ORDER,
  LeaveAttachment,
  LeaveBalance,
  LeaveGender,
  LeaveRequest,
  LeaveSignerRole,
  LeaveStepState,
  LeaveType,
  NewManualRegistryEntryInput,
} from '@/types/leave';
import {
  calculateLeaveDays,
  formatBuddhistDate,
  formatBuddhistYear,
  formatFiscalYear,
  getFiscalPeriod,
  toLocalISODate,
} from '@/utils/fiscalYear';
import {
  addLeaveAttachment,
  addManualRegistryEntry,
  approveLeave,
  ApproverContext,
  canSignNow,
  computeAllowedSignerRoles,
  createLeaveRequest,
  getLeaveSignerConfig,
  getSignerNameMap,
  LeaveSignerConfig,
  generateLeavePdf,
  getAllUsersLeaveSummary,
  getLeaveRegistry,
  getLeavesInRange,
  getMyBalance,
  getMyRequests,
  getOverviewStats,
  getPendingApprovalsByRoles,
  getRequesterLeaveTypeStats,
  LeaveOverviewStats,
  rejectLeave,
  RequesterLeaveTypeStats,
  UserLeaveSummary,
} from '@/services/leaveService';
import {
  getPositionDisplayName,
  isGovernmentOfficial,
  type Position,
} from '@/types/database';

type TeacherAttendance = {
  id: string;
  teacher_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  is_late: boolean | null;
  late_reason: string | null;
  auto_checkout: boolean | null;
  service_point_id: string | null;
};

type ProfileLite = {
  id: string;
  prefix?: string | null;
  first_name: string;
  last_name: string;
  nickname?: string | null;
  job_position?: string | null;
  position?: string | null;
};

const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatTime = (iso: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
};

const formatDateThai = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
};

const fullName = (p: ProfileLite | undefined) => {
  if (!p) return '-';
  const prefix = p.prefix ?? '';
  const nick = p.nickname ? ` (${p.nickname})` : '';
  return `${prefix}${p.first_name} ${p.last_name}${nick}`.trim();
};

// ───────────────── Tab 1: เข้า-ออกงาน ─────────────────
const AttendanceTab: React.FC<{ profile: { id: string; position?: string } }> = ({
  profile,
}) => {
  const [loading, setLoading] = useState(true);
  const [myRows, setMyRows] = useState<TeacherAttendance[]>([]);
  const [todayAllRows, setTodayAllRows] = useState<TeacherAttendance[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileLite>>({});

  const isAdmin =
    profile.position &&
    ['director', 'deputy_director', 'assistant_director'].includes(profile.position);

  const today = new Date();
  const days6Ago = new Date(today);
  days6Ago.setDate(today.getDate() - 6);
  const rangeStart = toDateStr(days6Ago);
  const rangeEnd = toDateStr(today);
  const rangeLabel = `${formatDateThai(rangeStart)} – ${formatDateThai(rangeEnd)}`;

  useEffect(() => {
    let cancelled = false;
    const todayStr = toDateStr(today);
    const days30Ago = new Date(today);
    days30Ago.setDate(today.getDate() - 29);

    const load = async () => {
      setLoading(true);

      const myQuery = supabase
        .from('std_teacher_attendance')
        .select('*')
        .eq('teacher_id', profile.id)
        .gte('date', toDateStr(days30Ago))
        .lte('date', todayStr)
        .order('date', { ascending: false });

      const adminQuery = isAdmin
        ? supabase
            .from('std_teacher_attendance')
            .select('*')
            .gte('date', rangeStart)
            .lte('date', rangeEnd)
            .order('date', { ascending: false })
            .order('check_in', { ascending: false })
        : Promise.resolve({ data: [] });

      const [myRes, todayRes] = await Promise.all([myQuery, adminQuery]);

      if (cancelled) return;

      const my = (myRes.data as TeacherAttendance[]) ?? [];
      const todayAll = (todayRes.data as TeacherAttendance[]) ?? [];

      setMyRows(my);
      setTodayAllRows(todayAll);

      // Fetch profiles for admin table
      const ids = new Set<string>();
      todayAll.forEach((r) => ids.add(r.teacher_id));
      if (ids.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, prefix, first_name, last_name, nickname, job_position, position')
          .in('id', Array.from(ids));
        if (!cancelled && profiles) {
          const map: Record<string, ProfileLite> = {};
          (profiles as ProfileLite[]).forEach((p) => (map[p.id] = p));
          setProfileMap(map);
        }
      }

      setLoading(false);
    };

    load();

    const channel = supabase
      .channel('fastmen-teacher-attendance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'std_teacher_attendance' },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [profile.id, isAdmin]);

  const todayMine = useMemo(() => {
    const todayStr = toDateStr(new Date());
    return myRows.find((r) => r.date === todayStr) ?? null;
  }, [myRows]);

  const monthStats = useMemo(() => {
    const onTime = myRows.filter((r) => r.check_in && !r.is_late).length;
    const late = myRows.filter((r) => r.is_late).length;
    return { onTime, late, total: myRows.length };
  }, [myRows]);

  // Filter out vacant profiles for admin views
  const filteredAdminRows = useMemo(() => {
    return todayAllRows.filter((r) => {
      const p = profileMap[r.teacher_id];
      if (!p) return false;
      if (p.position === 'vacant') return false;
      const hasName = (p.first_name?.trim() || p.last_name?.trim());
      return !!hasName;
    });
  }, [todayAllRows, profileMap]);

  // Bar chart: count UNIQUE teachers per job_position over the period
  const positionStats = useMemo(() => {
    const teachersByLabel = new Map<string, Set<string>>();
    for (const r of filteredAdminRows) {
      const p = profileMap[r.teacher_id];
      const label = p?.job_position?.trim() || 'ไม่ระบุตำแหน่ง';
      if (!teachersByLabel.has(label)) teachersByLabel.set(label, new Set());
      teachersByLabel.get(label)!.add(r.teacher_id);
    }
    return Array.from(teachersByLabel.entries())
      .map(([label, set]) => ({ label, count: set.size }))
      .sort((a, b) => b.count - a.count);
  }, [filteredAdminRows, profileMap]);

  const uniqueTeacherCount = useMemo(() => {
    const ids = new Set<string>();
    filteredAdminRows.forEach((r) => ids.add(r.teacher_id));
    return ids.size;
  }, [filteredAdminRows]);

  return (
    <div className="space-y-4">
      {/* My today card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
            สถานะของฉันวันนี้
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : !todayMine ? (
            <div className="text-center py-6 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">ยังไม่มีบันทึกเข้างานวันนี้</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <LogIn className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">เข้างาน</span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {formatTime(todayMine.check_in)}
                </p>
                {todayMine.is_late && (
                  <Badge variant="destructive" className="mt-1 text-[10px]">
                    มาสาย
                  </Badge>
                )}
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <LogOut className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-muted-foreground">ออกงาน</span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {formatTime(todayMine.check_out)}
                </p>
                {todayMine.auto_checkout && (
                  <Badge
                    variant="outline"
                    className="mt-1 text-[10px] border-amber-500 text-amber-600"
                  >
                    ระบบบันทึกออกอัตโนมัติ
                  </Badge>
                )}
              </div>
              <div className="rounded-lg border border-border p-3 col-span-2">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">
                    สถิติเดือนนี้ (30 วันล่าสุด)
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <span>
                    มา <strong>{monthStats.total}</strong> วัน
                  </span>
                  <span className="text-green-600 dark:text-green-400">
                    ตรงเวลา <strong>{monthStats.onTime}</strong>
                  </span>
                  <span className="text-rose-600 dark:text-rose-400">
                    สาย <strong>{monthStats.late}</strong>
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* My 30-day history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            ประวัติของฉัน 30 วัน
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : myRows.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-6">
              ยังไม่มีประวัติ
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>เข้างาน</TableHead>
                    <TableHead>ออกงาน</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {formatDateThai(r.date)}
                      </TableCell>
                      <TableCell>{formatTime(r.check_in)}</TableCell>
                      <TableCell>{formatTime(r.check_out)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.is_late && (
                            <Badge variant="destructive" className="text-[10px]">
                              สาย
                            </Badge>
                          )}
                          {r.auto_checkout && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-amber-500 text-amber-600"
                            >
                              ลืมออก
                            </Badge>
                          )}
                          {!r.is_late && !r.auto_checkout && r.check_in && r.check_out && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-green-500 text-green-600"
                            >
                              ปกติ
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin: today all teachers */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              ครูทั้งหมด 7 วัน ({uniqueTeacherCount} คน)
            </CardTitle>
            <p className="text-xs text-muted-foreground">{rangeLabel}</p>
          </CardHeader>
          <CardContent className="space-y-4">
              {loading ? (
                <Skeleton className="h-40 w-full" />
              ) : filteredAdminRows.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-6">
                  ยังไม่มีครูเข้างานในช่วงนี้
                </p>
              ) : (
                <>
                {/* Chart by job_position */}
                <div className="rounded-lg border border-border p-3">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    แบ่งตามตำแหน่ง (จำนวนครู)
                  </h3>
                  <div style={{ height: Math.max(160, positionStats.length * 36) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={positionStats}
                        layout="vertical"
                        margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis
                          type="category"
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          width={140}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, fontSize: 12 }}
                          formatter={(v: number) => [`${v} คน`, 'จำนวน']}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {positionStats.map((_, i) => {
                            const colors = [
                              '#3b82f6',
                              '#10b981',
                              '#f59e0b',
                              '#8b5cf6',
                              '#ec4899',
                              '#06b6d4',
                              '#f43f5e',
                              '#14b8a6',
                            ];
                            return <Cell key={i} fill={colors[i % colors.length]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>วันที่</TableHead>
                        <TableHead>ครู</TableHead>
                        <TableHead>ตำแหน่ง</TableHead>
                        <TableHead>เข้างาน</TableHead>
                        <TableHead>ออกงาน</TableHead>
                        <TableHead>สถานะ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAdminRows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{formatDateThai(r.date)}</TableCell>
                          <TableCell className="font-medium">
                            {fullName(profileMap[r.teacher_id])}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {profileMap[r.teacher_id]?.job_position || '-'}
                          </TableCell>
                          <TableCell>{formatTime(r.check_in)}</TableCell>
                          <TableCell>{formatTime(r.check_out)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {r.is_late && (
                                <Badge variant="destructive" className="text-[10px]">
                                  สาย
                                </Badge>
                              )}
                              {r.auto_checkout && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-amber-500 text-amber-600"
                                >
                                  ลืมออก
                                </Badge>
                              )}
                              {!r.is_late &&
                                !r.auto_checkout &&
                                r.check_in &&
                                r.check_out && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] border-green-500 text-green-600"
                                  >
                                    ปกติ
                                  </Badge>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                </>
              )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ───────────────── Tab 2: ขอลา ─────────────────
// theme ตาม StatisticsCards: icon pill + ตัวเลขใหญ่ + label หนา
const LEAVE_TYPE_THEME: Record<
  LeaveType,
  { icon: LucideIcon; pill: string; text: string }
> = {
  sick_leave: {
    icon: Stethoscope,
    pill: 'bg-red-100 dark:bg-red-900',
    text: 'text-red-600 dark:text-red-400',
  },
  personal_leave: {
    icon: Briefcase,
    pill: 'bg-blue-100 dark:bg-blue-900',
    text: 'text-blue-600 dark:text-blue-400',
  },
  annual_leave: {
    icon: Palmtree,
    pill: 'bg-green-100 dark:bg-green-900',
    text: 'text-green-600 dark:text-green-400',
  },
  maternity_leave: {
    icon: Baby,
    pill: 'bg-pink-100 dark:bg-pink-900',
    text: 'text-pink-600 dark:text-pink-400',
  },
  paternity_leave: {
    icon: Heart,
    pill: 'bg-rose-100 dark:bg-rose-900',
    text: 'text-rose-600 dark:text-rose-400',
  },
  ordination_leave: {
    icon: Flower,
    pill: 'bg-amber-100 dark:bg-amber-900',
    text: 'text-amber-600 dark:text-amber-400',
  },
  military_leave: {
    icon: Shield,
    pill: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
  },
  study_leave: {
    icon: GraduationCap,
    pill: 'bg-indigo-100 dark:bg-indigo-900',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
  spouse_follow_leave: {
    icon: Users,
    pill: 'bg-teal-100 dark:bg-teal-900',
    text: 'text-teal-600 dark:text-teal-400',
  },
  rehabilitation_leave: {
    icon: HeartPulse,
    pill: 'bg-orange-100 dark:bg-orange-900',
    text: 'text-orange-600 dark:text-orange-400',
  },
};

// ───────────────── Stepper: หน.บุคคล → ผอ → อนุมัติ ─────────────────
const STEP_CLASS: Record<LeaveStepState, string> = {
  done: 'bg-green-500 text-white border-green-500',
  current: 'bg-blue-500 text-white border-blue-500 animate-pulse',
  pending: 'bg-muted text-muted-foreground border-border',
  rejected: 'bg-red-500 text-white border-red-500',
};

const STEP_CONNECTOR_CLASS: Record<LeaveStepState, string> = {
  done: 'bg-green-500',
  current: 'bg-gradient-to-r from-green-500 to-border',
  pending: 'bg-border',
  rejected: 'bg-red-500',
};

// ชื่อผู้ลงนาม (ไม่มีคำนำหน้า) ที่ใช้แสดงใต้แต่ละขั้นของ stepper สถานะการลา
// config = ผู้ลงนามที่ admin ตั้งไว้, nameByUserId = map user_id -> "ชื่อ นามสกุล"
interface LeaveSignerNames {
  config: LeaveSignerConfig | null;
  nameByUserId: Record<string, string>;
}
const LeaveSignerNamesContext = createContext<LeaveSignerNames>({
  config: null,
  nameByUserId: {},
});

const LeaveProgress: React.FC<{
  req: LeaveRequest;
  showLabels?: boolean;
}> = ({ req, showLabels = true }) => {
  const steps = getLeaveSteps(req);
  const { config, nameByUserId } = useContext(LeaveSignerNamesContext);

  // ชื่อของขั้นนั้น: ถ้าเซ็นแล้วใช้ผู้ที่เซ็นจริง ไม่งั้นใช้ผู้ที่ถูกตั้งไว้ใน config
  const nameForRole = (role: LeaveSignerRole): string | undefined => {
    const signed = req.signatures.find(
      (s) => s.signer_role === role,
    )?.signer_user_id;
    const uid = signed ?? config?.[role] ?? undefined;
    return uid ? nameByUserId[uid] : undefined;
  };

  const items: Array<{ state: LeaveStepState; label: string; name?: string }> = [
    { state: 'done', label: 'ส่งคำขอ' },
    { state: steps.step1, label: 'หน.บุคคล', name: nameForRole('hr_head') },
    { state: steps.step2, label: 'รอง ผอ.', name: nameForRole('deputy_director') },
    { state: steps.step3, label: 'ผอ.', name: nameForRole('director') },
    { state: steps.step4, label: 'อนุมัติ' },
  ];

  return (
    <div className={`flex items-center ${showLabels ? 'gap-1' : 'gap-0.5'}`}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1">
            {showLabels && (
              <span className="text-[9px] text-muted-foreground opacity-80 whitespace-nowrap leading-tight">
                {item.name || ' '}
              </span>
            )}
            <div
              className={`${
                showLabels ? 'w-7 h-7' : 'w-5 h-5'
              } rounded-full border-2 flex items-center justify-center transition-colors ${STEP_CLASS[item.state]}`}
            >
              {item.state === 'done' && (
                <Check className={showLabels ? 'h-4 w-4' : 'h-3 w-3'} />
              )}
              {item.state === 'rejected' && (
                <X className={showLabels ? 'h-4 w-4' : 'h-3 w-3'} />
              )}
              {item.state === 'current' && (
                <Clock className={showLabels ? 'h-4 w-4' : 'h-3 w-3'} />
              )}
              {item.state === 'pending' && (
                <span
                  className={`rounded-full bg-current ${
                    showLabels ? 'w-1.5 h-1.5' : 'w-1 h-1'
                  } opacity-60`}
                />
              )}
            </div>
            {showLabels && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap leading-tight">
                {item.label}
              </span>
            )}
          </div>
          {i < items.length - 1 && (
            <div
              className={`h-0.5 flex-1 min-w-[12px] ${STEP_CONNECTOR_CLASS[item.state]}`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// ───────────────── Leave Detail Dialog ─────────────────
// ข้อความความเห็นสำเร็จรูปของรอง ผอ. (ตัวเลือกที่ 1)
const DEPUTY_PRESET_COMMENT = 'จึงเรียนมาเพื่อโปรดพิจารณาอนุญาต';

// export ไว้ให้ Telegram Mini App (TelegramLeaveSignPage) reuse modal เดียวกัน
export const LeaveDetailDialog: React.FC<{
  request: LeaveRequest | null;
  onClose: () => void;
  approver?: ApproverContext | null;
  canApprove?: boolean;
  // เจ้าของใบลาเปิดดูใบตัวเอง → แนบเอกสารเพิ่มได้ (เช่น ตามใบรับรองแพทย์มาทีหลัง)
  canAttach?: boolean;
  onChanged?: () => void;
}> = ({ request, onClose, approver, canApprove, canAttach, onChanged }) => {
  const { toast } = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [hrDecision, setHrDecision] = useState<HrDecision | null>(null);
  // ความเห็นรอง ผอ. ก่อนอนุมัติ: 'preset' = ใช้ข้อความสำเร็จรูป, 'custom' = พิมพ์เอง
  const [deputyMode, setDeputyMode] = useState<'preset' | 'custom' | null>(null);
  const [deputyComment, setDeputyComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [reqStats, setReqStats] = useState<RequesterLeaveTypeStats | null>(null);
  // ไฟล์ที่เพิ่งแนบในรอบนี้ — โชว์ทันทีโดยไม่ต้องรอ parent refetch+reopen
  const [justAttached, setJustAttached] = useState<LeaveAttachment[]>([]);
  const [attaching, setAttaching] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!request) {
      setRejecting(false);
      setRejectReason('');
      setHrDecision(null);
      setDeputyMode(null);
      setDeputyComment('');
      setReqStats(null);
    }
    setJustAttached([]);
  }, [request]);

  // โหลดสถิติการลา "ประเภทที่กำลังขอ" ของผู้ขอ (ปีงบเดียวกัน ไม่รวมใบนี้)
  useEffect(() => {
    if (!request) return;
    let alive = true;
    setReqStats(null);
    getRequesterLeaveTypeStats(
      request.user_id,
      request.leave_type,
      request.fiscal_year,
      request.id,
    )
      .then((s) => {
        if (alive) setReqStats(s);
      })
      .catch(() => {
        /* สถิติโหลดไม่ได้ก็ไม่เป็นไร — ไม่ใช่ข้อมูลหลักของหน้าอนุมัติ */
      });
    return () => {
      alive = false;
    };
  }, [request]);

  if (!request) return null;

  const theme = LEAVE_TYPE_THEME[request.leave_type];
  const Icon = theme.icon;
  const attachmentCfg = LEAVE_TYPE_ATTACHMENTS[request.leave_type];
  // ลาป่วย: 60 วันคือเพดาน "การได้รับเงินเดือน" ต่อปี (ขยายได้ถึง 120) ไม่ใช่เพดานการลา
  // — ลาได้เท่าที่ป่วยจริง จึงโชว์ "จำนวนที่ลาไปแล้ว" ไม่ใช่ "เหลือ"
  const isSickLeave = request.leave_type === 'sick_leave';

  const handleApprove = async (opts?: {
    hrDecision?: HrDecision;
    comment?: string;
  }) => {
    if (!approver) return;
    setBusy(true);
    try {
      await approveLeave(request.id, approver, {
        hrDecision: opts?.hrDecision,
        comment: opts?.comment,
      });
      toast({
        title: 'อนุมัติแล้ว',
        description:
          approver.role === 'hr_head' && opts?.hrDecision
            ? HR_DECISION_LABELS[opts.hrDecision]
            : opts?.comment || undefined,
      });
      onChanged?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!approver || !rejectReason.trim()) {
      toast({ title: 'กรุณากรอกเหตุผล', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await rejectLeave(request.id, approver, rejectReason);
      toast({ title: 'ปฏิเสธแล้ว' });
      onChanged?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const attachments = [
    ...(request.form_data?.attachments ?? []),
    ...justAttached,
  ];

  // เจ้าของแนบเอกสารเพิ่มได้ตราบใบยังไม่ถูกปฏิเสธ (pending / in_progress / approved)
  const showAttachButton = !!canAttach && request.status !== 'rejected';

  const handleAttach = async (file: File) => {
    setAttaching(true);
    try {
      const updated = await addLeaveAttachment(request.id, file);
      const next = updated.form_data?.attachments ?? [];
      // เอาเฉพาะรายการที่ยังไม่อยู่ใน request เดิม มาโชว์เป็น justAttached
      const existing = new Set(
        (request.form_data?.attachments ?? []).map((a) =>
          typeof a === 'string' ? a : a.path,
        ),
      );
      setJustAttached(
        next.filter((a) => (typeof a === 'string' ? !existing.has(a) : !existing.has(a.path))),
      );
      toast({ title: 'แนบเอกสารแล้ว', description: file.name });
      onChanged?.();
    } catch (err) {
      toast({
        title: 'แนบเอกสารไม่สำเร็จ',
        description: err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ',
        variant: 'destructive',
      });
    } finally {
      setAttaching(false);
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl ${theme.pill} flex-shrink-0`}>
              <Icon className={`h-6 w-6 ${theme.text}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-bold">
                {LEAVE_TYPE_LABELS[request.leave_type]}
              </div>
              <div className="text-xs text-muted-foreground font-normal mt-0.5">
                {request.user_name} · {request.user_position}
              </div>
              <div className="mt-1.5">
                <Badge className={LEAVE_STATUS_COLORS[request.status]}>
                  {getLeaveStatusLabel(request)}
                </Badge>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="text-xs font-semibold text-muted-foreground mb-3">
              สถานะการลงนาม
            </div>
            <LeaveProgress req={request} showLabels />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">วันที่เริ่มลา</div>
              <div className="font-medium">
                {formatBuddhistDate(request.start_date)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">วันที่สิ้นสุด</div>
              <div className="font-medium">
                {formatBuddhistDate(request.end_date)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">จำนวนวัน</div>
              <div className="font-medium">{request.days_count} วัน</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">ปีงบประมาณ</div>
              <div className="font-medium">
                {formatBuddhistYear(request.fiscal_year)} (ครึ่งที่ {request.fiscal_half})
              </div>
            </div>
            {request.form_data?.contact_phone && (
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">
                  เบอร์ติดต่อระหว่างลา
                </div>
                <div className="font-medium">
                  {request.form_data.contact_phone}
                </div>
              </div>
            )}
          </div>

          {reqStats && (
            <div className={`rounded-xl border ${theme.pill} p-3`}>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                ประวัติการลา{LEAVE_TYPE_LABELS[request.leave_type]} ปีงบ{' '}
                {formatBuddhistYear(request.fiscal_year)} (ไม่รวมใบนี้)
              </div>
              <div className="text-sm">
                <span className="font-bold text-base">
                  อนุมัติแล้ว {reqStats.approved_count} ครั้ง
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  · รวม {reqStats.approved_days} วัน
                  {reqStats.is_official && !isSickLeave && (
                    <>
                      {' '}
                      (เหลือ{' '}
                      {Math.max(
                        0,
                        reqStats.quota_days -
                          reqStats.approved_days -
                          reqStats.pending_days,
                      )}{' '}
                      / {reqStats.quota_days} วัน)
                    </>
                  )}
                </span>
                {reqStats.pending_count > 0 && (
                  <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    + มีใบรออนุมัติอีก {reqStats.pending_count} ครั้ง (
                    {reqStats.pending_days} วัน)
                  </div>
                )}

                {/* ลาป่วย (ข้าราชการ): โชว์จำนวนที่ลาไปแล้วเทียบเพดานเงินเดือน 60 วันทำการ/ปี */}
                {reqStats.is_official && isSickLeave && (
                  reqStats.approved_days > 60 ? (
                    <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      ⚠ ลาป่วยแล้ว {reqStats.approved_days} วัน — เกิน 60 วันทำการ
                      ที่ได้รับเงินเดือน/ปี (ขยายได้ถึง 120 วัน)
                    </div>
                  ) : (
                    <div className="text-xs text-foreground/70 mt-0.5">
                      ได้รับเงินเดือนระหว่างลาป่วยแล้ว {reqStats.approved_days} /
                      60 วันทำการ (ปีงบนี้)
                    </div>
                  )
                )}

                {/* ผลถ้าอนุมัติใบนี้ */}
                {reqStats.is_official && !isSickLeave && (
                  <div className="text-xs text-foreground/70 mt-0.5">
                    ถ้าอนุมัติใบนี้ ({request.days_count} วัน) จะเหลือ{' '}
                    <span className="font-semibold">
                      {Math.max(
                        0,
                        reqStats.quota_days -
                          reqStats.approved_days -
                          reqStats.pending_days -
                          request.days_count,
                      )}
                    </span>{' '}
                    / {reqStats.quota_days} วัน
                  </div>
                )}
                {reqStats.is_official && isSickLeave && (
                  <div className="text-xs text-foreground/70 mt-0.5">
                    ถ้าอนุมัติใบนี้ ({request.days_count} วัน) จะลาป่วยรวมเป็น{' '}
                    <span className="font-semibold">
                      {reqStats.approved_days + request.days_count}
                    </span>{' '}
                    วัน
                    {reqStats.approved_days + request.days_count > 60
                      ? ' (เกิน 60 วันทำการที่ได้รับเงินเดือน)'
                      : ' / 60 วันทำการ'}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs text-muted-foreground mb-1">
              เหตุผลการลา
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 text-sm whitespace-pre-wrap">
              {request.reason}
            </div>
          </div>

          {request.form_data?.delegations &&
            request.form_data.delegations.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1.5">
                  มอบหมายหน้าที่ระหว่างลา
                </div>
                <div className="space-y-1.5">
                  {request.form_data.delegations.map((d, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                    >
                      <span className="font-medium min-w-[160px]">
                        {DELEGATION_AREA_LABELS[d.area]}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span>{d.delegate_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {(attachmentCfg.required !== 'never' ||
            attachments.length > 0 ||
            showAttachButton) && (
            <div>
              <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                เอกสารแนบ{attachmentCfg.label ? ` (${attachmentCfg.label})` : ''}
              </div>
              {attachments.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                  ยังไม่มีเอกสารแนบ
                </div>
              ) : (
                <div className="space-y-1.5">
                  {attachments.map((a, i) => {
                    const isLegacyString = typeof a === 'string';
                    const displayName = isLegacyString ? a : a.name;
                    const storagePath = isLegacyString ? null : a.path;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={async () => {
                          if (!storagePath) {
                            toast({
                              title: 'ไฟล์เก่า (mock) ไม่มีในระบบ',
                              description: displayName,
                              variant: 'destructive',
                            });
                            return;
                          }
                          const { data, error } = await supabase.storage
                            .from('leave-attachments')
                            .createSignedUrl(storagePath, 300);
                          if (error || !data?.signedUrl) {
                            toast({
                              title: 'เปิดเอกสารไม่สำเร็จ',
                              description: error?.message ?? 'ไม่พบไฟล์',
                              variant: 'destructive',
                            });
                            return;
                          }
                          // ใน Telegram Mini App ต้องใช้ openLink (window.open ถูกบล็อก/ไม่เปิด)
                          const tg = (window as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } }).Telegram?.WebApp;
                          if (tg?.openLink) tg.openLink(data.signedUrl);
                          else window.open(data.signedUrl, '_blank', 'noopener');
                        }}
                        className="w-full flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                      >
                        <Paperclip className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <span className="flex-1 text-left truncate">{displayName}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              )}
              {showAttachButton && (
                <>
                  <input
                    ref={attachInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/heic,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      if (f.size > 10 * 1024 * 1024) {
                        toast({
                          title: 'ไฟล์ใหญ่เกิน 10MB',
                          variant: 'destructive',
                        });
                        return;
                      }
                      void handleAttach(f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={attaching}
                    onClick={() => attachInputRef.current?.click()}
                    className="mt-2 w-full"
                  >
                    {attaching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {attachments.length > 0 ? 'แนบเอกสารเพิ่ม' : 'แนบเอกสาร'}
                  </Button>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    รองรับ รูปภาพ หรือ PDF (สูงสุด 10MB) — แนบเพิ่มได้ทั้งก่อนและหลังอนุมัติ
                  </p>
                </>
              )}
            </div>
          )}

          {request.signatures.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">
                ประวัติการลงนาม
              </div>
              <div className="space-y-2">
                {request.signatures
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((sig, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border p-2.5 ${
                        sig.status === 'rejected'
                          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
                          : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-sm">
                          {sig.status === 'rejected' ? (
                            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          )}
                          <span className="font-medium">{sig.signer_name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({sig.signer_role === 'hr_head'
                              ? 'หน.บุคคล'
                              : sig.signer_role === 'deputy_director'
                                ? 'รอง ผอ.'
                                : 'ผอ.'})
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(sig.signed_at).toLocaleString('th-TH', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </div>
                      </div>
                      {sig.signer_role === 'hr_head' && sig.hr_decision && (
                        <div className="mt-1.5 text-xs font-medium text-green-700 dark:text-green-300">
                          ความเห็น: {HR_DECISION_LABELS[sig.hr_decision]}
                        </div>
                      )}
                      {sig.comment && (
                        <div className="mt-1.5 text-xs text-muted-foreground italic">
                          "{sig.comment}"
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {request.rejection_reason && (
            <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
              <div className="text-xs text-red-700 dark:text-red-300 font-semibold mb-1">
                เหตุผลที่ไม่อนุมัติ
              </div>
              <div className="text-sm text-red-700 dark:text-red-300">
                {request.rejection_reason}
              </div>
            </div>
          )}

          {request.status === 'approved' && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                generateLeavePdf(request);
                toast({
                  title: 'กำลังสร้าง PDF',
                  description: '(mock) ระบบจะ download ใบลาเมื่อ template พร้อม',
                });
              }}
            >
              <Download className="h-4 w-4 mr-2" /> โหลดใบลา PDF
            </Button>
          )}

          {canApprove && approver && (
            <>
              {!rejecting ? (
                approver.role === 'hr_head' ? (
                  <div className="space-y-3 pt-3 border-t">
                    <div className="text-sm font-semibold">
                      ความเห็น หน.บุคคล{' '}
                      <span className="text-muted-foreground font-normal">
                        (เลือก 1)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {HR_DECISION_ORDER.map((d) => {
                        const selected = hrDecision === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setHrDecision(d)}
                            disabled={busy}
                            aria-pressed={selected}
                            className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left text-sm font-medium transition-colors disabled:opacity-50 ${
                              selected
                                ? 'border-green-600 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200'
                                : 'border-border hover:border-green-400 hover:bg-green-50/40 dark:hover:bg-green-950/20'
                            }`}
                          >
                            <span
                              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                                selected
                                  ? 'border-green-600 bg-green-600'
                                  : 'border-muted-foreground/40'
                              }`}
                            >
                              {selected && (
                                <CheckCircle2 className="h-4 w-4 text-white" />
                              )}
                            </span>
                            {HR_DECISION_LABELS[d]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        variant="destructive"
                        onClick={() => setRejecting(true)}
                        disabled={busy}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> ปฏิเสธ
                      </Button>
                      <Button
                        onClick={() => handleApprove({ hrDecision: hrDecision! })}
                        disabled={busy || !hrDecision}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        {busy ? 'กำลังบันทึก...' : 'อนุมัติ'}
                      </Button>
                    </div>
                  </div>
                ) : approver.role === 'deputy_director' ? (
                  <div className="space-y-3 pt-3 border-t">
                    <div className="text-sm font-semibold">
                      ความเห็น รอง ผอ.{' '}
                      <span className="text-muted-foreground font-normal">
                        (เลือก 1)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {/* ตัวเลือก 1: ข้อความสำเร็จรูป */}
                      <button
                        type="button"
                        onClick={() => setDeputyMode('preset')}
                        disabled={busy}
                        aria-pressed={deputyMode === 'preset'}
                        className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left text-sm font-medium transition-colors disabled:opacity-50 ${
                          deputyMode === 'preset'
                            ? 'border-green-600 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200'
                            : 'border-border hover:border-green-400 hover:bg-green-50/40 dark:hover:bg-green-950/20'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                            deputyMode === 'preset'
                              ? 'border-green-600 bg-green-600'
                              : 'border-muted-foreground/40'
                          }`}
                        >
                          {deputyMode === 'preset' && (
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          )}
                        </span>
                        {DEPUTY_PRESET_COMMENT}
                      </button>
                      {/* ตัวเลือก 2: พิมพ์ความเห็นเอง */}
                      <button
                        type="button"
                        onClick={() => setDeputyMode('custom')}
                        disabled={busy}
                        aria-pressed={deputyMode === 'custom'}
                        className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left text-sm font-medium transition-colors disabled:opacity-50 ${
                          deputyMode === 'custom'
                            ? 'border-green-600 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200'
                            : 'border-border hover:border-green-400 hover:bg-green-50/40 dark:hover:bg-green-950/20'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                            deputyMode === 'custom'
                              ? 'border-green-600 bg-green-600'
                              : 'border-muted-foreground/40'
                          }`}
                        >
                          {deputyMode === 'custom' && (
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          )}
                        </span>
                        พิมพ์ความเห็นเอง
                      </button>
                      {deputyMode === 'custom' && (
                        <Textarea
                          rows={2}
                          value={deputyComment}
                          onChange={(e) => setDeputyComment(e.target.value)}
                          placeholder="พิมพ์ความเห็นของรอง ผอ. ..."
                          disabled={busy}
                          autoFocus
                        />
                      )}
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        variant="destructive"
                        onClick={() => setRejecting(true)}
                        disabled={busy}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> ปฏิเสธ
                      </Button>
                      <Button
                        onClick={() =>
                          handleApprove({
                            comment:
                              deputyMode === 'preset'
                                ? DEPUTY_PRESET_COMMENT
                                : deputyComment.trim(),
                          })
                        }
                        disabled={
                          busy ||
                          !deputyMode ||
                          (deputyMode === 'custom' && !deputyComment.trim())
                        }
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        {busy ? 'กำลังบันทึก...' : 'อนุมัติ'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="destructive"
                      onClick={() => setRejecting(true)}
                      disabled={busy}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> ปฏิเสธ
                    </Button>
                    <Button onClick={() => handleApprove()} disabled={busy}>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      {busy ? 'กำลังบันทึก...' : 'อนุมัติ'}
                    </Button>
                  </div>
                )
              ) : (
                <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/40 dark:bg-red-950/30 p-3">
                  <Label className="text-red-700 dark:text-red-300 text-sm">
                    เหตุผลที่ไม่อนุมัติ
                  </Label>
                  <Textarea
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="ระบุเหตุผลเพื่อแจ้งผู้ขอลา..."
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRejecting(false)}
                      disabled={busy}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleReject}
                      disabled={busy}
                    >
                      {busy ? 'กำลังบันทึก...' : 'ยืนยันปฏิเสธ'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

type LeaveProfile = {
  id: string;
  user_id?: string | null;
  is_admin?: boolean | null;
  prefix?: string | null;
  first_name: string;
  last_name: string;
  gender?: string | null;
  position?: Position | null;
  job_position?: string | null;
  org_structure_role?: string | null;
  signature_url?: string | null;
};

// ───────────────── Leave Calendar (เดือน) ─────────────────
const THAI_MONTH_NAMES = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];
const THAI_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];


const shortName = (full?: string) => {
  if (!full) return '-';
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0].slice(0, 4)} ${parts[parts.length - 1].slice(0, 6)}`;
};

const LeaveCalendar: React.FC = () => {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    (async () => {
      const data = await getLeavesInRange(
        toLocalISODate(start),
        toLocalISODate(end),
      );
      if (alive) {
        setLeaves(data);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [year, month]);

  const days = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const firstDayOfWeek = firstOfMonth.getDay();
    const start = new Date(year, month, 1 - firstDayOfWeek);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [year, month]);

  const dayLeaves = (date: Date) => {
    const ds = toLocalISODate(date);
    return leaves.filter((l) => l.start_date <= ds && l.end_date >= ds);
  };

  const todayStr = toLocalISODate(new Date());
  const selectedLeaves = selectedDate
    ? leaves.filter(
        (l) => l.start_date <= selectedDate && l.end_date >= selectedDate,
      )
    : [];

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          ปฏิทินการลา
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-semibold min-w-[140px] text-center">
            {THAI_MONTH_NAMES[month]} {year + 543}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-80 rounded-lg" />
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {THAI_WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={`text-center text-xs font-semibold py-1 ${
                  i === 0
                    ? 'text-red-500'
                    : i === 6
                      ? 'text-blue-500'
                      : 'text-muted-foreground'
                }`}
              >
                {w}
              </div>
            ))}
            {days.map((d) => {
              const ds = toLocalISODate(d);
              const isCurrentMonth = d.getMonth() === month;
              const isToday = ds === todayStr;
              const isSelected = ds === selectedDate;
              const dl = dayLeaves(d);
              const visible = dl.slice(0, 2);
              const extra = dl.length - visible.length;
              return (
                <button
                  key={ds}
                  type="button"
                  onClick={() => setSelectedDate(ds === selectedDate ? null : ds)}
                  className={`min-h-[68px] rounded-lg border p-1 text-left transition-colors ${
                    isSelected
                      ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/60 dark:bg-blue-950/30'
                      : isToday
                        ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/30'
                        : isCurrentMonth
                          ? 'bg-card hover:bg-muted/40'
                          : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <div
                    className={`text-xs font-semibold ${
                      isToday
                        ? 'text-blue-600 dark:text-blue-400'
                        : !isCurrentMonth
                          ? 'opacity-50'
                          : ''
                    }`}
                  >
                    {d.getDate()}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {visible.map((l) => {
                      const theme = LEAVE_TYPE_THEME[l.leave_type];
                      return (
                        <div
                          key={l.id}
                          className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ${theme.pill} ${theme.text}`}
                          title={`${l.user_name} · ${LEAVE_TYPE_LABELS[l.leave_type]}`}
                        >
                          {shortName(l.user_name)}
                        </div>
                      );
                    })}
                    {extra > 0 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{extra} อื่นๆ
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedDate && (
          <div className="mt-4 rounded-lg border bg-muted/30 p-3">
            <div className="text-sm font-semibold mb-2">
              ผู้ลาวันที่{' '}
              {new Date(selectedDate).toLocaleDateString('th-TH', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              {selectedLeaves.length > 0 && (
                <span className="text-muted-foreground font-normal ml-1">
                  ({selectedLeaves.length} คน)
                </span>
              )}
            </div>
            {selectedLeaves.length === 0 ? (
              <p className="text-xs text-muted-foreground">ไม่มีผู้ลา</p>
            ) : (
              <div className="space-y-1.5">
                {selectedLeaves.map((l) => {
                  const theme = LEAVE_TYPE_THEME[l.leave_type];
                  const Icon = theme.icon;
                  return (
                    <div
                      key={l.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <div className={`p-1.5 rounded ${theme.pill}`}>
                        <Icon className={`h-3.5 w-3.5 ${theme.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {l.user_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {LEAVE_TYPE_LABELS[l.leave_type]} ·{' '}
                          {new Date(l.start_date).toLocaleDateString('th-TH')} -{' '}
                          {new Date(l.end_date).toLocaleDateString('th-TH')}
                        </div>
                      </div>
                      {l.status === 'in_progress' && (
                        <Badge className={LEAVE_STATUS_COLORS.in_progress}>
                          รอ ผอ.
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ───────────────── Tab 1: ภาพรวม (admin/HR/ผอ) ─────────────────
const OverviewTab: React.FC = () => {
  const [stats, setStats] = useState<LeaveOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await getOverviewStats();
      if (alive) {
        setStats(s);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const statCards = [
    {
      label: 'ใบลาทั้งหมด',
      value: stats.totalRequests,
      icon: FileText,
      pill: 'bg-blue-100 dark:bg-blue-900',
      text: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'รออนุมัติ',
      value: stats.pending,
      icon: Clock,
      pill: 'bg-yellow-100 dark:bg-yellow-900',
      text: 'text-yellow-600 dark:text-yellow-400',
    },
    {
      label: 'อนุมัติแล้ว',
      value: stats.approved,
      icon: CheckCircle2,
      pill: 'bg-green-100 dark:bg-green-900',
      text: 'text-green-600 dark:text-green-400',
    },
    {
      label: 'ลาวันนี้',
      value: stats.onLeaveToday,
      icon: Users,
      pill: 'bg-purple-100 dark:bg-purple-900',
      text: 'text-purple-600 dark:text-purple-400',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${s.pill}`}>
                  <s.icon className={`h-4 w-4 ${s.text}`} />
                </div>
                <span className={`text-3xl sm:text-4xl font-bold ${s.text}`}>
                  {s.value}
                </span>
              </div>
              <h3 className="font-semibold text-foreground text-sm">{s.label}</h3>
            </CardContent>
          </Card>
        ))}
      </div>

      <LeaveCalendar />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              สถิติตามประเภทการลา
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              เฉพาะที่อนุมัติแล้ว · ครึ่งปีงบปัจจุบัน
            </p>
          </CardHeader>
          <CardContent>
            {stats.byType.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                ยังไม่มีข้อมูล
              </div>
            ) : (
              <div className="space-y-2">
                {stats.byType.map((t) => {
                  const theme = LEAVE_TYPE_THEME[t.leave_type];
                  const Icon = theme.icon;
                  const max = Math.max(...stats.byType.map((x) => x.days));
                  const pct = max > 0 ? (t.days / max) * 100 : 0;
                  return (
                    <div key={t.leave_type} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Icon className={`h-3.5 w-3.5 ${theme.text}`} />
                          <span className="font-medium">
                            {LEAVE_TYPE_LABELS[t.leave_type]}
                          </span>
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {t.count} ครั้ง · {t.days} วัน
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              ผู้ที่กำลังลา (วันนี้)
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {stats.currentlyOnLeave.length} คน
            </p>
          </CardHeader>
          <CardContent>
            {stats.currentlyOnLeave.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                ไม่มีคนลาวันนี้
              </div>
            ) : (
              <div className="space-y-2">
                {stats.currentlyOnLeave.map((r) => {
                  const theme = LEAVE_TYPE_THEME[r.leave_type];
                  const Icon = theme.icon;
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 p-2 rounded-lg border bg-card"
                    >
                      <div className={`p-2 rounded-lg ${theme.pill}`}>
                        <Icon className={`h-4 w-4 ${theme.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {r.user_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {LEAVE_TYPE_LABELS[r.leave_type]} ·{' '}
                          {new Date(r.start_date).toLocaleDateString('th-TH')}{' '}
                          - {new Date(r.end_date).toLocaleDateString('th-TH')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            ใบลาล่าสุด
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ผู้ขอ</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>วันที่</TableHead>
                  <TableHead>จำนวน</TableHead>
                  <TableHead>สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div>{r.user_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.user_position}
                      </div>
                    </TableCell>
                    <TableCell>{LEAVE_TYPE_LABELS[r.leave_type]}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(r.start_date).toLocaleDateString('th-TH')} -{' '}
                      {new Date(r.end_date).toLocaleDateString('th-TH')}
                    </TableCell>
                    <TableCell>{r.days_count} วัน</TableCell>
                    <TableCell>
                      <Badge className={LEAVE_STATUS_COLORS[r.status]}>
                        {getLeaveStatusLabel(r)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// 4 ประเภทหลักตามใบลาบุคลากร ศกศ.6 ลพบุรี — โชว์เด่นในหน้าโควต้า
// ตัวที่ 4 สลับ maternity↔paternity ตามเพศของผู้ใช้
function getMainLeaveTypes(gender: LeaveGender): LeaveType[] {
  const parental: LeaveType = gender === 'male' ? 'paternity_leave' : 'maternity_leave';
  return ['sick_leave', 'personal_leave', 'annual_leave', parental];
}

const LeaveTab: React.FC<{ profile: LeaveProfile }> = ({ profile }) => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailReq, setDetailReq] = useState<LeaveRequest | null>(null);
  const [showOtherQuotas, setShowOtherQuotas] = useState(false);
  const period = useMemo(() => getFiscalPeriod(), []);

  const gender = useMemo(
    () => inferLeaveGender({ prefix: profile.prefix, gender: profile.gender }),
    [profile],
  );
  const mainTypes = useMemo(() => getMainLeaveTypes(gender), [gender]);

  const mainBalance = useMemo(
    () => mainTypes.map((t) => balance.find((b) => b.leave_type === t)).filter(
      (b): b is LeaveBalance => !!b,
    ),
    [balance, mainTypes],
  );
  const otherBalance = useMemo(
    () => balance.filter((b) => !mainTypes.includes(b.leave_type)),
    [balance, mainTypes],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [b, r] = await Promise.all([
        getMyBalance(),
        getMyRequests(),
      ]);
      if (!alive) return;
      setBalance(b);
      setRequests(r);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [profile.id]);

  const refresh = async () => {
    const [b, r] = await Promise.all([
      getMyBalance(),
      getMyRequests(),
    ]);
    setBalance(b);
    setRequests(r);
  };

  const isOfficial = profile.position
    ? isGovernmentOfficial(profile.position)
    : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            {isOfficial ? 'โควต้าการลา' : 'สถิติการลา'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatFiscalYear(period.year)}
            {!isOfficial && ' · ไม่ใช่ข้าราชการ — ไม่มีระบบโควต้า'}
          </p>
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {mainBalance.map((b) => {
              const theme = LEAVE_TYPE_THEME[b.leave_type];
              const Icon = theme.icon;
              // ลาป่วย: 60 = เพดาน "ได้รับเงินเดือน" /ปี (ขยายได้ถึง 120) ไม่ใช่เพดานการลา
              const isSickLeave = b.leave_type === 'sick_leave';
              const remain = b.quota_days - b.used_days - b.pending_days;
              const pct =
                b.quota_days > 0 ? (b.used_days / b.quota_days) * 100 : 0;
              const danger = isOfficial && !isSickLeave && remain <= 0;
              const sickOverPaid =
                isOfficial && isSickLeave && b.used_days > 60;
              return (
                <Card
                  key={b.leave_type}
                  className={`flex flex-col w-full ${
                    danger ? 'border-red-300' : ''
                  }`}
                >
                  <CardContent className="pt-4 pb-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`p-2 rounded-lg ${theme.pill}`}>
                          <Icon className={`h-4 w-4 ${theme.text}`} />
                        </div>
                        <div className="flex items-baseline gap-1">
                          {isOfficial ? (
                            <>
                              <span className={`text-3xl sm:text-4xl font-bold ${theme.text}`}>
                                {b.used_days}
                              </span>
                              {/* ลาป่วยไม่มีเพดานการลา — โชว์เฉพาะจำนวนวันที่ลาไปแล้ว ไม่ใส่ /60 */}
                              <span className="text-sm text-muted-foreground">
                                {isSickLeave ? 'วัน' : `/ ${b.quota_days}`}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className={`text-3xl sm:text-4xl font-bold ${theme.text}`}>
                                {b.used_count}
                              </span>
                              <span className="text-sm text-muted-foreground">ครั้ง</span>
                            </>
                          )}
                        </div>
                      </div>
                      <h3 className="font-semibold text-foreground text-sm line-clamp-1">
                        {LEAVE_TYPE_LABELS[b.leave_type]}
                      </h3>
                      {isOfficial && isSickLeave && (
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          เพดานเงินเดือน 60 วันทำการ/ปี (ลาได้เท่าที่ป่วยจริง)
                        </p>
                      )}
                      {isOfficial && (
                        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full ${
                              danger
                                ? 'bg-red-500'
                                : sickOverPaid
                                  ? 'bg-amber-500'
                                  : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      )}
                      {sickOverPaid && (
                        <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                          เกิน 60 วันทำการที่ได้รับเงินเดือน (ขยายได้ถึง 120)
                        </p>
                      )}
                      {isOfficial && b.pending_days > 0 && (
                        <p className="mt-1.5 text-[11px] text-yellow-600 dark:text-yellow-400">
                          รออนุมัติ {b.pending_days} วัน
                        </p>
                      )}
                      {!isOfficial && b.pending_count > 0 && (
                        <p className="mt-1.5 text-[11px] text-yellow-600 dark:text-yellow-400">
                          รออนุมัติ {b.pending_count} ครั้ง
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {otherBalance.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-1"
                onClick={() => setShowOtherQuotas((v) => !v)}
              >
                {showOtherQuotas ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                {showOtherQuotas ? 'ซ่อน' : 'ดู'}ประเภทอื่น ({otherBalance.length})
              </button>
              {showOtherQuotas && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  {otherBalance.map((b) => {
                    const theme = LEAVE_TYPE_THEME[b.leave_type];
                    const Icon = theme.icon;
                    const remain = b.quota_days - b.used_days - b.pending_days;
                    const danger = isOfficial && remain <= 0;
                    return (
                      <div
                        key={b.leave_type}
                        className={`rounded-lg border bg-card px-2.5 py-2 flex items-center gap-2 ${
                          danger ? 'border-red-300' : 'border-border'
                        }`}
                        title={
                          isOfficial
                            ? `เหลือ ${remain} วัน${b.pending_days > 0 ? ` (รออนุมัติ ${b.pending_days})` : ''}`
                            : `ลาแล้ว ${b.used_count} ครั้ง${b.pending_count > 0 ? ` (รออนุมัติ ${b.pending_count})` : ''}`
                        }
                      >
                        <div className={`p-1.5 rounded-md ${theme.pill} flex-shrink-0`}>
                          <Icon className={`h-3.5 w-3.5 ${theme.text}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-foreground truncate">
                            {LEAVE_TYPE_LABELS[b.leave_type]}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {isOfficial ? (
                              <>
                                <span className={`font-semibold ${theme.text}`}>
                                  {b.used_days}
                                </span>
                                /{b.quota_days}
                              </>
                            ) : (
                              <>
                                <span className={`font-semibold ${theme.text}`}>
                                  {b.used_count}
                                </span>{' '}
                                ครั้ง
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            คำขอลาของฉัน
          </CardTitle>
          <Button
            size="sm"
            className="flex items-center gap-2"
            onClick={() => navigate('/leave/new')}
          >
            <Plus className="h-4 w-4" /> ขอลาใหม่
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32" />
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>ยังไม่มีคำขอลา</p>
              <p className="text-sm">คลิก "ขอลาใหม่" เพื่อเริ่มต้น</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left w-0 pr-2">ประเภท</TableHead>
                    <TableHead className="text-left w-0 pr-2">วันที่</TableHead>
                    <TableHead className="text-left w-0 pr-2">จำนวน</TableHead>
                    <TableHead className="text-left w-0 pr-2">สถานะ</TableHead>
                    <TableHead className="text-left">ความคืบหน้า</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => {
                    const theme = LEAVE_TYPE_THEME[r.leave_type];
                    const Icon = theme.icon;
                    const sameDay = r.start_date === r.end_date;
                    const startD = new Date(r.start_date);
                    const endD = new Date(r.end_date);
                    const dateText = sameDay
                      ? startD.toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                        })
                      : `${startD.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} – ${endD.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}`;
                    return (
                      <TableRow
                        key={r.id}
                        onClick={() => setDetailReq(r)}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell className="text-left whitespace-nowrap pr-2">
                          <div className="flex items-center gap-1.5">
                            <div className={`p-1 rounded ${theme.pill}`}>
                              <Icon className={`h-3 w-3 ${theme.text}`} />
                            </div>
                            <span className="text-sm font-medium">
                              {LEAVE_TYPE_LABELS[r.leave_type]}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-left whitespace-nowrap pr-2 text-xs">
                          {dateText}
                        </TableCell>
                        <TableCell className="text-left whitespace-nowrap pr-2 text-sm tabular-nums">
                          {r.days_count} วัน
                        </TableCell>
                        <TableCell className="text-left whitespace-nowrap pr-2">
                          <Badge
                            className={`${LEAVE_STATUS_COLORS[r.status]} text-[11px] px-1.5 py-0`}
                          >
                            {getLeaveStatusLabel(r)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-left">
                          <LeaveProgress req={r} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <LeaveDetailDialog
        request={detailReq}
        onClose={() => setDetailReq(null)}
        canAttach
        onChanged={refresh}
      />
    </div>
  );
};

// ───────────────── Quota viewer (ทุกคน / รายคน) — ใช้ในหน้าอนุมัติลา ─────────────────
// การ์ดโควต้าต่อประเภท (ข้าราชการ = วัน/โควต้า, ไม่ใช่ข้าราชการ = จำนวนครั้ง)
const QuotaTypeCard: React.FC<{ b: LeaveBalance; isOfficial: boolean }> = ({
  b,
  isOfficial,
}) => {
  const theme = LEAVE_TYPE_THEME[b.leave_type];
  const Icon = theme.icon;
  // ลาป่วย: 60 = เพดาน "ได้รับเงินเดือน" /ปี (ขยายได้ถึง 120) ไม่ใช่เพดานการลา
  // → ไม่ใช่ความผิด ถ้าเกิน, ไม่เด้งแดง — ใช้โทนเหลืองเตือนแทน
  const isSickLeave = b.leave_type === 'sick_leave';
  const remain = b.quota_days - b.used_days - b.pending_days;
  const pct = b.quota_days > 0 ? (b.used_days / b.quota_days) * 100 : 0;
  const danger = isOfficial && !isSickLeave && remain <= 0;
  const sickOverPaid = isOfficial && isSickLeave && b.used_days > 60;
  return (
    <div
      className={`rounded-lg border bg-card px-3 py-2.5 ${
        danger ? 'border-red-300' : 'border-border'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className={`p-1.5 rounded-md ${theme.pill}`}>
          <Icon className={`h-3.5 w-3.5 ${theme.text}`} />
        </div>
        <div className="flex items-baseline gap-1">
          {isOfficial ? (
            <>
              <span className={`text-xl font-bold ${theme.text}`}>{b.used_days}</span>
              {/* ลาป่วยไม่มีเพดานการลา — โชว์เฉพาะจำนวนวันที่ลาไปแล้ว ไม่ใส่ /60 */}
              <span className="text-xs text-muted-foreground">
                {isSickLeave ? 'วัน' : `/ ${b.quota_days}`}
              </span>
            </>
          ) : (
            <>
              <span className={`text-xl font-bold ${theme.text}`}>{b.used_count}</span>
              <span className="text-xs text-muted-foreground">ครั้ง</span>
            </>
          )}
        </div>
      </div>
      <p className="text-xs font-medium text-foreground line-clamp-1">
        {LEAVE_TYPE_LABELS[b.leave_type]}
      </p>
      {isOfficial && isSickLeave && (
        <p className="text-[10px] text-muted-foreground leading-tight">
          เพดานเงินเดือน 60 วันทำการ/ปี (ลาได้เท่าที่ป่วยจริง)
        </p>
      )}
      {isOfficial && (
        <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full ${
              danger
                ? 'bg-red-500'
                : sickOverPaid
                  ? 'bg-amber-500'
                  : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
      {sickOverPaid && (
        <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
          เกิน 60 วันทำการที่ได้รับเงินเดือน (ขยายได้ถึง 120)
        </p>
      )}
      {isOfficial && b.pending_days > 0 && (
        <p className="mt-1 text-[10px] text-yellow-600 dark:text-yellow-400">
          รออนุมัติ {b.pending_days} วัน
        </p>
      )}
      {!isOfficial && b.pending_count > 0 && (
        <p className="mt-1 text-[10px] text-yellow-600 dark:text-yellow-400">
          รออนุมัติ {b.pending_count} ครั้ง
        </p>
      )}
    </div>
  );
};

// มุมมองรายคน — การ์ดโควต้าทุกประเภท (แยก main / อื่น ๆ เหมือนหน้าโควต้าของฉัน)
const QuotaPersonDetail: React.FC<{ user: UserLeaveSummary }> = ({ user }) => {
  const gender = inferLeaveGender({ prefix: user.prefix });
  const mainTypes = useMemo(() => getMainLeaveTypes(gender), [gender]);
  const mainBalance = mainTypes
    .map((t) => user.balances.find((b) => b.leave_type === t))
    .filter((b): b is LeaveBalance => !!b);
  const otherBalance = user.balances.filter((b) => !mainTypes.includes(b.leave_type));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {mainBalance.map((b) => (
          <QuotaTypeCard key={b.leave_type} b={b} isOfficial={user.is_official} />
        ))}
      </div>
      {otherBalance.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 mt-1">ประเภทอื่น ๆ</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {otherBalance.map((b) => (
              <QuotaTypeCard key={b.leave_type} b={b} isOfficial={user.is_official} />
            ))}
          </div>
        </div>
      )}
      {!user.is_official && (
        <p className="text-[11px] text-muted-foreground">
          * ไม่ใช่ข้าราชการ — แสดงเป็นจำนวนครั้งที่ลา ไม่มีระบบโควต้าวัน
        </p>
      )}
    </div>
  );
};

// ตำแหน่งสำหรับแสดงผล — job_position (ไทย) ก่อน, ไม่งั้น map enum เป็นไทย, สุดท้าย '—'
const quotaPositionLabel = (u: UserLeaveSummary): string =>
  u.job_position ||
  (u.position ? getPositionDisplayName(u.position as Position) : '') ||
  '—';

const LeaveQuotaDialog: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { toast } = useToast();
  const period = useMemo(() => getFiscalPeriod(), []);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserLeaveSummary[]>([]);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<UserLeaveSummary | null>(null);

  useEffect(() => {
    if (!open) {
      // reset ตอนปิด เพื่อเริ่มที่หน้า list เสมอเมื่อเปิดใหม่
      setSelected(null);
      setSearch('');
      setShowAll(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getAllUsersLeaveSummary();
        if (alive) setUsers(data);
      } catch (e) {
        if (alive) {
          toast({
            title: 'โหลดโควต้าการลาไม่สำเร็จ',
            description: e instanceof Error ? e.message : String(e),
            variant: 'destructive',
          });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, toast]);

  const withLeave = useMemo(
    () => users.filter((u) => u.total_used_days > 0 || u.total_pending_days > 0),
    [users],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // ค้นหา → ค้นทุกคน; ไม่ค้นหา → ตาม toggle (ค่าเริ่มต้นเฉพาะผู้ที่มีการลา)
    const base = q ? users : showAll ? users : withLeave;
    if (!q) return base;
    return base.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.job_position ?? '').toLowerCase().includes(q) ||
        (u.position ?? '').toLowerCase().includes(q),
    );
  }, [users, withLeave, search, showAll]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            {selected ? selected.name : 'โควต้าการลา'}
          </DialogTitle>
          <DialogDescription>
            {selected
              ? `${quotaPositionLabel(selected)} · ${formatFiscalYear(period.year)}`
              : `เลือกดูรายคน หรือเลื่อนดูทั้งหมด · ${formatFiscalYear(period.year)}`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : selected ? (
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 -ml-2 text-muted-foreground"
              onClick={() => setSelected(null)}
            >
              <ChevronLeft className="h-4 w-4" /> กลับไปรายชื่อ
            </Button>
            <QuotaPersonDetail user={selected} />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ / ตำแหน่ง"
                className="pl-8"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {search.trim()
                  ? `พบ ${filtered.length} คน`
                  : `มีการลา ${withLeave.length} คน`}
              </span>
              {!search.trim() && (
                <button
                  type="button"
                  className="hover:text-foreground underline-offset-2 hover:underline"
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? 'แสดงเฉพาะผู้ที่มีการลา' : `แสดงทั้งหมด (${users.length} คน)`}
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">ไม่พบรายชื่อ</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filtered.map((u) => (
                  <button
                    key={u.user_id}
                    type="button"
                    onClick={() => setSelected(u)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {u.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {quotaPositionLabel(u)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {u.is_official
                            ? `${u.total_used_days} วัน`
                            : `${u.total_used_count} ครั้ง`}
                        </p>
                        {(u.is_official
                          ? u.total_pending_days
                          : u.total_pending_count) > 0 && (
                          <p className="text-[10px] text-yellow-600 dark:text-yellow-400">
                            รอ{' '}
                            {u.is_official
                              ? `${u.total_pending_days} วัน`
                              : `${u.total_pending_count} ครั้ง`}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ───────────────── Tab 3: อนุมัติลา (หน.บุคคล / ผอ) ─────────────────
const ApprovalTab: React.FC<{
  profile: LeaveProfile;
  signerConfig: LeaveSignerConfig | null;
  onListChange?: () => void;
}> = ({ profile, signerConfig, onListChange }) => {
  const allowedRoles = useMemo<LeaveSignerRole[]>(
    () => computeAllowedSignerRoles(profile, signerConfig),
    [profile, signerConfig],
  );

  const [list, setList] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailReq, setDetailReq] = useState<LeaveRequest | null>(null);
  const [quotaOpen, setQuotaOpen] = useState(false);

  const userName = `${profile.prefix ?? ''}${profile.first_name} ${profile.last_name}`.trim();

  // เลือก role อัตโนมัติตาม step ของใบลา → admin กดแทนได้ทุก role
  const detailApprover = useMemo<ApproverContext | null>(() => {
    if (!detailReq) return null;
    const needed: LeaveSignerRole =
      detailReq.current_signer_order === 1
        ? 'hr_head'
        : detailReq.current_signer_order === 2
          ? 'deputy_director'
          : 'director';
    if (!allowedRoles.includes(needed)) return null;
    return {
      user_id: profile.id,
      user_name: userName,
      role: needed,
      signature_url: profile.signature_url ?? null,
    };
  }, [detailReq, allowedRoles, profile, userName]);

  const refresh = async () => {
    setLoading(true);
    setList(await getPendingApprovalsByRoles(allowedRoles));
    setLoading(false);
    onListChange?.();
  };
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedRoles.join(',')]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            ใบลารอลงนาม
          </CardTitle>
          <div className="flex items-center gap-2">
            {allowedRoles.length > 1 && (
              <span className="hidden sm:inline text-xs text-muted-foreground">
                ลงนามแทน หน.บุคคล &amp; ผอ.
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setQuotaOpen(true)}
            >
              <BarChart3 className="h-4 w-4" /> ดูโควต้าการลา
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32" />
          ) : list.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>ไม่มีใบลารอลงนาม</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left w-0 pr-2">ประเภท</TableHead>
                    <TableHead className="text-left w-0 pr-2">ชื่อ</TableHead>
                    <TableHead className="text-left w-0 pr-2">วันที่</TableHead>
                    <TableHead className="text-left w-0 pr-2">จำนวน</TableHead>
                    <TableHead className="text-left w-0 pr-2">สถานะ</TableHead>
                    <TableHead className="text-left">ความคืบหน้า</TableHead>
                    <TableHead className="text-right">ลงนาม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((r) => {
                    const theme = LEAVE_TYPE_THEME[r.leave_type];
                    const Icon = theme.icon;
                    const hasAttachment =
                      (r.form_data?.attachments?.length ?? 0) > 0;
                    const sameDay = r.start_date === r.end_date;
                    const startD = new Date(r.start_date);
                    const endD = new Date(r.end_date);
                    const dateText = sameDay
                      ? startD.toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                        })
                      : `${startD.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} – ${endD.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}`;
                    return (
                      <TableRow
                        key={r.id}
                        onClick={() => setDetailReq(r)}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell className="text-left whitespace-nowrap pr-2">
                          <div className="flex items-center gap-1.5">
                            <div className={`p-1 rounded ${theme.pill}`}>
                              <Icon className={`h-3 w-3 ${theme.text}`} />
                            </div>
                            <span className="text-sm font-medium">
                              {LEAVE_TYPE_LABELS[r.leave_type]}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-left whitespace-nowrap pr-2">
                          <div className="text-sm font-medium leading-tight">
                            {r.user_name}
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-tight">
                            {r.user_position}
                          </div>
                        </TableCell>
                        <TableCell className="text-left whitespace-nowrap pr-2 text-xs">
                          {dateText}
                        </TableCell>
                        <TableCell className="text-left whitespace-nowrap pr-2 text-sm tabular-nums">
                          {r.days_count} วัน
                        </TableCell>
                        <TableCell className="text-left whitespace-nowrap pr-2">
                          <div className="flex items-center gap-1">
                            <Badge
                              className={`${LEAVE_STATUS_COLORS[r.status]} text-[11px] px-1.5 py-0`}
                            >
                              {getLeaveStatusLabel(r)}
                            </Badge>
                            {hasAttachment && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 dark:text-blue-400"
                                title={r.form_data?.attachments?.join(', ')}
                              >
                                <Paperclip className="h-3 w-3" />
                                {r.form_data?.attachments?.length}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <LeaveProgress req={r} />
                        </TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const enabled = canSignNow(r, allowedRoles);
                            const waitLabel =
                              r.current_signer_order === 1 ? 'หน.บุคคล' : 'ผอ.';
                            return (
                              <Button
                                size="sm"
                                disabled={!enabled}
                                title={
                                  enabled
                                    ? undefined
                                    : `ยังไม่ถึงคิว — รอ ${waitLabel} ลงนามก่อน`
                                }
                                className={
                                  enabled
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-semibold ring-2 ring-emerald-200 dark:ring-emerald-900'
                                    : 'bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed'
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (enabled) setDetailReq(r);
                                }}
                              >
                                <PenLine className="h-3.5 w-3.5 mr-1" />
                                ลงนาม
                              </Button>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <LeaveDetailDialog
        request={detailReq}
        onClose={() => setDetailReq(null)}
        approver={detailApprover}
        canApprove={!!detailApprover}
        onChanged={refresh}
      />

      <LeaveQuotaDialog open={quotaOpen} onClose={() => setQuotaOpen(false)} />
    </div>
  );
};

// ───────────────── Tab 4: ทะเบียนใบลา (หน.บุคคล / admin) ─────────────────
const LeaveRegistryTab: React.FC = () => {
  const { toast } = useToast();
  const [list, setList] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [announcing, setAnnouncing] = useState(false);

  const handleAnnounceToday = async () => {
    setAnnouncing(true);
    try {
      // เลือก variant ตามช่วงเวลา local — ก่อนเที่ยง = "ผู้ลาวันนี้" (heads-up),
      // หลังเที่ยง = "สรุปการลาวันนี้" — ให้ tone ตรงกับ cron 08:30/16:30
      const variant = new Date().getHours() < 12 ? 'morning' : 'evening';
      const { data, error } = await supabase.functions.invoke(
        'leave-telegram-notify',
        { body: { type: 'daily_rollcall', variant } },
      );
      if (error) throw error;
      const count = (data as { summary?: { count?: number } })?.summary?.count ?? 0;
      const tone = variant === 'morning' ? 'ประกาศ' : 'สรุป';
      toast({
        title: `ส่ง${tone}แล้ว`,
        description:
          count > 0
            ? `แจ้งผู้ลาวันนี้ ${count} คน เข้ากลุ่ม Telegram`
            : 'วันนี้ไม่มีผู้ลา — ส่งข้อความว่างเข้ากลุ่ม',
      });
    } catch (e) {
      toast({
        title: 'ส่งประกาศไม่สำเร็จ',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setAnnouncing(false);
    }
  };

  const today = toLocalISODate(new Date());
  const emptyForm: NewManualRegistryEntryInput = {
    user_name: '',
    user_position: '',
    leave_type: 'sick_leave',
    start_date: today,
    end_date: today,
    reason: '',
    director_user_id: '',
    director_name: '',
    remarks: '',
  };
  const [form, setForm] = useState<NewManualRegistryEntryInput>(emptyForm);
  const [directors, setDirectors] = useState<
    Array<{ user_id: string; name: string; position: string | null }>
  >([]);

  useEffect(() => {
    // โหลดรายชื่อผู้ที่อนุมัติในฐานะ ผอ. ได้ (position=director หรือ is_admin)
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, position, is_admin')
        .or('position.eq.director,is_admin.eq.true');
      setDirectors(
        (data ?? []).map((p) => ({
          user_id: p.user_id,
          name: `${p.first_name} ${p.last_name}`.trim(),
          position: p.position,
        })),
      );
    })();
  }, []);

  const refresh = async () => {
    setLoading(true);
    setList(await getLeaveRegistry());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleSubmit = async () => {
    if (
      !form.user_name.trim() ||
      !form.user_position.trim() ||
      !form.start_date ||
      !form.end_date ||
      !form.reason.trim() ||
      !form.director_user_id
    ) {
      toast({
        title: 'กรอกข้อมูลไม่ครบ',
        description: 'ชื่อ, ตำแหน่ง, วันที่, เหตุผล, และ ผอ.ผู้ลงนาม จำเป็นต้องกรอก',
        variant: 'destructive',
      });
      return;
    }
    if (form.start_date > form.end_date) {
      toast({ title: 'ช่วงวันที่ไม่ถูกต้อง', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const created = await addManualRegistryEntry(form);
      toast({
        title: 'เพิ่มทะเบียนแล้ว',
        description: `เลขที่ ${created.doc_number}`,
      });
      setForm(emptyForm);
      setOpen(false);
      await refresh();
    } catch (e) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              ทะเบียนใบลา
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              เลขทะเบียนออกอัตโนมัติเมื่อ หน.บุคคล ลงนาม (4 หลัก รันต่อเนื่อง)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={announcing}
              onClick={handleAnnounceToday}
              title="ส่งรายชื่อผู้ลาวันนี้เข้ากลุ่ม Telegram"
            >
              {announcing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Megaphone className="h-4 w-4" />
              )}
              ส่งประกาศวันนี้
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" />
                  เพิ่มแมนนวล
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>เพิ่มทะเบียนใบลา (แมนนวล)</DialogTitle>
                <DialogDescription>
                  สำหรับใบลาที่ยื่นเป็นกระดาษย้อนหลัง — ระบบจะออกเลขทะเบียนต่อจากเลขล่าสุดให้
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>ชื่อ-สกุล</Label>
                    <Input
                      value={form.user_name}
                      onChange={(e) =>
                        setForm({ ...form, user_name: e.target.value })
                      }
                      placeholder="นาย/นาง/น.ส. ชื่อ สกุล"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>ตำแหน่ง</Label>
                    <Input
                      value={form.user_position}
                      onChange={(e) =>
                        setForm({ ...form, user_position: e.target.value })
                      }
                      placeholder="เช่น ครู"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>ประเภทลา</Label>
                  <Select
                    value={form.leave_type}
                    onValueChange={(v) =>
                      setForm({ ...form, leave_type: v as LeaveType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAVE_TYPE_ORDER.map((t) => (
                        <SelectItem key={t} value={t}>
                          {LEAVE_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>วันที่เริ่ม</Label>
                    <Input
                      type="date"
                      min="2020-01-01"
                      max="2099-12-31"
                      value={form.start_date}
                      onChange={(e) =>
                        setForm({ ...form, start_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>วันที่สิ้นสุด</Label>
                    <Input
                      type="date"
                      min="2020-01-01"
                      max="2099-12-31"
                      value={form.end_date}
                      onChange={(e) =>
                        setForm({ ...form, end_date: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>เหตุผล</Label>
                  <Textarea
                    rows={2}
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>ผอ.ผู้ลงนาม (กระดาษ)</Label>
                  <Select
                    value={form.director_user_id}
                    onValueChange={(v) => {
                      const d = directors.find((x) => x.user_id === v);
                      setForm({
                        ...form,
                        director_user_id: v,
                        director_name: d?.name ?? '',
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือก ผอ. ที่ลงนามบนกระดาษ" />
                    </SelectTrigger>
                    <SelectContent>
                      {directors.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          ไม่พบ ผอ. ในระบบ
                        </div>
                      ) : (
                        directors.map((d) => (
                          <SelectItem key={d.user_id} value={d.user_id}>
                            {d.name}
                            {d.position && d.position !== 'director' && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({d.position})
                              </span>
                            )}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>หมายเหตุ (ถ้ามี)</Label>
                  <Input
                    value={form.remarks ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, remarks: e.target.value })
                    }
                    placeholder="เช่น ยื่นกระดาษเมื่อ ..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setForm(emptyForm);
                      setOpen(false);
                    }}
                  >
                    ยกเลิก
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
                  </Button>
                </div>
              </div>
            </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40" />
          ) : list.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>ยังไม่มีรายการในทะเบียน</p>
              <p className="text-sm">
                เลขทะเบียนจะออกอัตโนมัติเมื่อ หน.บุคคล ลงนามใบลา
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-0">เลขที่</TableHead>
                    <TableHead className="w-0">วันที่ออกเลข</TableHead>
                    <TableHead>ชื่อ-ตำแหน่ง</TableHead>
                    <TableHead className="w-0">ประเภท</TableHead>
                    <TableHead className="w-0">ช่วงวันลา</TableHead>
                    <TableHead className="text-right w-0">วัน</TableHead>
                    <TableHead className="w-0">สถานะ</TableHead>
                    <TableHead className="w-0">เอกสาร</TableHead>
                    <TableHead className="w-0">ที่มา</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((r) => {
                    const dStart = new Date(r.start_date).toLocaleDateString(
                      'th-TH',
                      { day: 'numeric', month: 'short', year: '2-digit' },
                    );
                    const dEnd = new Date(r.end_date).toLocaleDateString(
                      'th-TH',
                      { day: 'numeric', month: 'short', year: '2-digit' },
                    );
                    const dateRange =
                      r.start_date === r.end_date
                        ? dStart
                        : `${dStart} – ${dEnd}`;
                    const issuedAt = r.doc_number_at
                      ? new Date(r.doc_number_at).toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                        })
                      : '-';
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono font-semibold text-base whitespace-nowrap">
                          {r.doc_number}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {issuedAt}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="text-sm font-medium leading-tight">
                            {r.user_name}
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-tight">
                            {r.user_position}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {LEAVE_TYPE_LABELS[r.leave_type]}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {dateRange}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {r.days_count}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${LEAVE_STATUS_COLORS[r.status]} text-[11px] px-1.5 py-0`}
                          >
                            {getLeaveStatusLabel(r)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {(() => {
                            const count = (r.form_data?.attachments ?? []).length;
                            const needsDoc =
                              LEAVE_TYPE_ATTACHMENTS[r.leave_type].required !==
                              'never';
                            if (count > 0) {
                              return (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300 text-[11px] px-1.5 py-0 gap-1">
                                  <Paperclip className="h-3 w-3" />
                                  แนบแล้ว{count > 1 ? ` (${count})` : ''}
                                </Badge>
                              );
                            }
                            if (needsDoc) {
                              return (
                                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[11px] px-1.5 py-0">
                                  ยังไม่แนบ
                                </Badge>
                              );
                            }
                            return (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {r.entry_source === 'manual' ? (
                            <Badge variant="outline" className="text-[11px]">
                              แมนนวล
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              ระบบ
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                          {r.form_data?.notes ?? r.reason}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ───────────────── Page ─────────────────
// ───────────────── Admin Tabs (overview + attendance + leave + approve + registry) ─────────────────
const LeaveAdminTabs: React.FC<{
  profile: LeaveProfile;
  rawProfile: { id: string; position?: string };
  signerConfig: LeaveSignerConfig | null;
}> = ({ profile, rawProfile, signerConfig }) => {
  const allowedRoles = useMemo<LeaveSignerRole[]>(
    () => computeAllowedSignerRoles(profile, signerConfig),
    [profile, signerConfig],
  );
  // แท็บ "ทะเบียน" = หน.บุคคล / admin / ผอ. (คงสิทธิ์เดิมไว้ ไม่ผูกกับ signer config)
  const canSeeRegistry =
    allowedRoles.includes('hr_head') || profile.position === 'director';
  const allowedKey = allowedRoles.join(',');

  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(async () => {
    if (allowedRoles.length === 0) return;
    const list = await getPendingApprovalsByRoles(allowedRoles);
    setPendingCount(list.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedKey]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  const personalTriggerClass =
    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/60';
  const adminTriggerClass =
    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-emerald-50 dark:data-[state=inactive]:hover:bg-emerald-950/30';

  return (
    <Tabs
      defaultValue="overview"
      className="space-y-4"
      onValueChange={(v) => {
        if (v === 'approve') refreshCount();
      }}
    >
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="bg-card border shadow-sm rounded-2xl p-1.5 inline-flex items-stretch gap-2 w-auto">
          {/* กลุ่ม: ของฉัน */}
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70 px-3 pt-0.5 pb-1">
              ของฉัน
            </span>
            <TabsList className="bg-transparent border-0 shadow-none p-0 h-auto inline-flex gap-1 rounded-none">
              <TabsTrigger value="attendance" className={personalTriggerClass}>
                <UserCheck className="h-4 w-4" />
                เข้า-ออกงาน
              </TabsTrigger>
              <TabsTrigger value="leave" className={personalTriggerClass}>
                <FileText className="h-4 w-4" />
                ขอลา
              </TabsTrigger>
            </TabsList>
          </div>

          {/* เส้นคั่นแนวตั้ง */}
          <div className="w-px bg-border self-stretch my-1" />

          {/* กลุ่ม: บริหาร */}
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80 px-3 pt-0.5 pb-1">
              บริหาร
            </span>
            <TabsList className="bg-transparent border-0 shadow-none p-0 h-auto inline-flex gap-1 rounded-none">
              <TabsTrigger value="overview" className={adminTriggerClass}>
                <LayoutDashboard className="h-4 w-4" />
                ภาพรวม
              </TabsTrigger>
              <TabsTrigger value="approve" className={adminTriggerClass}>
                <ShieldCheck className="h-4 w-4" />
                อนุมัติลา
                {pendingCount > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white min-w-[18px] leading-none">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              {canSeeRegistry && (
                <TabsTrigger value="registry" className={adminTriggerClass}>
                  <BookOpen className="h-4 w-4" />
                  ทะเบียน
                </TabsTrigger>
              )}
            </TabsList>
          </div>
        </div>
      </div>

      <TabsContent value="overview">
        <OverviewTab />
      </TabsContent>
      <TabsContent value="attendance">
        <AttendanceTab profile={rawProfile} />
      </TabsContent>
      <TabsContent value="leave">
        <LeaveTab profile={profile} />
      </TabsContent>
      {canSeeRegistry && (
        <TabsContent value="registry">
          <LeaveRegistryTab />
        </TabsContent>
      )}
      <TabsContent value="approve">
        <ApprovalTab
          profile={profile}
          signerConfig={signerConfig}
          onListChange={refreshCount}
        />
      </TabsContent>
    </Tabs>
  );
};

const LeaveRequestsPage: React.FC = () => {
  const { profile } = useEmployeeAuth();
  // ผู้ลงนามที่ admin ตั้งไว้ (app_settings) — ใช้กำหนดว่าใครเห็นแท็บอนุมัติ
  const [signerConfig, setSignerConfig] = useState<LeaveSignerConfig | null>(null);
  // map user_id -> "ชื่อ นามสกุล" สำหรับแสดงชื่อผู้ลงนามใต้ stepper
  const [signerNameMap, setSignerNameMap] = useState<Record<string, string>>({});
  useEffect(() => {
    getLeaveSignerConfig()
      .then(setSignerConfig)
      .catch(() => setSignerConfig(null));
    getSignerNameMap()
      .then(setSignerNameMap)
      .catch(() => setSignerNameMap({}));
  }, []);

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <LeaveSignerNamesContext.Provider
      value={{ config: signerConfig, nameByUserId: signerNameMap }}
    >
      <div className="min-h-screen bg-background pb-24">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <Card className="mb-6">
          <CardContent className="bg-blue-600 rounded-t-lg pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-white/15">
                <UserCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  บุคลากร
                  <span className="text-blue-200 font-semibold">· FastMen</span>
                </h1>
                <p className="text-sm text-blue-100 mt-0.5">
                  เวลางาน, ขอลา, และข้อมูลบุคลากร
                </p>
                <p className="text-xs text-blue-200 mt-0.5">
                  {profile.first_name} {profile.last_name}
                  {profile.job_position ? ` · ${profile.job_position}` : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {(() => {
          const canApprove =
            computeAllowedSignerRoles(
              profile as unknown as Parameters<typeof computeAllowedSignerRoles>[0],
              signerConfig,
            ).length > 0;

          if (!canApprove) {
            return <LeaveTab profile={profile as unknown as LeaveProfile} />;
          }

          return (
            <LeaveAdminTabs
              profile={profile as unknown as LeaveProfile}
              rawProfile={profile}
              signerConfig={signerConfig}
            />
          );
        })()}
        </div>
      </div>
    </LeaveSignerNamesContext.Provider>
  );
};

export default LeaveRequestsPage;
