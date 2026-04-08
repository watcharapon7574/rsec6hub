/**
 * Test script: parse landscape payslip PDF using pdf.js deterministic extraction
 * Usage: node scripts/test-pdf-parse.mjs <path-to-pdf> [page-number]
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfjsLib = require('pdfjs-dist/build/pdf.js');
import { readFileSync } from 'fs';

const PDF_PATH = process.argv[2] || '/Users/watcharaponaonpan/Downloads/มีนาคมแนวนอน.pdf';
const TARGET_PAGE = parseInt(process.argv[3] || '0'); // 0 = all pages

// ==================== Helpers ====================

const AMOUNT_RE = /^[\d,]+\.\d{2}$/;
const NAME_RE = /^(นาย|นาง(?:สาว)?|ด\.ต\.|ว่าที่|ร\.ต\.อ?\.|จ\.ส\.[อตท]\.)/u;
const Y_THRESHOLD = 4;

function groupRows(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= Y_THRESHOLD) {
      last.tokens.push(it);
    } else {
      rows.push({ y: it.y, tokens: [it] });
    }
  }
  for (const row of rows) row.tokens.sort((a, b) => a.x - b.x);
  return rows;
}

// ==================== Known labels ====================

const INCOME_LABELS = [
  'เงินเดือน', 'เงินเดือนตกเบิก', 'ป.จ.ต.', 'ป.จ.ต./ตกเบิก', 'พ.ข.อ./ตกเบิก',
  'พ.ส.ร./ตกเบิก', 'พ.ค.ว./ตกเบิก', 'พ.ป.ผ./ตกเบิก', 'สปพ./ตกเบิก', 'ตปพ./ตกเบิก',
  'ต.ข.ท.ปจต.', 'ต.ข.ท.ปจต. ตกเบิก', 'ต.ข.8-8ว.', 'ต.ข.8-8ว. ตกเบิก', 'ต.ด.ข.1-7/ตกเบิก',
  'ง.ต.พ.ข./ตกเบิก', 'ค่าเช่าบ้าน/ตกเบิก', 'ช่วยเหลือบุตร/ตกเบิก', 'การศึกษาบุตร/ตกเบิก',
  'เงินรางวัล/เงินท้าทาย', 'วิทยฐานะ', 'วิทยฐานะ ตกเบิก', 'พ.ค.ก.',
];

const DEDUCTION_LABELS = [
  'ภาษี/ตกเบิก', 'กบข./ตกเบิก', 'สะสมเพิ่ม/ตกเบิก', 'ง.หักสหกรณ์',
  'สธณภ.', 'งก.กยศ.', 'สินเชื่อ',
];

const TOTAL_KEYWORDS = { 'รวมรับทั้งเดือน': 'income', 'รวมจ่ายทั้งเดือน': 'deductions', 'รับสุทธิ': 'net' };
const ALL_LABELS = [...INCOME_LABELS, ...DEDUCTION_LABELS];

/**
 * Match a token against known labels.
 * Supports partial match (e.g. "ง.หักสหกรณ์ สอ.ครู ลบ." matches "ง.หักสหกรณ์")
 */
function findLabel(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  // Skip total keywords — they are not item labels
  if (Object.keys(TOTAL_KEYWORDS).some(kw => t.includes(kw))) return null;
  // Exact match first
  if (ALL_LABELS.includes(t)) return t;
  // StartsWith match (for labels with org-specific suffixes)
  for (const label of ALL_LABELS) {
    if (t.startsWith(label)) return label;
  }
  // "งก.กรอ." and similar variants → map to งก.กยศ.
  if (/^งก\./.test(t)) return 'งก.กยศ.';
  return null;
}

function isIncomeLabel(label) { return INCOME_LABELS.includes(label); }
function isDeductionLabel(label) { return DEDUCTION_LABELS.includes(label); }

// ==================== Parse a single slip ====================

