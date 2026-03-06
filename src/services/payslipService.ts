import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/integrations/supabase/client';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ==================== Types ====================

export interface PayslipItem {
  label: string;
  amount: number | null;
}

export interface PayslipData {
  name: string;
  position?: string;
  income_items: PayslipItem[];
  deduction_items: PayslipItem[];
  total_income: number;
  total_deductions: number;
  net_pay: number;
}

export interface MatchResult {
  profileId: string | null;
  score: number;
  matchType: 'id' | 'name_exact' | 'name_fuzzy' | 'none';
}

export interface PageOcrResult {
  left: PayslipData;
  right: PayslipData;
  raw_text?: string;
}

export interface PayslipBatch {
  id: string;
  uploaded_by: string;
  month: number;
  year: number;
  file_url: string;
  storage_path: string;
  page_count: number;
  total_records: number;
  matched_records: number;
  status: 'processing' | 'completed' | 'error';
  created_at: string;
  updated_at: string;
}

export interface Payslip {
  id: string;
  batch_id: string;
  profile_id: string | null;
  employee_name: string;
  employee_position?: string;
  page_number: number;
  half: 'left' | 'right';
  income_items: PayslipItem[];
  deduction_items: PayslipItem[];
  total_income: number;
  total_deductions: number;
  net_pay: number;
  raw_ocr_text?: string;
  created_at: string;
}

export interface PayslipWithBatch extends Payslip {
  batch: PayslipBatch;
}

export interface ProfileSummary {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  prefix?: string;
}

// ==================== Concurrency pool ====================

async function runPool<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

// ==================== Gemini proxy ====================

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
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
  });
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function withRetry<T>(fn: (model: string) => Promise<T>, models = ['gemini-2.5-flash'], maxRetries = 2): Promise<T> {
  for (const model of models) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(model);
      } catch (err: any) {
        const status = err?.status;
        const msg = err?.message || '';
        const is429 = status === 429 || msg.includes('429') || msg.includes('quota');
        const isRetryable = status === 503 || status === 504 || msg.includes('network') || msg.includes('timeout') || msg.includes('overloaded');
        if (is429) break;
        if (isRetryable && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        if (isRetryable) break;
        throw err;
      }
    }
  }
  throw new Error('Gemini models unavailable. Please try again later.');
}

// ==================== PDF utilities ====================

async function loadPdf(data: ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  return pdfjsLib.getDocument({ data: data.slice(0) }).promise;
}

async function extractPageText(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const pageWidth = viewport.width;
  const textContent = await page.getTextContent();

  const items = (textContent.items as any[])
    .filter(item => item.str?.trim())
    .map(item => ({
      str: item.str as string,
      x: item.transform[4] as number,
      y: item.transform[5] as number,
    }));

  const midX = pageWidth / 2;
  const left = items.filter(it => it.x < midX).sort((a, b) => b.y - a.y || a.x - b.x);
  const right = items.filter(it => it.x >= midX).sort((a, b) => b.y - a.y || a.x - b.x);

  const toText = (col: typeof left) => col.map(it => it.str).join(' ');
  return `[LEFT COLUMN]
${toText(left)}

[RIGHT COLUMN]
${toText(right)}`;
}

// ==================== OCR ====================

const PAYSLIP_PROMPT = `Extract payslip data from this Thai government salary slip page.
This page contains TWO payslips side by side: LEFT column and RIGHT column.

IMPORTANT rules for income_items and deduction_items:
- Include ALL line items listed in the document, even if the amount cell is blank or zero.
- If an item has no amount, set "amount": null.
- Do NOT skip any item from the list.

For EACH person extract as JSON exactly:
{
  "left": {
    "name": "ชื่อ-นามสกุล",
    "position": "ตำแหน่ง/ตำแหน่งงาน",
    "income_items": [{"label": "เงินเดือน", "amount": 25350.00}, {"label": "เงินเดือน (ตกเบิก)", "amount": null}],
    "deduction_items": [{"label": "ภาษี", "amount": null}, {"label": "กบข./กสจ. (รายเดือน)", "amount": 760.50}],
    "total_income": 27850.00,
    "total_deductions": 1510.50,
    "net_pay": 26339.50
  },
  "right": { "name": "", "position": "", "income_items": [], "deduction_items": [], "total_income": 0, "total_deductions": 0, "net_pay": 0 }
}

Return ONLY valid JSON, no markdown, no explanation.`;

