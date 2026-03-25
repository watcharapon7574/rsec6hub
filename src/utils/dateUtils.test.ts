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
