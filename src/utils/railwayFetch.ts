import { supabase } from '@/integrations/supabase/client';

// PDF API hosts in priority order. Override via VITE_PDF_API_HOSTS (comma-separated).
// First entry is primary (Railway), subsequent entries are backups (Fly.io, ...).
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
const REQUEST_TIMEOUT_MS = 10_000;

// In-memory sticky failover state. Once we see the primary host fail we skip
// it for 5 minutes — avoids paying the 10s timeout on every subsequent request
// while the primary is still down. Reset on a successful primary response.
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
 *   - times each attempt out at 10s,
 *   - falls back on network errors and 5xx, but returns 2xx/3xx/4xx as-is.
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
        signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

  throw lastError ?? new Error('All PDF API hosts failed');
}
