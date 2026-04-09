import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Presentation,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Eye,
  Download,
  X,
  Plus,
  Save,
  Tag,
  RotateCcw,
  Globe,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { OcrDocument, OcrSearchResult } from '@/types/ocr';

interface OcrDocumentCardProps {
  document: OcrDocument | OcrSearchResult;
  onDelete?: (id: string) => void;
  onUpdateTags?: (id: string, tags: string[]) => void;
  onTogglePublic?: (id: string, isPublic: boolean) => void;
  onRetry?: (id: string) => void;
  isSearchResult?: boolean;
}

const fileTypeIcons: Record<string, { icon: typeof FileText; color: string }> = {
  pdf: { icon: FileText, color: 'text-red-500' },
  image: { icon: Image, color: 'text-green-500' },
  word: { icon: File, color: 'text-blue-500' },
  excel: { icon: FileSpreadsheet, color: 'text-emerald-500' },
  powerpoint: { icon: Presentation, color: 'text-orange-500' },
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'รอดำเนินการ', variant: 'outline' },
  processing: { label: 'กำลังประมวลผล', variant: 'secondary' },
  completed: { label: 'สำเร็จ', variant: 'default' },
  failed: { label: 'ล้มเหลว', variant: 'destructive' },
};

const OcrDocumentCard = ({ document: doc, onDelete, onUpdateTags, onTogglePublic, onRetry, isSearchResult }: OcrDocumentCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [localTags, setLocalTags] = useState<string[]>(doc.tags || []);
  const [newTag, setNewTag] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingTags) setLocalTags(doc.tags || []);
  }, [doc.tags, editingTags]);

  const { icon: Icon, color } = fileTypeIcons[doc.file_type] || fileTypeIcons.pdf;
  const status = statusConfig[doc.status] || statusConfig.pending;
  const searchResult = isSearchResult ? (doc as OcrSearchResult) : null;

  const textSnippet = doc.extracted_text
    ? doc.extracted_text.substring(0, 200) + (doc.extracted_text.length > 200 ? '...' : '')
    : null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleView = () => {
    if (doc.file_url) {
      window.open(doc.file_url, '_blank');
    }
  };

  const handleDownload = () => {
    if (doc.file_url) {
      const a = document.createElement('a');
      a.href = doc.file_url;
      a.download = doc.file_name;
      a.click();
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <Icon className={`h-6 w-6 ${color}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-sm truncate">{doc.file_name}</h3>
              <Badge variant={status.variant} className="shrink-0 text-xs">
                {doc.status === 'processing' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {status.label}
              </Badge>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span>{formatSize(doc.file_size)}</span>
              {doc.page_count > 0 && <span>{doc.page_count} หน้า</span>}
              <span>{formatDate(doc.created_at)}</span>
              {onTogglePublic && (
                <button
                  onClick={() => onTogglePublic(doc.id, !doc.is_public)}
                  className={`inline-flex items-center gap-0.5 transition-colors ${
                    doc.is_public
                      ? 'text-green-600 hover:text-green-700'
                      : 'text-muted-foreground/50 hover:text-primary'
                  }`}
                  title={doc.is_public ? 'เผยแพร่สาธารณะ (คลิกเพื่อปิด)' : 'ไม่เผยแพร่ (คลิกเพื่อเปิด)'}
                >
                  <Globe className="h-3 w-3" />
                  <span>{doc.is_public ? 'สาธารณะ' : 'ส่วนตัว'}</span>
                </button>
              )}
            </div>

            {doc.status === 'failed' && onRetry && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                ประมวลผลไม่สำเร็จ — กด <RotateCcw className="h-3 w-3 inline" /> เพื่อลองใหม่
              </p>
            )}

            {/* Tags: view mode */}
            {!editingTags && (
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                {doc.tags && doc.tags.length > 0 ? (
                  doc.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs font-normal">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground/50">ไม่มี tag</span>
                )}
                {onUpdateTags && (
                  <button
                    onClick={() => {
                      setLocalTags(doc.tags || []);
                      setEditingTags(true);
                      setNewTag('');
                      setEditingIndex(null);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors ml-1"
                  >
                    <Tag className="h-3 w-3" />
                    <span>แก้ไข</span>
                  </button>
                )}
              </div>
            )}

            {/* Tags: edit mode */}
            {editingTags && (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {localTags.map((tag, i) =>
                    editingIndex === i ? (
                      <div key={i} className="inline-flex items-center">
                        <input
                          ref={editInputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const trimmed = editValue.trim();
                              if (trimmed) {
                                setLocalTags((prev) => prev.map((t, idx) => (idx === editingIndex ? trimmed : t)));
                              }
                              setEditingIndex(null);
                            }
                            if (e.key === 'Escape') { setEditingIndex(null); }
                          }}
                          onBlur={() => {
                            const trimmed = editValue.trim();
                            if (trimmed) {
                              setLocalTags((prev) => prev.map((t, idx) => (idx === editingIndex ? trimmed : t)));
                            }
                            setEditingIndex(null);
                          }}
                          className="h-6 px-1.5 text-xs border rounded bg-background w-24 outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    ) : (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-xs font-normal gap-1 pr-1 cursor-pointer hover:bg-muted"
                      >
                        <span onClick={() => { setEditingIndex(i); setEditValue(localTags[i]); setTimeout(() => editInputRef.current?.focus(), 50); }}>{tag}</span>
                        <button
                          onClick={() => setLocalTags((prev) => prev.filter((_, idx) => idx !== i))}
                          className="hover:text-red-500 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={inputRef}
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = newTag.trim();
                        if (trimmed && !localTags.includes(trimmed)) {
                          setLocalTags((prev) => [...prev, trimmed]);
                          setNewTag('');
                        }
                      }
                      if (e.key === 'Escape') {
                        setEditingTags(false);
                        setLocalTags(doc.tags || []);
                        setNewTag('');
                        setEditingIndex(null);
                      }
                    }}
                    placeholder="พิมพ์ tag แล้วกด Enter"
                    className="h-7 px-2 text-xs border rounded bg-background flex-1 min-w-0 outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button size="sm" variant="ghost" onClick={() => {
                    const trimmed = newTag.trim();
                    if (trimmed && !localTags.includes(trimmed)) {
                      setLocalTags((prev) => [...prev, trimmed]);
                      setNewTag('');
                    }
                  }} className="h-7 w-7 p-0">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    const cleaned = localTags.filter((t) => t.trim().length > 0);
                    setEditingTags(false);
                    setEditingIndex(null);
                    onUpdateTags?.(doc.id, cleaned);
                  }} className="h-7 w-7 p-0 text-green-600 hover:text-green-700">
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    setEditingTags(false);
                    setLocalTags(doc.tags || []);
                    setNewTag('');
                    setEditingIndex(null);
                  }} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {searchResult && (
              <div className="flex items-center gap-2 mt-1.5">
                {searchResult.fts_rank && (
                  <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950">
                    คำค้น #{searchResult.fts_rank}
                  </Badge>
                )}
                {searchResult.semantic_rank && (
                  <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950">
                    ความหมาย #{searchResult.semantic_rank}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  Score: {searchResult.rrf_score.toFixed(4)}
                </span>
              </div>
            )}

            {textSnippet && !expanded && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{textSnippet}</p>
            )}

            {expanded && doc.extracted_text && (
              <pre className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap bg-muted p-3 rounded max-h-96 overflow-y-auto">
                {doc.extracted_text}
              </pre>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {doc.file_url && (
              <>
                {['pdf', 'image'].includes(doc.file_type) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleView}
                    title="เปิดดูไฟล์"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDownload}
                  title="ดาวน์โหลด"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </>
            )}
            {doc.extracted_text && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
            {onRetry && doc.status === 'failed' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRetry(doc.id)}
                title="ลองใหม่"
                className="text-blue-500 hover:text-blue-700"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>ยืนยันการลบเอกสาร</AlertDialogTitle>
                    <AlertDialogDescription>
                      ต้องการลบ "{doc.file_name}" หรือไม่?
                      <br />
                      ข้อมูลทั้งหมดที่เกี่ยวข้องจะถูกลบถาวรและไม่สามารถกู้คืนได้
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(doc.id)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      ลบเอกสาร
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OcrDocumentCard;
