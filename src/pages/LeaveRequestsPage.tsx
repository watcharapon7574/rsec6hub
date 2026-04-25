import React, { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';

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

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
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

      const todayQuery = isAdmin
        ? supabase
            .from('std_teacher_attendance')
            .select('*')
            .eq('date', todayStr)
            .order('check_in', { ascending: false })
        : Promise.resolve({ data: [] });

      const [myRes, todayRes] = await Promise.all([myQuery, todayQuery]);

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
          .select('id, prefix, first_name, last_name, nickname, job_position')
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

  const positionStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of todayAllRows) {
      const p = profileMap[r.teacher_id];
      const label = p?.job_position?.trim() || 'ไม่ระบุตำแหน่ง';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [todayAllRows, profileMap]);

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
              ครูทั้งหมดวันนี้ ({todayAllRows.length} คน)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              {loading ? (
                <Skeleton className="h-40 w-full" />
              ) : todayAllRows.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-6">
                  ยังไม่มีครูเข้างานวันนี้
                </p>
              ) : (
                <>
                {/* Chart by job_position */}
                <div className="rounded-lg border border-border p-3">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    แบ่งตามตำแหน่ง
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
                        <TableHead>ครู</TableHead>
                        <TableHead>ตำแหน่ง</TableHead>
                        <TableHead>เข้างาน</TableHead>
                        <TableHead>ออกงาน</TableHead>
                        <TableHead>สถานะ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todayAllRows.map((r) => (
                        <TableRow key={r.id}>
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

// ───────────────── Tab 2: ขอลา (mock เดิม) ─────────────────
const LeaveTab: React.FC = () => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const [leaveRequests, setLeaveRequests] = useState([
    {
      id: '1',
      leave_type: 'sick_leave',
      start_date: '2025-01-15',
      end_date: '2025-01-16',
      days_count: 2,
      reason: 'ป่วยเป็นไข้',
      status: 'pending',
      created_at: '2025-01-10',
    },
    {
      id: '2',
      leave_type: 'personal_leave',
      start_date: '2025-01-20',
      end_date: '2025-01-20',
      days_count: 1,
      reason: 'ธุระส่วนตัว',
      status: 'approved',
      created_at: '2025-01-05',
    },
  ]);

  const leaveTypeLabels: Record<string, string> = {
    sick_leave: 'ลาป่วย',
    personal_leave: 'ลากิจ',
    annual_leave: 'ลาพักผ่อน',
    maternity_leave: 'ลาคลอด',
    ordination_leave: 'ลาบวช',
  };

  const statusLabels: Record<string, string> = {
    pending: 'รอพิจารณา',
    approved: 'อนุมัติ',
    rejected: 'ไม่อนุมัติ',
    in_progress: 'กำลังพิจารณา',
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    approved: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    rejected: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    in_progress: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.leave_type ||
      !formData.start_date ||
      !formData.end_date ||
      !formData.reason
    ) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบถ้วน', variant: 'destructive' });
      return;
    }
    const days = calculateDays(formData.start_date, formData.end_date);
    const newRequest = {
      id: (leaveRequests.length + 1).toString(),
      ...formData,
      days_count: days,
      status: 'pending' as const,
      created_at: new Date().toISOString().split('T')[0],
    };
    setLeaveRequests([newRequest, ...leaveRequests]);
    setFormData({ leave_type: '', start_date: '', end_date: '', reason: '' });
    setIsDialogOpen(false);
    toast({
      title: 'ส่งคำขอลาสำเร็จ',
      description: 'คำขอลาของคุณได้ถูกส่งเพื่อรอการพิจารณาแล้ว',
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            คำขอลาของฉัน
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> ขอลาใหม่
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>ยื่นคำขอลา</DialogTitle>
                <DialogDescription>กรอกข้อมูลคำขอลาของคุณให้ครบถ้วน</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="leave_type">ประเภทการลา</Label>
                  <Select
                    value={formData.leave_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, leave_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกประเภทการลา" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sick_leave">ลาป่วย</SelectItem>
                      <SelectItem value="personal_leave">ลากิจ</SelectItem>
                      <SelectItem value="annual_leave">ลาพักผ่อน</SelectItem>
                      <SelectItem value="maternity_leave">ลาคลอด</SelectItem>
                      <SelectItem value="ordination_leave">ลาบวช</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">วันที่เริ่มลา</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">วันที่สิ้นสุด</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) =>
                        setFormData({ ...formData, end_date: e.target.value })
                      }
                    />
                  </div>
                </div>
                {formData.start_date && formData.end_date && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    จำนวนวันลา: {calculateDays(formData.start_date, formData.end_date)} วัน
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="reason">เหตุผลการลา</Label>
                  <Textarea
                    id="reason"
                    placeholder="กรอกเหตุผลการลา..."
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    ยกเลิก
                  </Button>
                  <Button type="submit">ส่งคำขอ</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {leaveRequests.length === 0 ? (
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
                    <TableHead>ประเภทการลา</TableHead>
                    <TableHead>วันที่ลา</TableHead>
                    <TableHead>จำนวนวัน</TableHead>
                    <TableHead>เหตุผล</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {leaveTypeLabels[request.leave_type]}
                      </TableCell>
                      <TableCell>
                        {new Date(request.start_date).toLocaleDateString('th-TH')} -{' '}
                        {new Date(request.end_date).toLocaleDateString('th-TH')}
                      </TableCell>
                      <TableCell>{request.days_count} วัน</TableCell>
                      <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[request.status]}>
                          {statusLabels[request.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
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
const LeaveRequestsPage: React.FC = () => {
  const { profile } = useEmployeeAuth();

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
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

        <Tabs defaultValue="attendance" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              เข้า-ออกงาน
            </TabsTrigger>
            <TabsTrigger value="leave" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              ขอลา
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance">
            <AttendanceTab profile={profile} />
          </TabsContent>

          <TabsContent value="leave">
            <LeaveTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default LeaveRequestsPage;
