// @ts-nocheck — Deno edge function (Supabase Edge Runtime)
// Mini App auto-login: รับ Telegram WebApp initData → verify HMAC ด้วย bot token
// → map telegram_chat_id → profile → mint Supabase session (generateLink + verifyOtp)
//
// POST { initData: "<window.Telegram.WebApp.initData>" }
//   200 → { access_token, refresh_token, user: { user_id, name } }
//   401 → initData ปลอม/หมดอายุ, 404 → ไม่พบ profile ที่ผูก Telegram นี้
//
// ใช้บอท @noti_leave_requie_bot (secret: LEAVE_SIGN_BOT_TOKEN) — บอทเดียวกับที่ส่ง DM
// เปิด Mini App เท่านั้นถึง verify ผ่าน (initData เซ็นด้วย token ของบอทที่เปิดแอป)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('LEAVE_SIGN_BOT_TOKEN') ?? '';
if (!BOT_TOKEN) console.error('Missing LEAVE_SIGN_BOT_TOKEN secret');

// initData เก่ากว่านี้ถือว่าหมดอายุ (กัน replay) — Mini App เปิดสดทุกครั้งจาก DM
const MAX_AUTH_AGE_SEC = 3600;
const DB_TIMEOUT_MS = 6000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── withAbort (เหมือน telegram-otp) — ทุก DB call ต้องมี timeout ───
async function withAbort<T>(
  build: (signal: AbortSignal) => PromiseLike<T>,
  label: string,
  ms: number = DB_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const result = await build(controller.signal);
    if (controller.signal.aborted) throw new Error(`DB timeout: ${label} after ${ms}ms`);
    return result;
  } catch (err) {
    if (controller.signal.aborted) throw new Error(`DB timeout: ${label} after ${ms}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// auth.admin.* ไม่รองรับ abortSignal → fallback timeout (fetch ไม่ถูก cancel จริง)
function withTimeout<T>(p: PromiseLike<T>, label: string, ms: number = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`DB timeout: ${label} after ${ms}ms`)), ms);
    Promise.resolve(p).then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

// ─── HMAC helper (Web Crypto) ───
const enc = new TextEncoder();
async function hmacSha256(keyBytes: Uint8Array, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ตรวจ initData ตามสูตร Telegram:
//   secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)
//   expected   = HMAC_SHA256(key=secret_key, msg=data_check_string)  → เทียบ hex กับ field hash
// คืน user object (parse จาก field "user") ถ้าผ่าน, throw ถ้าไม่ผ่าน/หมดอายุ
async function verifyInitData(initData: string): Promise<{ id: number; first_name?: string }> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new Error('Unauthorized — missing hash');

  const pairs: string[] = [];
  for (const [k, v] of params.entries()) {
    if (k === 'hash') continue;
    pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = await hmacSha256(enc.encode('WebAppData'), BOT_TOKEN);
  const expected = toHex(await hmacSha256(secretKey, dataCheckString));
  if (expected !== hash) throw new Error('Unauthorized — bad initData signature');

  const authDate = Number(params.get('auth_date') ?? 0);
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  if (!authDate || ageSec > MAX_AUTH_AGE_SEC) {
    throw new Error('Unauthorized — initData expired');
  }

  const userRaw = params.get('user');
  if (!userRaw) throw new Error('Unauthorized — no user in initData');
  const user = JSON.parse(userRaw);
  if (!user?.id) throw new Error('Unauthorized — no user id');
  return user;
}

function getAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { initData } = await req.json();
    if (!initData || typeof initData !== 'string') {
      throw new Error('initData required');
    }

    const tgUser = await verifyInitData(initData);
    const tgId = String(tgUser.id);

    const admin = getAdmin();

    // map telegram_chat_id (= chat id ส่วนตัว = user id) → profile
    // หมายเหตุ: 1 Telegram อาจผูกหลาย profile (เช่น dev มีทั้ง teacher + admin,
    // หรือเบอร์ admin ที่ใช้ร่วมกัน) → ห้าม maybeSingle (จะ throw "multiple rows")
    // เลือก profile ที่ "เซ็นได้" ก่อน: admin → ผอ./รอง → หน.บุคคล → ตัวแรกที่มี user_id
    const { data: profiles, error: profErr } = await withAbort(
      (signal) =>
        admin
          .from('profiles')
          .select('id, user_id, employee_id, first_name, last_name, position, org_structure_role, is_admin')
          .eq('telegram_chat_id', tgId)
          .abortSignal(signal),
      'profile-by-telegram',
    );
    if (profErr) throw new Error(`profile lookup: ${profErr.message}`);
    const candidates = (profiles ?? []).filter((p: any) => p.user_id);
    const profile =
      candidates.find((p: any) => p.is_admin === true) ??
      candidates.find((p: any) => p.position === 'director' || p.position === 'deputy_director') ??
      candidates.find((p: any) => /บุคคล/.test(p.org_structure_role ?? '')) ??
      candidates[0];
    if (!profile?.user_id) {
      return new Response(
        JSON.stringify({ error: 'ไม่พบบัญชีที่ผูกกับ Telegram นี้ — กรุณาเข้าสู่ระบบ FastDoc ด้วยเบอร์โทรก่อน' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // หา auth user + email (สร้าง temp email ถ้ายังไม่มี — เหมือน verify-otp)
    const { data: userData, error: userErr } = await withTimeout(
      admin.auth.admin.getUserById(profile.user_id),
      'getUserById',
    );
    if (userErr || !userData?.user) throw new Error('auth user not found');
    let authUser = userData.user;
    if (!authUser.email) {
      const tempEmail = `${profile.employee_id}@rsec6.temp`;
      const { data: upd, error: updErr } = await withTimeout(
        admin.auth.admin.updateUserById(authUser.id, { email: tempEmail, email_confirm: true }),
        'updateUserById',
      );
      if (updErr) throw new Error(`set email: ${updErr.message}`);
      authUser = upd.user;
    }

    // mint session: generateLink (magiclink) → verifyOtp (ไม่ invalidate session อื่น)
    const { data: linkData, error: linkErr } = await withTimeout(
      admin.auth.admin.generateLink({ type: 'magiclink', email: authUser.email! }),
      'generateLink',
    );
    if (linkErr || !linkData) throw new Error('ไม่สามารถสร้าง session ได้');

    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { auth: { persistSession: false } },
    );
    const { data: verifyData, error: verifyErr } = await withTimeout(
      anon.auth.verifyOtp({ token_hash: linkData.properties.hashed_token, type: 'email' }),
      'verifyOtp',
    );
    if (verifyErr || !verifyData?.session) throw new Error('ไม่สามารถสร้าง access token ได้');

    const s = verifyData.session;
    return new Response(
      JSON.stringify({
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        expires_at: s.expires_at,
        user: {
          user_id: profile.user_id,
          name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /Unauthorized/.test(message)
      ? 401
      : /timeout/i.test(message)
        ? 503
        : 500;
    console.error('❌ leave-miniapp-auth error:', message);
    // ไม่ leak label ภายในให้ client — map เป็นข้อความรวม
    const clientMsg = status === 401
      ? 'ยืนยันตัวตนกับ Telegram ไม่สำเร็จ'
      : status === 503
        ? 'ระบบไม่ว่าง กรุณาลองใหม่'
        : 'เกิดข้อผิดพลาด';
    return new Response(
      JSON.stringify({ error: clientMsg }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
