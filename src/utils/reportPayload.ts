import type {
  ReportType,
  CommonReportFields,
  ReportFormByType,
  DutyForm,
  LunchForm,
  EiServiceForm,
  StudentDevForm,
  OtherForm,
} from '@/types/report';
import { REPORT_TYPE_LABELS } from '@/types/report';

export interface ReportPayload {
  title: string;
  description: string | null;
  category: string;
  tags: string[];
  images: string[];
  location: { name: string } | null;
  report_type: ReportType;
  form_data: Record<string, unknown>;
  youtube_url: string | null;
}

const joinNonEmpty = (parts: (string | undefined | null)[], sep = ' — '): string =>
  parts.filter((p) => p && p.trim().length > 0).join(sep);

const buildTitle = <T extends ReportType>(reportType: T, form: ReportFormByType[T]): string => {
  switch (reportType) {
    case 'duty': {
      const f = form as DutyForm;
      return joinNonEmpty(['ดูแลนักเรียน', f.location, f.activity]);
    }
    case 'lunch': {
      const f = form as LunchForm;
      return joinNonEmpty(['อาหารกลางวัน', f.workplace]);
    }
    case 'ei_service': {
      const f = form as EiServiceForm;
      return joinNonEmpty(['บริการ EI', f.workplace]);
    }
    case 'student_dev': {
      const f = form as StudentDevForm;
      return joinNonEmpty([`พัฒนาผู้เรียน ${f.learningMode}`, f.serviceUnit, f.teachingActivity]);
    }
    case 'other': {
      const f = form as OtherForm;
      return f.customCategoryName.trim() || 'รายงานอื่น ๆ';
    }
  }
};

const line = (label: string, value: string | undefined | null): string | null => {
  if (!value || !value.trim()) return null;
  return `${label}: ${value.trim()}`;
};

const buildDescription = <T extends ReportType>(
  reportType: T,
  common: CommonReportFields,
  form: ReportFormByType[T],
): string | null => {
  const lines: (string | null)[] = [
    line('วันที่รายงาน', common.reportDate),
    line('เวลาปฏิบัติงาน', common.dutyTime),
    line('ผู้ปฏิบัติ', common.staffName),
    line('ตำแหน่ง', common.position),
  ];

  switch (reportType) {
    case 'duty': {
      const f = form as DutyForm;
      lines.push(
        line('สถานที่', f.location),
        line('กิจกรรม', f.activity),
        line('รายละเอียดเหตุการณ์', f.eventDetail),
        line('หมายเหตุ', f.note),
      );
      if (f.dutyExchanges.length > 0) {
        const ex = f.dutyExchanges
          .filter((e) => e.personA.trim() || e.personB.trim())
          .map((e, i) => `  ${i + 1}. ${e.personA} ↔ ${e.personB}`)
          .join('\n');
        if (ex) lines.push(`การแลกเปลี่ยนเวร:\n${ex}`);
      }
      break;
    }
    case 'lunch': {
      const f = form as LunchForm;
      lines.push(line('ห้องเรียน/หน่วยบริการ', f.workplace));
      const menus = f.foodMenus.filter((m) => m.trim());
      if (menus.length > 0) lines.push(`เมนูอาหาร: ${menus.join(', ')}`);
      lines.push(line('หมายเหตุ', f.note));
      break;
    }
    case 'ei_service': {
      const f = form as EiServiceForm;
      lines.push(
        line('ห้องเรียน/หน่วยบริการ', f.workplace),
        line('จำนวนนักเรียน', f.studentCount),
        line('จำนวนผู้ปกครอง', f.parentCount),
        line('กิจกรรมการจัดให้บริการ', f.serviceActivity),
        line('อื่น ๆ', f.note),
      );
      break;
    }
    case 'student_dev': {
      const f = form as StudentDevForm;
      lines.push(
        line('รูปแบบ', f.learningMode),
        line('ห้องเรียน/หน่วยบริการ', f.serviceUnit),
        line('กิจกรรมการสอน', f.teachingActivity),
      );
      const students = f.students
        .filter((s) => s.name.trim() || s.disabilityType.trim())
        .map((s, i) => `  ${i + 1}. ${s.name} (${s.disabilityType})`)
        .join('\n');
      if (students) lines.push(`นักเรียน:\n${students}`);
      const acts = f.learningActivities.filter((a) => a.trim());
      if (acts.length > 0) lines.push(`กิจกรรมการเรียนรู้:\n${acts.map((a, i) => `  ${i + 1}. ${a}`).join('\n')}`);
      lines.push(line('การให้คำแนะนำ', f.guidance));
      const obs = f.obstacles.filter((o) => o.trim());
      if (obs.length > 0) lines.push(`ปัญหา/อุปสรรค:\n${obs.map((o, i) => `  ${i + 1}. ${o}`).join('\n')}`);
      break;
    }
    case 'other': {
      const f = form as OtherForm;
      lines.push(line('ชื่อรายงาน', f.customCategoryName), line('หมายเหตุ', f.note));
      break;
    }
  }

  const text = lines.filter(Boolean).join('\n');
  return text.trim().length > 0 ? text : null;
};

