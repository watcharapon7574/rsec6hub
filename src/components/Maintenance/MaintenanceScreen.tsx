// หน้าเต็มจอแจ้ง "ระบบกำลังปิดปรับปรุง" + นับถอยหลังถึงเวลาเปิด
// แสดงให้ทุกคน (ยกเว้นแอดมิน) เมื่อโหมดปิดปรับปรุงเปิดอยู่
import { useEffect, useState } from 'react';
import { ServerOff, Clock, ShieldCheck, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MaintenanceScreenProps {
  reopenAt: Date | null;
  message: string;
  isAuthenticated: boolean;
  onAdminLogin: () => void;
  onSignOut?: () => void;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const hms = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return days > 0 ? `${days} วัน ${hms}` : hms;
}

const formatReopenAt = (d: Date): string =>
  d.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function MaintenanceScreen({
  reopenAt,
  message,
  isAuthenticated,
  onAdminLogin,
  onSignOut,
}: MaintenanceScreenProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = reopenAt ? reopenAt.getTime() - now : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card shadow-xl p-7 text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
          <ServerOff className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">ระบบกำลังปิดปรับปรุง</h1>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{message}</p>
        </div>

        {reopenAt ? (
          <div className="rounded-xl bg-muted/60 px-4 py-4 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center justify-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              ระบบจะกลับมาเปิดใช้งานในอีก
            </p>
            <p className="text-3xl font-bold tabular-nums tracking-wider text-foreground">
              {formatRemaining(remaining ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              (เวลาที่คาดว่าจะเปิด: {formatReopenAt(reopenAt)} น.)
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-muted/60 px-4 py-3">
            <p className="text-sm text-muted-foreground">ยังไม่กำหนดเวลาเปิดใช้งาน</p>
          </div>
        )}

        <div className="pt-1">
          {isAuthenticated ? (
            onSignOut && (
              <Button variant="outline" size="sm" onClick={onSignOut} className="text-muted-foreground">
                <LogOut className="h-4 w-4 mr-1.5" />
                ออกจากระบบ
              </Button>
            )
          ) : (
            <button
              type="button"
              onClick={onAdminLogin}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              เข้าสู่ระบบสำหรับผู้ดูแลระบบ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
