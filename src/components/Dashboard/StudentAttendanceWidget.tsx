import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, LogIn, LogOut, UserX, MapPin, TrendingUp } from 'lucide-react';
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

const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  const [totalStudents, setTotalStudents] = useState(0);
  const [todayRows, setTodayRows] = useState<AttendanceRow[]>([]);
  const [last7Rows, setLast7Rows] = useState<Pick<AttendanceRow, 'date'>[]>([]);
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    const todayStr = toDateStr(today);
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    const weekAgoStr = toDateStr(weekAgo);

    const load = async () => {
      setLoading(true);
      const [studentsRes, todayRes, weekRes, spRes] = await Promise.all([
        supabase
          .from('std_students')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true),
        supabase
          .from('std_attendance')
          .select('id, student_id, date, service_point_id, check_in, check_out')
          .eq('date', todayStr),
        supabase
          .from('std_attendance')
          .select('date')
          .gte('date', weekAgoStr)
          .lte('date', todayStr),
        supabase
          .from('std_service_points')
          .select('id, short_name, name')
          .eq('is_active', true),
      ]);

      if (cancelled) return;
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
    const present = todayRows.length;
    const absent = Math.max(0, totalStudents - present);
    return { present, checkedIn, checkedOut, absent };
  }, [todayRows, totalStudents]);

  const chartData = useMemo(() => {
    const today = new Date();
    const buckets: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      buckets[toDateStr(d)] = 0;
    }
    for (const row of last7Rows) {
      if (row.date in buckets) buckets[row.date]++;
    }
    return Object.entries(buckets).map(([date, count]) => {
      const d = new Date(date);
      return {
        date,
        label: `${THAI_DAYS_SHORT[d.getDay()]} ${d.getDate()}`,
        count,
      };
    });
  }, [last7Rows]);

  const byServicePoint = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of todayRows) {
      if (!row.service_point_id) continue;
      map.set(row.service_point_id, (map.get(row.service_point_id) ?? 0) + 1);
    }
    return servicePoints
      .map((sp) => ({
        id: sp.id,
        name: sp.short_name || sp.name,
        count: map.get(sp.id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [todayRows, servicePoints]);

  const statCards = [
    {
      label: 'มาเช็คชื่อวันนี้',
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
      label: 'ขาด',
      value: stats.absent,
      icon: UserX,
      bg: 'bg-rose-100 dark:bg-rose-900',
      fg: 'text-rose-600 dark:text-rose-400',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          สถิตินักเรียนวันนี้
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stat cards */}
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

        {/* 7-day chart */}
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

        {/* Service points */}
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              ตามหน่วยบริการ ({servicePoints.length})
            </h3>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : byServicePoint.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลหน่วยบริการ</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {byServicePoint.map((sp) => (
                <div
                  key={sp.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/40"
                >
                  <span className="text-sm text-foreground truncate" title={sp.name}>
                    {sp.name}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      sp.count > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                    }`}
                  >
                    {sp.count}
                  </span>
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
