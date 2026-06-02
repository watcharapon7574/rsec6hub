// หน้า "ตั้งค่าบทบาท" (/admin/roles) — hub รวมการตั้งค่าผู้ลงนาม/บทบาทของแต่ละฟีเจอร์
// เข้ามาแล้วเลือกฟีเจอร์ก่อน (ตอนนี้มี "การลา") แล้วค่อยเข้าไปตั้งค่า
// เพิ่มฟีเจอร์ใหม่ในอนาคต: เพิ่มเข้า FEATURES + เขียน panel ของมัน แล้ว map ใน renderPanel
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Loader2,
  UserCheck,
} from 'lucide-react';
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

// ───────────────── registry ของฟีเจอร์ที่ตั้งค่าบทบาทได้ ─────────────────
type FeatureKey = 'leave';

interface RoleFeature {
  key: FeatureKey;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FEATURES: RoleFeature[] = [
  {
    key: 'leave',
    title: 'ผู้ลงนามการลา',
    description: 'กำหนดผู้ลงนามแต่ละขั้น: หน.บุคคล → รอง ผอ. → ผอ.',
    icon: UserCheck,
  },
];

// ───────────────── panel: ตั้งค่าผู้ลงนามการลา ─────────────────
const LEAVE_ROLE_META: Array<{
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

const LeaveSignerPanel: React.FC = () => {
  const { toast } = useToast();
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
        description: `${LEAVE_ROLE_META.find((r) => r.role === role)?.label}: ${nameByUserId.get(userId) ?? ''}`,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {LEAVE_ROLE_META.map((meta) => {
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
  );
};

const renderPanel = (key: FeatureKey): React.ReactNode => {
  switch (key) {
    case 'leave':
      return <LeaveSignerPanel />;
    default:
      return null;
  }
};

// ───────────────── หน้า hub ─────────────────
const RoleSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useEmployeeAuth();
  const isAdmin = (profile as { is_admin?: boolean } | null)?.is_admin === true;
  const [selected, setSelected] = useState<FeatureKey | null>(null);

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

  const activeFeature = FEATURES.find((f) => f.key === selected) ?? null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2 text-muted-foreground"
          onClick={() => (activeFeature ? setSelected(null) : navigate(-1))}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {activeFeature ? 'เลือกฟีเจอร์อื่น' : 'ย้อนกลับ'}
        </Button>

        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              {activeFeature ? activeFeature.title : 'ตั้งค่าบทบาท'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {activeFeature
                ? activeFeature.description
                : 'เลือกฟีเจอร์ที่ต้องการกำหนดผู้รับผิดชอบ / ผู้ลงนาม'}
            </p>
          </CardHeader>
        </Card>

        {activeFeature ? (
          renderPanel(activeFeature.key)
        ) : (
          <div className="space-y-2.5">
            {FEATURES.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setSelected(f.key)}
                className="w-full text-left rounded-xl border bg-card p-4 flex items-center gap-3 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
              >
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex-shrink-0">
                  <f.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{f.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {f.description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleSettingsPage;
