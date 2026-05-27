// @ts-nocheck — Deno edge function
// ส่งประกาศใบลาเข้ากลุ่ม Telegram (@newleave_noti_bot)
//
// Modes:
//   POST { type: 'daily_rollcall', date?: 'YYYY-MM-DD' }
//     → รายชื่อผู้ลาในวันนั้น (approved + sick pending) — ส่งทุกวัน แม้วันที่ไม่มีคนลา
//   POST { type: 'sick_immediate', request_id: 'uuid' }
//     → ลาป่วยที่เพิ่งยื่นวันนี้ → ประกาศทันที (ไม่ต้องรออนุมัติ)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Config (hardcoded ตาม pattern telegram-notify) ──────────────────────
const BOT_TOKEN = '7742304832:AAFZgUUeN_5ZTA-rJNOAmJ6VZGpyKUTA2Zg';
const GROUP_CHAT_ID = '-1003977441825'; // กลุ่ม "วันนี้ใครลา?"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// ─── Thai date helpers ───────────────────────────────────────────────────
const THAI_WEEKDAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function parseISODate(s: string): Date {
  // 'YYYY-MM-DD' → midnight local time (timezone-safe คำนวณวัน)
  return new Date(`${s}T00:00:00`);
}

function todayISOBangkok(): string {
  // ใช้ Asia/Bangkok เพื่อให้ "วันนี้" ตรงกับเวลาท้องถิ่นไทย ไม่ใช่ UTC
  const tz = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  // en-CA → 'YYYY-MM-DD'
  return tz;
}

function formatThaiDate(d: Date, withWeekday = false): string {
  const day = d.getDate();
  const month = THAI_MONTHS_SHORT[d.getMonth()];
  const year = ((d.getFullYear() + 543) % 100).toString().padStart(2, '0');
  const base = `${day} ${month} ${year}`;
  return withWeekday ? `${THAI_WEEKDAYS_SHORT[d.getDay()]} ${base}` : base;
}

function formatDateRange(startISO: string, endISO: string): string {
  if (startISO === endISO) return formatThaiDate(parseISODate(startISO));
  const s = parseISODate(startISO);
  const e = parseISODate(endISO);
  // ถ้าเดือนปีเท่ากัน ย่อ "20–22 พ.ค. 69"
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    const year = ((s.getFullYear() + 543) % 100).toString().padStart(2, '0');
    return `${s.getDate()}–${e.getDate()} ${THAI_MONTHS_SHORT[s.getMonth()]} ${year}`;
  }
  return `${formatThaiDate(s)} – ${formatThaiDate(e)}`;
}

