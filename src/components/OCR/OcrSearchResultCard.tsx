import { useState } from 'react';
import {
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Presentation,
  ChevronDown,
  ChevronUp,
  Eye,
  Download,
} from 'lucide-react';
import { highlightText } from '@/lib/highlightText';
import type { OcrChunkSearchResult } from '@/types/ocr';

interface OcrSearchResultCardProps {
  result: OcrChunkSearchResult;
  query: string;
}

const fileTypeIcons: Record<string, { icon: typeof FileText; color: string }> = {
  pdf: { icon: FileText, color: 'text-red-500' },
  image: { icon: Image, color: 'text-green-500' },
  word: { icon: File, color: 'text-blue-500' },
  excel: { icon: FileSpreadsheet, color: 'text-emerald-500' },
  powerpoint: { icon: Presentation, color: 'text-orange-500' },
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const OcrSearchResultCard = ({ result, query }: OcrSearchResultCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const { icon: Icon, color } = fileTypeIcons[result.file_type] || fileTypeIcons.pdf;

  const snippet = result.content
    ? result.content.substring(0, 300) + (result.content.length > 300 ? '...' : '')
    : null;

  return (
    <div
      className="p-4 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer"
      onClick={() => result.content && setExpanded(!expanded)}
    >
      {/* Title row */}
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-5 w-5 shrink-0 ${color}`} />
        <h3 className="text-base font-medium text-foreground truncate flex-1">
          {result.file_name}
        </h3>
        <span className="text-xs text-muted-foreground shrink-0">
          หน้า {result.page_number}
        </span>
        {result.content && (
          expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Context summary */}
      {result.context_summary && (
        <p className="text-xs text-muted-foreground italic ml-7 mb-1">
          {result.context_summary}
        </p>
      )}

      {/* Snippet */}
      {snippet && !expanded && (
        <p className="text-sm text-foreground/70 ml-7 mb-1 line-clamp-2">
          {highlightText(snippet, query)}
        </p>
      )}

      {/* Metadata row */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 ml-7">
        <span>{formatSize(result.file_size)}</span>
        <span>&middot;</span>
        <span>{formatDate(result.created_at)}</span>
        {result.file_url && (
          <>
            <span>&middot;</span>
            {['pdf', 'image'].includes(result.file_type) && (
              <button
                onClick={(e) => { e.stopPropagation(); window.open(result.file_url!, '_blank'); }}
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                <Eye className="h-3 w-3" /> ดูไฟล์
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const a = document.createElement('a');
                a.href = result.file_url!;
                a.download = result.file_name;
                a.click();
              }}
              className="text-primary hover:underline inline-flex items-center gap-0.5"
            >
              <Download className="h-3 w-3" /> ดาวน์โหลด
            </button>
          </>
        )}
      </div>

      {/* Tags */}
      {result.tags && result.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 ml-7 mb-1">
          {result.tags.map((tag) => (
            <span key={tag} className="text-xs bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300 font-medium">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Full chunk text — hidden by default, expand to view */}
      {expanded && result.content && (
        <pre className="text-sm text-foreground/80 whitespace-pre-wrap bg-muted p-3 rounded max-h-96 overflow-y-auto ml-7 mt-1">
          {highlightText(result.content, query)}
        </pre>
      )}

      {/* Rank indicators */}
      {(result.fts_rank || result.semantic_rank) && (
        <div className="flex items-center gap-3 mt-2 ml-7">
          {result.fts_rank && (
            <span className="text-xs text-blue-600 dark:text-blue-400">
              คำค้น #{result.fts_rank}
            </span>
          )}
          {result.semantic_rank && (
            <span className="text-xs text-purple-600 dark:text-purple-400">
              ความหมาย #{result.semantic_rank}
            </span>
          )}
          <span className="text-xs text-muted-foreground/60">
            {result.rrf_score.toFixed(4)}
          </span>
        </div>
      )}
    </div>
  );
};

export default OcrSearchResultCard;
