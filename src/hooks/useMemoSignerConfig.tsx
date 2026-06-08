// โหลด config ผู้ลงนาม memo (app_settings) ครั้งเดียว — ใช้ในหน้าที่ธุรการเลือกผู้ลงนาม
// คืน null ระหว่างโหลด/ถ้าพลาด → ผู้เรียกจะ fallback เป็น logic เดิม (ของเก่าไม่พัง)
import { useEffect, useState } from 'react';
import {
  getMemoSignerConfig,
  type MemoSignerConfig,
} from '@/services/memoSignerService';

export function useMemoSignerConfig(): MemoSignerConfig | null {
  const [config, setConfig] = useState<MemoSignerConfig | null>(null);
  useEffect(() => {
    let alive = true;
    getMemoSignerConfig()
      .then((c) => {
        if (alive) setConfig(c);
      })
      .catch(() => {
        /* fallback เป็น logic เดิม */
      });
    return () => {
      alive = false;
    };
  }, []);
  return config;
}
