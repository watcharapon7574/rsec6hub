import { supabase } from '@/integrations/supabase/client';
import type { OcrDocument, OcrPage, OcrSearchResult, OcrChunkSearchResult, OcrSearchHistory, SearchMode } from '@/types/ocr';

// --- File Upload ---

async function uploadFile(
  file: File,
  userId: string,
  documentId: string
): Promise<{ url: string; path: string }> {
  // Use documentId + extension as filename to avoid Thai/space encoding issues
  const ext = file.name.split('.').pop() || 'bin';
  const path = `ocr/${userId}/${documentId}.${ext}`;
  const { error } = await supabase.storage
    .from('documents')
    .upload(path, file, { upsert: true });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(path);

  return { url: urlData.publicUrl, path };
}

// --- CRUD for ocr_documents ---

async function createDocument(
  data: Pick<OcrDocument, 'user_id' | 'file_name' | 'file_type' | 'file_size'>
): Promise<OcrDocument> {
  const { data: doc, error } = await supabase
    .from('ocr_documents')
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`Create document failed: ${error.message}`);
  return doc as OcrDocument;
}

async function updateDocument(
  id: string,
  data: Partial<OcrDocument>
): Promise<void> {
  const { error } = await supabase
    .from('ocr_documents')
    .update({ ...data, updated_at: new Date().toISOString() } as any)
    .eq('id', id);

  if (error) throw new Error(`Update document failed: ${error.message}`);
}

async function updateDocumentWithEmbedding(
  id: string,
  extractedText: string,
  embedding: number[],
  pageCount: number,
  fileUrl: string | null,
  storagePath: string | null
): Promise<void> {
  // Update basic fields via JS client
  await supabase
    .from('ocr_documents')
    .update({
      page_count: pageCount,
      file_url: fileUrl,
      storage_path: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  // Update fts + embedding via RPC (JS client can't handle vector type)
  const embeddingStr = `[${embedding.join(',')}]`;
  const { error } = await supabase.rpc('ocr_update_document_vectors', {
    doc_id: id,
    doc_text: extractedText,
    doc_embedding: embeddingStr,
  });

  if (error) throw new Error(`Update vectors failed: ${error.message}`);
}

async function deleteDocument(
  id: string,
  deletedBy: string,
  deletedByName: string
): Promise<void> {
  // Get document info for logging before deleting
  const { data: doc } = await supabase
    .from('ocr_documents')
    .select('file_name, file_type, file_size, page_count, storage_path')
    .eq('id', id)
    .single();

  if (!doc) throw new Error('Document not found');

  // Log deletion for audit trail
  await supabase.from('ocr_delete_logs').insert({
    document_id: id,
    file_name: doc.file_name,
    file_type: doc.file_type,
    file_size: doc.file_size,
    page_count: doc.page_count || 0,
    deleted_by: deletedBy,
    deleted_by_name: deletedByName,
  });

  // Delete storage file
  if (doc.storage_path) {
    await supabase.storage.from('documents').remove([doc.storage_path]);
  }

  // Delete chunks, pages, then document
  await supabase.from('ocr_chunks').delete().eq('document_id', id);
  await supabase.from('ocr_pages').delete().eq('document_id', id);
  const { error } = await supabase
    .from('ocr_documents')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Delete document failed: ${error.message}`);
}

// Delete a storage file directly by path (for cleanup on failure)
async function deleteStorageFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from('documents').remove([storagePath]);
  if (error) console.warn(`Storage delete failed: ${error.message}`);
}

// Force delete a document + its pages without requiring storage_path lookup
// Used for cleanup when processing fails mid-way
async function forceDeleteDocument(id: string): Promise<void> {
  // Delete chunks + pages first (cascade may handle this, but be explicit)
  await supabase.from('ocr_chunks').delete().eq('document_id', id);
  await supabase.from('ocr_pages').delete().eq('document_id', id);
  await supabase.from('ocr_documents').delete().eq('id', id);
}

async function getAllDocuments(): Promise<OcrDocument[]> {
  const { data, error } = await supabase
    .from('ocr_documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Fetch documents failed: ${error.message}`);
  return (data || []) as OcrDocument[];
}

// --- CRUD for ocr_pages ---

async function createPage(data: {
  document_id: string;
  page_number: number;
  extracted_text: string;
}): Promise<OcrPage> {
  const { data: page, error } = await supabase
    .from('ocr_pages')
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`Create page failed: ${error.message}`);
  return page as OcrPage;
}

