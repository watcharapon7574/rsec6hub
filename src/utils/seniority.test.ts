import { describe, it, expect } from 'vitest';
import { getMostSeniorUser } from './seniority';

describe('getMostSeniorUser', () => {
  it('empty array → null', () => {
    expect(getMostSeniorUser([])).toBe(null);
  });

  it('single user → return that user', () => {
    expect(getMostSeniorUser([{ userId: 'u1', employeeId: 'RSEC610' }])).toBe('u1');
  });

  it('RSEC601 vs RSEC610 → RSEC601 (ตัวเลขน้อย = อาวุโสกว่า)', () => {
    const users = [
      { userId: 'u-junior', employeeId: 'RSEC610' },
      { userId: 'u-senior', employeeId: 'RSEC601' },
    ];
    expect(getMostSeniorUser(users)).toBe('u-senior');
  });

  it('3 คน → เลือกตัวเลขน้อยสุด', () => {
    const users = [
      { userId: 'u3', employeeId: 'RSEC650' },
      { userId: 'u1', employeeId: 'RSEC601' },
      { userId: 'u2', employeeId: 'RSEC620' },
    ];
    expect(getMostSeniorUser(users)).toBe('u1');
  });

  it('missing employeeId → fallback 999999 (ท้ายสุด)', () => {
    const users = [
      { userId: 'u-no-id' },
      { userId: 'u-has-id', employeeId: 'RSEC610' },
    ];
    expect(getMostSeniorUser(users)).toBe('u-has-id');
  });

  it('non-numeric employeeId → fallback 999999', () => {
    const users = [
      { userId: 'u-bad', employeeId: 'ABC' },
      { userId: 'u-good', employeeId: 'RSEC605' },
    ];
    expect(getMostSeniorUser(users)).toBe('u-good');
  });

  it('ทุกคน missing employeeId → return คนแรก (stable sort)', () => {
    const users = [
      { userId: 'u1' },
      { userId: 'u2' },
    ];
    // ทั้งคู่ได้ 999999 → stable sort → คนแรก
    expect(getMostSeniorUser(users)).toBe('u1');
  });

  it('employeeId ที่มีเลข 0 นำหน้า → parse ถูก', () => {
    const users = [
      { userId: 'u1', employeeId: 'RSEC003' },
      { userId: 'u2', employeeId: 'RSEC010' },
    ];
    expect(getMostSeniorUser(users)).toBe('u1'); // 3 < 10
  });
});
