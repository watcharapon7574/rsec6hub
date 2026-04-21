import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { ocrService } from '@/services/ocrService';
import type { OcrChunkSearchResult, OcrSearchHistory, SearchMode } from '@/types/ocr';

export function useOcrSearch() {
  const { profile } = useEmployeeAuth();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('fulltext');
  const [results, setResults] = useState<OcrChunkSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [history, setHistory] = useState<OcrSearchHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const prevModeRef = useRef(mode);

  // Load history on mount
  useEffect(() => {
    if (!profile?.user_id) return;
    setHistoryLoading(true);
    ocrService
      .getSearchHistory(profile.user_id)
      .then(setHistory)
      .catch((err) => console.error('Failed to load search history:', err))
      .finally(() => setHistoryLoading(false));
  }, [profile?.user_id]);

  const doSearch = useCallback(async (searchQuery: string, searchMode: SearchMode) => {
    if (!searchQuery.trim() || !profile?.user_id) return;

    setLoading(true);
    setHasSearched(true);
    const startTime = performance.now();

    try {
      // Single Edge Function call handles everything:
      // query rewriting → Thai segmentation → embedding → hybrid search → reranking → save history
      const data = await ocrService.chunkSearch(searchQuery, searchMode, profile.user_id);

      setResults(data);
      setSearchTime(performance.now() - startTime);

      // Refresh history (saved server-side by Edge Function)
      ocrService
        .getSearchHistory(profile.user_id)
        .then(setHistory)
        .catch((err) => console.error('Failed to refresh search history:', err));
    } catch (err: any) {
      console.error('Search failed:', err);
      toast.error(`ค้นหาล้มเหลว: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id]);

  const executeSearch = useCallback(() => {
    return doSearch(query, mode);
  }, [query, mode, doSearch]);

  const searchFromHistory = useCallback((historyQuery: string, historyMode: SearchMode) => {
    setQuery(historyQuery);
    setMode(historyMode);
    return doSearch(historyQuery, historyMode);
  }, [doSearch]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults(null);
    setSearchTime(null);
    setHasSearched(false);
  }, []);

  const deleteHistoryItem = useCallback(
    async (id: string) => {
      try {
        await ocrService.deleteSearchHistory(id);
        setHistory((prev) => prev.filter((h) => h.id !== id));
      } catch (err: any) {
        toast.error(`ลบประวัติไม่สำเร็จ: ${err.message}`);
      }
    },
    []
  );

  const clearAllHistory = useCallback(async () => {
    if (!profile?.user_id) return;
    try {
      await ocrService.clearSearchHistory(profile.user_id);
      setHistory([]);
      toast.success('ลบประวัติทั้งหมดแล้ว');
    } catch (err: any) {
      toast.error(`ลบประวัติไม่สำเร็จ: ${err.message}`);
    }
  }, [profile?.user_id]);

  // Auto re-search when mode changes (if already searched)
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
    history,
    historyLoading,
    setQuery,
    setMode,
    executeSearch,
    searchFromHistory,
    clearSearch,
    deleteHistoryItem,
    clearAllHistory,
  };
}
