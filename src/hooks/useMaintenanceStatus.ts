// โหลดสถานะโหมดปิดปรับปรุง + poll ทุก 30 วิ + ตั้ง timer เปิดอัตโนมัติเมื่อถึงเวลา
// fail-open: ถ้าอ่านค่าไม่สำเร็จ ถือว่าไม่ปิด (กันล็อกทุกคนออกเพราะ network สะดุด)
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getMaintenanceConfig,
  isMaintenanceActive,
  type MaintenanceConfig,
} from '@/services/maintenanceService';

const POLL_MS = 30_000;

export interface MaintenanceStatus {
  loading: boolean;
  config: MaintenanceConfig | null;
  isActive: boolean;
}

export function useMaintenanceStatus(): MaintenanceStatus {
  const [config, setConfig] = useState<MaintenanceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const reopenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const evaluate = useCallback((cfg: MaintenanceConfig | null) => {
    if (reopenTimer.current) {
      clearTimeout(reopenTimer.current);
      reopenTimer.current = null;
    }
    const active = isMaintenanceActive(cfg);
    setIsActive(active);
    // นัด flip เป็น "เปิด" ตอน countdown ถึงศูนย์ (ไม่ต้อง re-render ทั้งแอปทุกวินาที)
    // ตั้ง timer เฉพาะเมื่อ delay อยู่ในช่วงที่ setTimeout รับได้ (< 2^31-1 ms ≈ 24.8 วัน)
    // ไกลกว่านั้นจะ overflow แล้ว fire ทันที → ปล่อยให้ poll 30 วิ จัดการเมื่อใกล้เวลาแทน
    if (active && cfg?.reopenAt) {
      const ms = cfg.reopenAt.getTime() - Date.now();
      if (ms > 0 && ms < 2_147_483_647) {
        reopenTimer.current = setTimeout(() => setIsActive(false), ms + 500);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const cfg = await getMaintenanceConfig();
      setConfig(cfg);
      evaluate(cfg);
    } catch {
      // อ่านค่าไม่ได้ → fail-open (อย่าล็อกคนออกเพราะ fetch fail)
    } finally {
      setLoading(false);
    }
  }, [evaluate]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => {
      clearInterval(id);
      if (reopenTimer.current) clearTimeout(reopenTimer.current);
    };
  }, [refresh]);

  return { loading, config, isActive };
}
