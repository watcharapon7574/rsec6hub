import { Search, Loader2, X, History, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { OcrSearchHistory } from '@/types/ocr';

interface OcrGoogleSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSearch: () => void;
  onClear: () => void;
  loading?: boolean;
  autoFocus?: boolean;
  className?: string;
  history?: OcrSearchHistory[];
  onSelectHistory?: (item: OcrSearchHistory) => void;
  onDeleteHistory?: (id: string) => void;
  onClearAllHistory?: () => void;
}

const OcrGoogleSearchBar = ({
  query,
  onQueryChange,
  onSearch,
  onClear,
  loading,
  autoFocus,
  className,
  history = [],
  onSelectHistory,
  onDeleteHistory,
  onClearAllHistory,
}: OcrGoogleSearchBarProps) => {
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter history by current query
  const filtered = query.trim()
    ? history.filter((h) =>
        h.query.toLowerCase().includes(query.toLowerCase())
      )
    : history;

  const showDropdown = focused && filtered.length > 0 && !loading;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div
        className={cn(
          'flex items-center border bg-background px-5 py-1 transition-shadow',
          showDropdown
            ? 'rounded-t-3xl shadow-md border-b-0'
            : 'rounded-full shadow-sm hover:shadow-md focus-within:shadow-md'
        )}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin shrink-0" />
        ) : (
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setFocused(false);
              onSearch();
            }
          }}
          onFocus={() => setFocused(true)}
          placeholder="ค้นหาเอกสาร..."
          className="flex-1 bg-transparent border-none outline-none text-base sm:text-lg px-3 py-2.5 placeholder:text-muted-foreground/60"
          autoFocus={autoFocus}
        />
        {query && (
          <button
            onClick={onClear}
            className="p-1.5 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* History dropdown */}
      {showDropdown && (
        <div className="absolute left-0 right-0 z-50 bg-background border border-t-0 rounded-b-3xl shadow-md overflow-hidden">
          <div className="border-t mx-4" />
          <ul className="py-1 max-h-80 overflow-y-auto">
            {filtered.slice(0, 8).map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/50 cursor-pointer group"
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur
                  onSelectHistory?.(item);
                  setFocused(false);
                }}
              >
                <History className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                <span className="flex-1 text-sm truncate">{item.query}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded-full transition-opacity"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDeleteHistory?.(item.id);
                  }}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
          {history.length > 0 && onClearAllHistory && (
            <div className="border-t mx-4" />
          )}
          {history.length > 0 && onClearAllHistory && (
            <button
              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:text-red-500 hover:bg-muted/30 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                onClearAllHistory();
              }}
            >
              <Trash2 className="h-3 w-3" />
              ลบประวัติทั้งหมด
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default OcrGoogleSearchBar;
