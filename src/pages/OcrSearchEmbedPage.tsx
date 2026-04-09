import { useState, useCallback, useRef } from 'react';
import { Search, Loader2, X, Download, Eye, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { highlightText } from '@/lib/highlightText';
import Turnstile from '@/components/Turnstile';
import OcrSearchModeTabs from '@/components/OCR/OcrSearchModeTabs';
import { useOcrSearchPublic, usePublicDownload } from '@/hooks/useOcrSearchPublic';
import type { OcrChunkSearchResult } from '@/types/ocr';

const TURNSTILE_SITE_KEY = '0x4AAAAAAC2i-o57J_Porm3E';

const fileTypeIcons: Record<string, string> = {
  pdf: 'text-red-500',
  image: 'text-green-500',
  word: 'text-blue-500',
  excel: 'text-emerald-500',
  powerpoint: 'text-orange-500',
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
};

// --- Download Button with countdown ---
const DownloadButton = ({
  documentId,
  requestDownload,
  fetchDownload,
  getDownloadState,
}: {
  documentId: string;
  requestDownload: (id: string) => void;
  fetchDownload: (id: string) => void;
  getDownloadState: (id: string) => { status: string; countdown: number; error?: string };
}) => {
  const state = getDownloadState(documentId);

  if (state.status === 'idle') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); requestDownload(documentId); }}
        className="text-primary hover:underline inline-flex items-center gap-0.5 text-xs"
      >
        <Download className="h-3 w-3" /> ดาวน์โหลด
      </button>
    );
  }

  if (state.status === 'waiting') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3 animate-pulse" />
        รอ {state.countdown} วิ...
      </span>
    );
  }

  if (state.status === 'ready') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); fetchDownload(documentId); }}
        className="text-green-600 hover:underline inline-flex items-center gap-0.5 text-xs font-medium animate-pulse"
      >
        <Download className="h-3 w-3" /> ดาวน์โหลดเลย!
      </button>
    );
  }

  if (state.status === 'downloading') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> กำลังดาวน์โหลด...
      </span>
    );
  }

  if (state.status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600">
        <CheckCircle2 className="h-3 w-3" /> สำเร็จ
      </span>
    );
  }

  if (state.status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-500">
        <AlertCircle className="h-3 w-3" /> {state.error || 'ผิดพลาด'}
      </span>
    );
  }

  return null;
};

