import { describe, it, expect } from 'vitest';
import { validatePhoneNumber, formatPhoneNumber } from './validation';

// =============================================
// validatePhoneNumber
// =============================================

describe('validatePhoneNumber', () => {
  it('เบอร์ 10 หลัก → valid', () => {
    expect(validatePhoneNumber('0812345678')).toEqual({ isValid: true });
  });

  it('เบอร์ 10+ หลัก → valid', () => {
    expect(validatePhoneNumber('08123456789')).toEqual({ isValid: true });
  });

  it('เบอร์สั้นกว่า 10 หลัก → invalid', () => {
    const result = validatePhoneNumber('081234');
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('empty string → invalid', () => {
    const result = validatePhoneNumber('');
    expect(result.isValid).toBe(false);
  });

  it('+66 prefix (13 chars) → valid', () => {
    expect(validatePhoneNumber('+66812345678')).toEqual({ isValid: true });
  });
});

// =============================================
// formatPhoneNumber
// =============================================

describe('formatPhoneNumber', () => {
  it('0812345678 → +66812345678', () => {
    expect(formatPhoneNumber('0812345678')).toBe('+66812345678');
  });

  it('already +66 → keep as-is', () => {
    expect(formatPhoneNumber('+66812345678')).toBe('+66812345678');
  });

  it('+66 prefix → normalize ก่อนแล้ว format ใหม่', () => {
    // +66812345678 → starts with + → return as-is
    const result = formatPhoneNumber('+66812345678');
    expect(result).toBe('+66812345678');
  });

  it('เบอร์มี dash/space → strip แล้ว format', () => {
    // 081-234-5678 → normalizedPhone = 0812345678 → +66812345678
    expect(formatPhoneNumber('081-234-5678')).toBe('+66812345678');
  });
});
