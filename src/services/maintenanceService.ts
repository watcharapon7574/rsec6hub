// โหมดปิดปรับปรุงระบบ (maintenance mode) — เก็บใน app_settings (key/value)
// อ่านได้ทั้ง anon (หน้า login) และ authenticated; เขียนผ่าน UI ที่ gate ด้วย is_admin
import { supabase } from '@/integrations/supabase/client';

export const MAINTENANCE_KEYS = {
  enabled: 'maintenance_enabled',
  reopenAt: 'maintenance_reopen_at',
  message: 'maintenance_message',
} as const;

export const DEFAULT_MAINTENANCE_MESSAGE =
  'ระบบกำลังปิดปรับปรุงชั่วคราว ขออภัยในความไม่สะดวก';

export interface MaintenanceConfig {
  enabled: boolean;
  reopenAt: Date | null; // เวลาที่ระบบจะกลับมาเปิดอัตโนมัติ (null = ไม่มีกำหนด)
  message: string;
}

export async function getMaintenanceConfig(): Promise<MaintenanceConfig> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', Object.values(MAINTENANCE_KEYS));
  if (error) throw new Error(error.message ?? 'getMaintenanceConfig failed');

  const map = new Map<string, string>();
  for (const row of (data as Array<{ key: string; value: string | null }> | null) ?? []) {
    map.set(row.key, row.value ?? '');
  }

  const reopenRaw = map.get(MAINTENANCE_KEYS.reopenAt) ?? '';
  const reopenAt = reopenRaw ? new Date(reopenRaw) : null;

  return {
    enabled: (map.get(MAINTENANCE_KEYS.enabled) ?? 'false') === 'true',
    reopenAt: reopenAt && !Number.isNaN(reopenAt.getTime()) ? reopenAt : null,
    message: map.get(MAINTENANCE_KEYS.message) || DEFAULT_MAINTENANCE_MESSAGE,
  };
}

export async function setMaintenanceConfig(cfg: MaintenanceConfig): Promise<void> {
  const rows = [
    { key: MAINTENANCE_KEYS.enabled, value: cfg.enabled ? 'true' : 'false' },
    { key: MAINTENANCE_KEYS.reopenAt, value: cfg.reopenAt ? cfg.reopenAt.toISOString() : '' },
    { key: MAINTENANCE_KEYS.message, value: cfg.message ?? '' },
  ];
  const { error } = await supabase
    .from('app_settings')
    .upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(error.message ?? 'setMaintenanceConfig failed');
}

// active จริง = เปิดโหมด และ (ยังไม่กำหนดเวลาเปิด หรือ ยังไม่ถึงเวลาเปิด)
export function isMaintenanceActive(
  cfg: MaintenanceConfig | null,
  now: number = Date.now(),
): boolean {
  if (!cfg || !cfg.enabled) return false;
  if (cfg.reopenAt && now >= cfg.reopenAt.getTime()) return false;
  return true;
}
