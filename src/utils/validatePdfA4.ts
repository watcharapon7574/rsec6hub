import * as pdfjsLib from 'pdfjs-dist';

// A4 size in points: 595.28 x 841.89
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const TOLERANCE = 15; // ±15 points (~5mm)

export interface InvalidPage {
  page: number;
  width: number;
  height: number;
  paperType: string; // ประเภทกระดาษที่ตรวจพบ
  sizeMm: string; // ขนาดเป็น mm
}

export interface PdfValidationResult {
  valid: boolean;
  totalPages: number;
  invalidPages: InvalidPage[];
}

// ขนาดกระดาษมาตรฐาน (width x height ในหน่วย points)
const PAPER_SIZES: { name: string; w: number; h: number }[] = [
  { name: 'Letter (US)', w: 612, h: 792 },
  { name: 'Legal', w: 612, h: 1008 },
  { name: 'A3', w: 841.89, h: 1190.55 },
  { name: 'A5', w: 419.53, h: 595.28 },
  { name: 'B4', w: 728.5, h: 1031.81 },
  { name: 'B5', w: 515.91, h: 728.5 },
  { name: 'Folio', w: 612, h: 936 },
  { name: 'Executive', w: 522, h: 756 },
];

function detectPaperType(width: number, height: number): string {
  const tol = 10;
  for (const paper of PAPER_SIZES) {
    const isPortrait = Math.abs(width - paper.w) <= tol && Math.abs(height - paper.h) <= tol;
    const isLandscape = Math.abs(width - paper.h) <= tol && Math.abs(height - paper.w) <= tol;
    if (isPortrait || isLandscape) return paper.name;
  }
  return 'ไม่ทราบประเภท';
}

function ptToMm(pt: number): number {
  return Math.round(pt * 25.4 / 72 * 10) / 10;
}

/**
 * ตรวจสอบว่าทุกหน้าของ PDF เป็นขนาด A4 หรือไม่
 * รองรับทั้งแนวตั้ง (portrait) และแนวนอน (landscape)
 */
export async function validatePdfA4(file: File): Promise<PdfValidationResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;

  const invalidPages: PdfValidationResult['invalidPages'] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const { width, height } = viewport;

    // เช็คทั้งแนวตั้งและแนวนอน
    const isPortraitA4 =
      Math.abs(width - A4_WIDTH) <= TOLERANCE &&
      Math.abs(height - A4_HEIGHT) <= TOLERANCE;

    const isLandscapeA4 =
      Math.abs(width - A4_HEIGHT) <= TOLERANCE &&
      Math.abs(height - A4_WIDTH) <= TOLERANCE;

    if (!isPortraitA4 && !isLandscapeA4) {
      invalidPages.push({
        page: i,
        width: Math.round(width * 100) / 100,
        height: Math.round(height * 100) / 100,
        paperType: detectPaperType(width, height),
        sizeMm: `${ptToMm(width)} x ${ptToMm(height)} mm`,
      });
    }
  }

  pdf.destroy();

  return {
    valid: invalidPages.length === 0,
    totalPages: pdf.numPages,
    invalidPages,
  };
}

/**
 * สร้างข้อความ error สำหรับแสดงให้ user
 */
export function formatA4ValidationError(result: PdfValidationResult): string {
  if (result.valid) return '';

  const pages = result.invalidPages;
  if (pages.length === result.totalPages) {
    return `ไฟล์ PDF ทุกหน้าไม่ใช่ขนาด A4 (ขนาดที่พบ: ${pages[0].width} x ${pages[0].height} pt) กรุณาใช้ไฟล์ขนาด A4`;
  }

  const pageNums = pages.map(p => p.page).join(', ');
  return `หน้าที่ ${pageNums} ไม่ใช่ขนาด A4 กรุณาใช้ไฟล์ที่ทุกหน้าเป็นขนาด A4`;
}
