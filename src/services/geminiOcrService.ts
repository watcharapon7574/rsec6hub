import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/integrations/supabase/client';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// --- Vertex AI via Edge Function proxy ---

const OCR_MODELS = ['gemini-2.5-flash'];
const EMBEDDING_MODEL = 'gemini-embedding-001';
const CONTEXT_MODEL = 'gemini-2.0-flash-lite';
const PAGE_CONCURRENCY = 5;
const CHUNK_CONCURRENCY = 5;

// --- Concurrency pool ---

async function runPool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      results[idx] = await tasks[idx]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker())
  );
  return results;
}

async function callProxy(model: string, method: string, body: any): Promise<any> {
  const { data, error } = await supabase.functions.invoke('gemini-proxy', {
    body: { model, method, body },
  });

  if (error) throw new Error(`Proxy error: ${error.message}`);
  if (!data.ok) {
    const err: any = new Error(typeof data.body === 'string' ? data.body : JSON.stringify(data.body));
    err.status = data.status;
    throw err;
  }
  return data.body;
}

async function callGenerate(model: string, parts: any[]): Promise<string> {
  const data = await callProxy(model, 'generateContent', {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callEmbed(
  model: string,
  text: string,
  dimensions: number,
  taskType: string = 'RETRIEVAL_DOCUMENT'
): Promise<number[]> {
  const data = await callProxy(model, 'predict', {
    instances: [{ content: text, task_type: taskType }],
    parameters: { outputDimensionality: dimensions },
  });
  return data.predictions[0].embeddings.values;
}

// --- Retry with fallback models ---

async function withRetry<T>(
  fn: (model: string) => Promise<T>,
  models: string[] = OCR_MODELS,
  maxRetries = 2
): Promise<T> {
  for (const model of models) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(model);
      } catch (err: any) {
        const status = err?.status || err?.httpStatusCode;
        const msg = err?.message || '';
        const is429 = status === 429 || msg.includes('429') || msg.includes('quota');
        const is503 = status === 503 || msg.includes('503');
        const is504 = status === 504 || msg.includes('504') || msg.includes('timed out') || msg.includes('timeout');
        const isNetworkError = msg.includes('Failed to send') || msg.includes('fetch') || msg.includes('network');
        const isEdgeFnCrash = msg.includes('non-2xx') || msg.includes('546');
        const isRetryable = is503 || is504 || isNetworkError || isEdgeFnCrash || msg.includes('overloaded') || msg.includes('high demand');

        // 429 rate limit → skip to next model immediately
        if (is429) break;

        if (isRetryable && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        if (isRetryable) break; // try next model
        throw err; // non-retryable error
      }
    }
  }
  throw new Error('All Gemini models are unavailable. Please try again later.');
}

// --- OCR via Gemini Vision ---

async function extractTextFromImage(base64Data: string, mimeType: string): Promise<string> {
  return withRetry(async (modelName) => {
    return callGenerate(modelName, [
      { inline_data: { data: base64Data, mime_type: mimeType } },
      { text: `Extract ALL text from this document image, preserving the original layout and language.

Additionally, describe any visual elements found in the document:
- Images/Photos: Describe what is shown
- Charts/Graphs: Describe the type, axes, and key data points
- Tables: Extract the table data preserving rows and columns
- Logos/Stamps/Signatures: Describe their appearance and any text on them
- Diagrams/Flowcharts: Describe the structure and content

Format visual descriptions in brackets like: [ภาพ: description] [กราฟ: description] [ตาราง: data] [โลโก้: description]

Return the extracted text with visual descriptions inline where they appear in the document.` },
    ]);
  });
}

async function renderPdfPageToBase64(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  await page.render({ canvasContext: ctx, viewport }).promise;

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  canvas.remove();
  return dataUrl.split(',')[1]; // strip "data:image/jpeg;base64,"
}

async function loadPdf(pdfData: ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  const copy = pdfData.slice(0);
  return pdfjsLib.getDocument({ data: copy }).promise;
}

// --- Embedding ---

async function generateEmbedding(
  text: string,
  taskType: string = 'RETRIEVAL_DOCUMENT'
): Promise<number[]> {
  return withRetry(
    async () => callEmbed(EMBEDDING_MODEL, text, 768, taskType),
    [EMBEDDING_MODEL]
  );
}

// --- Thai Segmentation ---

function segmentThai(text: string): string {
  const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
  const segments = segmenter.segment(text);
  return Array.from(segments)
    .filter((s) => s.isWordLike)
    .map((s) => s.segment)
    .join(' ');
}

// --- Chunking ---

interface RawChunk {
  content: string;
  pageNumber: number;
  chunkIndex: number;
}

function chunkPageText(
  text: string,
  pageNumber: number,
  maxChars = 2000,
  overlap = 200
): RawChunk[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) {
    return [{ content: trimmed, pageNumber, chunkIndex: 0 }];
  }

  const chunks: RawChunk[] = [];
  let start = 0;
  let chunkIndex = 0;
  const minChunkSize = 100;

  while (start < trimmed.length) {
    // Skip if remaining text is too small — merge into last chunk
    if (trimmed.length - start < minChunkSize && chunks.length > 0) {
      break;
    }

    let end = start + maxChars;

    if (end < trimmed.length) {
      // Try to break at paragraph boundary
      const lastPara = trimmed.lastIndexOf('\n\n', end);
      if (lastPara > start + maxChars / 2) {
        end = lastPara;
      } else {
        // Try newline boundary
        const lastNl = trimmed.lastIndexOf('\n', end);
        if (lastNl > start + maxChars / 2) {
          end = lastNl;
        }
      }
    } else {
      end = trimmed.length;
    }

    const content = trimmed.substring(start, end).trim();
    if (content && content.length >= minChunkSize) {
      chunks.push({ content, pageNumber, chunkIndex });
      chunkIndex++;
    } else if (content && chunks.length > 0) {
      // Append small trailing content to last chunk
      chunks[chunks.length - 1].content += '\n' + content;
      break;
    } else if (content) {
      // First chunk even if small
      chunks.push({ content, pageNumber, chunkIndex });
      chunkIndex++;
    }

    // Advance with overlap, but ensure forward progress
    const nextStart = end - overlap;
    start = Math.max(start + minChunkSize, nextStart);
  }

  return chunks;
}

