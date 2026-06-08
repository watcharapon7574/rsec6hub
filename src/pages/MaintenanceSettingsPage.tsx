// หน้า "ปิดปรับปรุงระบบ" (/admin/maintenance) — เฉพาะแอดมิน
// เปิด/ปิดโหมดปิดระบบ (บล็อก login + ล็อกผู้ใช้ทุกคนยกเว้นแอดมิน), กำหนดเวลาเปิดอัตโนมัติ,
// ตั้งข้อความแจ้งผู้ใช้ และดูตัวอย่างนับถอยหลังก่อนบันทึก
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ShieldCheck,
  Loader2,
  Save,
  AlertTriangle,
  ServerOff,
  Clock,
  Users,
  X,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getSignerCandidates, type SignerCandidate } from '@/services/leaveService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { isAdmin } from '@/types/database';
import {
  getMaintenanceConfig,
  setMaintenanceConfig,
  DEFAULT_MAINTENANCE_MESSAGE,
  type MaintenanceConfig,
} from '@/services/maintenanceService';

// Date <-> ค่า input datetime-local (อิงเวลาท้องถิ่น)
const toLocalInput = (d: Date | null): string => {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (s: string): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatRemaining = (ms: number): string => {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const hms = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return days > 0 ? `${days} วัน ${hms}` : hms;
};

const PRESETS: Array<{ label: string; mins: number }> = [
  { label: '+30 นาที', mins: 30 },
  { label: '+1 ชม.', mins: 60 },
  { label: '+2 ชม.', mins: 120 },
  { label: '+1 วัน', mins: 1440 },
];

const MaintenancePanel: React.FC = () => {
  const { toast } = useToast();
  const [saved, setSaved] = useState<MaintenanceConfig | null>(null);
  const [draft, setDraft] = useState<MaintenanceConfig | null>(null);
  const [candidates, setCandidates] = useState<SignerCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [cfg, cands] = await Promise.all([
          getMaintenanceConfig(),
          getSignerCandidates(),
        ]);
        setSaved(cfg);
        setDraft(cfg);
        setCandidates(cands);
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

  const dirty = useMemo(() => {
    if (!saved || !draft) return false;
    return (
      saved.enabled !== draft.enabled ||
      saved.message !== draft.message ||
      (saved.reopenAt?.getTime() ?? null) !== (draft.reopenAt?.getTime() ?? null) ||
      JSON.stringify(saved.testUserIds) !== JSON.stringify(draft.testUserIds)
    );
  }, [saved, draft]);

  const candidateById = useMemo(() => {
    const m = new Map<string, SignerCandidate>();
    for (const c of candidates) m.set(c.user_id, c);
    return m;
  }, [candidates]);

  const setPreset = (mins: number) =>
    setDraft((d) => (d ? { ...d, reopenAt: new Date(Date.now() + mins * 60_000) } : d));

  const handleSave = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const toSave: MaintenanceConfig = {
        ...draft,
        message: draft.message.trim() || DEFAULT_MAINTENANCE_MESSAGE,
      };
      await setMaintenanceConfig(toSave);
      setSaved(toSave);
      setDraft(toSave);
      toast({
        title: toSave.enabled ? 'เปิดโหมดปิดปรับปรุงแล้ว' : 'ปิดโหมดปิดปรับปรุงแล้ว',
      });
    } catch (e) {
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !draft) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const reopenPassed = draft.reopenAt ? now >= draft.reopenAt.getTime() : false;
  const previewActive = draft.enabled && !reopenPassed;

  return (
    <div className="space-y-4">
      {/* สวิตช์เปิด/ปิดโหมด */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ServerOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                เปิดโหมดปิดปรับปรุงระบบ
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                เมื่อเปิด: บล็อกการเข้าสู่ระบบ และผู้ใช้ทุกคน (ยกเว้นแอดมิน) จะเห็นหน้าปิดปรับปรุง
              </p>
            </div>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) => setDraft((d) => (d ? { ...d, enabled: v } : d))}
              disabled={busy}
            />
          </div>
        </CardContent>
      </Card>

      {/* เวลาเปิดอัตโนมัติ */}
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            เวลาที่จะกลับมาเปิดอัตโนมัติ
          </p>
          <p className="text-xs text-muted-foreground mt-1 mb-2.5">
            พอถึงเวลานี้ ระบบจะเปิดให้ใช้งานเองทันที (เว้นว่าง = ปิดไม่มีกำหนด จนกว่าจะปิดสวิตช์เอง)
          </p>
          <Input
            type="datetime-local"
            value={toLocalInput(draft.reopenAt)}
            onChange={(e) =>
              setDraft((d) => (d ? { ...d, reopenAt: fromLocalInput(e.target.value) } : d))
            }
            disabled={busy}
            className="mb-2"
          />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Button
                key={p.mins}
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setPreset(p.mins)}
              >
                {p.label}
              </Button>
            ))}
            {draft.reopenAt && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setDraft((d) => (d ? { ...d, reopenAt: null } : d))}
                className="text-muted-foreground"
              >
                ล้างเวลา
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ข้อความแจ้งผู้ใช้ */}
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm font-semibold text-foreground">ข้อความแจ้งผู้ใช้</p>
          <p className="text-xs text-muted-foreground mt-1 mb-2.5">
            ข้อความที่จะแสดงบนหน้าปิดปรับปรุง (เว้นว่าง = ใช้ข้อความค่าเริ่มต้น)
          </p>
          <Textarea
            value={draft.message}
            onChange={(e) => setDraft((d) => (d ? { ...d, message: e.target.value } : d))}
            placeholder={DEFAULT_MAINTENANCE_MESSAGE}
            disabled={busy}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* ผู้ทดสอบ — ยกเว้นให้เข้าใช้งานได้ระหว่างปิดปรับปรุง */}
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            ผู้ทดสอบ (เข้าใช้งานได้ระหว่างปิดปรับปรุง)
          </p>
          <p className="text-xs text-muted-foreground mt-1 mb-2.5">
            เลือกได้หลายคน — คนเหล่านี้จะ login และใช้งานระบบได้ตามปกติแม้เปิดโหมดปิดปรับปรุง
            (แอดมินยกเว้นให้อยู่แล้วโดยอัตโนมัติ ไม่ต้องเพิ่ม)
          </p>

          {draft.testUserIds.length === 0 ? (
            <p className="text-xs text-muted-foreground italic mb-2">— ยังไม่ได้เลือก —</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {draft.testUserIds.map((uid) => (
                <span
                  key={uid}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 pl-2.5 pr-1 py-1 text-xs"
                >
                  {candidateById.get(uid)?.name ?? uid}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setDraft((d) =>
                        d ? { ...d, testUserIds: d.testUserIds.filter((x) => x !== uid) } : d,
                      )
                    }
                    className="rounded-full hover:bg-blue-200/60 dark:hover:bg-blue-800/60 p-0.5 disabled:opacity-50"
                    aria-label="เอาออก"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={pickerOpen}
                disabled={busy}
                className="w-full justify-between font-normal text-muted-foreground"
              >
                + เพิ่มผู้ทดสอบ (พิมพ์ค้นหาชื่อได้)
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[--radix-popover-trigger-width] p-0 bg-card"
              align="start"
            >
              <Command>
                <CommandInput placeholder="พิมพ์ชื่อเพื่อค้นหา..." />
                <CommandList>
                  <CommandEmpty>ไม่พบรายชื่อ</CommandEmpty>
                  <CommandGroup>
                    {candidates
                      .filter((c) => !draft.testUserIds.includes(c.user_id))
                      .map((c) => {
                        const label = c.org_structure_role
                          ? `${c.name} · ${c.org_structure_role}`
                          : c.name;
                        return (
                          <CommandItem
                            key={c.user_id}
                            value={label}
                            onSelect={() => {
                              setDraft((d) =>
                                d && !d.testUserIds.includes(c.user_id)
                                  ? { ...d, testUserIds: [...d.testUserIds, c.user_id] }
                                  : d,
                              );
                              setPickerOpen(false);
                            }}
                          >
                            <Check className="mr-2 h-4 w-4 opacity-0" />
                            {label}
                          </CommandItem>
                        );
                      })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* ตัวอย่างหน้าที่ผู้ใช้จะเห็น */}
      <Card className="border-dashed">
        <CardContent className="pt-5">
          <p className="text-xs font-medium text-muted-foreground mb-3">ตัวอย่างที่ผู้ใช้จะเห็น</p>
          <div className="rounded-xl border bg-muted/40 p-5 text-center space-y-2.5">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <ServerOff className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="font-bold text-foreground">ระบบกำลังปิดปรับปรุง</p>
            <p className="text-xs text-muted-foreground whitespace-pre-line">
              {draft.message.trim() || DEFAULT_MAINTENANCE_MESSAGE}
            </p>
            {draft.reopenAt ? (
              <p className="text-2xl font-bold tabular-nums tracking-wider text-foreground pt-1">
                {formatRemaining(draft.reopenAt.getTime() - now)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground pt-1">ยังไม่กำหนดเวลาเปิดใช้งาน</p>
            )}
            {!previewActive && draft.enabled && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                ⓘ ถึงเวลาเปิดแล้ว — ระบบจะเปิดให้ใช้งานอัตโนมัติ
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* แถบบันทึก + ยืนยัน */}
      <div className="sticky bottom-0 -mx-4 px-4 py-3 mt-2 bg-background/95 backdrop-blur border-t">
        <div className="flex items-center gap-2">
          <div className="flex-1 text-xs">
            {dirty ? (
              <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> มีการเปลี่ยนแปลงที่ยังไม่บันทึก
              </span>
            ) : (
              <span className="text-muted-foreground">
                {saved?.enabled ? 'สถานะ: ปิดปรับปรุงอยู่' : 'สถานะ: เปิดให้ใช้งานปกติ'}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" disabled={!dirty || busy} onClick={() => setDraft(saved)}>
            ยกเลิก
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={!dirty || busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                บันทึก
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  {draft.enabled ? 'ยืนยันเปิดโหมดปิดปรับปรุง?' : 'ยืนยันปิดโหมดปิดปรับปรุง?'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {draft.enabled
                    ? 'ผู้ใช้ทุกคน (ยกเว้นแอดมิน) จะถูกบล็อกการเข้าสู่ระบบและเห็นหน้าปิดปรับปรุงทันทีหลังบันทึก'
                    : 'ระบบจะกลับมาเปิดให้ใช้งานตามปกติทันทีหลังบันทึก'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction onClick={handleSave}>ยืนยัน</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

const MaintenanceSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useEmployeeAuth();
  const admin = profile ? isAdmin(profile) : false;

  if (!admin) {
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
          <ChevronLeft className="h-4 w-4 mr-1" />
          ย้อนกลับ
        </Button>

        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ServerOff className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              ปิดปรับปรุงระบบ
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              ปิดการเข้าสู่ระบบชั่วคราว แจ้งผู้ใช้ว่ากำลังปรับปรุง และกำหนดเวลานับถอยหลังที่จะเปิดอีกครั้ง
            </p>
          </CardHeader>
        </Card>

        <MaintenancePanel />
      </div>
    </div>
  );
};

export default MaintenanceSettingsPage;
