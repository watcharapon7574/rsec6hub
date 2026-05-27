import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Clock,
  FileText,
  Paperclip,
  UserCheck,
  Upload,
} from 'lucide-react';
import {
  DELEGATION_AREA_LABELS,
  DELEGATION_AREA_ORDER,
  DelegationArea,
  isAttachmentRequired,
  LEAVE_TYPE_ATTACHMENTS,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_ORDER,
  LEAVE_TYPE_REGULATION,
  LeaveBalance,
  LeaveType,
} from '@/types/leave';
import { calculateLeaveDays } from '@/utils/fiscalYear';
import { createLeaveRequest, getMyBalance } from '@/services/leaveService';

const NewLeaveRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useEmployeeAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    leave_type: LeaveType | '';
    start_date: string;
    end_date: string;
    reason: string;
    contact_phone: string;
    attachment_name: string;
  }>({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: '',
    contact_phone: '',
    attachment_name: '',
  });
  const [delegations, setDelegations] = useState<
    Record<DelegationArea, { enabled: boolean; name: string }>
  >({
    daily_student_care: { enabled: false, name: '' },
    teaching: { enabled: false, name: '' },
    classroom: { enabled: false, name: '' },
    service_unit: { enabled: false, name: '' },
  });
  const [balance, setBalance] = useState<LeaveBalance[]>([]);

  useEffect(() => {
    if (!profile) return;
    let alive = true;
    getMyBalance(profile.id).then((b) => {
      if (alive) setBalance(b);
    });
    return () => {
      alive = false;
    };
  }, [profile]);

  const days =
    formData.start_date && formData.end_date
      ? calculateLeaveDays(formData.start_date, formData.end_date)
      : 0;

  const selectedBalance = useMemo(
    () =>
      formData.leave_type
        ? balance.find((b) => b.leave_type === formData.leave_type)
        : undefined,
    [balance, formData.leave_type],
  );
  const remaining = selectedBalance
    ? selectedBalance.quota_days -
      selectedBalance.used_days -
      selectedBalance.pending_days
    : null;
  const overQuota =
    remaining !== null && days > 0 && days > remaining;
  const regulation = formData.leave_type
    ? LEAVE_TYPE_REGULATION[formData.leave_type as LeaveType]
    : null;

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
    if (
      isAttachmentRequired(formData.leave_type as LeaveType, days) &&
      !formData.attachment_name.trim()
    ) {
      toast({
        title: 'ต้องแนบเอกสาร',
        description:
          LEAVE_TYPE_ATTACHMENTS[formData.leave_type as LeaveType].label,
        variant: 'destructive',
      });
      return;
    }
    if (overQuota) {
      toast({
        title: 'เกินโควต้าการลา',
        description: `${LEAVE_TYPE_LABELS[formData.leave_type as LeaveType]} เหลือ ${remaining} วัน แต่ขอลา ${days} วัน`,
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const userName =
        `${profile.prefix ?? ''}${profile.first_name} ${profile.last_name}`.trim();
      const delegationList = DELEGATION_AREA_ORDER
        .filter(
          (a) => delegations[a].enabled && delegations[a].name.trim() !== '',
        )
        .map((a) => ({ area: a, delegate_name: delegations[a].name.trim() }));
      await createLeaveRequest(
        profile.id,
        userName,
        profile.job_position ?? profile.position ?? '',
        {
          leave_type: formData.leave_type as LeaveType,
          start_date: formData.start_date,
          end_date: formData.end_date,
          reason: formData.reason,
          form_data: {
            contact_phone: formData.contact_phone,
            attachments: formData.attachment_name.trim()
              ? [formData.attachment_name.trim()]
              : [],
            delegations: delegationList.length ? delegationList : undefined,
          },
        },
      );
      toast({ title: 'ส่งคำขอลาแล้ว', description: 'รอ หน.บุคคล พิจารณา' });
      navigate('/attendance');
    } catch (err) {
      toast({
        title: 'ผิดพลาด',
        description: err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const attachmentCfg = formData.leave_type
    ? LEAVE_TYPE_ATTACHMENTS[formData.leave_type as LeaveType]
    : null;
  const attachmentRequired =
    !!formData.leave_type &&
    isAttachmentRequired(formData.leave_type as LeaveType, days);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Card className="mb-6">
          <CardContent className="bg-blue-600 rounded-t-lg pt-6">
            <div className="flex items-start gap-3">
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/15 -ml-1"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="p-2.5 rounded-xl bg-white/15">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">ยื่นคำขอลา</h1>
                <p className="text-sm text-blue-100 mt-0.5">
                  กรอกข้อมูลคำขอลาให้ครบถ้วน
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="leave_type">
                  ประเภทการลา <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.leave_type}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      leave_type: value as LeaveType,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกประเภทการลา" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPE_ORDER.map((t) => (
                      <SelectItem key={t} value={t}>
                        {LEAVE_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {regulation && (
                <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-blue-900 dark:text-blue-200">
                    <BookOpen className="h-3.5 w-3.5" />
                    ระเบียบการลา
                  </div>
                  <p className="text-[12px] leading-relaxed text-blue-900/90 dark:text-blue-100/90">
                    {regulation.rule}
                  </p>
                  {regulation.extendable && (
                    <p className="text-[11px] leading-relaxed text-blue-800/80 dark:text-blue-200/80">
                      • {regulation.extendable}
                    </p>
                  )}
                  {selectedBalance && (
                    <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-blue-200/60 dark:border-blue-800/60">
                      <span className="text-[11px] text-blue-900/80 dark:text-blue-100/80">
                        ใช้ไป {selectedBalance.used_days}
                        {selectedBalance.pending_days > 0 &&
                          ` (รออนุมัติ ${selectedBalance.pending_days})`}{' '}
                        / {selectedBalance.quota_days} วัน
                      </span>
                      <span
                        className={`text-[12px] font-semibold ${
                          (remaining ?? 0) <= 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        เหลือ {remaining} วัน
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">
                    วันที่เริ่มลา <span className="text-red-500">*</span>
                  </Label>
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
                  <Label htmlFor="end_date">
                    วันที่สิ้นสุด <span className="text-red-500">*</span>
                  </Label>
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

              {days > 0 && (
                <div
                  className={`text-sm flex items-center gap-2 rounded-lg px-3 py-2 ${
                    overQuota
                      ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900'
                      : 'bg-muted/40 text-muted-foreground'
                  }`}
                >
                  {overQuota ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                  จำนวนวันลา: <span className="font-semibold">{days} วัน</span>
                  {overQuota && (
                    <span className="ml-auto text-xs font-semibold">
                      เกินโควต้า {days - (remaining ?? 0)} วัน
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="contact_phone">เบอร์ติดต่อระหว่างลา</Label>
                <Input
                  id="contact_phone"
                  type="tel"
                  placeholder="08x-xxx-xxxx"
                  value={formData.contact_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_phone: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">
                  เหตุผลการลา <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="reason"
                  placeholder="กรอกเหตุผลการลา..."
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  rows={4}
                />
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <UserCheck className="h-4 w-4" />
                  มอบหมายหน้าที่ระหว่างลา
                  <span className="text-[11px] font-normal text-muted-foreground">
                    (ถ้ามี)
                  </span>
                </div>
                <div className="space-y-2">
                  {DELEGATION_AREA_ORDER.map((area) => {
                    const d = delegations[area];
                    return (
                      <div
                        key={area}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          id={`delegation-${area}`}
                          checked={d.enabled}
                          onCheckedChange={(v) =>
                            setDelegations((prev) => ({
                              ...prev,
                              [area]: { ...prev[area], enabled: v === true },
                            }))
                          }
                        />
                        <Label
                          htmlFor={`delegation-${area}`}
                          className="cursor-pointer min-w-[160px] text-xs sm:text-sm"
                        >
                          {DELEGATION_AREA_LABELS[area]}
                        </Label>
                        <Input
                          className="flex-1 h-8 text-xs"
                          placeholder="ชื่อผู้ปฏิบัติหน้าที่แทน"
                          value={d.name}
                          disabled={!d.enabled}
                          onChange={(e) =>
                            setDelegations((prev) => ({
                              ...prev,
                              [area]: { ...prev[area], name: e.target.value },
                            }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {attachmentCfg && attachmentCfg.required !== 'never' && (
                <div className="space-y-2">
                  <Label
                    htmlFor="attachment"
                    className="flex items-center gap-1.5"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {attachmentCfg.label}
                    {attachmentRequired && (
                      <span className="text-red-500">*</span>
                    )}
                  </Label>
                  <label
                    htmlFor="attachment"
                    className={`flex items-center gap-2 rounded-lg border-2 border-dashed p-3 cursor-pointer transition-colors hover:bg-muted/40 ${
                      attachmentRequired && !formData.attachment_name
                        ? 'border-red-300'
                        : 'border-border'
                    }`}
                  >
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">
                      {formData.attachment_name || 'เลือกไฟล์...'}
                    </span>
                    {formData.attachment_name && (
                      <span className="text-xs text-blue-600">เปลี่ยน</span>
                    )}
                    <input
                      id="attachment"
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setFormData((d) => ({
                            ...d,
                            attachment_name: f.name,
                          }));
                        }
                      }}
                    />
                  </label>
                  {attachmentCfg.hint && (
                    <p className="text-[11px] text-muted-foreground">
                      {attachmentCfg.hint}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  disabled={submitting}
                >
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={submitting || overQuota}>
                  <CalendarDays className="h-4 w-4 mr-1" />
                  {submitting ? 'กำลังส่ง...' : 'ส่งคำขอ'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NewLeaveRequestPage;
