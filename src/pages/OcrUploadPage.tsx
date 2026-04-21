import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ScanText,
  Search,
  FileStack,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Image,
  File,
  FileSpreadsheet,
  Presentation,
  X,
  Filter,
} from 'lucide-react';
import OcrUploadCard from '@/components/OCR/OcrUploadCard';
import OcrProcessingProgress from '@/components/OCR/OcrProcessingProgress';
import OcrDocumentCard from '@/components/OCR/OcrDocumentCard';
import { useOcrUpload } from '@/hooks/useOcrUpload';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { getPermissions } from '@/utils/permissionUtils';

const fileTypeFilters = [
  { value: 'pdf', label: 'PDF', icon: FileText, color: 'text-red-500' },
  { value: 'image', label: 'รูปภาพ', icon: Image, color: 'text-green-500' },
  { value: 'word', label: 'Word', icon: File, color: 'text-blue-500' },
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet, color: 'text-emerald-500' },
  { value: 'powerpoint', label: 'PPT', icon: Presentation, color: 'text-orange-500' },
] as const;

const OcrUploadPage = () => {
  const { profile } = useEmployeeAuth();
  const permissions = getPermissions(profile);
  const {
    documents,
    loading,
    processing,
    queue,
    addToQueue,
    deleteDocument,
    updateTags,
    togglePublic,
    retryDocument,
  } = useOcrUpload();

  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const isProcessing = queue.some((item) => ['registering', 'waiting', 'processing'].includes(item.status));

  // Collect all unique tags from documents
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    documents.forEach((doc) => doc.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [documents]);

  // Count by file type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach((doc) => {
      counts[doc.file_type] = (counts[doc.file_type] || 0) + 1;
    });
    return counts;
  }, [documents]);

  const hasAnyFilter = filterText || filterType || filterTag;

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (filterType && doc.file_type !== filterType) return false;
      if (filterTag && !(doc.tags || []).includes(filterTag)) return false;
      if (filterText) {
        const q = filterText.toLowerCase();
        const nameMatch = doc.file_name.toLowerCase().includes(q);
        const tagMatch = (doc.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!nameMatch && !tagMatch) return false;
      }
      return true;
    });
  }, [documents, filterType, filterTag, filterText]);

  // Reset page when filters change
  const setFilterTextAndReset = (v: string) => { setFilterText(v); setPage(1); };
  const setFilterTypeAndReset = (v: string | null) => { setFilterType(v); setPage(1); };
  const setFilterTagAndReset = (v: string | null) => { setFilterTag(v); setPage(1); };

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));
  const pagedDocuments = filteredDocuments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const clearFilters = () => {
    setFilterText('');
    setFilterType(null);
    setFilterTag(null);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <Card className="overflow-hidden">
          <CardContent className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ScanText className="h-8 w-8 text-white" />
                <div>
                  <h1 className="text-xl font-bold text-white">
                    OCR จัดเก็บเอกสาร
                  </h1>
                  <p className="text-blue-100 text-sm">
                    อัปโหลดเอกสาร ดึงข้อความด้วย Gemini 3 Flash
                  </p>
                </div>
              </div>
              <Link to="/ocr-search">
                <Button variant="secondary" size="sm" className="gap-2">
                  <Search className="h-4 w-4" />
                  ค้นหาเอกสาร
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Upload */}
        <OcrUploadCard onUpload={addToQueue} disabled={false} />

        {/* Queue + Processing */}
        {queue.length > 0 && (
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-sm font-medium">
                  คิวประมวลผล ({queue.filter((q) => q.status === 'done').length}/{queue.length})
                </h3>
              </div>

              {queue.map((item, i) => (
                <div
                  key={`${item.file.name}-${i}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50"
                >
                  {item.status === 'registering' && (
                    <Loader2 className="h-4 w-4 text-amber-500 animate-spin shrink-0" />
                  )}
                  {item.status === 'waiting' && (
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  {item.status === 'processing' && (
                    <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
                  )}
                  {item.status === 'done' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                  {item.status === 'error' && (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.status === 'registering' && 'กำลังลงทะเบียน...'}
                      {item.status === 'waiting' && 'รอคิว'}
                      {item.status === 'processing' && 'กำลังประมวลผล...'}
                      {item.status === 'done' && 'สำเร็จ'}
                      {item.status === 'error' && (item.error || 'เกิดข้อผิดพลาด')}
                    </p>
                  </div>

                  <span className="text-xs text-muted-foreground shrink-0">
                    #{i + 1}
                  </span>
                </div>
              ))}

              {/* Current processing progress */}
              {processing && isProcessing && (
                <div className="pt-2">
                  <OcrProcessingProgress state={processing} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Retry processing progress (no queue, but processing is active) */}
        {processing && queue.length === 0 && (
          <OcrProcessingProgress state={processing} />
        )}

        {/* Document List */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileStack className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-sm font-medium text-muted-foreground">
              เอกสารทั้งหมด ({documents.length} รายการ)
            </h2>
          </div>

          {/* Filters */}
          {!loading && documents.length > 0 && (
            <div className="space-y-2 mb-4">
              {/* Search + clear */}
              <div className="flex items-center gap-2">
                <div className="flex items-center flex-1 gap-2 rounded-lg border bg-background px-3 py-1.5">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterTextAndReset(e.target.value)}
                    placeholder="กรองชื่อไฟล์หรือ tag..."
                    className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/60"
                  />
                  {filterText && (
                    <button onClick={() => setFilterTextAndReset('')} className="p-0.5 hover:bg-muted rounded">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
                {hasAnyFilter && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground shrink-0 gap-1">
                    <X className="h-3.5 w-3.5" />
                    ล้างตัวกรอง
                  </Button>
                )}
              </div>

              {/* File type chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                {fileTypeFilters.map(({ value, label, icon: TypeIcon, color }) => {
                  const count = typeCounts[value] || 0;
                  if (count === 0) return null;
                  const active = filterType === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setFilterTypeAndReset(active ? null : value)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted border-border'
                      }`}
                    >
                      <TypeIcon className={`h-3 w-3 ${active ? '' : color}`} />
                      {label}
                      <span className="opacity-60">({count})</span>
                    </button>
                  );
                })}

                {/* Tag chips */}
                {allTags.length > 0 && (
                  <>
                    <span className="text-muted-foreground/40 mx-0.5">|</span>
                    {allTags.slice(0, 10).map((tag) => {
                      const active = filterTag === tag;
                      return (
                        <button
                          key={tag}
                          onClick={() => setFilterTagAndReset(active ? null : tag)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors ${
                            active
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-muted border-border'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                    {allTags.length > 10 && (
                      <span className="text-xs text-muted-foreground">+{allTags.length - 10}</span>
                    )}
                  </>
                )}
              </div>

              {/* Active filter summary */}
              {hasAnyFilter && (
                <p className="text-xs text-muted-foreground">
                  แสดง {filteredDocuments.length} จาก {documents.length} รายการ
                </p>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                ยังไม่มีเอกสาร — อัปโหลดเอกสารเพื่อเริ่มต้น
              </CardContent>
            </Card>
          ) : filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                ไม่พบเอกสารที่ตรงกับตัวกรอง
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-3">
                {pagedDocuments.map((doc) => {
                  const canManage =
                    permissions.isAdmin || doc.user_id === profile?.user_id;
                  return (
                    <OcrDocumentCard
                      key={doc.id}
                      document={doc}
                      onDelete={permissions.isAdmin ? deleteDocument : undefined}
                      onUpdateTags={updateTags}
                      onTogglePublic={canManage ? togglePublic : undefined}
                      onRetry={retryDocument}
                    />
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 px-2 text-xs"
                  >
                    ก่อนหน้า
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={p === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPage(p)}
                      className="h-8 w-8 p-0 text-xs"
                    >
                      {p}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-8 px-2 text-xs"
                  >
                    ถัดไป
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OcrUploadPage;
