import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

interface AttendanceExportRow {
  id: string;
  student_id: string | null;
  date: string;
  service_point_id: string | null;
  check_in: string | null;
  check_out: string | null;
  guardian_in: string | null;
  guardian_out: string | null;
  teacher_name: string | null;
  notes: string | null;
}

// check_in/check_out may be a timestamp or a bare time string depending on the
// recording path — normalize both to HH:mm (Bangkok time for timestamps).
const fmtTime = (value: string | null): string => {
  if (!value) return '';
  if (value.includes('T') || value.includes(' ')) {
    const d = new Date(value.replace(' ', 'T'));
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d);
    }
  }
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return value;
};

const fmtThaiDate = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y + 543}`;
};

// Supabase caps each select at 1,000 rows; a full month of attendance can
// exceed that, so page until a short page comes back.
const fetchMonthAttendance = async (
  startDate: string,
  endDate: string,
): Promise<AttendanceExportRow[]> => {
  const PAGE = 1000;
  const rows: AttendanceExportRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('std_attendance')
      .select(
        'id, student_id, date, service_point_id, check_in, check_out, guardian_in, guardian_out, teacher_name, notes',
      )
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data as AttendanceExportRow[]) ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
};

/**
 * Exports a month of std_attendance into a 3-sheet workbook:
 * 1) สรุปรายสถานที่ — monthly totals per หน่วยบริการ / ห้องเรียน (HQ split by classroom)
 * 2) รายละเอียดรายคน — one row per attendance record
 * 3) สรุปรายนักเรียน — per-student totals
 * Returns the file name, or null when the month has no records.
 * `month` is 1-12, `year` is CE.
 */
export const exportStudentAttendanceExcel = async (
  year: number,
  month: number,
): Promise<string | null> => {
  const mm = String(month).padStart(2, '0');
  const startDate = `${year}-${mm}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;

  // Lookups intentionally skip is_active filters so records of since-removed
  // students/locations still resolve to names in the report.
  const [attendance, studentsRes, spRes, classroomsRes] = await Promise.all([
    fetchMonthAttendance(startDate, endDate),
    supabase.from('std_students').select('id, name, nickname, classroom_id'),
    supabase
      .from('std_service_points')
      .select('id, name, short_name, is_headquarters')
      .order('is_headquarters', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('std_classrooms')
      .select('id, name, service_point_id')
      .order('name', { ascending: true }),
  ]);
  if (studentsRes.error) throw studentsRes.error;
  if (spRes.error) throw spRes.error;
  if (classroomsRes.error) throw classroomsRes.error;

  if (attendance.length === 0) return null;

  const students = new Map(
    (studentsRes.data ?? []).map((s) => [s.id as string, s]),
  );
  const servicePoints = (spRes.data ?? []) as {
    id: string;
    name: string;
    short_name: string | null;
    is_headquarters: boolean | null;
  }[];
  const spById = new Map(servicePoints.map((sp) => [sp.id, sp]));
  const classrooms = (classroomsRes.data ?? []) as {
    id: string;
    name: string;
    service_point_id: string | null;
  }[];
  const classroomById = new Map(classrooms.map((cl) => [cl.id, cl]));
  const hqId = servicePoints.find((sp) => sp.is_headquarters)?.id ?? null;

  const spName = (id: string | null) => {
    if (!id) return '';
    const sp = spById.get(id);
    return sp ? sp.name || sp.short_name || '' : '';
  };
  const classroomName = (studentId: string | null) => {
    const cid = studentId ? students.get(studentId)?.classroom_id : null;
    return cid ? classroomById.get(cid)?.name ?? '' : '';
  };

  // ---- Sheet 1: per-location monthly totals (HQ split into classrooms) ----
  type Counts = { present: number; in: number; out: number; forgot: number };
  const newCounts = (): Counts => ({ present: 0, in: 0, out: 0, forgot: 0 });
  const tally = (c: Counts, row: AttendanceExportRow) => {
    c.present++;
    if (row.check_in) c.in++;
    if (row.check_out) c.out++;
    if (row.check_in && !row.check_out) c.forgot++;
  };

  const locationKey = (row: AttendanceExportRow): string => {
    if (!row.service_point_id) return 'none';
    if (row.service_point_id === hqId) {
      const cid = row.student_id ? students.get(row.student_id)?.classroom_id : null;
      // Only bucket into a classroom that actually belongs to HQ — otherwise the
      // count would land in a `cl:` key that the HQ-classroom render loop never
      // emits, silently dropping it from the sheet while the total still counts it.
      if (cid && classroomById.get(cid)?.service_point_id === hqId) return `cl:${cid}`;
      return 'hq-no-classroom';
    }
    return `sp:${row.service_point_id}`;
  };
  const locationCounts = new Map<string, Counts>();
  const total = newCounts();
  for (const row of attendance) {
    const key = locationKey(row);
    const c = locationCounts.get(key) ?? newCounts();
    tally(c, row);
    locationCounts.set(key, c);
    tally(total, row);
  }

  type LocationEntry = { name: string; counts: Counts };
  const locationRows: LocationEntry[] = [];
  // HQ classrooms first, then other service points, mirroring the dashboard.
  if (hqId) {
    for (const cl of classrooms.filter((c) => c.service_point_id === hqId)) {
      const counts = locationCounts.get(`cl:${cl.id}`);
      if (counts) locationRows.push({ name: cl.name, counts });
    }
    const noRoom = locationCounts.get('hq-no-classroom');
    if (noRoom) {
      locationRows.push({ name: `${spName(hqId)} (ไม่ระบุห้อง)`, counts: noRoom });
    }
  }
  for (const sp of servicePoints.filter((s) => s.id !== hqId)) {
    const counts = locationCounts.get(`sp:${sp.id}`);
    if (counts) locationRows.push({ name: sp.name || sp.short_name || '', counts });
  }
  const noLocation = locationCounts.get('none');
  if (noLocation) locationRows.push({ name: 'ไม่ระบุสถานที่', counts: noLocation });

  const sheet1Data = [
    ...locationRows.map((loc) => ({
      'สถานที่': loc.name,
      'มา (คน-วัน)': loc.counts.present,
      'รับเข้า': loc.counts.in,
      'ส่งกลับ': loc.counts.out,
      'ค้างส่ง': loc.counts.forgot,
    })),
    {
      'สถานที่': 'รวมทั้งเดือน',
      'มา (คน-วัน)': total.present,
      'รับเข้า': total.in,
      'ส่งกลับ': total.out,
      'ค้างส่ง': total.forgot,
    },
  ];

  // ---- Sheet 2: one row per attendance record ----
  const studentName = (id: string | null) =>
    (id ? students.get(id)?.name : null) ?? '(ไม่พบชื่อ)';
  const sheet2Data = [...attendance]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        studentName(a.student_id).localeCompare(studentName(b.student_id), 'th'),
    )
    .map((row) => ({
      'วันที่': fmtThaiDate(row.date),
      'ชื่อนักเรียน': studentName(row.student_id),
      'ชื่อเล่น': (row.student_id ? students.get(row.student_id)?.nickname : null) ?? '',
      'ห้องเรียน': classroomName(row.student_id),
      'จุดบริการ': spName(row.service_point_id),
      'เวลารับเข้า': fmtTime(row.check_in),
      'ผู้มาส่ง': row.guardian_in ?? '',
      'เวลาส่งกลับ': fmtTime(row.check_out),
      'ผู้มารับ': row.guardian_out ?? '',
      'ครูผู้บันทึก': row.teacher_name ?? '',
      'หมายเหตุ': row.notes ?? '',
    }));

  // ---- Sheet 3: per-student totals ----
  const perStudent = new Map<string, { days: Set<string>; forgot: number; spCount: Map<string, number> }>();
  for (const row of attendance) {
    if (!row.student_id) continue;
    const s = perStudent.get(row.student_id) ?? {
      days: new Set<string>(),
      forgot: 0,
      spCount: new Map<string, number>(),
    };
    s.days.add(row.date);
    if (row.check_in && !row.check_out) s.forgot++;
    if (row.service_point_id) {
      s.spCount.set(row.service_point_id, (s.spCount.get(row.service_point_id) ?? 0) + 1);
    }
    perStudent.set(row.student_id, s);
  }
  const sheet3Data = [...perStudent.entries()]
    .sort((a, b) => studentName(a[0]).localeCompare(studentName(b[0]), 'th'))
    .map(([studentId, s]) => {
      const mainSp = [...s.spCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        'ชื่อนักเรียน': studentName(studentId),
        'ชื่อเล่น': students.get(studentId)?.nickname ?? '',
        'ห้องเรียน': classroomName(studentId),
        'จุดบริการหลัก': spName(mainSp),
        'จำนวนวันที่มา': s.days.size,
        'ค้างส่ง (ครั้ง)': s.forgot,
      };
    });

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
  ws1['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'สรุปรายสถานที่');

  const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
  ws2['!cols'] = [
    { wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 18 },
    { wch: 11 }, { wch: 14 }, { wch: 11 }, { wch: 14 }, { wch: 18 }, { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'รายละเอียดรายคน');

  const ws3 = XLSX.utils.json_to_sheet(sheet3Data);
  ws3['!cols'] = [
    { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 13 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, 'สรุปรายนักเรียน');

  const fileName = `รับ-ส่งนักเรียน_${THAI_MONTHS[month - 1]}_${year + 543}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
};
