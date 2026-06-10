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
 * - Pages WITH overlay → flatten to JPEG (drops accumulated PNG embeds, O(1) size)
 * - Pages WITHOUT overlay → copyPages (keep vector, searchable text intact)
 *
 * Solves the O(N) bloat from stacked PNG overlays across signers without
 * sacrificing text on pages no one drew on.
 */
export async function exportAnnotatedPdf(
  originalPdfBytes: ArrayBuffer,
  pageCanvasImages: Map<number, string> // pageNumber -> dataURL (PNG)
): Promise<Blob> {
  const RENDER_SCALE = 2.0; // ≈ 144 DPI — readable for govt forms, small enough on mobile
  const MAX_CANVAS_DIM = 4000; // iOS Safari starts to fail above ~4096 px
  const JPEG_QUALITY = 0.85;

  const sourcePdf = await PDFDocument.load(originalPdfBytes);
  const sourcePages = sourcePdf.getPages();
  const newPdf = await PDFDocument.create();

  // Skip pdf.js entirely when nothing to flatten — just copy everything
  if (pageCanvasImages.size === 0) {
    const indices = sourcePages.map((_, i) => i);
    const copied = await newPdf.copyPages(sourcePdf, indices);
    copied.forEach(p => newPdf.addPage(p));
    const bytes = await newPdf.save();
    return new Blob([bytes], { type: 'application/pdf' });
  }

  // Pass a copy to pdf.js because it may mutate/transfer the buffer
  const pdfJsDoc = await pdfjsLib.getDocument({
    data: new Uint8Array(originalPdfBytes.slice(0)),
  }).promise;

  try {
    for (let i = 0; i < pdfJsDoc.numPages; i++) {
      const pageNum = i + 1;
      const overlayDataUrl = pageCanvasImages.get(pageNum);

      if (!overlayDataUrl) {
        // No overlay → keep page as-is (vector preserved, text searchable)
        const [copied] = await newPdf.copyPages(sourcePdf, [i]);
        newPdf.addPage(copied);
        continue;
      }

      const { width: ptW, height: ptH } = sourcePages[i].getSize();
      const effectiveScale = Math.min(RENDER_SCALE, MAX_CANVAS_DIM / Math.max(ptW, ptH));

      const canvas = document.createElement('canvas');
      await renderPdfPageToCanvas(pdfJsDoc, pageNum, canvas, effectiveScale);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = () => reject(new Error('Failed to decode annotation overlay'));
          im.src = overlayDataUrl;
        });
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      const jpegBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          b => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
          'image/jpeg',
          JPEG_QUALITY
        );
      });
      const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());

      const jpegImage = await newPdf.embedJpg(jpegBytes);
      const newPage = newPdf.addPage([ptW, ptH]);
      newPage.drawImage(jpegImage, { x: 0, y: 0, width: ptW, height: ptH });

      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    await pdfJsDoc.destroy();
  }

  const resultBytes = await newPdf.save();
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

/**
 * Reliably delete a memo's annotation OVERLAY layers — both the storage PNGs and
 * the `memo_annotation_layers` rows. Pass `userId` to scope to one signer, or omit
 * to clear every signer's layers for the memo (use on reject / revise).
 *
 * Swallows its own errors (logs them) so callers can safely `await` it without it
 * ever throwing and breaking an already-successful approve/reject.
 *
 * WHY THIS EXISTS: the old cleanup was a fire-and-forget `.delete()` placed right
 * before `navigate()`, so the in-flight request was cancelled on unmount and almost
 * never completed — leaking orphan layers. A leaked layer makes `hasCompletedAnnotation`
 * restore to `true` (mere row-existence) and then gets silently RE-BAKED onto the next
 * sign, so a signer who never drew anything ends up with someone's old annotation burned
 * into their document. Keeping layers reliably deleted means "a layer exists" can only
 * mean "drawn this round, not yet baked".
 */
export async function deleteAnnotationLayers(memoId: string, userId?: string): Promise<void> {
  try {
    let sel = supabase.from('memo_annotation_layers').select('layer_url').eq('memo_id', memoId);
    if (userId) sel = sel.eq('user_id', userId);
    const { data: layers, error } = await sel;
    if (error || !layers || layers.length === 0) return;

    // Remove the overlay PNGs from storage first
    const paths = layers
      .map((l: any) => extractStoragePath(l.layer_url))
      .filter((p: string | null): p is string => !!p);
    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage.from('documents').remove(paths);
      if (removeError) console.warn('deleteAnnotationLayers: storage remove failed:', removeError.message);
    }

    // Then drop the rows
    let del = supabase.from('memo_annotation_layers').delete().eq('memo_id', memoId);
    if (userId) del = del.eq('user_id', userId);
    const { error: delError } = await del;
    if (delError) console.warn('deleteAnnotationLayers: row delete failed:', delError.message);
  } catch (e) {
    console.error('deleteAnnotationLayers failed:', e);
  }
}