const buildLocation = <T extends ReportType>(
  reportType: T,
  form: ReportFormByType[T],
): { name: string } | null => {
  switch (reportType) {
    case 'duty': {
      const f = form as DutyForm;
      return f.location.trim() ? { name: f.location.trim() } : null;
    }
    case 'student_dev': {
      const f = form as StudentDevForm;
      return f.serviceUnit.trim() ? { name: f.serviceUnit.trim() } : null;
    }
    case 'ei_service': {
      const f = form as EiServiceForm;
      return f.workplace.trim() ? { name: f.workplace.trim() } : null;
    }
    case 'lunch': {
      const f = form as LunchForm;
      return f.workplace.trim() ? { name: f.workplace.trim() } : null;
    }
    case 'other':
      return null;
  }
};

const buildCategory = <T extends ReportType>(reportType: T, form: ReportFormByType[T]): string => {
  if (reportType === 'other') {
    const f = form as OtherForm;
    return f.customCategoryName.trim() || REPORT_TYPE_LABELS.other;
  }
  return REPORT_TYPE_LABELS[reportType];
};

export const buildReportPayload = <T extends ReportType>(
  reportType: T,
  common: CommonReportFields,
  form: ReportFormByType[T],
): ReportPayload => {
  const builtinTags = [
    `report_date:${common.reportDate}`,
    `duty_time:${common.dutyTime}`,
    `report_type:${reportType}`,
  ];

  return {
    title: buildTitle(reportType, form),
    description: buildDescription(reportType, common, form),
    category: buildCategory(reportType, form),
    tags: [...builtinTags, ...common.tags.filter((t) => t.trim())],
    images: common.images,
    location: buildLocation(reportType, form),
    report_type: reportType,
    form_data: {
      reportType,
      formType: reportType,
      reportDate: common.reportDate,
      dutyTime: common.dutyTime,
      staffName: common.staffName,
      position: common.position,
      tags: common.tags,
      ...form,
    },
    youtube_url: common.youtubeUrl.trim() || null,
  };
};

export const validateReport = <T extends ReportType>(
  reportType: T,
  common: CommonReportFields,
  form: ReportFormByType[T],
): string | null => {
  if (!common.reportDate) return 'กรุณาเลือกวันที่รายงาน';
  if (!common.dutyTime) return 'กรุณากรอกเวลาปฏิบัติงาน';
  if (common.images.length === 0) return 'กรุณาแนบรูปภาพอย่างน้อย 1 รูป';

  switch (reportType) {
    case 'duty': {
      const f = form as DutyForm;
      if (!f.location.trim()) return 'กรุณากรอกสถานที่';
      if (!f.activity.trim()) return 'กรุณากรอกกิจกรรมที่ปฏิบัติ';
      break;
    }
    case 'ei_service': {
      const f = form as EiServiceForm;
      if (!f.serviceActivity.trim()) return 'กรุณากรอกกิจกรรมการจัดให้บริการ';
      break;
    }
    case 'student_dev': {
      const f = form as StudentDevForm;
      if (!f.learningMode) return 'กรุณาเลือกรูปแบบ Online/Onsite';
      if (!f.serviceUnit.trim()) return 'กรุณากรอกห้องเรียน/หน่วยบริการ';
      if (!f.teachingActivity.trim()) return 'กรุณากรอกกิจกรรมการสอน';
      if (f.students.filter((s) => s.name.trim() || s.disabilityType.trim()).length === 0)
        return 'กรุณาเพิ่มข้อมูลนักเรียนอย่างน้อย 1 รายการ';
      if (f.learningActivities.filter((a) => a.trim()).length === 0)
        return 'กรุณาเพิ่มกิจกรรมการเรียนรู้อย่างน้อย 1 รายการ';
      break;
    }
    case 'other': {
      const f = form as OtherForm;
      if (!f.customCategoryName.trim()) return 'กรุณาระบุชื่อรายงาน';
      break;
    }
  }
  return null;
};

export const initialFormByType = <T extends ReportType>(reportType: T): ReportFormByType[T] => {
  switch (reportType) {
    case 'duty':
      return { location: '', activity: '', eventDetail: '', note: '', dutyExchanges: [] } as ReportFormByType[T];
    case 'lunch':
      return { workplace: '', foodMenus: [], note: '' } as ReportFormByType[T];
    case 'ei_service':
      return { workplace: '', studentCount: '', parentCount: '', serviceActivity: '', note: '' } as ReportFormByType[T];
    case 'student_dev':
      return {
        learningMode: 'Onsite',
        serviceUnit: '',
        teachingActivity: '',
        students: [],
        learningActivities: [],
        guidance: '',
        obstacles: [],
      } as ReportFormByType[T];
    case 'other':
      return { customCategoryName: '', note: '' } as ReportFormByType[T];
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
};