// --- Context Summary ---

async function generateContextSummary(
  fullText: string,
  chunkContent: string
): Promise<string> {
  try {
    return await withRetry(
      async (modelName) => {
        const raw = await callGenerate(modelName, [
          {
            text: `จากเอกสารนี้ (ตัดมาบางส่วน) และข้อความ chunk ที่ให้ ให้เขียนสรุปบริบท 1-2 ประโยค ว่า chunk นี้อยู่ในส่วนไหนของเอกสาร

เอกสาร:
${fullText.substring(0, 2000)}

Chunk:
${chunkContent.substring(0, 500)}

ตอบเฉพาะสรุปบริบทภาษาไทย สั้นๆ ไม่ต้องอธิบายเพิ่ม`,
          },
        ]);
        return raw.trim();
      },
      [CONTEXT_MODEL]
    );
  } catch {
    return '';
  }
}

// --- File type detection ---

export type DetectedFileType = 'pdf' | 'image' | 'word' | 'excel' | 'powerpoint';

function detectFileType(file: File): DetectedFileType {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const mime = file.type;

  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  if (mime.includes('wordprocessingml') || mime.includes('msword') || ext === 'docx' || ext === 'doc') return 'word';
  if (mime.includes('spreadsheetml') || mime.includes('ms-excel') || ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'excel';
  if (mime.includes('presentationml') || mime.includes('ms-powerpoint') || ext === 'pptx' || ext === 'ppt') return 'powerpoint';
  return 'image'; // fallback: try vision OCR
}

function detectFileTypeFromBlob(blob: Blob): DetectedFileType {
  const mime = blob.type;
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.includes('wordprocessingml') || mime.includes('msword')) return 'word';
  if (mime.includes('spreadsheetml') || mime.includes('ms-excel')) return 'excel';
  if (mime.includes('presentationml') || mime.includes('ms-powerpoint')) return 'powerpoint';
  return 'image'; // fallback
}

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// --- Text extraction for Office docs (without vision) ---

async function extractTextFromDocx(file: File | Blob): Promise<string> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file);
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) return '';
  return docXml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

async function extractTextFromXlsx(file: File | Blob): Promise<string> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const buffer = await fileToArrayBuffer(file);
  await workbook.xlsx.load(buffer);

  const lines: string[] = [];
  workbook.eachSheet((sheet) => {
    lines.push(`[${sheet.name}]`);
    sheet.eachRow((row) => {
      const cells = (row.values as unknown[])?.slice(1) || [];
      lines.push(cells.map((c) => (c != null ? String(c) : '')).join('\t'));
    });
    lines.push('');
  });
  return lines.join('\n').trim();
}

