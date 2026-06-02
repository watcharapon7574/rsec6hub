// ตั้งค่าผู้ลงนามหนังสือ/บันทึกข้อความ (memo) — admin กำหนดไว้ใน app_settings
// หัวหน้าฝ่าย/รอง ผอ. เลือกได้หลายคน (เก็บเป็น JSON array), ผอ. คนเดียว (เก็บเป็น user_id)
// NOTE: ตอนนี้เป็น "config เก็บไว้" เท่านั้น — ยังไม่ได้ wire เข้า flow ที่ธุรการเลือกผู้ลงนาม
import { supabase } from '@/integrations/supabase/client';

const sb = supabase;

const KEY = {
  dept_heads: 'memo_signer_dept_heads',
  deputies: 'memo_signer_deputies',
  director: 'memo_signer_director',
} as const;

export type MemoSignerListRole = 'dept_heads' | 'deputies';

export interface MemoSignerConfig {
  dept_heads: string[]; // หัวหน้าฝ่าย (ตามจำนวนฝ่าย)
  deputies: string[]; // รอง ผอ. (หลายคนได้)
  director: string | null; // ผอ. (คนเดียว)
}

function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function getMemoSignerConfig(): Promise<MemoSignerConfig> {
  const { data, error } = await sb
    .from('app_settings')
    .select('key, value')
    .in('key', [KEY.dept_heads, KEY.deputies, KEY.director]);
  if (error) throw new Error(error.message ?? 'getMemoSignerConfig failed');
  const map = new Map<string, string>();
  for (const row of (data as Array<{ key: string; value: string | null }> | null) ?? []) {
    if (row.value != null) map.set(row.key, row.value);
  }
  return {
    dept_heads: parseList(map.get(KEY.dept_heads)),
    deputies: parseList(map.get(KEY.deputies)),
    director: map.get(KEY.director) || null,
  };
}

async function upsertSetting(key: string, value: string): Promise<void> {
  const { error } = await sb
    .from('app_settings')
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) throw new Error(error.message ?? 'setMemoSigner failed');
}

export async function setMemoSignerList(
  role: MemoSignerListRole,
  userIds: string[],
): Promise<void> {
  await upsertSetting(KEY[role], JSON.stringify(userIds));
}

export async function setMemoSignerDirector(userId: string): Promise<void> {
  await upsertSetting(KEY.director, userId);
}
