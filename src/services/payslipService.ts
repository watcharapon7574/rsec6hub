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
  position_number?: string;
  bank_name?: string;
  bank_account?: string;
  department?: string;
  division?: string;
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
  top: PayslipData;
  bottom: PayslipData;
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
  half: 'top' | 'bottom';
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
  });
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ==================== PDF utilities ====================

async function loadPdf(data: ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  return pdfjsLib.getDocument({ data: data.slice(0) }).promise;
}

async function extractPageText(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const textContent = await page.getTextContent();
  const items = (textContent.items as any[])
    .filter(it => it.str?.trim())
    .map(it => ({
      str: it.str as string,
      x: it.transform[4] as number,
      y: it.transform[5] as number,
    }));

  // Group by rows (same Y within threshold) then sort by X within each row
  const Y_THRESHOLD = 4;
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: { y: number; tokens: { str: string; x: number }[] }[] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= Y_THRESHOLD) {
      last.tokens.push(it);
    } else {
      rows.push({ y: it.y, tokens: [it] });
    }
  }

  // Format each row as tab-separated to preserve spatial layout
  return rows
    .map(r => r.tokens.sort((a, b) => a.x - b.x).map(t => t.str).join('\t'))
    .join('\n');
}

// ==================== Gemini OCR ====================

const PAYSLIP_PROMPT = `ใบรับรองการจ่ายเงินเดือนราชการไทย แนวนอน (landscape) 1 หน้ามี 2 สลิป เรียงบน-ล่าง
แต่ละสลิปมีโครงสร้าง:
- ชื่อ-นามสกุล (มีคำนำหน้า เช่น นาย/นาง/นางสาว)
- เลขตำแหน่ง, ธนาคาร, เลขที่บัญชี
- รายรับ 23 รายการ เรียงเป็นตาราง 5 คอลัมน์ x 5 แถว (income_items):
  คอลัมน์ 1: เงินเดือน, เงินเดือนตกเบิก, ป.จ.ต., ป.จ.ต./ตกเบิก, พ.ข.อ./ตกเบิก
  คอลัมน์ 2: พ.ส.ร./ตกเบิก, พ.ค.ว./ตกเบิก, พ.ป.ผ./ตกเบิก, สปพ./ตกเบิก, ตปพ./ตกเบิก
  คอลัมน์ 3: ต.ข.ท.ปจต., ต.ข.ท.ปจต. ตกเบิก, ต.ข.8-8ว., ต.ข.8-8ว. ตกเบิก, ต.ด.ข.1-7/ตกเบิก
  คอลัมน์ 4: ง.ต.พ.ข./ตกเบิก, ค่าเช่าบ้าน/ตกเบิก, ช่วยเหลือบุตร/ตกเบิก, การศึกษาบุตร/ตกเบิก, เงินรางวัล/เงินท้าทาย
  คอลัมน์ 5: วิทยฐานะ, วิทยฐานะ ตกเบิก, พ.ค.ก.
- รวมรับทั้งเดือน (total_income)
- รายจ่าย 6 รายการ (deduction_items):
  แถว 1: ภาษี/ตกเบิก, กบข./ตกเบิก, สะสมเพิ่ม/ตกเบิก, ง.หักสหกรณ์
  แถว 2: สธณภ., งก.กยศ.
- รวมจ่ายทั้งเดือน (total_deductions)
- รับสุทธิ (net_pay)

ตอบ JSON เท่านั้น ห้ามมี markdown:
{
  "top": {
    "name": "ชื่อ-นามสกุล",
    "position_number": "0148875",
    "bank_name": "ธนาคารกรุงไทย จำกัด(มหาชน)",
    "bank_account": "4980368883",
    "income_items": [
      {"label": "เงินเดือน", "amount": 21210.00},
      {"label": "เงินเดือนตกเบิก", "amount": 100.00},
      {"label": "ป.จ.ต.", "amount": null},
      {"label": "ป.จ.ต./ตกเบิก", "amount": null},
      {"label": "พ.ข.อ./ตกเบิก", "amount": null},
      {"label": "พ.ส.ร./ตกเบิก", "amount": null},
      {"label": "พ.ค.ว./ตกเบิก", "amount": null},
      {"label": "พ.ป.ผ./ตกเบิก", "amount": null},
      {"label": "สปพ./ตกเบิก", "amount": null},
      {"label": "ตปพ./ตกเบิก", "amount": null},
      {"label": "ต.ข.ท.ปจต.", "amount": null},
      {"label": "ต.ข.ท.ปจต. ตกเบิก", "amount": null},
      {"label": "ต.ข.8-8ว.", "amount": null},
      {"label": "ต.ข.8-8ว. ตกเบิก", "amount": null},
      {"label": "ต.ด.ข.1-7/ตกเบิก", "amount": null},
      {"label": "ง.ต.พ.ข./ตกเบิก", "amount": null},
      {"label": "ค่าเช่าบ้าน/ตกเบิก", "amount": null},
      {"label": "ช่วยเหลือบุตร/ตกเบิก", "amount": null},
      {"label": "การศึกษาบุตร/ตกเบิก", "amount": null},
      {"label": "เงินรางวัล/เงินท้าทาย", "amount": null},
      {"label": "วิทยฐานะ", "amount": null},
      {"label": "วิทยฐานะ ตกเบิก", "amount": null},
      {"label": "พ.ค.ก.", "amount": null}
    ],
    "deduction_items": [
      {"label": "ภาษี/ตกเบิก", "amount": null},
      {"label": "กบข./ตกเบิก", "amount": 639.30},
      {"label": "สะสมเพิ่ม/ตกเบิก", "amount": null},
      {"label": "ง.หักสหกรณ์", "amount": 300.00},
      {"label": "สธณภ.", "amount": 754.00},
      {"label": "งก.กยศ.", "amount": 1199.00}
    ],
    "total_income": 21310.00,
    "total_deductions": 2892.30,
    "net_pay": 18417.70
  },
  "bottom": { ... }
}

กฎสำคัญ:
- income_items ต้องมีครบ 23 รายการเสมอ ตามลำดับข้างต้น
- deduction_items ต้องมีครบ 6 รายการเสมอ
- ถ้ารายการใดไม่มีจำนวนเงิน → "amount": null
- name ต้องไม่ว่างเปล่า ทั้ง 2 คน
- ตอบ JSON เท่านั้น ห้าม markdown หรือคำอธิบาย`;