function dayNumberOf(startISO: string, todayISO: string): number {
  // วันที่ปัจจุบันเป็นวันที่กี่ของช่วงลา (1-indexed)
  const s = parseISODate(startISO);
  const t = parseISODate(todayISO);
  const diff = Math.round((t.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

// ─── Leave-type display ───────────────────────────────────────────────────
const LEAVE_TYPE_DISPLAY: Record<string, { emoji: string; label: string }> = {
  sick_leave:           { emoji: '🤒', label: 'ลาป่วย' },
  personal_leave:       { emoji: '📋', label: 'ลากิจส่วนตัว' },
  annual_leave:         { emoji: '🌴', label: 'ลาพักผ่อน' },
  maternity_leave:      { emoji: '👶', label: 'ลาคลอด' },
  paternity_leave:      { emoji: '👨‍👶', label: 'ลาช่วยภรรยาคลอด' },
  ordination_leave:     { emoji: '🧘', label: 'ลาบวช' },
  military_leave:       { emoji: '🪖', label: 'ลาทหาร' },
  study_leave:          { emoji: '🎓', label: 'ลาศึกษาต่อ' },
  spouse_follow_leave:  { emoji: '🧳', label: 'ลาติดตามคู่สมรส' },
  rehabilitation_leave: { emoji: '🏥', label: 'ลาฟื้นฟูสมรรถภาพ' },
};

function leaveDisplay(type: string): { emoji: string; label: string } {
  return LEAVE_TYPE_DISPLAY[type] ?? { emoji: '📄', label: type };
}

// ─── Telegram HTML safety ────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Telegram send ────────────────────────────────────────────────────────
async function sendTelegram(text: string): Promise<unknown> {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: GROUP_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Telegram API ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      throw new Error('Telegram API timeout after 10s');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Message formatters (Style A) ────────────────────────────────────────
type LeaveRow = {
  id: string;
  doc_number: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  status: string;
  user_name: string | null;
  user_position: string | null;
  reason: string;
};

function formatDailyRollcall(rows: LeaveRow[], todayISO: string): string {
  const today = parseISODate(todayISO);
  const dateLine = formatThaiDate(today, true);
  if (rows.length === 0) {
    return `🗓 <b>ผู้ลาวันนี้</b> · ${dateLine}\n\nวันนี้ไม่มีผู้ลา`;
  }
  const header = `🗓 <b>ผู้ลาวันนี้</b> · ${dateLine} · ${rows.length} คน`;
  const body = rows
    .map((r, i) => {
      const d = leaveDisplay(r.leave_type);
      const dayN = dayNumberOf(r.start_date, todayISO);
      const name = escapeHtml(r.user_name ?? '-');
      const pos = escapeHtml(r.user_position ?? '-');
      return `${i + 1}. <b>${name}</b> — ${pos}\n   ${d.emoji} ${d.label} · วันที่ ${dayN}/${r.days_count}`;
    })
    .join('\n\n');
  return `${header}\n\n${body}`;
}

function formatSickImmediate(r: LeaveRow): string {
  const d = leaveDisplay(r.leave_type);
  const name = escapeHtml(r.user_name ?? '-');
  const pos = escapeHtml(r.user_position ?? '-');
  const dateRange = formatDateRange(r.start_date, r.end_date);
  const reason = r.reason ? `\n📝 ${escapeHtml(r.reason)}` : '';
  return `${d.emoji} <b>ลาป่วยวันนี้</b>\n\n<b>${name}</b> (${pos})\n🗓 ${dateRange} (${r.days_count} วัน)${reason}`;
}

// ─── DB queries ──────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

async function fetchTodayLeaves(todayISO: string): Promise<LeaveRow[]> {
  const sb = getSupabase();
  // ครอบคลุม: approved ทุกประเภท + sick ที่ pending/in_progress (ยังไม่อนุมัติแต่ลาวันนี้)
  const { data, error } = await sb
    .from('leave_requests')
    .select(
      'id, doc_number, leave_type, start_date, end_date, days_count, status, user_name, user_position, reason',
    )
    .lte('start_date', todayISO)
    .gte('end_date', todayISO)
    .or(
      'status.eq.approved,and(leave_type.eq.sick_leave,status.in.(pending,in_progress))',
    )
    .order('user_name', { ascending: true });
  if (error) throw new Error(`fetchTodayLeaves: ${error.message}`);
  return (data as LeaveRow[]) ?? [];
}

async function fetchOneLeave(id: string): Promise<LeaveRow | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('leave_requests')
    .select(
      'id, doc_number, leave_type, start_date, end_date, days_count, status, user_name, user_position, reason',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`fetchOneLeave: ${error.message}`);
  return (data as LeaveRow | null) ?? null;
}

// ─── Handler ─────────────────────────────────────────────────────────────
type Payload =
  | { type: 'daily_rollcall'; date?: string }
  | { type: 'sick_immediate'; request_id: string };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as Payload;
    if (!payload?.type) {
      throw new Error('payload.type required');
    }

    let messageText: string;
    let summary: Record<string, unknown> = { type: payload.type };

    if (payload.type === 'daily_rollcall') {
      const todayISO = payload.date ?? todayISOBangkok();
      const rows = await fetchTodayLeaves(todayISO);
      messageText = formatDailyRollcall(rows, todayISO);
      summary = { ...summary, date: todayISO, count: rows.length };
    } else if (payload.type === 'sick_immediate') {
      if (!payload.request_id) throw new Error('request_id required');
      const row = await fetchOneLeave(payload.request_id);
      if (!row) throw new Error('leave request not found');
      if (row.leave_type !== 'sick_leave') {
        throw new Error('ใช้ได้กับ sick_leave เท่านั้น');
      }
      messageText = formatSickImmediate(row);
      summary = {
        ...summary,
        request_id: payload.request_id,
        user: row.user_name,
      };
    } else {
      throw new Error(`unknown type: ${(payload as { type: string }).type}`);
    }

    const tgRes = await sendTelegram(messageText);
    console.log('✅ leave-telegram-notify sent:', summary);
    return new Response(
      JSON.stringify({ ok: true, summary, telegram: tgRes }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('❌ leave-telegram-notify error:', message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
