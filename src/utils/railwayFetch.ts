import { supabase } from '@/integrations/supabase/client';

// PDF API hosts in priority order. Override via VITE_PDF_API_HOSTS (comma-separated).
// First entry is primary (Railway), subsequent entries are backups (Fly.io, ...).
//
// NOTE (2026-06-09): the Fly.io backup is currently SUSPENDED — the fly.io trial
// ended and the app can't run VMs until a card is added, so it answers with a
// connection error. The failover machinery below still works; it just no-ops
// against a dead host today (one wasted ~0.2s fetch when the primary blips).
// Kept in the list so failover is ready the moment any backup is revived — to
// actually disable failover, drop this entry (and update railwayFetch.test.ts).
const DEFAULT_PDF_API_HOSTS = [
  'https://pdf-memo-docx-production-25de.up.railway.app',
  'https://pdf-memo-docx-backup.fly.dev',
];

const parseHosts = (raw: string | undefined): string[] => {
  if (!raw) return DEFAULT_PDF_API_HOSTS;
  const list = raw
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_PDF_API_HOSTS;
};

export const PDF_API_HOSTS: readonly string[] = parseHosts(
  (import.meta as any).env?.VITE_PDF_API_HOSTS,
);

// Kept for backward compatibility with callers/tests that still import the
// single-host constant — points at the current primary.
export const RAILWAY_PDF_API = PDF_API_HOSTS[0];

const PRIMARY_DOWN_MS = 5 * 60 * 1000; // 5 minutes

// In-memory sticky failover state. Once we see the primary host fail we skip
// it for 5 minutes — avoids forcing every subsequent request to wait for the
// primary to fail again. Reset on a successful primary response.
let primaryDownUntil = 0;

export const markPrimaryHealthy = () => {
  primaryDownUntil = 0;
};

const orderedHosts = (): string[] => {
  if (PDF_API_HOSTS.length <= 1) return [...PDF_API_HOSTS];
  if (Date.now() < primaryDownUntil) {
    // Skip primary while it's in the cooldown window
    return PDF_API_HOSTS.slice(1);
  }
  return [...PDF_API_HOSTS];
};

const shouldFailover = (status: number) => status >= 500 && status <= 599;

/**
 * Fetch wrapper for PDF API that:
 *   - attaches the Supabase JWT,
 *   - tries each configured host in order (primary → backups),
 *   - falls back on network errors and 5xx, but returns 2xx/3xx/4xx as-is.
 *
 * No default timeout — large uploads (PDF + signature image) on slow networks
 * need to be able to run as long as the browser allows. Callers that want a
 * timeout should pass `init.signal` (e.g. `AbortSignal.timeout(ms)`).
 */
export async function railwayFetch(endpoint: string, init: RequestInit = {}): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const baseHeaders = new Headers(init.headers);
  if (session?.access_token) {
    baseHeaders.set('Authorization', `Bearer ${session.access_token}`);
  }

  const hosts = orderedHosts();
  let lastError: unknown;

  for (let i = 0; i < hosts.length; i++) {
    const host = hosts[i];
    const isPrimary = host === PDF_API_HOSTS[0];
    try {
      const res = await fetch(`${host}${endpoint}`, {
        ...init,
        headers: baseHeaders,
      });

      if (!shouldFailover(res.status)) {
        // Success, redirect, or client error — server is responding, return as-is.
        if (isPrimary) markPrimaryHealthy();
        return res;
      }

      // 5xx — try next host
      lastError = new Error(`${host} returned ${res.status}`);
      if (isPrimary) primaryDownUntil = Date.now() + PRIMARY_DOWN_MS;
    } catch (err) {
      lastError = err;
      if (isPrimary) primaryDownUntil = Date.now() + PRIMARY_DOWN_MS;
    }
  }

  // Every host failed (network error or 5xx). lastError is usually a bare
  // `TypeError: Failed to fetch` — opaque to end users and useless in a toast.
  // Keep the raw cause for the console/debugging, but surface a user-actionable
  // Thai message so callers that toast `error.message` show something sensible.
  console.warn('[railwayFetch] all PDF API hosts failed:', lastError);
  const friendly = new Error(
    'เซิร์ฟเวอร์ประมวลผลเอกสารไม่ตอบสนองชั่วคราว กรุณาลองใหม่อีกครั้งในอีกสักครู่',
  );
  (friendly as Error & { cause?: unknown }).cause = lastError;
  throw friendly;
}