async function createPageWithEmbedding(data: {
  document_id: string;
  page_number: number;
  extracted_text: string;
  embedding: number[];
}): Promise<void> {
  // Insert page first
  const { data: page, error } = await supabase
    .from('ocr_pages')
    .insert({
      document_id: data.document_id,
      page_number: data.page_number,
      extracted_text: data.extracted_text,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Create page failed: ${error.message}`);

  // Update embedding + fts via RPC
  const embeddingStr = `[${data.embedding.join(',')}]`;
  await supabase.rpc('ocr_update_page_vectors', {
    page_id: page!.id,
    page_text: data.extracted_text,
    page_embedding: embeddingStr,
  });
}

async function getPagesByDocument(documentId: string): Promise<OcrPage[]> {
  const { data, error } = await supabase
    .from('ocr_pages')
    .select('*')
    .eq('document_id', documentId)
    .order('page_number', { ascending: true });

  if (error) throw new Error(`Fetch pages failed: ${error.message}`);
  return (data || []) as OcrPage[];
}

// --- Hybrid Search ---

async function hybridSearch(
  queryText: string,
  queryEmbedding: number[],
  matchCount = 10,
  fullTextWeight = 1.0,
  semanticWeight = 1.0
): Promise<OcrSearchResult[]> {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const { data, error } = await supabase.rpc('ocr_hybrid_search', {
    query_text: queryText,
    query_embedding: embeddingStr,
    match_count: matchCount,
    full_text_weight: fullTextWeight,
    semantic_weight: semanticWeight,
  });

  if (error) throw new Error(`Hybrid search failed: ${error.message}`);
  return (data || []) as OcrSearchResult[];
}

// --- Chunk CRUD ---

async function createChunkWithEmbedding(data: {
  document_id: string;
  content: string;
  content_segmented: string;
  context_summary: string;
  page_number: number;
  chunk_index: number;
  embedding: number[];
}): Promise<void> {
  const embeddingStr = `[${data.embedding.join(',')}]`;
  const { error } = await supabase.rpc('ocr_insert_chunk', {
    p_document_id: data.document_id,
    p_content: data.content,
    p_content_segmented: data.content_segmented,
    p_context_summary: data.context_summary,
    p_page_number: data.page_number,
    p_chunk_index: data.chunk_index,
    p_embedding: embeddingStr,
  });

  if (error) throw new Error(`Create chunk failed: ${error.message}`);
}

// --- Chunk Search (via Edge Function) ---

async function chunkSearch(
  query: string,
  mode: SearchMode,
  userId: string
): Promise<OcrChunkSearchResult[]> {
  const { data, error } = await supabase.functions.invoke('ocr-search', {
    body: { query, mode, user_id: userId },
  });

  if (error) throw new Error(`Search failed: ${error.message}`);
  if (!data?.results) return [];
  return data.results as OcrChunkSearchResult[];
}

// --- Search History ---

async function saveSearchHistory(
  userId: string,
  query: string,
  mode: SearchMode,
  resultCount: number
): Promise<void> {
  await supabase.from('ocr_search_history').insert({
    user_id: userId,
    query,
    mode,
    result_count: resultCount,
  });
}

async function getSearchHistory(userId: string, limit = 20): Promise<OcrSearchHistory[]> {
  const { data, error } = await supabase
    .from('ocr_search_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit * 3);

  if (error) throw new Error(`Fetch search history failed: ${error.message}`);

  // Dedup: keep only the latest entry per query+mode
  const seen = new Set<string>();
  const unique = ((data || []) as OcrSearchHistory[]).filter((h) => {
    const key = `${h.query}::${h.mode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, limit);
}

async function deleteSearchHistory(id: string): Promise<void> {
  const { error } = await supabase
    .from('ocr_search_history')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Delete history failed: ${error.message}`);
}

async function clearSearchHistory(userId: string): Promise<void> {
  const { error } = await supabase
    .from('ocr_search_history')
    .delete()
    .eq('user_id', userId);

  if (error) throw new Error(`Clear history failed: ${error.message}`);
}

// Download file from Storage bucket → Blob
async function downloadFile(storagePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from('documents')
    .download(storagePath);
  if (error || !data) throw new Error(`Download failed: ${error?.message}`);
  return data;
}

// Delete all chunks for a document (for re-generation on resume)
async function deleteChunksByDocument(docId: string): Promise<void> {
  const { error } = await supabase
    .from('ocr_chunks')
    .delete()
    .eq('document_id', docId);
  if (error) throw new Error(`Delete chunks failed: ${error.message}`);
}

// Get page numbers that already have chunks saved (for resume — skip re-chunking)
async function getChunkPageNumbers(docId: string): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('ocr_chunks')
    .select('page_number')
    .eq('document_id', docId);
  if (error) throw new Error(`Fetch chunk pages failed: ${error.message}`);
  const pages = new Set<number>();
  (data || []).forEach((row) => pages.add(row.page_number));
  return pages;
}

export const ocrService = {
  uploadFile,
  createDocument,
  updateDocument,
  updateDocumentWithEmbedding,
  deleteDocument,
  deleteStorageFile,
  forceDeleteDocument,
  getAllDocuments,
  createPage,
  createPageWithEmbedding,
  getPagesByDocument,
  createChunkWithEmbedding,
  hybridSearch,
  chunkSearch,
  saveSearchHistory,
  getSearchHistory,
  deleteSearchHistory,
  clearSearchHistory,
  downloadFile,
  deleteChunksByDocument,
  getChunkPageNumbers,
};
