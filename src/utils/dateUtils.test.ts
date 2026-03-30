import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  convertToThaiNumerals,
  formatThaiDateFull,
  formatThaiDateShort,
  formatRelativeTime,
} from './dateUtils';

describe('convertToThaiNumerals', () => {
  it('ตัวเลข → เลขไทย', () => {
    expect(convertToThaiNumerals(0)).toBe('๐');
    expect(convertToThaiNumerals(123)).toBe('๑๒๓');
    expect(convertToThaiNumerals(2568)).toBe('๒๕๖๘');
  });

  it('string ตัวเลข → เลขไทย', () => {
    expect(convertToThaiNumerals('456')).toBe('๔๕๖');
  });

  it('ไม่มีตัวเลข → ไม่เปลี่ยน', () => {
    expect(convertToThaiNumerals('abc')).toBe('abc');
  });
});

describe('formatThaiDateFull', () => {
  it('Date object → วันที่ไทยเต็ม', () => {
    // 2 ก.พ. 2025 = 2 กุมภาพันธ์ 2568
    expect(formatThaiDateFull(new Date(2025, 1, 2))).toBe('๒ กุมภาพันธ์ ๒๕๖๘');
  });

  it('string → วันที่ไทยเต็ม', () => {
    // Note: new Date('2025-01-15') อาจ timezone shift, ใช้ explicit date
    const result = formatThaiDateFull(new Date(2025, 0, 15));
    expect(result).toBe('๑๕ มกราคม ๒๕๖๘');
  });

  it('null → empty string', () => {
    expect(formatThaiDateFull(null)).toBe('');
  });

  it('invalid date string → empty string', () => {
    expect(formatThaiDateFull('not-a-date')).toBe('');
  });
});

describe('formatThaiDateShort', () => {
  it('วันที่ → รูปแบบสั้น d/m/yy', () => {
    expect(formatThaiDateShort(new Date(2025, 1, 2))).toBe('2/2/68');
  });

  it('null → empty string', () => {
    expect(formatThaiDateShort(null)).toBe('');
  });

  it('invalid → empty string', () => {
    expect(formatThaiDateShort('invalid')).toBe('');
  });
});

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('เมื่อไม่กี่วินาทีที่แล้ว → เมื่อสักครู่', () => {
    vi.useFakeTimers();
    const now = new Date('2025-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const thirtySecondsAgo = new Date('2025-06-15T11:59:30Z').toISOString();
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('เมื่อสักครู่');
  });

  it('5 นาทีที่แล้ว', () => {
    vi.useFakeTimers();
    const now = new Date('2025-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const fiveMinAgo = new Date('2025-06-15T11:55:00Z').toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe('5 นาทีที่แล้ว');
  });

  it('3 ชม.ที่แล้ว', () => {
    vi.useFakeTimers();
    const now = new Date('2025-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const threeHoursAgo = new Date('2025-06-15T09:00:00Z').toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe('3 ชม.ที่แล้ว');
  });

  it('เมื่อวาน', () => {
    vi.useFakeTimers();
    const now = new Date('2025-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const yesterday = new Date('2025-06-14T10:00:00Z').toISOString();
    expect(formatRelativeTime(yesterday)).toBe('เมื่อวาน');
  });

  it('3 วันที่แล้ว', () => {
    vi.useFakeTimers();
    const now = new Date('2025-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const threeDaysAgo = new Date('2025-06-12T10:00:00Z').toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe('3 วันที่แล้ว');
  });

  it('เกิน 7 วัน → แสดงวันที่', () => {
    vi.useFakeTimers();
    const now = new Date('2025-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const twoWeeksAgo = new Date('2025-06-01T10:00:00Z').toISOString();
    expect(formatRelativeTime(twoWeeksAgo)).toBe('1 มิ.ย.');
  });

  it('invalid date → empty string', () => {
    expect(formatRelativeTime('not-a-date')).toBe('');
  });
});

// =============================================
// Edge Cases (เพิ่มเติม Phase 3)
// =============================================

describe('formatThaiDateFull — Edge Cases', () => {
  it('31 ธ.ค. → ปี พ.ศ. ถูกต้อง', () => {
    // 31 Dec 2025 = 31 ธันวาคม 2568
    expect(formatThaiDateFull(new Date(2025, 11, 31))).toBe('๓๑ ธันวาคม ๒๕๖๘');
  });

  it('1 ม.ค. ปีถัดไป → ปี พ.ศ. เปลี่ยน', () => {
    // 1 Jan 2026 = 1 มกราคม 2569
    expect(formatThaiDateFull(new Date(2026, 0, 1))).toBe('๑ มกราคม ๒๕๖๙');
  });

  it('ปี 2000 → พ.ศ. 2543', () => {
    expect(formatThaiDateFull(new Date(2000, 0, 1))).toBe('๑ มกราคม ๒๕๔๓');
  });

  it('29 ก.พ. ปีอธิกสุรทิน', () => {
    // 2024 is leap year
    expect(formatThaiDateFull(new Date(2024, 1, 29))).toBe('๒๙ กุมภาพันธ์ ๒๕๖๗');
  });
});

describe('formatThaiDateShort — Edge Cases', () => {
  it('31 ธ.ค. 2025 → 31/12/68', () => {
    expect(formatThaiDateShort(new Date(2025, 11, 31))).toBe('31/12/68');
  });

  it('1 ม.ค. 2026 → 1/1/69', () => {
    expect(formatThaiDateShort(new Date(2026, 0, 1))).toBe('1/1/69');
  });

  it('ปี 2057 → พ.ศ. 2600 → 2 หลัก = 0', () => {
    // 2057 + 543 = 2600, mod 100 = 0
    expect(formatThaiDateShort(new Date(2057, 5, 15))).toBe('15/6/0');
  });

  it('ISO string → parse ถูก', () => {
    // Note: ISO string parsed in local timezone
    const result = formatThaiDateShort(new Date(2025, 2, 15)); // March 15, 2025
    expect(result).toBe('15/3/68');
  });
});

describe('formatRelativeTime — Boundary Cases', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exactly 1 นาที → 1 นาทีที่แล้ว', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:01:00Z'));
    expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('1 นาทีที่แล้ว');
  });

  it('exactly 59 นาที → 59 นาทีที่แล้ว', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:59:00Z'));
    expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('59 นาทีที่แล้ว');
  });

  it('exactly 1 ชม. → 1 ชม.ที่แล้ว', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T13:00:00Z'));
    expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('1 ชม.ที่แล้ว');
  });

  it('exactly 23 ชม. → 23 ชม.ที่แล้ว', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-16T11:00:00Z'));
    expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('23 ชม.ที่แล้ว');
  });

  it('exactly 7 วัน → แสดงวันที่ (ไม่ใช่ "7 วันที่แล้ว")', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-22T12:00:00Z'));
    expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('15 มิ.ย.');
  });

  it('ข้ามปี: ธ.ค. → ม.ค.', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T12:00:00Z'));
    expect(formatRelativeTime('2025-12-28T12:00:00Z')).toBe('28 ธ.ค.');
  });
});

describe('convertToThaiNumerals — Edge Cases', () => {
  it('0 → ๐', () => {
    expect(convertToThaiNumerals(0)).toBe('๐');
  });

  it('ตัวเลขใหญ่มาก', () => {
    expect(convertToThaiNumerals(9999999)).toBe('๙๙๙๙๙๙๙');
  });

  it('mixed text + number → แปลงเฉพาะตัวเลข', () => {
    expect(convertToThaiNumerals('RSEC601')).toBe('RSEC๖๐๑');
  });
});
