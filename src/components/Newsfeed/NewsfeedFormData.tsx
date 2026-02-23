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
  if (!formData || typeof formData !== 'object') return null;

  const f = formData;

  // Shared fields
  const sharedRows: React.ReactNode[] = [];

  if (f.reportDate) {
    sharedRows.push(
      <Row key="date" icon={<CalendarDays className="h-3.5 w-3.5 shrink-0 mt-0.5" />} label="วันที่" value={f.reportDate} />
    );
  }
  if (f.dutyTime) {
    sharedRows.push(
      <Row key="time" icon={<Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />} label="เวลา" value={f.dutyTime} />
    );
  }
  if (f.staffName) {
    sharedRows.push(
      <Row key="staff" icon={<User className="h-3.5 w-3.5 shrink-0 mt-0.5" />} label="ผู้รายงาน" value={f.staffName} />
    );
  }
  if (f.position) {
    sharedRows.push(
      <Row key="pos" icon={<Briefcase className="h-3.5 w-3.5 shrink-0 mt-0.5" />} label="ตำแหน่ง" value={f.position} />
    );
  }
  if (f.location) {
    sharedRows.push(
      <Row key="loc" icon={<MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />} label="สถานที่" value={f.location} />
    );
  }

  // Type-specific fields
  const typeRows: React.ReactNode[] = [];

  if (reportType === 'duty') {
    if (f.activity) {
      typeRows.push(<Row key="activity" label="กิจกรรมที่ปฏิบัติ" value={f.activity} />);
    }
    if (f.eventDetail) {
      typeRows.push(<Row key="event" label="เหตุการณ์/รายละเอียด" value={f.eventDetail} />);
    }
  } else if (reportType === 'service' || reportType === 'lunch' || reportType === 'early_intervention') {
    if (f.serviceDetail) {
      typeRows.push(<Row key="svc" label="รายละเอียดที่ปฏิบัติ" value={f.serviceDetail} />);
    }
  } else if (reportType === 'student_dev') {
    if (f.learningMode) {
      typeRows.push(
        <Row key="mode" label="รูปแบบ" value={
          <Badge variant="outline" className="text-[11px] h-5 font-normal">
            {LEARNING_MODE_LABELS[f.learningMode] || f.learningMode}
          </Badge>
        } />
      );
    }
    if (f.studentName) {
      typeRows.push(<Row key="student" label="ชื่อผู้เรียน" value={f.studentName} />);
    }
    if (f.disabilityType) {
      typeRows.push(<Row key="disability" label="ประเภทความพิการ" value={f.disabilityType} />);
    }
    if (Array.isArray(f.learningActivities) && f.learningActivities.length > 0) {
      typeRows.push(
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
      typeRows.push(
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
      typeRows.push(<Row key="catName" label="ชื่อรายงาน" value={f.customCategoryName} />);
    }
    if (f.serviceDetail) {
      typeRows.push(<Row key="svc" label="รายละเอียดที่ปฏิบัติ" value={f.serviceDetail} />);
    }
  }

  // Note (all types)
  if (f.note) {
    typeRows.push(<Row key="note" label="หมายเหตุ" value={f.note} />);
  }

  const typeLabel = REPORT_TYPE_LABELS[reportType] || reportType;

  return (
    <div className="space-y-2">
      {/* Report type badge */}
      <Badge variant="secondary" className="text-xs">
        {typeLabel}
      </Badge>

      {/* Fields */}
      <div className="space-y-1.5 bg-muted/30 rounded-lg p-3">
        {sharedRows}
        {sharedRows.length > 0 && typeRows.length > 0 && (
          <div className="border-t border-border/50 my-1.5" />
        )}
        {typeRows}
      </div>
    </div>
  );
};

export default NewsfeedFormData;