function parseSlip(items) {
  const rows = groupRows(items);

  let name = '';
  let positionNumber = '';
  let bankName = '';
  let bankAccount = '';

  const incomeMap = new Map(); // label → amount|null
  const deductionMap = new Map();
  let totalIncome = 0;
  let totalDeductions = 0;
  let netPay = 0;

  for (const row of rows) {
    const tokens = row.tokens;

    // --- Extract name ---
    for (const tok of tokens) {
      const t = tok.str.trim();
      if (NAME_RE.test(t) && !name) {
        name = t;
      }
    }

    // --- Extract position number, bank, account ---
    const rowText = tokens.map(t => t.str).join(' ');
    if (rowText.includes('เลขตำแหน่ง')) {
      const posMatch = rowText.match(/เลขตำแหน่ง\s*(\d+)/);
      if (posMatch) positionNumber = posMatch[1];
      const bankMatch = rowText.match(/โอนเงินเข้า\s*(.+?)(?:\s+เลขที่บัญชี|$)/);
      if (bankMatch) bankName = bankMatch[1].trim();
      const acctMatch = rowText.match(/เลขที่บัญชี\s*(\d+)/);
      if (acctMatch) bankAccount = acctMatch[1];
    }

    // --- Parse label-amount pairs ---
    // Walk through tokens: label followed by optional amount
    let lastLabel = null;

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i].str.trim();

      if (AMOUNT_RE.test(t)) {
        const amount = parseFloat(t.replace(/,/g, ''));
        if (lastLabel) {
          // Assign amount to the label
          if (isIncomeLabel(lastLabel)) incomeMap.set(lastLabel, amount);
          else if (isDeductionLabel(lastLabel)) deductionMap.set(lastLabel, amount);
          lastLabel = null;
        }
        continue;
      }

      // Check totals — handle before label check, consume amount token
      let isTotalKeyword = false;
      for (const [kw, type] of Object.entries(TOTAL_KEYWORDS)) {
        if (t === kw) {
          isTotalKeyword = true;
          // Flush lastLabel as no-amount
          if (lastLabel) {
            if (isIncomeLabel(lastLabel) && !incomeMap.has(lastLabel)) incomeMap.set(lastLabel, null);
            if (isDeductionLabel(lastLabel) && !deductionMap.has(lastLabel)) deductionMap.set(lastLabel, null);
            lastLabel = null;
          }
          if (i + 1 < tokens.length && AMOUNT_RE.test(tokens[i + 1].str.trim())) {
            const amt = parseFloat(tokens[i + 1].str.replace(/,/g, ''));
            if (type === 'income') totalIncome = amt;
            else if (type === 'deductions') totalDeductions = amt;
            else if (type === 'net') netPay = amt;
            i++; // skip amount token
          }
          break;
        }
      }
      if (isTotalKeyword) continue;

      // Check if it's a known label
      const matched = findLabel(t);
      if (matched) {
        // If previous label had no amount, record it with null
        if (lastLabel) {
          if (isIncomeLabel(lastLabel) && !incomeMap.has(lastLabel)) incomeMap.set(lastLabel, null);
          if (isDeductionLabel(lastLabel) && !deductionMap.has(lastLabel)) deductionMap.set(lastLabel, null);
        }
        lastLabel = matched;
        continue;
      }

      // Not a label and not an amount → might be header text, skip
    }

    // End of row: if last label had no amount
    if (lastLabel) {
      if (isIncomeLabel(lastLabel) && !incomeMap.has(lastLabel)) incomeMap.set(lastLabel, null);
      if (isDeductionLabel(lastLabel) && !deductionMap.has(lastLabel)) deductionMap.set(lastLabel, null);
      lastLabel = null;
    }
  }

  // Build ordered results matching INCOME_LABELS / DEDUCTION_LABELS order
  const incomeItems = INCOME_LABELS.map(label => ({
    label,
    amount: incomeMap.has(label) ? incomeMap.get(label) : null,
  }));
  const deductionItems = DEDUCTION_LABELS.map(label => ({
    label,
    amount: deductionMap.has(label) ? deductionMap.get(label) : null,
  }));

  return {
    name, positionNumber, bankName, bankAccount,
    incomeItems, deductionItems,
    totalIncome, totalDeductions, netPay,
  };
}

// ==================== Main ====================

