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

export interface MemoSignerConfig {
  // หัวหน้าฝ่าย: map ฝ่าย (อิง org_structure_role ของหัวหน้า) → user_id ที่ override ไว้
  // ฝ่ายที่ไม่มีใน map ให้ใช้ค่าเริ่มต้น = คนที่ org_structure_role ตรงกับฝ่าย (คำนวณฝั่ง UI)
  dept_heads: Record<string, string>;
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

function parseMap(value: string | null | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const obj = JSON.parse(value);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
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
    dept_heads: parseMap(map.get(KEY.dept_heads)),
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

// หัวหน้าฝ่าย: เก็บเป็น map ฝ่าย→user_id ที่ผู้ดูแลกำหนด (effective ทั้งหมด)
export async function setMemoSignerDeptHeads(
  byDept: Record<string, string>,
): Promise<void> {
  await upsertSetting(KEY.dept_heads, JSON.stringify(byDept));
}

export async function setMemoSignerDeputies(userIds: string[]): Promise<void> {
  await upsertSetting(KEY.deputies, JSON.stringify(userIds));
}

export async function setMemoSignerDirector(userId: string): Promise<void> {
  await upsertSetting(KEY.director, userId);
}
