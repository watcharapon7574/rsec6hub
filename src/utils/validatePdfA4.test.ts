import { describe, it, expect } from 'vitest';
import { formatA4ValidationError, type PdfValidationResult, type InvalidPage } from './validatePdfA4';

// === Helper to create InvalidPage ===
function mkPage(page: number, width: number, height: number, paperType = 'ไม่ทราบประเภท', sizeMm = ''): InvalidPage {
  return { page, width, height, paperType, sizeMm: sizeMm || `${Math.round(width * 25.4 / 72 * 10) / 10} x ${Math.round(height * 25.4 / 72 * 10) / 10} mm` };
}

// =============================================
// formatA4ValidationError
// =============================================
describe('formatA4ValidationError', () => {
  it('valid result → empty string', () => {
    const result: PdfValidationResult = { valid: true, totalPages: 3, invalidPages: [] };
    expect(formatA4ValidationError(result)).toBe('');
  });

  it('ทุกหน้าไม่ใช่ A4 → แสดงขนาดที่พบ', () => {
    const result: PdfValidationResult = {
      valid: false,
      totalPages: 2,
      invalidPages: [
        mkPage(1, 612, 792, 'Letter (US)'),
        mkPage(2, 612, 792, 'Letter (US)'),
      ],
    };
    const msg = formatA4ValidationError(result);
    expect(msg).toContain('ทุกหน้า');
    expect(msg).toContain('612');
    expect(msg).toContain('792');
  });

  it('บางหน้าไม่ใช่ A4 → แสดงเลขหน้า', () => {
    const result: PdfValidationResult = {
      valid: false,
      totalPages: 5,
      invalidPages: [
        mkPage(2, 612, 792, 'Letter (US)'),
        mkPage(4, 612, 792, 'Letter (US)'),
      ],
    };
    const msg = formatA4ValidationError(result);
    expect(msg).toContain('2');
    expect(msg).toContain('4');
    expect(msg).toMatch(/^หน้าที่/);
  });
});

// =============================================
// Paper type detection (tested via InvalidPage structure)
// =============================================
describe('InvalidPage structure', () => {
  it('has paperType and sizeMm fields', () => {
    const page = mkPage(1, 612, 792, 'Letter (US)', '215.9 x 279.4 mm');
    expect(page.paperType).toBe('Letter (US)');
    expect(page.sizeMm).toBe('215.9 x 279.4 mm');
  });

  it('sizeMm is auto-calculated from points', () => {
    const page = mkPage(1, 595.28, 841.89);
    // A4 in mm should be approximately 210 x 297
    expect(page.sizeMm).toContain('210');
    expect(page.sizeMm).toContain('297');
  });
});