// --- Auto-tagging via Gemini ---

async function generateTags(text: string): Promise<string[]> {
  try {
    return await withRetry(async (modelName) => {
      const raw = await callGenerate(modelName, [
        { text: `วิเคราะห์เอกสารนี้แล้วสร้าง tags ภาษาไทย 3-6 คำ ที่อธิบายประเภทและเนื้อหาหลักของเอกสาร
ตอบเฉพาะ tags คั่นด้วยเครื่องหมายจุลภาค (,) ไม่ต้องมีคำอธิบายอื่น
ตัวอย่าง: คำสั่ง,แต่งตั้ง,คณะกรรมการ,โครงการ

เอกสาร:
${text.substring(0, 3000)}` },
      ]);
      return raw
        .trim()
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length < 50)
        .slice(0, 6);
    });
  } catch {
    return []; // fail silently — tags are optional
  }
}

// --- Auto file naming via Gemini ---

async function generateFileName(text: string): Promise<string> {
  try {
    return await withRetry(async (modelName) => {
      const raw = await callGenerate(modelName, [
        { text: `อ่านเนื้อหาเอกสารนี้แล้วตั้งชื่อไฟล์ภาษาไทยสั้นๆ ที่สื่อความหมาย
ตอบเฉพาะชื่อไฟล์เท่านั้น ไม่ต้องมีนามสกุลไฟล์ ไม่ต้องมีคำอธิบาย
ชื่อควรสั้นกระชับ ไม่เกิน 80 ตัวอักษร
ตัวอย่าง: คำสั่งแต่งตั้งคณะกรรมการดำเนินงาน

เอกสาร:
${text.substring(0, 3000)}` },
      ]);
      const name = raw.trim().replace(/[\n\r]/g, '').substring(0, 80);
      return name || '';
    });
  } catch {
    return ''; // fail silently — use original filename
  }
}

// --- Main processing pipeline ---

export interface ProcessingCallbacks {
  onProgress: (step: string, currentPage?: number, totalPages?: number) => void;
  onPageComplete?: (page: PageResult) => Promise<void>;
  onChunkComplete?: (chunk: ChunkResult) => Promise<void>;
}

export interface PageResult {
  pageNumber: number;
  text: string;
  embedding: number[];
}

export interface ChunkResult {
  content: string;
  contentSegmented: string;
  contextSummary: string;
  pageNumber: number;
  chunkIndex: number;
  embedding: number[];
}

export interface ProcessingResult {
  fileType: DetectedFileType;
  pages: PageResult[];
  chunks: ChunkResult[];
  fullText: string;
  fullEmbedding: number[];
  tags: string[];
  suggestedFileName: string;
}

