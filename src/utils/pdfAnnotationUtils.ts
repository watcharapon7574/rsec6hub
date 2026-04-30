import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { supabase } from '@/integrations/supabase/client';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Render a PDF page to a canvas element
 */
export async function renderPdfPageToCanvas(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<{ width: number; height: number }> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas 2d context');

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  return { width: viewport.width, height: viewport.height };
}

/**
 * Load PDF from URL as ArrayBuffer (handles Supabase URLs)
 */
export async function loadPdfFromUrl(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
  return await response.arrayBuffer();
}

/**
 * Export annotated PDF:
 * For each page that has annotations, render the Fabric canvas as PNG
 * and embed it onto the PDF page using pdf-lib
 */
export async function exportAnnotatedPdf(
  originalPdfBytes: ArrayBuffer,
  pageCanvasImages: Map<number, string> // pageNumber -> dataURL (PNG)
): Promise<Blob> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const pages = pdfDoc.getPages();

  for (const [pageNumber, dataUrl] of pageCanvasImages) {
    const pageIndex = pageNumber - 1; // pages are 1-indexed
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    // Convert data URL to bytes
    const base64 = dataUrl.split(',')[1];
    const pngBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    const pngImage = await pdfDoc.embedPng(pngBytes);

    // Draw annotation overlay on top of existing content
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  const resultBytes = await pdfDoc.save();
  return new Blob([resultBytes], { type: 'application/pdf' });
}

/**
 * Upload annotated PDF to Supabase storage
 */
export async function uploadAnnotatedPdf(
  blob: Blob,
  documentId: string,
  userId: string
): Promise<string> {
  const fileName = `annotated_${documentId}_${Date.now()}.pdf`;
  const filePath = `memos/${userId}/${fileName}`;

  const { error } = await supabase.storage
    .from('documents')
    .upload(filePath, blob, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);

  return `${urlData.publicUrl}?t=${Date.now()}`;
}

/**
 * Extract storage file path from a Supabase public URL
 * e.g. "https://xxx.supabase.co/storage/v1/object/public/documents/memos/uid/file.pdf?t=123"
 * → "memos/uid/file.pdf"
 */
function extractStoragePath(url: string): string | null {
  try {
    const match = url.match(/\/storage\/v1\/object\/public\/documents\/(.+?)(\?|$)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Delete annotated PDF files from Supabase storage and clear DB columns.
 * Call this when annotations are no longer needed (e.g. author resubmits, or new rejection replaces old).
 * Supports both memos and doc_receive tables.
 */
/**
 * Merge annotation layers (PNG) จาก memo_annotation_layers ลง PDF
 * ดึง layers จาก DB → embed แต่ละ layer ลงหน้าที่ตรงกัน → return PDF blob
 */
export async function mergeAnnotationLayers(
  pdfUrl: string,
  memoId: string
): Promise<Blob | null> {
  try {
    // ดึง layers จาก DB
    const { data: layers, error } = await supabase
      .from('memo_annotation_layers')
      .select('*')
      .eq('memo_id', memoId)
      .order('created_at', { ascending: true });

    if (error || !layers || layers.length === 0) {
      return null;
    }

    // โหลด PDF ต้นฉบับ
    const pdfBytes = await loadPdfFromUrl(pdfUrl);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    // Embed แต่ละ layer ลงหน้าที่ตรงกัน
    for (const layer of layers) {
      const pageIndex = layer.page_number - 1;
      if (pageIndex < 0 || pageIndex >= pages.length) continue;

      const page = pages[pageIndex];
      const { width, height } = page.getSize();

      // Fetch PNG layer
      const response = await fetch(layer.layer_url);
      if (!response.ok) {
        console.warn(`⚠️ Failed to fetch layer: ${layer.layer_url}`);
        continue;
      }
      const pngBytes = new Uint8Array(await response.arrayBuffer());
      const pngImage = await pdfDoc.embedPng(pngBytes);

      page.drawImage(pngImage, { x: 0, y: 0, width, height });
    }

    const resultBytes = await pdfDoc.save();
    return new Blob([resultBytes], { type: 'application/pdf' });
  } catch (error) {
    console.error('Error merging annotation layers:', error);
    return null;
  }
}

export async function cleanupAnnotatedFiles(documentId: string): Promise<void> {
  try {
    // Try memos table first, then doc_receive
    let memo: any = null;
    let tableName = 'memos';

    const { data: memoData } = await (supabase as any)
      .from('memos')
      .select('annotated_pdf_path, annotated_attachment_paths')
      .eq('id', documentId)
      .maybeSingle();

    if (memoData) {
      memo = memoData;
    } else {
      const { data: docData } = await (supabase as any)
        .from('doc_receive')
        .select('annotated_pdf_path, annotated_attachment_paths')
        .eq('id', documentId)
        .maybeSingle();
      if (docData) {
        memo = docData;
        tableName = 'doc_receive';
      }
    }

    if (!memo) return;

    const filesToDelete: string[] = [];

    // Main annotated PDF
    if (memo.annotated_pdf_path) {
      const path = extractStoragePath(memo.annotated_pdf_path);
      if (path) filesToDelete.push(path);
    }

    // Annotated attachments
    if (memo.annotated_attachment_paths) {
      try {
        const paths: string[] = typeof memo.annotated_attachment_paths === 'string'
          ? JSON.parse(memo.annotated_attachment_paths)
          : memo.annotated_attachment_paths;
        if (Array.isArray(paths)) {
          for (const url of paths) {
            const path = extractStoragePath(url);
            if (path) filesToDelete.push(path);
          }
        }
      } catch { /* ignore parse error */ }
    }

    // Delete files from storage
    if (filesToDelete.length > 0) {
      const { error: removeError } = await supabase.storage
        .from('documents')
        .remove(filesToDelete);
      if (removeError) {
        console.warn('Failed to delete annotated files:', removeError.message);
      }
    }

    // Clear DB columns
    await (supabase as any)
      .from(tableName)
      .update({ annotated_pdf_path: null, annotated_attachment_paths: null })
      .eq('id', documentId);
  } catch (error) {
    console.warn('Error cleaning up annotated files:', error);
  }
}
