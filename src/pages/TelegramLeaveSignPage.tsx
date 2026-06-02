// Telegram Mini App — หน้าลงนามใบลา
// เปิดจากปุ่ม web_app ใน DM ของบอท @noti_leave_requie_bot (ส่งโดย edge fn leave-sign-notify)
// flow: init Telegram WebApp → auth ด้วย initData (leave-miniapp-auth) → setSession
//        → โหลด profile + ใบลา → แสดง LeaveDetailDialog (modal เดียวกับในเว็บ) → เซ็น → tg.close()
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  computeAllowedSignerRoles,
  getLeaveRequestById,
  getLeaveSignerConfig,
} from '@/services/leaveService';
import type { ApproverContext, LeaveSignerConfig } from '@/services/leaveService';
import type { LeaveRequest, LeaveSignerRole } from '@/types/leave';
import { LeaveDetailDialog } from './LeaveRequestsPage';

type Phase = 'init' | 'auth' | 'loading' | 'ready' | 'error';

interface SignerProfile {
  id: string;
  user_id: string;
  prefix: string | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  org_structure_role: string | null;
  is_admin: boolean | null;
  signature_url: string | null;
}

// รอ Telegram WebApp SDK โหลด (async script ใน index.html) แล้วคืน object
function waitForTelegram(timeoutMs = 3000): Promise<any | null> {
  return new Promise((resolve) => {
    const existing = (window as any).Telegram?.WebApp;
    if (existing) return resolve(existing);
    let waited = 0;
    const interval = setInterval(() => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg || (waited += 150) >= timeoutMs) {
        clearInterval(interval);
        resolve(tg ?? null);
      }
    }, 150);
  });
}

function closeMiniApp() {
  (window as any).Telegram?.WebApp?.close?.();
}

const TelegramLeaveSignPage: React.FC = () => {
  const { id: routeId } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<Phase>('init');
  const [errorMsg, setErrorMsg] = useState('');
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [profile, setProfile] = useState<SignerProfile | null>(null);
  const [signerConfig, setSignerConfig] = useState<LeaveSignerConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const tg = await waitForTelegram();
        if (tg) {
          tg.ready?.();
          tg.expand?.();
          tg.setHeaderColor?.('#ffffff');
          tg.setBackgroundColor?.('#f8fafc');
        }

        const initData: string | undefined = tg?.initData;
        const leaveId = routeId || tg?.initDataUnsafe?.start_param;
        if (!initData) throw new Error('NO_TG');
        if (!leaveId) throw new Error('NO_ID');

        // 1) auto-login ผ่าน Telegram identity
        if (cancelled) return;
        setPhase('auth');
        const { data: authRes, error: authErr } = await supabase.functions.invoke(
          'leave-miniapp-auth',
          { body: { initData } },
        );
        if (authErr || !authRes?.access_token) throw new Error('AUTH');
        await supabase.auth.setSession({
          access_token: authRes.access_token,
          refresh_token: authRes.refresh_token,
        });

        // 2) โหลด profile ของผู้ลงนาม (ใช้ตัดสิทธิ์ลงนาม) + ใบลา
        if (cancelled) return;
        setPhase('loading');
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('id, user_id, prefix, first_name, last_name, position, org_structure_role, is_admin, signature_url')
          .eq('user_id', authRes.user.user_id)
          .maybeSingle();
        if (profErr || !prof) throw new Error('PROFILE');

        const [leave, cfg] = await Promise.all([
          getLeaveRequestById(leaveId),
          getLeaveSignerConfig().catch(() => null),
        ]);
        if (!leave) throw new Error('NOTFOUND');

        if (cancelled) return;
        setProfile(prof as SignerProfile);
        setSignerConfig(cfg);
        setRequest(leave);
        setPhase('ready');
      } catch (e) {
        if (cancelled) return;
        const code = e instanceof Error ? e.message : 'UNKNOWN';
        setErrorMsg(
          code === 'NO_TG'
            ? 'กรุณาเปิดหน้านี้ผ่านปุ่มใน Telegram'
            : code === 'AUTH'
              ? 'ยืนยันตัวตนกับ Telegram ไม่สำเร็จ — บัญชีนี้อาจยังไม่ได้ผูกกับ FastDoc'
              : code === 'NOTFOUND' || code === 'NO_ID'
                ? 'ไม่พบใบลานี้'
                : 'เกิดข้อผิดพลาด กรุณาลองใหม่',
        );
        setPhase('error');
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  // สิทธิ์ลงนามตาม role (ใช้ helper เดียวกับหน้าเว็บ — รวมผู้ที่ admin ตั้งใน config)
  const allowedRoles = useMemo<LeaveSignerRole[]>(
    () => (profile ? computeAllowedSignerRoles(profile, signerConfig) : []),
    [profile, signerConfig],
  );

  const approver = useMemo<ApproverContext | null>(() => {
    if (!request || !profile) return null;
    const needed: LeaveSignerRole =
      request.current_signer_order === 1
        ? 'hr_head'
        : request.current_signer_order === 2
          ? 'deputy_director'
          : 'director';
    if (!allowedRoles.includes(needed)) return null;
    return {
      user_id: profile.id,
      user_name: `${profile.prefix ?? ''}${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
      role: needed,
      signature_url: profile.signature_url ?? null,
    };
  }, [request, profile, allowedRoles]);

  const canApprove =
    !!approver && (request?.status === 'pending' || request?.status === 'in_progress');

  if (phase === 'ready' && request) {
    return (
      <div className="min-h-screen bg-slate-50">
        <LeaveDetailDialog
          request={request}
          approver={approver}
          canApprove={canApprove}
          onClose={() => closeMiniApp()}
        />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center bg-slate-50">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-slate-700">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 bg-slate-50">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      <p className="text-sm text-slate-500">
        {phase === 'auth' ? 'กำลังยืนยันตัวตน...' : 'กำลังโหลดใบลา...'}
      </p>
    </div>
  );
};

export default TelegramLeaveSignPage;
