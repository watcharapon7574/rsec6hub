import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, MapPin, User, Briefcase } from 'lucide-react';

interface FormDataProps {
  reportType: string;
  formData: Record<string, any>;
}

// Label mapping per report type
const REPORT_TYPE_LABELS: Record<string, string> = {
  duty: 'ปฏิบัติหน้าที่',
  service: 'บริการ',
  lunch: 'อาหารกลางวัน',
  early_intervention: 'ระยะแรกเริ่ม',
  student_dev: 'พัฒนาผู้เรียน',
  other: 'อื่นๆ',
};

const LEARNING_MODE_LABELS: Record<string, string> = {
  onsite: 'ในสถานที่',
  online: 'ออนไลน์',
};

const PREVIEW_COUNT = 3; // show first N rows before collapsing

const Row = ({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) => (
  <div className="flex gap-2 text-sm">
    <div className="flex items-start gap-1.5 text-muted-foreground shrink-0 w-[120px] min-w-[120px]">
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </div>
    <div className="flex-1 min-w-0 text-foreground break-words">{value}</div>
  </div>
);

const NewsfeedFormData = ({ reportType, formData }: FormDataProps) => {
  const [expanded, setExpanded] = useState(false);

  if (!formData || typeof formData !== 'object') return null;

  const f = formData;

  // Build all rows
  const allRows: React.ReactNode[] = [];

  // Shared fields
  if (f.reportDate) {
    allRows.push(
      <Row key="date" icon={<CalendarDays className="h-3.5 w-3.5 shrink-0 mt-0.5" />} label="วันที่" value={f.reportDate} />
    );
  }
  if (f.dutyTime) {
    allRows.push(
      <Row key="time" icon={<Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />} label="เวลา" value={f.dutyTime} />
    );
  }
  if (f.staffName) {
    allRows.push(
      <Row key="staff" icon={<User className="h-3.5 w-3.5 shrink-0 mt-0.5" />} label="ผู้รายงาน" value={f.staffName} />
    );
  }
  if (f.position) {
    allRows.push(
      <Row key="pos" icon={<Briefcase className="h-3.5 w-3.5 shrink-0 mt-0.5" />} label="ตำแหน่ง" value={f.position} />
    );
  }
  if (f.location) {
    allRows.push(
      <Row key="loc" icon={<MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />} label="สถานที่" value={f.location} />
    );
  }

  // Type-specific fields
  if (reportType === 'duty') {
    if (f.activity) {
      allRows.push(<Row key="activity" label="กิจกรรมที่ปฏิบัติ" value={f.activity} />);
    }
    if (f.eventDetail) {
      allRows.push(<Row key="event" label="เหตุการณ์/รายละเอียด" value={f.eventDetail} />);
    }
  } else if (reportType === 'service' || reportType === 'lunch' || reportType === 'early_intervention') {
    if (f.serviceDetail) {
      allRows.push(<Row key="svc" label="รายละเอียดที่ปฏิบัติ" value={f.serviceDetail} />);
    }
  } else if (reportType === 'student_dev') {
    if (f.learningMode) {
      allRows.push(
        <Row key="mode" label="รูปแบบ" value={
          <Badge variant="outline" className="text-[11px] h-5 font-normal">
            {LEARNING_MODE_LABELS[f.learningMode] || f.learningMode}
          </Badge>
        } />
      );
    }
    if (f.studentName) {
      allRows.push(<Row key="student" label="ชื่อผู้เรียน" value={f.studentName} />);
    }
    if (f.disabilityType) {
      allRows.push(<Row key="disability" label="ประเภทความพิการ" value={f.disabilityType} />);
    }
    if (Array.isArray(f.learningActivities) && f.learningActivities.length > 0) {
      allRows.push(
        <Row key="activities" label="กิจกรรมการเรียนรู้" value={
          <ul className="list-disc list-inside space-y-0.5">
            {f.learningActivities.map((a: string, i: number) => (
              <li key={i} className="text-sm">{a}</li>
            ))}
          </ul>
        } />
      );
    }
    if (Array.isArray(f.obstacles) && f.obstacles.length > 0) {
      allRows.push(
        <Row key="obstacles" label="ปัญหา/อุปสรรค" value={
          <ul className="list-disc list-inside space-y-0.5">
            {f.obstacles.map((o: string, i: number) => (
              <li key={i} className="text-sm">{o}</li>
            ))}
          </ul>
        } />
      );
    }
  } else if (reportType === 'other') {
    if (f.customCategoryName) {
      allRows.push(<Row key="catName" label="ชื่อรายงาน" value={f.customCategoryName} />);
    }
    if (f.serviceDetail) {
      allRows.push(<Row key="svc" label="รายละเอียดที่ปฏิบัติ" value={f.serviceDetail} />);
    }
  }

  // Note (all types)
  if (f.note) {
    allRows.push(<Row key="note" label="หมายเหตุ" value={f.note} />);
  }

  if (allRows.length === 0) return null;

  const typeLabel = REPORT_TYPE_LABELS[reportType] || reportType;
  const needsCollapse = allRows.length > PREVIEW_COUNT;
  const visibleRows = expanded || !needsCollapse ? allRows : allRows.slice(0, PREVIEW_COUNT);

  return (
    <div className="space-y-2">
      {/* Report type badge */}
      <Badge variant="secondary" className="text-xs">
        {typeLabel}
      </Badge>

      {/* Fields */}
      <div className="space-y-1.5 bg-muted/30 rounded-lg p-3">
        {visibleRows}
        {needsCollapse && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-blue-500 font-medium mt-1"
          >
            ดูเพิ่มเติม...
          </button>
        )}
      </div>
    </div>
  );
};

export default NewsfeedFormData;