const OCR_MODEL = 'gemini-2.5-flash';

function validateOcr(result: PageOcrResult): boolean {
  for (const half of ['top', 'bottom'] as const) {
    const d = result[half];
    if (!d.name) return false;
    if (d.income_items.length < 20) return false;
    if (d.deduction_items.length < 5) return false;
  }
  return true;
}

function scoreOcr(result: PageOcrResult): number {
  let s = 0;
  for (const half of ['top', 'bottom'] as const) {
    const d = result[half];
    if (d.name) s += 10;
    s += d.income_items.length;
    s += d.deduction_items.length;
    if (d.total_income > 0) s += 5;
    if (d.total_deductions > 0) s += 5;
    if (d.net_pay > 0) s += 5;
  }
  return s;
}

async function ocrPayslipPage(pageText: string): Promise<PageOcrResult> {
  const raw = await callGenerate(OCR_MODEL, [
    { text: `${PAYSLIP_PROMPT}\n\nข้อความในหน้า (เรียงตามแถว, แต่ละแถวคั่นด้วย tab — ตัวเลขที่อยู่หลังชื่อรายการในแถวเดียวกันคือจำนวนเงินของรายการนั้น):\n${pageText}` },
  ]);
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  const obj = Array.isArray(parsed) ? parsed[0] : parsed;

  const normalizeItems = (arr: any[]): PayslipItem[] =>
    (arr || []).map(it => ({ label: String(it?.label || ''), amount: it?.amount == null ? null : Number(it.amount) }));
  const normalize = (d: any): PayslipData => ({
    name: String(d?.name || '').trim(),
    position: String(d?.position || '').trim(),
    position_number: String(d?.position_number || '').trim(),
    bank_name: String(d?.bank_name || '').trim(),
    bank_account: String(d?.bank_account || '').trim(),
    income_items: normalizeItems(d?.income_items),
    deduction_items: normalizeItems(d?.deduction_items),
    total_income: Number(d?.total_income) || 0,
    total_deductions: Number(d?.total_deductions) || 0,
    net_pay: Number(d?.net_pay) || 0,
  });
  return { top: normalize(obj.top), bottom: normalize(obj.bottom), raw_text: raw };
}

