import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  ShieldCheck,
  Sandwich,
  HandHeart,
  GraduationCap,
  PenSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { NewsfeedService } from '@/services/newsfeedService';
import {
  REPORT_TYPE_LABELS,
  REPORT_IMAGE_LIMIT,
  type CommonReportFields,
  type ReportType,
  type ReportFormByType,
} from '@/types/report';
import { buildReportPayload, initialFormByType, validateReport } from '@/utils/reportPayload';
import CommonFields from '@/components/Report/CommonFields';
import DutyFormFields from '@/components/Report/DutyForm';
import LunchFormFields from '@/components/Report/LunchForm';
import EiServiceFormFields from '@/components/Report/EiServiceForm';
import StudentDevFormFields from '@/components/Report/StudentDevForm';
import OtherFormFields from '@/components/Report/OtherForm';

const POSITION_TEXT: Record<string, string> = {
  director: 'ผู้อำนวยการ',
  deputy_director: 'รองผู้อำนวยการ',
  assistant_director: 'หัวหน้าฝ่าย',
  government_teacher: 'ข้าราชการครู',
  government_employee: 'พนักงานราชการ',
  contract_teacher: 'ครูอัตราจ้าง',
  clerk_teacher: 'ครูธุรการ',
  disability_aide: 'พี่เลี้ยงเด็กพิการ',
};

const REPORT_TYPE_OPTIONS: { type: ReportType; icon: typeof ShieldCheck; description: string }[] = [
  { type: 'duty', icon: ShieldCheck, description: 'รายงานการดูแลนักเรียนที่ศูนย์ฯ' },
  { type: 'lunch', icon: Sandwich, description: 'รายงานอาหารกลางวันที่หน่วยฯ' },
  { type: 'ei_service', icon: HandHeart, description: 'รายงานบริการ EI' },
  { type: 'student_dev', icon: GraduationCap, description: 'พัฒนาผู้เรียน Online/Onsite' },
  { type: 'other', icon: PenSquare, description: 'รายงานประเภทอื่น ๆ' },
];

const todayString = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const nowTime = () => {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const ReportPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useEmployeeAuth();

  const staffName = useMemo(() => {
    if (!profile) return '';
    return [profile.prefix, profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  }, [profile]);

  const positionText = useMemo(() => {
    if (!profile) return '';
    return profile.job_position || profile.current_position || POSITION_TEXT[profile.position] || profile.position || '';
  }, [profile]);

  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [common, setCommon] = useState<CommonReportFields>({
    reportDate: todayString(),
    dutyTime: nowTime(),
    staffName: '',
    position: '',
    images: [],
    youtubeUrl: '',
    tags: [],
  });
  const [formByType, setFormByType] = useState<Partial<ReportFormByType>>({});
  const [submitting, setSubmitting] = useState(false);

  // Sync staffName/position from profile once it loads
  useEffect(() => {
    if (!staffName) return;
    setCommon((c) =>
      c.staffName === staffName && c.position === positionText
        ? c
        : { ...c, staffName, position: positionText },
    );
  }, [staffName, positionText]);

  const pickType = (t: ReportType) => {
    setReportType(t);
    if (!formByType[t]) {
      setFormByType((prev) => ({ ...prev, [t]: initialFormByType(t) }));
    }
  };

  const goBackToSelector = () => {
    setReportType(null);
  };

  const handleSubmit = async () => {
    if (!reportType || !profile) return;
    const form = formByType[reportType];
    if (!form) return;

    const errorMessage = validateReport(reportType, common, form);
    if (errorMessage) {
      toast({ title: 'กรุณาตรวจสอบข้อมูล', description: errorMessage, variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildReportPayload(reportType, common, form);
      await NewsfeedService.createPost({
        userId: profile.user_id,
        authorName: common.staffName,
        authorPosition: common.position,
        authorAvatarUrl: profile.profile_picture_url || undefined,
        title: payload.title,
        description: payload.description,
        category: payload.category,
        tags: payload.tags,
        images: payload.images,
        youtubeUrl: payload.youtube_url,
        location: payload.location,
        reportType: payload.report_type,
        formData: payload.form_data,
      });

      toast({ title: 'ส่งรายงานสำเร็จ', description: payload.title });
      navigate('/newsfeed');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'ไม่สามารถส่งรายงานได้';
      toast({ title: 'ส่งรายงานไม่สำเร็จ', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderTypeForm = () => {
    if (!reportType) return null;
    const form = formByType[reportType];
    if (!form) return null;

    switch (reportType) {
      case 'duty':
        return (
          <DutyFormFields
            value={form as ReportFormByType['duty']}
            onChange={(next) => setFormByType((prev) => ({ ...prev, duty: next }))}
          />
        );
      case 'lunch':
        return (
          <LunchFormFields
            value={form as ReportFormByType['lunch']}
            onChange={(next) => setFormByType((prev) => ({ ...prev, lunch: next }))}
          />
        );
      case 'ei_service':
        return (
          <EiServiceFormFields
            value={form as ReportFormByType['ei_service']}
            onChange={(next) => setFormByType((prev) => ({ ...prev, ei_service: next }))}
          />
        );
      case 'student_dev':
        return (
          <StudentDevFormFields
            value={form as ReportFormByType['student_dev']}
            onChange={(next) => setFormByType((prev) => ({ ...prev, student_dev: next }))}
          />
        );
      case 'other':
        return (
          <OtherFormFields
            value={form as ReportFormByType['other']}
            onChange={(next) => setFormByType((prev) => ({ ...prev, other: next }))}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white pb-32">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (reportType ? goBackToSelector() : navigate('/newsfeed'))}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {reportType ? 'เลือกประเภทใหม่' : 'กลับ'}
        </Button>

        {!reportType && (
          <div className="bg-white rounded-2xl shadow-md border border-border/40 p-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">รายงานปฏิบัติงาน</h1>
                <p className="text-xs text-gray-500">เลือกประเภทรายงานที่ต้องการ</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              {REPORT_TYPE_OPTIONS.map(({ type, icon: Icon, description }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => pickType(type)}
                  className="flex items-start gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800 text-sm">
                      {REPORT_TYPE_LABELS[type]}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {reportType && (
          <div className="bg-white rounded-2xl shadow-md border border-border/40 p-6 space-y-6">
            <div>
              <div className="text-xs text-gray-500 mb-1">ประเภทรายงาน</div>
              <div className="font-semibold text-gray-800">{REPORT_TYPE_LABELS[reportType]}</div>
            </div>

            <div className="border-t pt-5">
              <CommonFields
                value={common}
                onChange={setCommon}
                imageLimit={REPORT_IMAGE_LIMIT[reportType]}
                userId={profile?.user_id || ''}
              />
            </div>

            <div className="border-t pt-5">{renderTypeForm()}</div>

            <div className="border-t pt-5 flex gap-2 justify-end">
              <Button variant="outline" onClick={goBackToSelector} disabled={submitting}>
                ยกเลิก
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    กำลังส่ง...
                  </>
                ) : (
                  'ส่งรายงาน'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportPage;
