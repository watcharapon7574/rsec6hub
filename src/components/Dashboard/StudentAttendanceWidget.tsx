import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, LogIn, LogOut, AlarmClock, MapPin, TrendingUp } from 'lucide-react';
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
}

interface AttendanceRow {
  id: string;
  student_id: string;
  date: string;
  service_point_id: string | null;
  check_in: string | null;
  check_out: string | null;
}

const StudentAttendanceWidget: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [todayStr, setTodayStr] = useState(() => bangkokDateStr());
  const [totalStudents, setTotalStudents] = useState(0);
  const [todayRows, setTodayRows] = useState<AttendanceRow[]>([]);
  const [last7Rows, setLast7Rows] = useState<Pick<AttendanceRow, 'date'>[]>([]);
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const today = bangkokDateStr();
      const weekAgo = shiftDateStr(today, -6);

      const [studentsRes, todayRes, weekRes, spRes] = await Promise.all([
        supabase
          .from('std_students')
          .select('*', { count: 'exact', head: true })
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
          .select('id, short_name, name')
          .eq('is_active', true)
          .order('short_name', { ascending: true }),
      ]);

      if (cancelled) return;
      setTodayStr(today);
      setTotalStudents(studentsRes.count ?? 0);
      setTodayRows((todayRes.data as AttendanceRow[]) ?? []);
      setLast7Rows((weekRes.data as Pick<AttendanceRow, 'date'>[]) ?? []);
      setServicePoints((spRes.data as ServicePoint[]) ?? []);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel('dashboard-std-attendance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'std_attendance' },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
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
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          สถิติรับ-ส่งนักเรียนวันนี้
        </CardTitle>
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
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : byServicePoint.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลหน่วยบริการ</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {byServicePoint.map((sp) => (
                <div
                  key={sp.id}
                  className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/40"
                >
                  <span className="text-sm text-foreground truncate" title={sp.name}>
                    {sp.name}
                  </span>
                  <div className="flex items-center gap-3 text-xs font-medium shrink-0 tabular-nums">
                    <span className="text-green-600 dark:text-green-400" title="รับเข้า">
                      รับ {sp.in}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400" title="ส่งกลับ">
                      ส่ง {sp.out}
                    </span>
                    {sp.forgot > 0 && (
                      <span className="text-rose-600 dark:text-rose-400" title="ค้างส่ง">
                        ค้าง {sp.forgot}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentAttendanceWidget;
