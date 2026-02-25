import { Link } from 'react-router-dom';
import { ScanText, Upload } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import OcrGoogleSearchBar from '@/components/OCR/OcrGoogleSearchBar';
import OcrSearchModeTabs from '@/components/OCR/OcrSearchModeTabs';
import OcrSearchResultCard from '@/components/OCR/OcrSearchResultCard';
import OcrSearchEmptyState from '@/components/OCR/OcrSearchEmptyState';
import { useOcrSearch } from '@/hooks/useOcrSearch';

const OcrSearchPage = () => {
  const {
    query,
    mode,
    results,
    loading,
    searchTime,
    hasSearched,
    history,
    setQuery,
    setMode,
    executeSearch,
    searchFromHistory,
    clearSearch,
    deleteHistoryItem,
    clearAllHistory,
  } = useOcrSearch();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div
        className={cn(
          'max-w-3xl mx-auto px-4 transition-all duration-300',
          hasSearched ? 'pt-6' : 'pt-[20vh] sm:pt-[25vh]'
        )}
      >
        {/* Logo/Title — only visible before search */}
        {!hasSearched && (
          <div className="text-center mb-8">
            <ScanText className="h-16 w-16 mx-auto mb-4 text-blue-500/60" />
            <h1 className="text-2xl font-bold text-foreground mb-2">
              ค้นหาเอกสาร OCR
            </h1>
            <p className="text-muted-foreground text-sm">
              ค้นหาจากข้อความที่ดึงจากเอกสาร
            </p>
          </div>
        )}

        {/* Search bar + tabs — becomes sticky after search */}
        <div
          className={cn(
            hasSearched &&
              'sticky top-14 z-40 bg-background/95 backdrop-blur-sm pb-3 pt-2'
          )}
        >
          <OcrGoogleSearchBar
            query={query}
            onQueryChange={setQuery}
            onSearch={executeSearch}
            onClear={clearSearch}
            loading={loading}
            autoFocus={!hasSearched}
            history={history}
            onSelectHistory={(item) => {
              searchFromHistory(item.query, item.mode);
            }}
            onDeleteHistory={deleteHistoryItem}
            onClearAllHistory={clearAllHistory}
          />
          <OcrSearchModeTabs
            mode={mode}
            onModeChange={setMode}
            className="mt-4 ml-5"
          />
          {hasSearched && <div className="border-b border-border mt-3" />}
        </div>

        {/* Results area */}
        {hasSearched && (
          <div className="mt-4">
            {/* Results meta */}
            <div className="flex items-center justify-between mb-4 px-4">
              <p className="text-sm text-muted-foreground">
                พบ {results?.length ?? 0} รายการ
                {searchTime !== null && (
                  <span> ({(searchTime / 1000).toFixed(2)} วินาที)</span>
                )}
              </p>
              <Link
                to="/ocr"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Upload className="h-4 w-4" />
                จัดการเอกสาร
              </Link>
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
              <div className="space-y-1">
                {results.map((result) => (
                  <OcrSearchResultCard
                    key={result.chunk_id}
                    result={result}
                    query={query}
                  />
                ))}
              </div>
            ) : (
              <OcrSearchEmptyState />
            )}
          </div>
        )}

        {/* Link to upload page — only when no search */}
        {!hasSearched && (
          <div className="text-center mt-8">
            <Link
              to="/ocr"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              จัดการเอกสาร →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default OcrSearchPage;