export async function ocrPayslipPage(pageText: string, pageNum: number): Promise<PageOcrResult> {
  return withRetry(async model => {
    const raw = await callGenerate(model, [
      { text: `${PAYSLIP_PROMPT}

Page text content:
${pageText}` },
    ]);

    const cleaned = raw.replace(/```json[\s\S]*?```|```/g, s =>
      s.startsWith('```json') ? s.slice(7, -3).trim() : ''
    ).trim();

    const parsed = JSON.parse(cleaned);
    // Gemini sometimes wraps result in an array: [{"top":...,"bottom":...}]
    const obj = Array.isArray(parsed) ? parsed[0] : parsed;

    const normalizeItems = (arr: any[]): PayslipItem[] =>
      arr.map(it => ({ label: String(it?.label || ''), amount: it?.amount == null ? null : Number(it.amount) }));

    const normalize = (d: any): PayslipData => ({
      name: d?.name || '',
      position: d?.position || '',
      income_items: Array.isArray(d?.income_items) ? normalizeItems(d.income_items) : [],
      deduction_items: Array.isArray(d?.deduction_items) ? normalizeItems(d.deduction_items) : [],
      total_income: Number(d?.total_income) || 0,
      total_deductions: Number(d?.total_deductions) || 0,
      net_pay: Number(d?.net_pay) || 0,
    });

    return { left: normalize(obj.left), right: normalize(obj.right), raw_text: raw };
  });
}

// ==================== Name matching ====================

