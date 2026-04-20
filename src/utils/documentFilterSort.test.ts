import { describe, it, expect } from 'vitest';
import {
  filterBySearch,
  filterByStatus,
  filterByType,
  filterByAssignment,
  sortMemos,
} from './documentFilterSort';

const makeMemo = (overrides: Record<string, any> = {}) => ({
  id: 'memo-1',
  subject: 'ขอความอนุเคราะห์',
  creator_name: 'วัชรพล',
  doc_number: '001/2569',
  current_signer_order: 2,
  status: 'pending_sign',
  is_assigned: false,
  __source_table: 'memo',
  form_data: {},
  created_at: '2025-03-01T00:00:00Z',
  updated_at: '2025-03-02T00:00:00Z',
  ...overrides,
});

// =============================================
// filterBySearch
// =============================================

describe('filterBySearch', () => {
  const memos = [
    makeMemo({ id: '1', subject: 'ขอความอนุเคราะห์จัดงาน' }),
    makeMemo({ id: '2', subject: 'รายงานผลการดำเนินงาน', creator_name: 'สมชาย' }),
    makeMemo({ id: '3', doc_number: '099/2569' }),
  ];

  it('empty search → return ทั้งหมด', () => {
    expect(filterBySearch(memos, '')).toHaveLength(3);
  });

  it('ค้นหาจาก subject', () => {
    expect(filterBySearch(memos, 'จัดงาน')).toHaveLength(1);
  });

  it('ค้นหาจาก creator_name', () => {
    expect(filterBySearch(memos, 'สมชาย')).toHaveLength(1);
  });

  it('ค้นหาจาก doc_number', () => {
    expect(filterBySearch(memos, '099')).toHaveLength(1);
  });

  it('case insensitive', () => {
    const memos2 = [makeMemo({ subject: 'ABC Report' })];
    expect(filterBySearch(memos2, 'abc')).toHaveLength(1);
  });

  it('ไม่เจอ → empty', () => {
    expect(filterBySearch(memos, 'ไม่มีคำนี้')).toHaveLength(0);
  });
});

// =============================================
// filterByStatus
// =============================================

describe('filterByStatus', () => {
  const memos = [
    makeMemo({ id: '1', current_signer_order: 1, status: 'draft' }),
    makeMemo({ id: '2', current_signer_order: 2, status: 'pending_sign' }),
    makeMemo({ id: '3', current_signer_order: 3, status: 'pending_sign' }),
    makeMemo({ id: '4', current_signer_order: 5, status: 'completed' }),
    makeMemo({ id: '5', current_signer_order: 0, status: 'rejected' }),
    // signer order 5 ที่ยังไม่เซ็น (ผอ.) — ต้องอยู่ใน pending_sign ไม่ใช่ completed
    makeMemo({ id: '6', current_signer_order: 5, status: 'pending_sign' }),
  ];

  it('all → return ทั้งหมด', () => {
    expect(filterByStatus(memos, 'all')).toHaveLength(6);
  });

  it('draft → status=draft', () => {
    expect(filterByStatus(memos, 'draft')).toHaveLength(1);
  });

  it('pending_sign → status=pending_sign (รวม signer order 5 ที่ยังไม่เซ็น)', () => {
    expect(filterByStatus(memos, 'pending_sign')).toHaveLength(3);
  });

  it('completed → status=completed', () => {
    expect(filterByStatus(memos, 'completed')).toHaveLength(1);
  });

  it('rejected → status=rejected', () => {
    expect(filterByStatus(memos, 'rejected')).toHaveLength(1);
  });
});

// =============================================
// filterByType
// =============================================

describe('filterByType', () => {
  const memos = [
    makeMemo({ id: '1', __source_table: undefined }),
    makeMemo({ id: '2', __source_table: 'doc_receive' }),
    makeMemo({ id: '3', __source_table: 'doc_receive' }),
  ];

  it('all → return ทั้งหมด', () => {
    expect(filterByType(memos, 'all')).toHaveLength(3);
  });

  it('memo → ไม่ใช่ doc_receive', () => {
    expect(filterByType(memos, 'memo')).toHaveLength(1);
  });

  it('doc_receive → เฉพาะ doc_receive', () => {
    expect(filterByType(memos, 'doc_receive')).toHaveLength(2);
  });
});

// =============================================
// filterByAssignment
// =============================================

describe('filterByAssignment', () => {
  const memos = [
    makeMemo({ id: '1', current_signer_order: 5, status: 'completed', is_assigned: true }),
    makeMemo({ id: '2', current_signer_order: 5, status: 'completed', is_assigned: false }),
    makeMemo({ id: '3', current_signer_order: 2, status: 'pending_sign', is_assigned: false }),
  ];

  it('all → return ทั้งหมด', () => {
    expect(filterByAssignment(memos, 'all')).toHaveLength(3);
  });

  it('assigned → เฉพาะ is_assigned=true', () => {
    expect(filterByAssignment(memos, 'assigned')).toHaveLength(1);
  });

  it('not_assigned → completed + not assigned', () => {
    expect(filterByAssignment(memos, 'not_assigned')).toHaveLength(1);
    expect(filterByAssignment(memos, 'not_assigned')[0].id).toBe('2');
  });
});

// =============================================
// sortMemos
// =============================================

describe('sortMemos', () => {
  it('sort by updated_at desc (default)', () => {
    const memos = [
      makeMemo({ id: '1', updated_at: '2025-01-01T00:00:00Z' }),
      makeMemo({ id: '2', updated_at: '2025-03-01T00:00:00Z' }),
      makeMemo({ id: '3', updated_at: '2025-02-01T00:00:00Z' }),
    ];
    const sorted = sortMemos(memos, 'updated_at', 'desc');
    expect(sorted.map(m => m.id)).toEqual(['2', '3', '1']);
  });

  it('sort by updated_at asc', () => {
    const memos = [
      makeMemo({ id: '1', updated_at: '2025-03-01T00:00:00Z' }),
      makeMemo({ id: '2', updated_at: '2025-01-01T00:00:00Z' }),
    ];
    const sorted = sortMemos(memos, 'updated_at', 'asc');
    expect(sorted.map(m => m.id)).toEqual(['2', '1']);
  });

  it('sort by subject asc', () => {
    const memos = [
      makeMemo({ id: '1', subject: 'ข' }),
      makeMemo({ id: '2', subject: 'ก' }),
    ];
    const sorted = sortMemos(memos, 'subject', 'asc');
    expect(sorted.map(m => m.id)).toEqual(['2', '1']);
  });

  it('sort by status (current_signer_order)', () => {
    const memos = [
      makeMemo({ id: '1', current_signer_order: 5 }),
      makeMemo({ id: '2', current_signer_order: 1 }),
      makeMemo({ id: '3', current_signer_order: 3 }),
    ];
    const sorted = sortMemos(memos, 'status', 'asc');
    expect(sorted.map(m => m.id)).toEqual(['2', '3', '1']);
  });

  it('ไม่ mutate array ต้นฉบับ', () => {
    const memos = [
      makeMemo({ id: '2', updated_at: '2025-03-01T00:00:00Z' }),
      makeMemo({ id: '1', updated_at: '2025-01-01T00:00:00Z' }),
    ];
    const original = [...memos];
    sortMemos(memos, 'updated_at', 'asc');
    expect(memos.map(m => m.id)).toEqual(original.map(m => m.id));
  });
});
