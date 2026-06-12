import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Users,
  LogIn,
  LogOut,
  AlarmClock,
  MapPin,
  TrendingUp,
  School,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  exportStudentAttendanceExcel,
  THAI_MONTHS,
} from './exportStudentAttendanceExcel';

const THAI_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// std_attendance.date is stored as a Bangkok-local date (Asia/Bangkok, UTC+7) —
// compute "today" in that zone regardless of the device clock.
const bangkokDateStr = (d: Date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${day}`;
};

const shiftDateStr = (dateStr: string, days: number) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

interface ServicePoint {
  id: string;
  short_name: string | null;
  name: string;
  is_headquarters: boolean | null;
}

interface AttendanceRow {
  id: string;
  student_id: string;
  date: string;
  service_point_id: string | null;
  check_in: string | null;
  check_out: string | null;
}

interface Classroom {
  id: string;
  name: string;
  service_point_id: string | null;
}

interface StudentLite {
  id: string;
  classroom_id: string | null;
}

interface AttendanceRowProps {
  name: string;
  count: number;
  out: number;
  forgot: number;
}

// Visual hierarchy: name + big "X คน" total up top so the eye lands on the
// headline number first; รับ/ส่ง/ค้าง breakdown sits underneath for detail.
const AttendanceLine: React.FC<AttendanceRowProps> = ({ name, count, out, forgot }) => (
  <div className="p-3 rounded-md bg-muted/40">
    <div className="flex items-center justify-between gap-3 mb-1">
      <span className="text-sm font-medium text-foreground truncate" title={name}>
        {name}
      </span>
      <div className="flex items-baseline gap-1 shrink-0">
        <span
          className={`text-xl font-bold tabular-nums leading-none ${
            count > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
          }`}
        >
          {count}
        </span>
        <span className="text-xs text-muted-foreground">คน</span>
      </div>
    </div>
    <div className="flex items-center gap-3 text-[11px] font-medium tabular-nums">
      <span className={count > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground/70'}>
        รับ {count}
      </span>
      <span className={out > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/70'}>
        ส่ง {out}
      </span>
      <span className={forgot > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground/70'}>
        ค้าง {forgot}
      </span>
    </div>
  </div>
);

const StudentAttendanceWidget: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [todayStr, setTodayStr] = useState(() => bangkokDateStr());
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportYear, setExportYear] = useState(() => Number(bangkokDateStr().slice(0, 4)));
  const [exportMonth, setExportMonth] = useState(() => Number(bangkokDateStr().slice(5, 7)));
  const channelIdRef = useRef(crypto.randomUUID());
  const [totalStudents, setTotalStudents] = useState(0);
  const [todayRows, setTodayRows] = useState<AttendanceRow[]>([]);
  const [last7Rows, setLast7Rows] = useState<Pick<AttendanceRow, 'date'>[]>([]);
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);

  useEffect(() => {
    let cancelled = false;
    let debounceTimer: number | undefined;

    const load = async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      const today = bangkokDateStr();
      const weekAgo = shiftDateStr(today, -6);

      const [studentsRes, todayRes, weekRes, spRes, classroomsRes] = await Promise.all([
        supabase
          .from('std_students')
          .select('id, classroom_id', { count: 'exact' })
          .eq('is_active', true),
        supabase
          .from('std_attendance')
          .select('id, student_id, date, service_point_id, check_in, check_out')
          .eq('date', today),
        supabase
          .from('std_attendance')
          .select('date')
          .gte('date', weekAgo)
          .lte('date', today),
        supabase
          .from('std_service_points')
          .select('id, short_name, name, is_headquarters')
          .eq('is_active', true)
          .order('is_headquarters', { ascending: false })
          .order('name', { ascending: true }),
        supabase
          .from('std_classrooms')
          .select('id, name, service_point_id')
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ]);

      if (cancelled) return;
      setTodayStr(today);
      setTotalStudents(studentsRes.count ?? 0);
      setStudents((studentsRes.data as StudentLite[]) ?? []);
      setTodayRows((todayRes.data as AttendanceRow[]) ?? []);
      setLast7Rows((weekRes.data as Pick<AttendanceRow, 'date'>[]) ?? []);
      setServicePoints((spRes.data as ServicePoint[]) ?? []);
      setClassrooms((classroomsRes.data as Classroom[]) ?? []);
      setLoading(false);
    };

    load();

    // Scope realtime to today's rows only (date is btree-indexed:
    // idx_std_attendance_date). The filter value is pinned at subscribe time —
    // after midnight the channel goes quiet until the next mount, which is fine
    // for a dashboard widget. Debounce the refetch so a burst of check-ins
    // (face-scan queue) collapses into one reload, refreshed silently to avoid
    // skeleton flashes.
    const today = bangkokDateStr();
    const channel = supabase
      .channel(`std-attendance-dashboard-${channelIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'std_attendance',
          filter: `date=eq.${today}`,
        },
        () => {
          if (debounceTimer) window.clearTimeout(debounceTimer);
          debounceTimer = window.setTimeout(() => load({ silent: true }), 2000);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const checkedIn = todayRows.filter((r) => r.check_in).length;
    const checkedOut = todayRows.filter((r) => r.check_out).length;
    const forgotCheckout = todayRows.filter((r) => r.check_in && !r.check_out).length;
    const present = todayRows.length;
    return { present, checkedIn, checkedOut, forgotCheckout };
  }, [todayRows]);

  const chartData = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      buckets[shiftDateStr(todayStr, -i)] = 0;
    }
    for (const row of last7Rows) {
      if (row.date in buckets) buckets[row.date]++;
    }
    return Object.entries(buckets).map(([date, count]) => {
      const [y, m, d] = date.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return {
        date,
        label: `${THAI_DAYS_SHORT[dt.getUTCDay()]} ${d}`,
        count,
      };
    });
  }, [last7Rows, todayStr]);

  const byServicePoint = useMemo(() => {
    type Counts = { in: number; out: number; forgot: number };
    const map = new Map<string, Counts>();
    for (const row of todayRows) {
      if (!row.service_point_id) continue;
      const c = map.get(row.service_point_id) ?? { in: 0, out: 0, forgot: 0 };
      if (row.check_in) c.in++;
      if (row.check_out) c.out++;
      if (row.check_in && !row.check_out) c.forgot++;
      map.set(row.service_point_id, c);
    }
    return servicePoints.map((sp) => ({
      id: sp.id,
      name: sp.name || sp.short_name || '',
      ...(map.get(sp.id) ?? { in: 0, out: 0, forgot: 0 }),
    }));
  }, [todayRows, servicePoints]);

  const hqId = useMemo(
    () => servicePoints.find((sp) => sp.is_headquarters)?.id ?? null,
    [servicePoints],
  );

  const byClassroom = useMemo(() => {
    if (!hqId) return [];
    type Counts = { in: number; out: number; forgot: number };
    const studentToClassroom = new Map<string, string>();
    for (const s of students) {
      if (s.classroom_id) studentToClassroom.set(s.id, s.classroom_id);
    }
    const counts = new Map<string, Counts>();
    for (const row of todayRows) {
      if (row.service_point_id !== hqId) continue;
      const cid = studentToClassroom.get(row.student_id);
      if (!cid) continue;
      const c = counts.get(cid) ?? { in: 0, out: 0, forgot: 0 };
      if (row.check_in) c.in++;
      if (row.check_out) c.out++;
      if (row.check_in && !row.check_out) c.forgot++;
      counts.set(cid, c);
    }
    return classrooms
      .filter((cl) => cl.service_point_id === hqId)
      .map((cl) => ({
        id: cl.id,
        name: cl.name,
        ...(counts.get(cl.id) ?? { in: 0, out: 0, forgot: 0 }),
      }));
  }, [hqId, classrooms, students, todayRows]);

  const currentYear = Number(todayStr.slice(0, 4));
  const exportYearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const handleExport = async () => {
    setExporting(true);
    try {
      const fileName = await exportStudentAttendanceExcel(exportYear, exportMonth);
      if (!fileName) {
        toast({
          title: 'ไม่มีข้อมูล',
          description: `ไม่พบข้อมูลรับ-ส่งของ${THAI_MONTHS[exportMonth - 1]} ${exportYear + 543}`,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'ส่งออกสำเร็จ', description: `ไฟล์ ${fileName}` });
        setExportOpen(false);
      }
    } catch (err) {
      console.error('Export attendance failed:', err);
      toast({
        title: 'ส่งออกไม่สำเร็จ',
        description: 'ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const statCards = [
    {
      label: 'มาวันนี้',
      value: stats.present,
      total: totalStudents,
      icon: Users,
      bg: 'bg-blue-100 dark:bg-blue-900',
      fg: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'รับเข้า',
      value: stats.checkedIn,
      icon: LogIn,
      bg: 'bg-green-100 dark:bg-green-900',
      fg: 'text-green-600 dark:text-green-400',
    },
    {
      label: 'ส่งกลับ',
      value: stats.checkedOut,
      icon: LogOut,
      bg: 'bg-amber-100 dark:bg-amber-900',
      fg: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'ค้างส่ง',
      value: stats.forgotCheckout,
      icon: AlarmClock,
      bg: 'bg-rose-100 dark:bg-rose-900',
      fg: 'text-rose-600 dark:text-rose-400',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            สถิติรับ-ส่งนักเรียนวันนี้
          </CardTitle>
          <Popover open={exportOpen} onOpenChange={setExportOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-green-600 dark:text-green-400" />
                Excel
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-3 bg-card">
              <p className="text-sm font-semibold text-foreground">
                ส่งออกข้อมูลรับ-ส่งรายเดือน
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={exportMonth}
                  onChange={(e) => setExportMonth(Number(e.target.value))}
                  className="flex-1 border border-border rounded-lg px-2 py-1.5 bg-background text-sm"
                >
                  {THAI_MONTHS.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
                <select
                  value={exportYear}
                  onChange={(e) => setExportYear(Number(e.target.value))}
                  className="border border-border rounded-lg px-2 py-1.5 bg-background text-sm"
                >
                  {exportYearOptions.map((y) => (
                    <option key={y} value={y}>{y + 543}</option>
                  ))}
                </select>
              </div>
              <Button
                size="sm"
                className="w-full gap-1.5"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                {exporting ? 'กำลังดึงข้อมูล...' : 'ดาวน์โหลด Excel'}
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-border p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.fg}`} />
                </div>
                {loading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <span className={`text-2xl font-bold ${s.fg}`}>
                    {s.value}
                    {s.total ? (
                      <span className="text-xs text-muted-foreground font-normal">
                        {' '}/ {s.total}
                      </span>
                    ) : null}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-foreground">{s.label}</h3>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              เช็คชื่อย้อนหลัง 7 วัน
            </h3>
          </div>
          {loading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="stdAttGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.1)',
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${v} คน`, 'เช็คชื่อ']}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#stdAttGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {hqId && byClassroom.length > 0 && (
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 mb-3">
              <School className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                ห้องเรียน — ศูนย์ฯ หลัก ({byClassroom.length})
              </h3>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {byClassroom.map((cl) => (
                  <AttendanceLine
                    key={cl.id}
                    name={cl.name}
                    count={cl.in}
                    out={cl.out}
                    forgot={cl.forgot}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              ตามหน่วยบริการ ({servicePoints.length})
            </h3>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : byServicePoint.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลหน่วยบริการ</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {byServicePoint.map((sp) => (
                <AttendanceLine
                  key={sp.id}
                  name={sp.name}
                  count={sp.in}
                  out={sp.out}
                  forgot={sp.forgot}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentAttendanceWidget;
