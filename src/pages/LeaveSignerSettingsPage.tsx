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
  FileSignature,
  X,
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
import {
  getMemoSignerConfig,
  setMemoSignerDeptHeads,
  setMemoSignerDeputies,
  setMemoSignerDirector,
  type MemoSignerConfig,
} from '@/services/memoSignerService';
import type { LeaveSignerRole } from '@/types/leave';

// ───────────────── registry ของฟีเจอร์ที่ตั้งค่าบทบาทได้ ─────────────────
type FeatureKey = 'leave' | 'memo';

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
  {
    key: 'memo',
    title: 'ผู้ลงนามหนังสือ/บันทึกข้อความ',
    description: 'กำหนดหัวหน้าฝ่าย (หลายคน) / รอง ผอ. (หลายคน) / ผอ. (คนเดียว)',
    icon: FileSignature,
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

// ───────────────── panel: ตั้งค่าผู้ลงนาม memo ─────────────────
// ตัวเลือกหลายคน: chips ที่เลือก + dropdown เพิ่มทีละคน
const MultiSignerPicker: React.FC<{
  label: string;
  hint: string;
  selected: string[];
  candidates: SignerCandidate[];
  busy: boolean;
  onChange: (ids: string[]) => void;
}> = ({ label, hint, selected, candidates, busy, onChange }) => {
  const byId = useMemo(() => {
    const m = new Map<string, SignerCandidate>();
    for (const c of candidates) m.set(c.user_id, c);
    return m;
  }, [candidates]);
  const available = candidates.filter((c) => !selected.includes(c.user_id));

  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mb-2.5">{hint}</p>

        {selected.length === 0 ? (
          <p className="text-xs text-muted-foreground italic mb-2">— ยังไม่ได้เลือก —</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {selected.map((uid) => (
              <span
                key={uid}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 pl-2.5 pr-1 py-1 text-xs"
              >
                {byId.get(uid)?.name ?? uid}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onChange(selected.filter((x) => x !== uid))}
                  className="rounded-full hover:bg-blue-200/60 dark:hover:bg-blue-800/60 p-0.5 disabled:opacity-50"
                  aria-label="เอาออก"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <Select
          value=""
          onValueChange={(v) => onChange([...selected, v])}
          disabled={busy || available.length === 0}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={available.length === 0 ? 'เลือกครบทุกคนแล้ว' : '+ เพิ่มรายชื่อ'}
            />
          </SelectTrigger>
          <SelectContent>
            {available.map((c) => (
              <SelectItem key={c.user_id} value={c.user_id}>
                {candidateLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
};

// ฝ่าย = org_structure_role ที่ขึ้นต้น/มีคำว่า "หัวหน้าฝ่าย" (ไม่มีตาราง departments แยก)
const HEAD_ROLE_RE = /หัวหน้าฝ่าย/;
const deptLabel = (role: string) => role.replace(/หัวหน้า/g, '').trim() || role;

const MemoSignerPanel: React.FC = () => {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<SignerCandidate[]>([]);
  const [config, setConfig] = useState<MemoSignerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [cands, cfg] = await Promise.all([
          getSignerCandidates(),
          getMemoSignerConfig(),
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

  // ฝ่ายในระบบ + หัวหน้าเริ่มต้น (คนแรกที่ org_structure_role ตรงฝ่าย)
  const departments = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of candidates) {
      const role = c.org_structure_role ?? '';
      if (HEAD_ROLE_RE.test(role) && !seen.has(role)) seen.set(role, c.user_id);
    }
    return Array.from(seen.entries())
      .map(([role, defaultUid]) => ({ role, defaultUid }))
      .sort((a, b) => a.role.localeCompare(b.role, 'th'));
  }, [candidates]);

  // effective = ค่าเริ่มต้นต่อฝ่าย แล้ว override ด้วย config (เฉพาะฝ่ายที่ยังมีจริง)
  const effectiveHeads = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of departments) m[d.role] = d.defaultUid;
    if (config) {
      for (const [role, uid] of Object.entries(config.dept_heads)) {
        if (role in m) m[role] = uid;
      }
    }
    return m;
  }, [departments, config]);

  const withSave = async (
    optimistic: (c: MemoSignerConfig) => MemoSignerConfig,
    persist: () => Promise<void>,
  ) => {
    const prev = config;
    setConfig((c) => (c ? optimistic(c) : c));
    setBusy(true);
    try {
      await persist();
    } catch (e) {
      setConfig(prev);
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  // รอง ผอ. / ผอ. เลือกเฉพาะคนที่ตำแหน่งตรง (org_structure_role เชื่อไม่ได้ — directors
  // บางคน org เขียน "รองผู้อำนวยการ", รองบางคน org ว่าง จึง filter ด้วย position)
  const deputyCandidates = useMemo(
    () => candidates.filter((c) => c.position === 'deputy_director'),
    [candidates],
  );
  const directorCandidates = useMemo(
    () => candidates.filter((c) => c.position === 'director'),
    [candidates],
  );

  const saveDeptHeads = (next: Record<string, string>) =>
    withSave((c) => ({ ...c, dept_heads: next }), () => setMemoSignerDeptHeads(next));
  const saveDeputies = (ids: string[]) =>
    withSave((c) => ({ ...c, deputies: ids }), () => setMemoSignerDeputies(ids));
  const saveDirector = (uid: string) =>
    withSave((c) => ({ ...c, director: uid }), () => setMemoSignerDirector(uid));

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm font-semibold text-foreground">หัวหน้าฝ่าย</p>
          <p className="text-xs text-muted-foreground mb-3">
            1 คนต่อฝ่าย ({departments.length} ฝ่าย) — ค่าเริ่มต้นคือคนที่ตำแหน่งตรงกับฝ่าย
            เปลี่ยนได้
          </p>
          {departments.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              ไม่พบฝ่ายในระบบ (อิงจาก org_structure_role ที่มีคำว่า "หัวหน้าฝ่าย")
            </p>
          ) : (
            <div className="space-y-3">
              {departments.map((d) => (
                <div key={d.role}>
                  <p className="text-xs font-medium text-foreground mb-1">
                    {deptLabel(d.role)}
                  </p>
                  <Select
                    value={effectiveHeads[d.role] ?? ''}
                    onValueChange={(v) =>
                      saveDeptHeads({ ...effectiveHeads, [d.role]: v })
                    }
                    disabled={busy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="— เลือก —" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((c) => (
                        <SelectItem key={c.user_id} value={c.user_id}>
                          {candidateLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <MultiSignerPicker
        label="รอง ผอ."
        hint="เลือกได้มากกว่า 1 คน (เฉพาะผู้มีตำแหน่งรอง ผอ.)"
        selected={config.deputies}
        candidates={deputyCandidates}
        busy={busy}
        onChange={saveDeputies}
      />

      <Card>
        <CardContent className="pt-5">
          <p className="text-sm font-semibold text-foreground">ผอ.</p>
          <p className="text-xs text-muted-foreground mb-2.5">
            เลือกได้คนเดียวเท่านั้น (เฉพาะผู้มีตำแหน่ง ผอ.)
          </p>
          <Select
            value={config.director ?? ''}
            onValueChange={saveDirector}
            disabled={busy}
          >
            <SelectTrigger>
              <SelectValue placeholder="— ยังไม่ได้เลือก —" />
            </SelectTrigger>
            <SelectContent>
              {directorCandidates.map((c) => (
                <SelectItem key={c.user_id} value={c.user_id}>
                  {candidateLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
};

const renderPanel = (key: FeatureKey): React.ReactNode => {
  switch (key) {
    case 'leave':
      return <LeaveSignerPanel />;
    case 'memo':
      return <MemoSignerPanel />;
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