async function processDocument(
  file: File | Blob,
  callbacks?: ProcessingCallbacks,
  existingPages?: PageResult[],
  existingChunkPageNums?: Set<number>
): Promise<ProcessingResult> {
  const fileType = file instanceof File ? detectFileType(file) : detectFileTypeFromBlob(file);
  const pages: PageResult[] = [];
  const existingPageNums = new Set(existingPages?.map((p) => p.pageNumber) || []);
  let fullText = '';

  callbacks?.onProgress('ocr');

  if (fileType === 'pdf') {
    const arrayBuffer = await fileToArrayBuffer(file as File);
    const pdf = await loadPdf(arrayBuffer);
    const totalPages = pdf.numPages;

    // Collect existing pages + build tasks for new pages
    let ocrDone = 0;
    const pageTasks: (() => Promise<PageResult>)[] = [];

    for (let i = 1; i <= totalPages; i++) {
      if (existingPageNums.has(i)) {
        const existing = existingPages!.find((p) => p.pageNumber === i)!;
        pages.push(existing);
        ocrDone++;
        continue;
      }

      const pageNum = i;
      pageTasks.push(async () => {
        const base64 = await renderPdfPageToBase64(pdf, pageNum);
        const text = await extractTextFromImage(base64, 'image/jpeg');
        const embedding = await generateEmbedding(text);
        const page: PageResult = { pageNumber: pageNum, text, embedding };
        await callbacks?.onPageComplete?.(page);
        ocrDone++;
        callbacks?.onProgress('ocr', ocrDone, totalPages);
        return page;
      });
    }

    callbacks?.onProgress('ocr', ocrDone, totalPages);
    const newPages = await runPool(pageTasks, PAGE_CONCURRENCY);
    pages.push(...newPages);
    pages.sort((a, b) => a.pageNumber - b.pageNumber);
    fullText = pages.map((p) => p.text).join('\n\n');
  } else if (fileType === 'image') {
    if (existingPageNums.has(1)) {
      pages.push(existingPages!.find((p) => p.pageNumber === 1)!);
    } else {
      callbacks?.onProgress('ocr', 1, 1);
      const base64 = await fileToBase64(file as File);
      const mimeType = file.type || 'image/png';
      const text = await extractTextFromImage(base64, mimeType);
      const embedding = await generateEmbedding(text);
      const page = { pageNumber: 1, text, embedding };
      pages.push(page);
      await callbacks?.onPageComplete?.(page);
    }
    fullText = pages[0].text;
  } else if (fileType === 'word') {
    if (existingPageNums.has(1)) {
      pages.push(existingPages!.find((p) => p.pageNumber === 1)!);
    } else {
      callbacks?.onProgress('ocr', 1, 1);
      fullText = await extractTextFromDocx(file as File);
      const embedding = await generateEmbedding(fullText);
      const page = { pageNumber: 1, text: fullText, embedding };
      pages.push(page);
      await callbacks?.onPageComplete?.(page);
    }
    fullText = pages[0].text;
  } else if (fileType === 'excel') {
    if (existingPageNums.has(1)) {
      pages.push(existingPages!.find((p) => p.pageNumber === 1)!);
    } else {
      callbacks?.onProgress('ocr', 1, 1);
      fullText = await extractTextFromXlsx(file as File);
      const embedding = await generateEmbedding(fullText);
      const page = { pageNumber: 1, text: fullText, embedding };
      pages.push(page);
      await callbacks?.onPageComplete?.(page);
    }
    fullText = pages[0].text;
  } else {
    // powerpoint or unknown — try as image
    if (existingPageNums.has(1)) {
      pages.push(existingPages!.find((p) => p.pageNumber === 1)!);
    } else {
      callbacks?.onProgress('ocr', 1, 1);
      const base64 = await fileToBase64(file as File);
      const text = await extractTextFromImage(base64, file.type || 'application/octet-stream');
      const embedding = await generateEmbedding(text);
      const page = { pageNumber: 1, text, embedding };
      pages.push(page);
      await callbacks?.onPageComplete?.(page);
    }
    fullText = pages[0].text;
  }

  // --- Chunking step ---
  callbacks?.onProgress('chunking');
  const rawChunks: RawChunk[] = [];
  for (const page of pages) {
    // Skip chunking for pages that already have chunks saved (resume)
    if (existingChunkPageNums?.has(page.pageNumber)) continue;
    rawChunks.push(...chunkPageText(page.text, page.pageNumber));
  }

  let chunksDone = 0;
  const chunkTasks = rawChunks.map((rc) => async (): Promise<ChunkResult> => {
    const contentSegmented = segmentThai(rc.content);
    const [embedding, contextSummary] = await Promise.all([
      generateEmbedding(rc.content, 'RETRIEVAL_DOCUMENT'),
      generateContextSummary(fullText, rc.content),
    ]);

    const chunk: ChunkResult = {
      content: rc.content,
      contentSegmented,
      contextSummary,
      pageNumber: rc.pageNumber,
      chunkIndex: rc.chunkIndex,
      embedding,
    };
    await callbacks?.onChunkComplete?.(chunk);
    chunksDone++;
    callbacks?.onProgress('chunking', chunksDone, rawChunks.length);
    return chunk;
  });

  const chunks = await runPool(chunkTasks, CHUNK_CONCURRENCY);

  callbacks?.onProgress('embedding');
  const [fullEmbedding, tags, suggestedFileName] = await Promise.all([
    generateEmbedding(fullText, 'RETRIEVAL_DOCUMENT'),
    generateTags(fullText),
    generateFileName(fullText),
  ]);

  return { fileType, pages, chunks, fullText, fullEmbedding, tags, suggestedFileName };
}

export const geminiOcrService = {
  extractTextFromImage,
  generateEmbedding,
  generateTags,
  segmentThai,
  chunkPageText,
  processDocument,
  detectFileType,
};
