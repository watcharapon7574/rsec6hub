import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PDF_API_HOSTS,
  RAILWAY_PDF_API,
  markPrimaryHealthy,
  railwayFetch,
} from './railwayFetch';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

describe('railwayFetch — host config', () => {
  it('RAILWAY_PDF_API points at Railway primary', () => {
    expect(RAILWAY_PDF_API).toBe('https://pdf-memo-docx-production-25de.up.railway.app');
  });

  it('RAILWAY_PDF_API has no trailing slash', () => {
    expect(RAILWAY_PDF_API.endsWith('/')).toBe(false);
  });

  it('PDF_API_HOSTS includes Railway primary and Fly backup by default', () => {
    expect(PDF_API_HOSTS[0]).toBe('https://pdf-memo-docx-production-25de.up.railway.app');
    expect(PDF_API_HOSTS).toContain('https://pdf-memo-docx-backup.fly.dev');
  });
});

describe('railwayFetch — failover behavior', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    markPrimaryHealthy();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    markPrimaryHealthy();
  });

  it('returns primary response when primary is healthy', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    global.fetch = mockFetch as any;

    const res = await railwayFetch('/health');

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain(PDF_API_HOSTS[0]);
  });

  it('does NOT failover on 4xx — server is responding', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));
    global.fetch = mockFetch as any;

    const res = await railwayFetch('/missing');

    expect(res.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to backup on primary 5xx', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok from backup', { status: 200 }));
    global.fetch = mockFetch as any;

    const res = await railwayFetch('/pdf');

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok from backup');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain(PDF_API_HOSTS[0]);
    expect(mockFetch.mock.calls[1][0]).toContain(PDF_API_HOSTS[1]);
  });

  it('falls back to backup on primary network error', async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    global.fetch = mockFetch as any;

    const res = await railwayFetch('/pdf');

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('skips primary for 5 minutes after a failure (sticky failover)', async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValue(new Response('ok', { status: 200 }));
    global.fetch = mockFetch as any;

    // First call — primary fails, fallback to backup
    await railwayFetch('/pdf');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    mockFetch.mockClear();

    // Second call — primary should be skipped; only backup should be tried
    await railwayFetch('/pdf');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain(PDF_API_HOSTS[1]);
  });

  it('throws a user-friendly error when all hosts fail, preserving the raw cause', async () => {
    const primaryErr = new Error('primary down');
    const backupErr = new Error('backup down');
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(primaryErr)
      .mockRejectedValueOnce(backupErr);
    global.fetch = mockFetch as any;

    const err = (await railwayFetch('/pdf').catch((e) => e)) as Error & { cause?: unknown };

    // Toast-friendly Thai message instead of the opaque raw "Failed to fetch"...
    expect(err.message).toMatch(/ไม่ตอบสนองชั่วคราว/);
    // ...with the raw error still reachable via `cause` for debugging.
    expect(err.cause).toBe(backupErr);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