function normalizeName(name: string): string {
  return name
    .replace(/^(นาย|นาง|นางสาว|ด\.ต\.|ด\.ตรี|ว่าที่|ร\.ต\.|จ\.ส\.อ\.|จ\.ส\.ต\.|จ\.ส\.ท\.)\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bigrams = (s: string): string[] => {
    const r: string[] = [];
    for (let i = 0; i < s.length - 1; i++) r.push(s.slice(i, i + 2));
    return r;
  };
  const ab = bigrams(a);
  const bb = new Set(bigrams(b));
  const intersect = ab.filter(bg => bb.has(bg)).length;
  const total = ab.length + bb.size;
  return total === 0 ? 0 : (2 * intersect) / total;
}

export function matchProfiles(
  ocrItems: { name: string }[],
  profiles: ProfileSummary[]
): Map<string, MatchResult> {
  const result = new Map<string, MatchResult>();

  for (const item of ocrItems) {
    const { name } = item;
    let best: MatchResult = { profileId: null, score: 0, matchType: 'none' };

    // Name matching only — employee_id comes from the matched profile
    if (name.trim()) {
      const normOcr = normalizeName(name);
      const [ocrFirst, ...ocrRest] = normOcr.split(' ');
      const ocrLast = ocrRest.join(' ');

      for (const p of profiles) {
        const fullNorm = normalizeName(`${p.first_name} ${p.last_name}`);

        if (normOcr === fullNorm) {
          best = { profileId: p.id, score: 1.0, matchType: 'name_exact' };
          break;
        }

        const firstSim = bigramSimilarity(ocrFirst || '', p.first_name);
        const lastSim = bigramSimilarity(ocrLast || '', p.last_name);
        const combined = firstSim * 0.4 + lastSim * 0.6;

        if (firstSim >= 0.8 && combined > best.score) {
          best = { profileId: p.id, score: combined, matchType: 'name_fuzzy' };
        } else {
          const overall = bigramSimilarity(normOcr, fullNorm);
          if (overall >= 0.65 && overall > best.score) {
            best = { profileId: p.id, score: overall, matchType: 'name_fuzzy' };
          }
        }
      }
    }

    result.set(name, best);
  }

  return result;
}

// ==================== DB CRUD ====================

export async function getAllProfiles(): Promise<ProfileSummary[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, employee_id, first_name, last_name, prefix')
    .order('first_name');
  if (error) throw error;
  return (data || []) as ProfileSummary[];
}

export async function createBatch(data: {
  uploadedBy: string;
  month: number;
  year: number;
  fileUrl: string;
  storagePath: string;
  pageCount: number;
}): Promise<PayslipBatch> {
  const { data: batch, error } = await (supabase as any).from('payslip_batches')
    .upsert(
      {
        uploaded_by: data.uploadedBy,
        month: data.month,
        year: data.year,
        file_url: data.fileUrl,
        storage_path: data.storagePath,
        page_count: data.pageCount,
        status: 'processing',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'month,year' }
    )
    .select()
    .single();
  if (error) throw error;
  return batch;
}

export async function deleteBatchPayslips(batchId: string): Promise<void> {
  const { error } = await (supabase as any).from('payslips').delete().eq('batch_id', batchId);
  if (error) throw error;
}

export async function insertPayslips(
  batchId: string,
  rows: {
    profileId: string | null;
    employeeName: string;
    employeePosition?: string;
    pageNumber: number;
    half: 'left' | 'right';
    incomeItems: PayslipItem[];
    deductionItems: PayslipItem[];
    totalIncome: number;
    totalDeductions: number;
    netPay: number;
    rawOcrText?: string;
  }[]
): Promise<void> {
  const records = rows.map(r => ({
    batch_id: batchId,
    profile_id: r.profileId,
    employee_name: r.employeeName,
    employee_position: r.employeePosition || null,
    page_number: r.pageNumber,
    half: r.half,
    income_items: r.incomeItems,
    deduction_items: r.deductionItems,
    total_income: r.totalIncome,
    total_deductions: r.totalDeductions,
    net_pay: r.netPay,
    raw_ocr_text: r.rawOcrText || null,
  }));
  const { error } = await (supabase as any).from('payslips').insert(records);
  if (error) throw error;
}

export async function updateBatchStatus(
  batchId: string,
  update: { status: string; total_records?: number; matched_records?: number }
): Promise<void> {
  const { error } = await (supabase as any).from('payslip_batches')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', batchId);
  if (error) throw error;
}

export async function getMyPayslips(profileId: string): Promise<PayslipWithBatch[]> {
  const { data, error } = await (supabase as any).from('payslips')
    .select('*, batch:payslip_batches(*)')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getPayslipBatches(): Promise<PayslipBatch[]> {
  const { data, error } = await (supabase as any).from('payslip_batches')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getBatchPayslips(batchId: string): Promise<Payslip[]> {
  const { data, error } = await (supabase as any).from('payslips')
    .select('*')
    .eq('batch_id', batchId)
    .order('page_number')
    .order('half');
  if (error) throw error;
  return data || [];
}

// ==================== Upload PDF ====================

export async function uploadPayslipPdf(
  file: File,
  userId: string,
  month: number,
  year: number
): Promise<{ fileUrl: string; storagePath: string }> {
  const storagePath = `payslips/${userId}/${month}_${year}.pdf`;
  const { error } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, { cacheControl: '3600', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('documents').getPublicUrl(storagePath);
  return { fileUrl: data.publicUrl, storagePath };
}

// ==================== Full OCR pipeline ====================

const hasOcrData = (left: PayslipData, right: PayslipData) =>
  left.name.trim() !== '' || left.net_pay > 0 || left.income_items.length > 0 ||
  right.name.trim() !== '' || right.net_pay > 0 || right.income_items.length > 0;

export async function processPayslipPdf(
  file: File,
  batchId: string,
  onPageDone: (done: number, total: number) => void
): Promise<{ left: PayslipData; right: PayslipData; pageNumber: number; rawText: string }[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await loadPdf(buffer);
  const totalPages = pdf.numPages;

  const empty: PayslipData = { name: '', position: '', income_items: [], deduction_items: [], total_income: 0, total_deductions: 0, net_pay: 0 };
  let doneCount = 0;

  const tasks = Array.from({ length: totalPages }, (_, i) => {
    const pageNum = i + 1;
    return async () => {
      const pageText = await extractPageText(pdf, pageNum);
      let entry: { left: PayslipData; right: PayslipData; pageNumber: number; rawText: string } =
        { left: { ...empty }, right: { ...empty }, pageNumber: pageNum, rawText: '' };

      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const ocr = await ocrPayslipPage(pageText, pageNum);
          entry = { left: ocr.left, right: ocr.right, pageNumber: pageNum, rawText: ocr.raw_text || '' };
          if (hasOcrData(ocr.left, ocr.right)) break;
          if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000 * attempt));
        } catch {
          if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }

      doneCount++;
      onPageDone(doneCount, totalPages);
      return entry;
    };
  });

  const results = await runPool(tasks, 5);
  return results;
}

// ==================== Admin settings ====================

export async function getPayslipUploader(): Promise<string> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'payslip_uploader_employee_id')
    .single();
  return (data as any)?.value || '';
}

export async function setPayslipUploader(employeeId: string): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'payslip_uploader_employee_id', value: employeeId });
  if (error) throw error;
}

// ==================== PDF crop (Railway placeholder) ====================

export async function cropPayslipPDF(
  _fileUrl: string,
  _page: number,
  _half: 'left' | 'right'
): Promise<Blob> {
  throw new Error('Railway crop endpoint ยังไม่ได้ configure — กรุณาตั้งค่า Railway API ก่อน');
}