// ==================== Deterministic payslip parser ==

const AMOUNT_RE = /^[\d,]+\.\d{2}$/;
const NAME_RE = /^(นาย|นาง(?:สาว)?|ด\.ต\.|ว่าที่|ร\.ต\.อ\.|ร\.ต\.|จ\.ส\.[อตท]\.)/u;
const FOOTER_RE = /ลงชื่อ|ผู้มีหน้าที่จ่ายเงิน|วัน เดือน ปี ที่ออก/;
const ROW_Y_THRESHOLD = 4;
const SKIP_LABELS = new Set(['รายรับ', 'รายจ่าย', 'รายการ', 'ลำดับ', 'จำนวนเงิน(บาท)', 'จำนวนเงิน (บาท)', 'หลักเกณฑ์']);

interface TItem { str: string; x: number; y: number; }
interface TRow  { y: number; tokens: string[]; }

function groupRows(items: TItem[]): TRow[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: TRow[] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= ROW_Y_THRESHOLD) last.tokens.push(it.str);
    else rows.push({ y: it.y, tokens: [it.str] });
  }
  return rows;
}

function rowAmount(tokens: string[]): number {
  for (let i = tokens.length - 1; i >= 0; i--)
    if (AMOUNT_RE.test(tokens[i])) return parseFloat(tokens[i].replace(/,/g, ''));
  return 0;
}

function rowLabel(tokens: string[]): string {
  const t = [...tokens];
  if (t.length && AMOUNT_RE.test(t[t.length - 1])) t.pop();
  if (t.length && /^\d+\.$/.test(t[0])) t.shift();
  return t.join(' ').trim();
}

function parseColumn(items: TItem[]): PayslipData {
  const rows = groupRows(items);
  let name = '', position = '';
  const incomeItems: PayslipItem[] = [];
  const deductionItems: PayslipItem[] = [];
  let totalIncome = 0, totalDeductions = 0, netPay = 0;
  let phase = 0; // 0=find name, 1=position, 2=income items, 3=deduction items
  let incomeTotalFound = false;

  for (const row of rows) {
    const text = row.tokens.join(' ').trim();
    if (!text || SKIP_LABELS.has(text)) continue;

    if (FOOTER_RE.test(text)) break;

    if (phase === 0) {
      if (NAME_RE.test(text)) { name = text; phase = 1; }
      continue;
    }
    if (phase === 1) {
      if (!AMOUNT_RE.test(text)) { position = text; }
      phase = 2;
      continue;
    }

    if (/^รวม/.test(text)) {
      if (!incomeTotalFound) { totalIncome = rowAmount(row.tokens); incomeTotalFound = true; phase = 3; }
      else { totalDeductions = rowAmount(row.tokens); phase = 4; }
      continue;
    }
    if (text.includes('รับสุทธิ')) { netPay = rowAmount(row.tokens); continue; }

    if (phase === 2 || phase === 3) {
      const label = rowLabel(row.tokens);
      if (!label) continue;
      const hasAmt = AMOUNT_RE.test(row.tokens[row.tokens.length - 1]);
      const item: PayslipItem = { label, amount: hasAmt ? rowAmount(row.tokens) : null };
      if (phase === 2) incomeItems.push(item); else deductionItems.push(item);
    }
  }

  return { name, position, income_items: incomeItems, deduction_items: deductionItems, total_income: totalIncome, total_deductions: totalDeductions, net_pay: netPay };
}

