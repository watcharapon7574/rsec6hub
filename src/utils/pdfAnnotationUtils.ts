import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { supabase } from '@/integrations/supabase/client';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Bucket `documents` hard limit is 200 MB; cap at 180 MB so we fail in code
// with a nice message instead of getting a generic 413 from storage.
export const MAX_ANNOTATED_PDF_MB = 180;

export class PdfTooLargeError extends Error {
  constructor(public sizeMB: number, public limitMB: number = MAX_ANNOTATED_PDF_MB) {
    super(`PDF size ${sizeMB.toFixed(1)} MB exceeds limit ${limitMB} MB`);
    this.name = 'PdfTooLargeError';
  }
}

// Downscale (if wider than maxWidth) and re-encode a PNG. Annotation overlays
// from Fabric.js often arrive oversampled and uncompressed — re-encoding through
// a canvas typically shrinks them substantially even at scale=1.
async function compressPngBytes(pngBytes: Uint8Array, maxWidth = 1500): Promise<Uint8Array> {
  const blob = new Blob([pngBytes], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Failed to decode PNG for compression'));
      i.src = url;
    });

    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return pngBytes;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const compressedBlob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/png')
    );
    if (!compressedBlob) return pngBytes;
    const compressedBytes = new Uint8Array(await compressedBlob.arrayBuffer());

    return compressedBytes.byteLength < pngBytes.byteLength ? compressedBytes : pngBytes;
  } catch (err) {
    console.warn('compressPngBytes failed, embedding original:', err);
    return pngBytes;
  } finally {
    URL.revokeObjectURL(url);
  }
}

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

    // Convert data URL to bytes, then compress to keep annotated PDF size bounded
    const base64 = dataUrl.split(',')[1];
    const rawBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const pngBytes = await compressPngBytes(rawBytes);

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
  const sizeMB = blob.size / 1024 / 1024;
  if (sizeMB > MAX_ANNOTATED_PDF_MB) {
    throw new PdfTooLargeError(sizeMB);
  }

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
      const rawBytes = new Uint8Array(await response.arrayBuffer());
      const pngBytes = await compressPngBytes(rawBytes);
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