// --- Result Card for embed ---
const EmbedResultCard = ({
  result,
  query,
  requestDownload,
  fetchDownload,
  getDownloadState,
}: {
  result: OcrChunkSearchResult;
  query: string;
  requestDownload: (id: string) => void;
  fetchDownload: (id: string) => void;
  getDownloadState: (id: string) => { status: string; countdown: number; error?: string };
}) => {
  const [expanded, setExpanded] = useState(false);
  const color = fileTypeIcons[result.file_type] || 'text-gray-500';

  const snippet = result.content
    ? result.content.substring(0, 300) + (result.content.length > 300 ? '...' : '')
    : null;

  return (
    <div
      className="p-4 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer border-b border-slate-100 last:border-b-0"
      onClick={() => result.content && setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={`h-5 w-5 shrink-0 ${color}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <h3 className="text-base font-medium text-slate-900 truncate flex-1">
          {result.file_name}
        </h3>
        <span className="text-xs text-slate-400 shrink-0">
          หน้า {result.page_number}
        </span>
      </div>

      {result.context_summary && (
        <p className="text-xs text-slate-400 italic ml-7 mb-1">
          {result.context_summary}
        </p>
      )}

      {snippet && !expanded && (
        <p className="text-sm text-slate-600 ml-7 mb-1 line-clamp-2">
          {highlightText(snippet, query)}
        </p>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1 ml-7">
        <span>{formatSize(result.file_size)}</span>
        <span>&middot;</span>
        <span>{formatDate(result.created_at)}</span>
        <span>&middot;</span>
        <DownloadButton
          documentId={result.document_id}
          requestDownload={requestDownload}
          fetchDownload={fetchDownload}
          getDownloadState={getDownloadState}
        />
      </div>

      {result.tags && result.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 ml-7 mb-1">
          {result.tags.map((tag) => (
            <span key={tag} className="text-xs bg-blue-50 px-1.5 py-0.5 rounded text-blue-600 font-medium">
              {tag}
            </span>
          ))}
        </div>
      )}

      {expanded && result.content && (
        <pre className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded max-h-96 overflow-y-auto ml-7 mt-1">
          {highlightText(result.content, query)}
        </pre>
      )}
    </div>
  );
};

// --- Main Embed Page ---
const OcrSearchEmbedPage = () => {
  const turnstileTokenRef = useRef<string | null>(null);

  const getTurnstileToken = useCallback(() => turnstileTokenRef.current, []);

  const {
    query, mode, results, loading, searchTime, hasSearched, error,
    setQuery, setMode, executeSearch, clearSearch,
  } = useOcrSearchPublic({ getTurnstileToken });

  const { requestDownload, fetchDownload, getDownloadState } = usePublicDownload(getTurnstileToken);

  return (
    <div className="min-h-screen bg-white">
      <div
        className={cn(
          'max-w-3xl mx-auto px-4 transition-all duration-300',
          hasSearched ? 'pt-4' : 'pt-[12vh] sm:pt-[16vh]'
        )}
      >
        {/* Logo — only before search */}
        {!hasSearched && (
          <div className="text-center mb-6">
            <img src="/fastS.png" alt="FastSearch" className="h-28 mx-auto mb-2" />
            <img src="/fastS1.png" alt="FASTSEARCH" className="h-10 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              ค้นหาเอกสารสาธารณะ
            </p>
          </div>
        )}

        {/* Search bar */}
        <div
          className={cn(
            hasSearched && 'sticky top-0 z-40 bg-white/95 backdrop-blur-sm pb-3 pt-2'
          )}
        >
          <div className="flex items-center border border-slate-200 bg-white px-5 py-1 rounded-full shadow-sm hover:shadow-md focus-within:shadow-md transition-shadow">
            {loading ? (
              <Loader2 className="h-5 w-5 text-slate-400 animate-spin shrink-0" />
            ) : (
              <Search className="h-5 w-5 text-slate-400 shrink-0" />
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') executeSearch(); }}
              placeholder="ค้นหาเอกสาร..."
              className="flex-1 bg-transparent border-none outline-none text-base px-3 py-2.5 placeholder:text-slate-300"
              autoFocus={!hasSearched}
            />
            {query && (
              <button onClick={clearSearch} className="p-1.5 hover:bg-slate-100 rounded-full">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            )}
          </div>
          <OcrSearchModeTabs mode={mode} onModeChange={setMode} className="mt-3 ml-5" />
          {hasSearched && <div className="border-b border-slate-100 mt-3" />}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {hasSearched && !error && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-4 px-4">
              <p className="text-sm text-slate-400">
                พบ {results?.length ?? 0} รายการ
                {searchTime !== null && (
                  <span> ({(searchTime / 1000).toFixed(2)} วินาที)</span>
                )}
              </p>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-3 w-64" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            ) : results && results.length > 0 ? (
              <div className="space-y-0">
                {results.map((result) => (
                  <EmbedResultCard
                    key={result.chunk_id}
                    result={result}
                    query={query}
                    requestDownload={requestDownload}
                    fetchDownload={fetchDownload}
                    getDownloadState={getDownloadState}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="h-16 w-16 text-slate-200 mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-1">
                  ไม่พบผลลัพธ์
                </h3>
                <p className="text-sm text-slate-400 max-w-xs">
                  ลองค้นหาด้วยคำค้นอื่น หรือเปลี่ยนโหมดการค้นหา
                </p>
              </div>
            )}
          </div>
        )}

        {/* Turnstile — placed at bottom, small */}
        <div className="flex justify-center mt-6 mb-4">
          <Turnstile
            siteKey={TURNSTILE_SITE_KEY}
            onToken={(token) => { turnstileTokenRef.current = token; }}
            onExpire={() => { turnstileTokenRef.current = null; }}
          />
        </div>

        {/* Footer */}
        <div className="text-center pb-6">
          <p className="text-xs text-slate-300">
            FastDoc &middot; ระบบค้นหาเอกสารสาธารณะ
          </p>
        </div>
      </div>
    </div>
  );
};

export default OcrSearchEmbedPage;
