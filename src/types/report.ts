export type ReportType = 'duty' | 'lunch' | 'ei_service' | 'student_dev' | 'other';

export type LearningMode = 'Online' | 'Onsite';

export interface DutyExchange {
  personA: string;
  personB: string;
}

export interface StudentEntry {
  name: string;
  disabilityType: string;
}

export interface CommonReportFields {
  reportDate: string;       // YYYY-MM-DD
  dutyTime: string;         // HH:MM
  staffName: string;        // auto from profile
  position: string;         // auto from profile
  images: string[];         // uploaded URLs
  youtubeUrl: string;       // optional
  tags: string[];           // user-added
}

export interface DutyForm {
  location: string;
  activity: string;
  eventDetail: string;
  note: string;
  dutyExchanges: DutyExchange[];
}

export interface LunchForm {
  workplace: string;
  foodMenus: string[];
  note: string;
}

export interface EiServiceForm {
  workplace: string;
  studentCount: string;
  parentCount: string;
  serviceActivity: string;
  note: string;
}

export interface StudentDevForm {
  learningMode: LearningMode;
  serviceUnit: string;
  teachingActivity: string;
  students: StudentEntry[];
  learningActivities: string[];
  guidance: string;
  obstacles: string[];
}

export interface OtherForm {
  customCategoryName: string;
  note: string;
}

export type ReportFormByType = {
  duty: DutyForm;
  lunch: LunchForm;
  ei_service: EiServiceForm;
  student_dev: StudentDevForm;
  other: OtherForm;
};

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  duty: 'ดูแลนักเรียน (ศูนย์ฯ)',
  lunch: 'อาหารกลางวัน (หน่วยฯ)',
  ei_service: 'บริการ EI',
  student_dev: 'พัฒนาผู้เรียน',
  other: 'อื่น ๆ',
};

export const REPORT_IMAGE_LIMIT: Record<ReportType, number> = {
  duty: 5,
  lunch: 5,
  ei_service: 5,
  student_dev: 5,
  other: 99,
};
