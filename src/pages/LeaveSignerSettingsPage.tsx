// หน้า "ตั้งค่าบทบาท" — admin เลือกว่าใครเป็นผู้ลงนามแต่ละขั้นของการลา
// (หน.บุคคล → รอง ผอ. → ผอ.) เก็บลง app_settings ผ่าน leaveService
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldCheck, Loader2, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import {
  getLeaveSignerConfig,
  getSignerCandidates,
  setLeaveSignerConfig,
  type LeaveSignerConfig,
  type SignerCandidate,
} from '@/services/leaveService';
import type { LeaveSignerRole } from '@/types/leave';

const ROLE_META: Array<{
  role: LeaveSignerRole;
  label: string;
  order: string;
  hint: string;
}> = [
  { role: 'hr_head', label: 'หน.บุคคล', order: 'ขั้นที่ 1', hint: 'ผู้ลงนามคนแรก — ออกเลขหนังสือ' },
  { role: 'deputy_director', label: 'รอง ผอ.', order: 'ขั้นที่ 2', hint: 'ลงนามต่อจาก หน.บุคคล' },
  { role: 'director', label: 'ผอ.', order: 'ขั้นที่ 3', hint: 'ผู้ลงนามคนสุดท้าย — อนุมัติ' },
];

const candidateLabel = (c: SignerCandidate): string =>
  c.org_structure_role ? `${c.name} · ${c.org_structure_role}` : c.name;

const LeaveSignerSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useEmployeeAuth();
  const isAdmin = (profile as { is_admin?: boolean } | null)?.is_admin === true;

  const [candidates, setCandidates] = useState<SignerCandidate[]>([]);
  const [config, setConfig] = useState<LeaveSignerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<LeaveSignerRole | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cands, cfg] = await Promise.all([
          getSignerCandidates(),
          getLeaveSignerConfig(),
        ]);
        setCandidates(cands);
        setConfig(cfg);
      } catch (e) {
        toast({
          title: 'โหลดข้อมูลไม่สำเร็จ',
          description: e instanceof Error ? e.message : undefined,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const nameByUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of candidates) m.set(c.user_id, c.name);
    return m;
  }, [candidates]);

  const handleChange = async (role: LeaveSignerRole, userId: string) => {
    setSavingRole(role);
    try {
      await setLeaveSignerConfig(role, userId);
      setConfig((prev) => ({
        hr_head: prev?.hr_head ?? null,
        deputy_director: prev?.deputy_director ?? null,
        director: prev?.director ?? null,
        [role]: userId,
      }));
      toast({
        title: 'บันทึกแล้ว',
        description: `${ROLE_META.find((r) => r.role === role)?.label}: ${nameByUserId.get(userId) ?? ''}`,
      });
    } catch (e) {
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSavingRole(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          ย้อนกลับ
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2 text-muted-foreground"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> ย้อนกลับ
        </Button>

        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              ตั้งค่าบทบาทผู้ลงนาม
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              เลือกว่าใครเป็นผู้ลงนามแต่ละขั้นของการลา — ผู้ที่เลือกจะได้รับแจ้งเตือน
              และลงนามได้ทันที (เปลี่ยนเมื่อไหร่ก็ได้)
            </p>
          </CardHeader>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {ROLE_META.map((meta) => {
              const current = config?.[meta.role] ?? '';
              return (
                <Card key={meta.role}>
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {meta.order}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {meta.label}
                      </span>
                      {savingRole === meta.role && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2.5">{meta.hint}</p>
                    <Select
                      value={current}
                      onValueChange={(v) => handleChange(meta.role, v)}
                      disabled={savingRole !== null}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="— ยังไม่ได้เลือก —" />
                      </SelectTrigger>
                      <SelectContent>
                        {candidates.map((c) => (
                          <SelectItem key={c.user_id} value={c.user_id}>
                            {candidateLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveSignerSettingsPage;
