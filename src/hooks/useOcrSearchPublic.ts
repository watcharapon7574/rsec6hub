import { useState, useCallback, useEffect, useRef } from 'react';
import type { OcrChunkSearchResult, SearchMode } from '@/types/ocr';

const SUPABASE_URL = 'https://ikfioqvjrhquiyeylmsv.supabase.co';

interface UseOcrSearchPublicOptions {
  getTurnstileToken: () => string | null;
}

export function useOcrSearchPublic({ getTurnstileToken }: UseOcrSearchPublicOptions) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('hybrid');
  const [results, setResults] = useState<OcrChunkSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevModeRef = useRef(mode);

  const doSearch = useCallback(async (searchQuery: string, searchMode: SearchMode) => {
    if (!searchQuery.trim()) return;

    const turnstileToken = getTurnstileToken();
    if (!turnstileToken) {
      setError('กรุณารอการยืนยันตัวตน');
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setError(null);
    const startTime = performance.now();

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ocr-search-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          mode: searchMode,
          turnstile_token: turnstileToken,
        }),
      });

      if (res.status === 429) {
        setError('ค้นหาบ่อยเกินไป กรุณารอสักครู่');
        return;
      }
      if (res.status === 403) {
        setError('การยืนยันตัวตนล้มเหลว กรุณารีเฟรชหน้า');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }

      const data = await res.json();
      setResults(data.results || []);
      setSearchTime(performance.now() - startTime);
    } catch (err: any) {
      console.error('Public search failed:', err);
      setError(`ค้นหาล้มเหลว: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [getTurnstileToken]);

  const executeSearch = useCallback(() => {
    return doSearch(query, mode);
  }, [query, mode, doSearch]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults(null);
    setSearchTime(null);
    setHasSearched(false);
    setError(null);
  }, []);

  // Auto re-search when mode changes
  useEffect(() => {
    if (prevModeRef.current !== mode && hasSearched && query.trim()) {
      executeSearch();
    }
    prevModeRef.current = mode;
  }, [mode, hasSearched, query, executeSearch]);

  return {
    query,
    mode,
    results,
    loading,
    searchTime,
    hasSearched,
    error,
    setQuery,
    setMode,
    executeSearch,
    clearSearch,
  };
}

// --- Download with server-enforced delay ---

interface DownloadState {
  status: 'idle' | 'waiting' | 'ready' | 'downloading' | 'done' | 'error';
  countdown: number;
  error?: string;
}

export function usePublicDownload(getTurnstileToken: () => string | null) {
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const intervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const requestDownload = useCallback(async (documentId: string) => {
    const turnstileToken = getTurnstileToken();
    if (!turnstileToken) return;

    setDownloads((prev) => ({
      ...prev,
      [documentId]: { status: 'waiting', countdown: 3 },
    }));

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ocr-download-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId, turnstile_token: turnstileToken }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }

      const { token, delay_seconds } = await res.json();
      const countdown = delay_seconds || 3;

      setDownloads((prev) => ({
        ...prev,
        [documentId]: { status: 'waiting', countdown },
      }));

      // Start countdown
      let remaining = countdown;
      const interval = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(interval);
          delete intervalsRef.current[documentId];
          setDownloads((prev) => ({
            ...prev,
            [documentId]: { status: 'ready', countdown: 0 },
          }));
        } else {
          setDownloads((prev) => ({
            ...prev,
            [documentId]: { status: 'waiting', countdown: remaining },
          }));
        }
      }, 1000);
      intervalsRef.current[documentId] = interval;

      // Store token for fetch step
      setDownloads((prev) => ({
        ...prev,
        [documentId]: { ...prev[documentId], countdown, _token: token } as any,
      }));
    } catch (err: any) {
      setDownloads((prev) => ({
        ...prev,
        [documentId]: { status: 'error', countdown: 0, error: err.message },
      }));
    }
  }, [getTurnstileToken]);

  const fetchDownload = useCallback(async (documentId: string) => {
    const state = downloads[documentId] as any;
    if (!state?._token) return;

    setDownloads((prev) => ({
      ...prev,
      [documentId]: { status: 'downloading', countdown: 0 },
    }));

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ocr-download-fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: state._token }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }

      const { signed_url, file_name } = await res.json();

      // Trigger download
      const a = document.createElement('a');
      a.href = signed_url;
      a.download = file_name;
      a.target = '_blank';
      a.click();

      setDownloads((prev) => ({
        ...prev,
        [documentId]: { status: 'done', countdown: 0 },
      }));
    } catch (err: any) {
      setDownloads((prev) => ({
        ...prev,
        [documentId]: { status: 'error', countdown: 0, error: err.message },
      }));
    }
  }, [downloads]);

  const getDownloadState = useCallback(
    (documentId: string): DownloadState => {
      return downloads[documentId] || { status: 'idle', countdown: 0 };
    },
    [downloads]
  );

  return { requestDownload, fetchDownload, getDownloadState };
}
