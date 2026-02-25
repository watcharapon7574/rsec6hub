export type OcrFileType = 'pdf' | 'image' | 'word' | 'excel' | 'powerpoint';
export type OcrStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type SearchMode = 'hybrid' | 'fulltext' | 'semantic';

export interface OcrDocument {
  id: string;
  user_id: string;
  file_name: string;
  file_type: OcrFileType;
  file_size: number;
  file_url: string | null;
  storage_path: string | null;
  extracted_text: string | null;
  status: OcrStatus;
  error_message: string | null;
  page_count: number;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OcrPage {
  id: string;
  document_id: string;
  page_number: number;
  extracted_text: string | null;
  created_at: string;
}

export interface OcrSearchResult extends OcrDocument {
  fts_rank: number | null;
  semantic_rank: number | null;
  rrf_score: number;
}

export interface OcrChunkSearchResult {
  chunk_id: string;
  document_id: string;
  content: string;
  context_summary: string | null;
  page_number: number;
  chunk_index: number;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string | null;
  tags: string[] | null;
  created_at: string;
  fts_rank: number | null;
  semantic_rank: number | null;
  rrf_score: number;
}

export interface OcrProcessingState {
  step: 'uploading' | 'ocr' | 'embedding' | 'chunking' | 'saving' | 'done' | 'error';
  currentPage?: number;
  totalPages?: number;
  message: string;
}

export interface OcrSearchHistory {
  id: string;
  user_id: string;
  query: string;
  mode: SearchMode;
  result_count: number;
  created_at: string;
}