async function main() {
  const data = readFileSync(PDF_PATH);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data.buffer) }).promise;

  console.log(`PDF: ${PDF_PATH}`);
  console.log(`Pages: ${pdf.numPages}\n`);

  const pagesToParse = TARGET_PAGE > 0
    ? [TARGET_PAGE]
    : Array.from({ length: pdf.numPages }, (_, i) => i + 1);

  let totalSlips = 0;
  let successSlips = 0;
  let errors = [];

  for (const pageNum of pagesToParse) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const allItems = textContent.items
      .filter(it => it.str?.trim())
      .map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));

    const midY = viewport.height / 2;
    const topItems = allItems.filter(it => it.y >= midY);
    const bottomItems = allItems.filter(it => it.y < midY);

    for (const [half, items] of [['top', topItems], ['bottom', bottomItems]]) {
      if (items.length === 0) continue;
      totalSlips++;

      const slip = parseSlip(items);

      // Validate
      const issues = [];
      if (!slip.name) issues.push('ไม่พบชื่อ');
      if (slip.totalIncome === 0) issues.push('รวมรับ = 0');
      if (slip.netPay === 0) issues.push('รับสุทธิ = 0');

      // Check that amounts with values are correctly assigned
      const hasAnyIncome = slip.incomeItems.some(it => it.amount !== null);
      if (!hasAnyIncome && slip.totalIncome > 0) issues.push('มีรวมรับแต่ไม่มี income items');

      // Verify sum
      const incomeSum = slip.incomeItems.reduce((s, it) => s + (it.amount || 0), 0);
      if (slip.totalIncome > 0 && Math.abs(incomeSum - slip.totalIncome) > 0.01) {
        issues.push(`income sum ${incomeSum} ≠ total ${slip.totalIncome}`);
      }
      const deductionSum = slip.deductionItems.reduce((s, it) => s + (it.amount || 0), 0);
      if (slip.totalDeductions > 0 && Math.abs(deductionSum - slip.totalDeductions) > 0.01) {
        issues.push(`deduction sum ${deductionSum} ≠ total ${slip.totalDeductions}`);
      }

      if (issues.length === 0) {
        successSlips++;
        if (TARGET_PAGE > 0) {
          console.log(`\n=== Page ${pageNum} / ${half.toUpperCase()} ===`);
          printSlip(slip);
        }
      } else {
        errors.push({ page: pageNum, half, issues, slip });
        if (TARGET_PAGE > 0) {
          console.log(`\n=== Page ${pageNum} / ${half.toUpperCase()} ⚠️ ===`);
          console.log(`  Issues: ${issues.join(', ')}`);
          printSlip(slip);
        }
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`SUMMARY: ${successSlips}/${totalSlips} slips parsed correctly (${(successSlips/totalSlips*100).toFixed(1)}%)`);

  if (errors.length > 0) {
    console.log(`\nFailed slips (${errors.length}):`);
    for (const e of errors) {
      console.log(`  Page ${e.page}/${e.half}: ${e.issues.join(', ')} | name="${e.slip.name}" net=${e.slip.netPay}`);
    }
  }
}

function printSlip(slip) {
  console.log(`  Name: ${slip.name}`);
  console.log(`  Position#: ${slip.positionNumber}  Bank: ${slip.bankName}  Account: ${slip.bankAccount}`);

  const activeIncome = slip.incomeItems.filter(it => it.amount !== null);
  console.log(`  Income (${activeIncome.length} items with amount):`);
  for (const item of activeIncome) {
    console.log(`    ${item.label}: ${item.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`);
  }
  console.log(`  Total income: ${slip.totalIncome.toLocaleString()}`);

  const activeDeductions = slip.deductionItems.filter(it => it.amount !== null);
  console.log(`  Deductions (${activeDeductions.length} items with amount):`);
  for (const item of activeDeductions) {
    console.log(`    ${item.label}: ${item.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`);
  }
  console.log(`  Total deductions: ${slip.totalDeductions.toLocaleString()}`);
  console.log(`  Net pay: ${slip.netPay.toLocaleString()}`);
}

main().catch(console.error);
