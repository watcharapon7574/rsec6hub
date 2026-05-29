// @ts-nocheck — Deno edge function (Supabase Edge Runtime)
// ส่ง DM เข้า Telegram ส่วนตัวของ "ผู้ลงนามหลัก" เมื่อใบลาขยับมาถึงคิว
// พร้อมปุ่ม web_app เปิด Mini App (/tg/leave/:id) ให้เซ็นได้ในแอป
// และแจ้งเจ้าของใบลาผ่าน 🔔 ในแอปเมื่อผลออก (approved/rejected)
//
// เรียกจาก DB trigger บน leave_requests (pg_net) — auth ด้วย X-Cron-Auth
// POST { leave_id: uuid, event: 'advanced' | 'approved' | 'rejected' }

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('LEAVE_SIGN_BOT_TOKEN') ?? '';
const MINIAPP_URL = Deno.env.get('LEAVE_MINIAPP_URL') ?? 'https://rsec6hub.vercel.app';
if (!BOT_TOKEN) console.error('Missing LEAVE_SIGN_BOT_TOKEN secret');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── order → role + label ───
const ORDER_ROLE: Record<number, { role: string; settingKey: string; label: string }> = {
  1: { role: 'hr_head', settingKey: 'leave_signer_hr_head', label: 'หน.บุคคล' },
  2: { role: 'deputy_director', settingKey: 'leave_signer_deputy_director', label: 'รอง ผอ.' },
  3: { role: 'director', settingKey: 'leave_signer_director', label: 'ผอ.' },
};