export async function parsePayslipPage(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<PageOcrResult> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();
  const allItems: TItem[] = (textContent.items as any[])
    .filter(it => it.str?.trim())
    .map(it => ({ str: it.str as string, x: it.transform[4] as number, y: it.transform[5] as number }));

  // Landscape layout: 2 slips stacked top-bottom, split at vertical midpoint
  // PDF y-coordinate: higher y = higher on page (top), lower y = lower on page (bottom)
  const midY = viewport.height / 2;
  const rawText = allItems.map(it => it.str).join(' ');
  return {
    top:    parseColumn(allItems.filter(it => it.y >= midY)),
    bottom: parseColumn(allItems.filter(it => it.y < midY)),
    raw_text: rawText,
  };
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
    half: 'top' | 'bottom';
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
  console.log('[payslip] insertPayslips:', records.length, 'records, matched:', records.filter(r => r.profile_id).length);
  records.forEach((r, i) => console.log(`  [${i}] name=${r.employee_name}, profile_id=${r.profile_id}, half=${r.half}`));
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
  // Use RPC with SECURITY DEFINER to bypass RLS for legacy auth users
  const { data, error } = await (supabase as any).rpc('get_payslips_by_profile', {
    p_profile_id: profileId,
  });
  if (error) throw error;
  return (data || []) as PayslipWithBatch[];
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

export async function processPayslipPdf(
  file: File,
  batchId: string,
  onPageDone: (done: number, total: number) => void
): Promise<{ top: PayslipData; bottom: PayslipData; pageNumber: number; rawText: string }[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await loadPdf(buffer);
  const totalPages = pdf.numPages;
  const empty: PayslipData = { name: '', position: '', income_items: [], deduction_items: [], total_income: 0, total_deductions: 0, net_pay: 0 };
  let doneCount = 0;

  const tasks = Array.from({ length: totalPages }, (_, i) => {
    const pageNum = i + 1;
    return async () => {
      let best: PageOcrResult | null = null;
      const pageText = await extractPageText(pdf, pageNum);
      const MAX_ATTEMPTS = 3;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          const result = await ocrPayslipPage(pageText);
          if (!best || scoreOcr(result) > scoreOcr(best)) best = result;
          if (validateOcr(result)) break;
        } catch { /* retry */ }
        if (attempt < MAX_ATTEMPTS - 1) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      }
      const entry = best
        ? { top: best.top, bottom: best.bottom, pageNumber: pageNum, rawText: best.raw_text || '' }
        : { top: { ...empty }, bottom: { ...empty }, pageNumber: pageNum, rawText: '' };
      doneCount++;
      onPageDone(doneCount, totalPages);
      return entry;
    };
  });

  return runPool(tasks, 5);
}

// ==================== Admin settings ====================

export async function getPayslipUploader(): Promise<string> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'payslip_uploader_employee_id')
    .maybeSingle();
  return (data as any)?.value || '';
}

export async function setPayslipUploader(employeeId: string): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'payslip_uploader_employee_id', value: employeeId });
  if (error) throw error;
}

// ==================== PDF crop via Edge Function ====================

export async function cropPayslipPDF(
  fileUrl: string,
  page: number,
  half: 'top' | 'bottom',
  centerOffset = 0
): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke('crop-payslip', {
    body: { file_url: fileUrl, page, half, center_offset: centerOffset, orientation: 'landscape' },
  });
  if (error) throw new Error(error.message || 'Crop failed');
  // supabase.functions.invoke returns data as Blob when Content-Type is not JSON
  if (data instanceof Blob) return data;
  // fallback: if returned as ArrayBuffer or other
  return new Blob([data], { type: 'application/pdf' });
}
