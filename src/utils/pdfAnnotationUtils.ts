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