// ─── Thai date / leave-type helpers (style เดียวกับ leave-telegram-notify) ───
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function parseISODate(s: string): Date { return new Date(`${s}T00:00:00`); }
function formatThaiDate(d: Date): string {
  const year = ((d.getFullYear() + 543) % 100).toString().padStart(2, '0');
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${year}`;
}
function formatDateRange(startISO: string, endISO: string): string {
  if (startISO === endISO) return formatThaiDate(parseISODate(startISO));
  const s = parseISODate(startISO), e = parseISODate(endISO);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    const year = ((s.getFullYear() + 543) % 100).toString().padStart(2, '0');
    return `${s.getDate()}–${e.getDate()} ${THAI_MONTHS_SHORT[s.getMonth()]} ${year}`;
  }
  return `${formatThaiDate(s)} – ${formatThaiDate(e)}`;
}
const LEAVE_TYPE_DISPLAY: Record<string, { emoji: string; label: string }> = {
  sick_leave: { emoji: '🤒', label: 'ลาป่วย' },
  personal_leave: { emoji: '📋', label: 'ลากิจส่วนตัว' },
  annual_leave: { emoji: '🌴', label: 'ลาพักผ่อน' },
  maternity_leave: { emoji: '👶', label: 'ลาคลอด' },
  paternity_leave: { emoji: '👨‍👶', label: 'ลาช่วยภรรยาคลอด' },
  ordination_leave: { emoji: '🧘', label: 'ลาบวช' },
  military_leave: { emoji: '🪖', label: 'ลาทหาร' },
  study_leave: { emoji: '🎓', label: 'ลาศึกษาต่อ' },
  spouse_follow_leave: { emoji: '🧳', label: 'ลาติดตามคู่สมรส' },
  rehabilitation_leave: { emoji: '🏥', label: 'ลาฟื้นฟูสมรรถภาพ' },
};
function leaveDisplay(t: string) { return LEAVE_TYPE_DISPLAY[t] ?? { emoji: '📄', label: t }; }
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Telegram send (retry เฉพาะ error ที่ retry ได้ + 8s timeout) ───
// retry เฉพาะ 429 (rate-limit) / 5xx / network — ไม่ retry 4xx อื่น เช่น
// "chat not found" (ผู้ลงนามยังไม่ /start บอท) หรือ "bot was blocked" เพราะ
// retry ก็ไม่หาย แถมกิน wall time จน pg_net (timeout ฝั่ง trigger) หลุด
class TelegramError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}
async function sendTelegramOnce(chatId: string, text: string, replyMarkup?: unknown): Promise<unknown> {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true,
    };
    if (replyMarkup) body.reply_markup = replyMarkup;
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: controller.signal,
    });
    if (!res.ok) {
      // 429 หรือ 5xx → retry ได้; 4xx อื่น → ถาวร ไม่ retry
      const retryable = res.status === 429 || res.status >= 500;
      throw new TelegramError(`Telegram API ${res.status}: ${await res.text()}`, retryable);
    }
    return await res.json();
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw new TelegramError('Telegram API timeout after 8s', true);
    if (err instanceof TelegramError) throw err;
    throw new TelegramError(`Telegram fetch failed: ${(err as Error)?.message ?? err}`, true); // network → retry
  } finally {
    clearTimeout(timeoutId);
  }
}
async function sendTelegram(chatId: string, text: string, replyMarkup?: unknown): Promise<unknown> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await sendTelegramOnce(chatId, text, replyMarkup);
    } catch (err) {
      lastErr = err;
      if (err instanceof TelegramError && !err.retryable) throw err; // fail fast
      if (attempt < 3) {
        console.warn(`Telegram send failed (${attempt}/3): ${(err as Error)?.message ?? err}`);
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  }
  throw lastErr;
}

// แก้ข้อความ DM เดิม (ลบปุ่ม web_app + เปลี่ยนข้อความเป็น "ลงนามแล้ว")
// best-effort: ถ้า fail (ข้อความถูกลบ/หา message ไม่เจอ) แค่ log ไม่ throw
async function editTelegramText(chatId: string, messageId: number, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // ไม่ส่ง reply_markup → ปุ่ม inline ถูกลบออก
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: controller.signal,
    });
    if (!res.ok) console.warn(`editMessageText ${res.status}: ${await res.text()}`);
  } catch (err) {
    console.warn(`editMessageText failed: ${(err as Error)?.message ?? err}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ลบปุ่มของ DM ขั้นที่เพิ่งทำรายการ (เซ็น/ปฏิเสธ) — อ่าน message_id ที่เก็บไว้
async function clearSignerButton(
  sb: ReturnType<typeof getSupabase>,
  leave: any,
  prevOrder: number,
  kind: 'signed' | 'rejected',
): Promise<void> {
  const { data: msg } = await sb
    .from('leave_sign_messages')
    .select('chat_id, message_id')
    .eq('leave_id', leave.id)
    .eq('signer_order', prevOrder)
    .maybeSingle();
  if (!msg) return;
  const d = leaveDisplay(leave.leave_type);
  const range = formatDateRange(leave.start_date, leave.end_date);
  const who = escapeHtml(leave.user_name ?? '-');
  const head = kind === 'rejected'
    ? '❌ <b>ท่านปฏิเสธใบลานี้แล้ว</b>'
    : '✅ <b>ท่านลงนามใบลานี้แล้ว</b>';
  await editTelegramText(
    String(msg.chat_id),
    Number(msg.message_id),
    `${head}\n\n<b>${who}</b>\n${d.emoji} ${d.label} · ${range} (${leave.days_count} วัน)`,
  );
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

// auth: cron shared-secret เท่านั้น (เรียกจาก DB trigger / cron)
function authorize(req: Request): void {
  const cronToken = req.headers.get('X-Cron-Auth');
  const expected = Deno.env.get('CRON_AUTH_TOKEN');
  if (cronToken && expected && cronToken === expected) return;
  throw new Error('Unauthorized — bad cron token');
}

type Payload = {
  leave_id: string;
  event: 'advanced' | 'approved' | 'rejected';
  prev_order?: number | null; // ขั้นที่เพิ่งเซ็น/ปฏิเสธ → ไปลบปุ่มของ DM ขั้นนั้น
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    authorize(req);
    const payload = (await req.json()) as Payload;
    if (!payload?.leave_id || !payload?.event) throw new Error('leave_id + event required');

    const sb = getSupabase();
    const { data: leave, error: leaveErr } = await sb
      .from('leave_requests')
      .select('id, user_id, user_name, leave_type, start_date, end_date, days_count, status, current_signer_order, rejection_reason')
      .eq('id', payload.leave_id)
      .maybeSingle();
    if (leaveErr) throw new Error(`leave lookup: ${leaveErr.message}`);
    if (!leave) throw new Error('leave request not found');

    const d = leaveDisplay(leave.leave_type);
    const range = formatDateRange(leave.start_date, leave.end_date);
    const who = escapeHtml(leave.user_name ?? '-');

    // ─── advanced: DM ผู้ลงนามหลักของขั้นปัจจุบัน ───
    if (payload.event === 'advanced') {
      // ขั้นก่อนหน้าเพิ่งเซ็น → ลบปุ่มของ DM ขั้นนั้น
      if (payload.prev_order) {
        await clearSignerButton(sb, leave, payload.prev_order, 'signed');
      }

      if (leave.status !== 'pending' && leave.status !== 'in_progress') {
        return ok({ skipped: 'not open', status: leave.status });
      }
      const stage = ORDER_ROLE[leave.current_signer_order];
      if (!stage) return ok({ skipped: 'no stage', order: leave.current_signer_order });

      const { data: setting } = await sb
        .from('app_settings').select('value').eq('key', stage.settingKey).maybeSingle();
      const signerUserId = setting?.value;
      if (!signerUserId) return ok({ skipped: 'no designated signer', key: stage.settingKey });

      const { data: signer } = await sb
        .from('profiles').select('telegram_chat_id, first_name').eq('user_id', signerUserId).maybeSingle();
      if (!signer?.telegram_chat_id) return ok({ skipped: 'signer has no telegram', signerUserId });

      const text =
        `🖊 <b>มีใบลารอท่านลงนาม</b> (${stage.label})\n\n` +
        `<b>${who}</b>\n${d.emoji} ${d.label} · ${range} (${leave.days_count} วัน)\n\n` +
        `กดปุ่มด้านล่างเพื่อเปิดและลงนามได้เลย`;
      const replyMarkup = {
        inline_keyboard: [[
          { text: '📝 เปิดใบลา / ลงนาม', web_app: { url: `${MINIAPP_URL}/tg/leave/${leave.id}` } },
        ]],
      };
      const tg = await sendTelegram(String(signer.telegram_chat_id), text, replyMarkup) as
        { result?: { message_id?: number } };
      // เก็บ message_id ไว้ลบปุ่มทีหลังเมื่อผู้ลงนามขั้นนี้เซ็นเสร็จ
      const messageId = tg?.result?.message_id;
      if (messageId) {
        await sb.from('leave_sign_messages').upsert({
          leave_id: leave.id,
          signer_order: leave.current_signer_order,
          chat_id: String(signer.telegram_chat_id),
          message_id: messageId,
        });
      }
      return ok({ event: 'advanced', stage: stage.role, signerUserId, message_id: messageId ?? null });
    }

    // ─── approved / rejected: ลบปุ่มของผู้ลงนามขั้นสุดท้าย + แจ้ง 🔔 เจ้าของใบลา ───
    if (payload.event === 'approved' || payload.event === 'rejected') {
      const isApproved = payload.event === 'approved';
      if (payload.prev_order) {
        await clearSignerButton(sb, leave, payload.prev_order, isApproved ? 'signed' : 'rejected');
      }
      const message = isApproved
        ? `ใบ${d.label} ${range} (${leave.days_count} วัน) ของคุณได้รับการอนุมัติแล้ว`
        : `ใบ${d.label} ${range} (${leave.days_count} วัน) ของคุณไม่ได้รับการอนุมัติ` +
          (leave.rejection_reason ? ` — เหตุผล: ${leave.rejection_reason}` : '');
      const { error: notiErr } = await sb.from('leave_notifications').insert({
        leave_id: leave.id,
        user_id: leave.user_id,
        type: isApproved ? 'leave_approved' : 'leave_rejected',
        message,
      });
      if (notiErr) throw new Error(`notification insert: ${notiErr.message}`);
      return ok({ event: payload.event, notified_user: leave.user_id });
    }

    throw new Error(`unknown event: ${payload.event}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /Unauthorized/.test(message) ? 401 : 500;
    console.error('❌ leave-sign-notify error:', message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function ok(summary: Record<string, unknown>): Response {
  console.log('✅ leave-sign-notify:', summary);
  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
