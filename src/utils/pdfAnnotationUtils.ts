import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/integrations/supabase/client';

// Set worker URL (same as PDFViewer.tsx)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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
 */
export async function cleanupAnnotatedFiles(memoId: string): Promise<void> {
  try {
    // Fetch current annotation paths from DB
    const { data: memo, error: fetchError } = await (supabase as any)
      .from('memos')
      .select('annotated_pdf_path, annotated_attachment_paths')
      .eq('id', memoId)
      .maybeSingle();

    if (fetchError || !memo) return;

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
      } else {
        console.log(`🗑️ Deleted ${filesToDelete.length} annotated file(s)`);
      }
    }

    // Clear DB columns
    await (supabase as any)
      .from('memos')
      .update({ annotated_pdf_path: null, annotated_attachment_paths: null })
      .eq('id', memoId);
  } catch (error) {
    console.warn('Error cleaning up annotated files:', error);
  }
}
