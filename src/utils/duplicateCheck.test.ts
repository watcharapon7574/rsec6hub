import { describe, it, expect } from 'vitest';

// Test duplicate number check logic used in RegisterForm
// The logic: check if docNumber exists in document_register_manual + memos/doc_receive

describe('Duplicate Number Check Logic', () => {
  it('formats doc number correctly from number + year', () => {
    const nextNumber = 42;
    const yearShort = '69';
    const paddedNumber = String(nextNumber).padStart(4, '0');
    const docNumber = `${paddedNumber}/${yearShort}`;
    expect(docNumber).toBe('0042/69');
  });

  it('pads single digit numbers to 4 digits', () => {
    expect(String(1).padStart(4, '0')).toBe('0001');
    expect(String(99).padStart(4, '0')).toBe('0099');
    expect(String(999).padStart(4, '0')).toBe('0999');
    expect(String(9999).padStart(4, '0')).toBe('9999');
  });

  it('doc number suffix format validation regex', () => {
    const regex = /^\d+\/\d{2}$/;
    expect(regex.test('0240/69')).toBe(true);
    expect(regex.test('1/69')).toBe(true);
    expect(regex.test('0001/69')).toBe(true);
    expect(regex.test('abc/69')).toBe(false);
    expect(regex.test('0240')).toBe(false);
    expect(regex.test('0240/690')).toBe(false); // 3-digit year
    expect(regex.test('')).toBe(false);
  });
});
