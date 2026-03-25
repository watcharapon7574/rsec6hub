import { describe, it, expect } from 'vitest';
import { getStatusText } from './approvalUtils';

describe('getStatusText', () => {
  it('approved → อนุมัติแล้ว', () => {
    expect(getStatusText('approved')).toBe('อนุมัติแล้ว');
  });

  it('rejected → ปฏิเสธแล้ว', () => {
    expect(getStatusText('rejected')).toBe('ปฏิเสธแล้ว');
  });

  it('pending → รอดำเนินการ', () => {
    expect(getStatusText('pending')).toBe('รอดำเนินการ');
  });

  it('unknown status → รอดำเนินการ (default)', () => {
    expect(getStatusText('something_else')).toBe('รอดำเนินการ');
  });

  it('empty string → รอดำเนินการ (default)', () => {
    expect(getStatusText('')).toBe('รอดำเนินการ');
  });
});
