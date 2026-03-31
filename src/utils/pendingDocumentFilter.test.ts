import { describe, it, expect } from 'vitest';
import { filterPendingMemos, PendingFilterProfile } from './pendingDocumentFilter';

// === Helpers ===

const makeMemo = (overrides: Record<string, any> = {}) => ({
  id: 'memo-1',
  user_id: 'author-1',
  subject: 'ทดสอบ',
  status: 'pending_sign',
  current_signer_order: 2,
  doc_del: null,
  signer_list_progress: null,
  parallel_signers: null,
  ...overrides,
});

const makeProfile = (overrides: Partial<PendingFilterProfile> = {}): PendingFilterProfile => ({
  user_id: 'viewer-1',
  is_admin: false,
  position: 'government_teacher',
  ...overrides,
});

// =============================================
// Executive (Admin / ผช.ผอ / รองผอ / ผอ)
// =============================================

describe('filterPendingMemos — Executive', () => {
  const profile = makeProfile({ position: 'assistant_director' });

  it('เห็น pending_sign order 2', () => {
    const result = filterPendingMemos([makeMemo({ current_signer_order: 2 })], profile);
    expect(result).toHaveLength(1);
  });

  it('เห็น pending_sign order 3', () => {
    const result = filterPendingMemos([makeMemo({ current_signer_order: 3 })], profile);
    expect(result).toHaveLength(1);
  });

  it('เห็น pending_sign order 4', () => {
    const result = filterPendingMemos([makeMemo({ current_signer_order: 4 })], profile);
    expect(result).toHaveLength(1);
  });

  it('ไม่เห็น draft (order 1)', () => {
    const result = filterPendingMemos([makeMemo({ current_signer_order: 1, status: 'draft' })], profile);
    expect(result).toHaveLength(0);
  });

  it('ไม่เห็น completed (order 5)', () => {
    const result = filterPendingMemos([makeMemo({ current_signer_order: 5, status: 'completed' })], profile);
    expect(result).toHaveLength(0);
  });

  it('ไม่เห็น soft deleted', () => {
    const result = filterPendingMemos([makeMemo({ doc_del: { deleted: true } })], profile);
    expect(result).toHaveLength(0);
  });

  it('Admin เห็นเหมือน executive', () => {
    const admin = makeProfile({ is_admin: true, position: 'government_teacher' });
    const result = filterPendingMemos([makeMemo({ current_signer_order: 3 })], admin);
    expect(result).toHaveLength(1);
  });

  it('Director เห็นเหมือน executive', () => {
    const director = makeProfile({ position: 'director' });
    const result = filterPendingMemos([makeMemo({ current_signer_order: 2 })], director);
    expect(result).toHaveLength(1);
  });

  it('Deputy Director เห็นเหมือน executive', () => {
    const deputy = makeProfile({ position: 'deputy_director' });
    const result = filterPendingMemos([makeMemo({ current_signer_order: 4 })], deputy);
    expect(result).toHaveLength(1);
  });
});

// =============================================
// Parallel Group Member
// =============================================

describe('filterPendingMemos — Parallel Group', () => {
  const profile = makeProfile({ user_id: 'u1', position: 'government_teacher' });

  it('อยู่ใน group + ถึงคิว + ยังไม่เซ็น → เห็น', () => {
    const memo = makeMemo({
      current_signer_order: 2,
      parallel_signers: {
        order: 2,
        signers: [{ user_id: 'u1', name: 'A', require_annotation: false }],
        completed_user_ids: [],
      },
    });
    expect(filterPendingMemos([memo], profile)).toHaveLength(1);
  });

  it('อยู่ใน group + เซ็นแล้ว → ไม่เห็น', () => {
    const memo = makeMemo({
      current_signer_order: 2,
      parallel_signers: {
        order: 2,
        signers: [{ user_id: 'u1', name: 'A', require_annotation: false }],
        completed_user_ids: ['u1'],
      },
    });
    expect(filterPendingMemos([memo], profile)).toHaveLength(0);
  });

  it('ไม่อยู่ใน group → ไม่เห็น', () => {
    const memo = makeMemo({
      current_signer_order: 2,
      parallel_signers: {
        order: 2,
        signers: [{ user_id: 'u99', name: 'X', require_annotation: false }],
        completed_user_ids: [],
      },
    });
    expect(filterPendingMemos([memo], profile)).toHaveLength(0);
  });

  it('ยังไม่ถึง parallel order → ไม่เห็น', () => {
    const memo = makeMemo({
      current_signer_order: 2,
      parallel_signers: {
        order: 3, // parallel อยู่ order 3 แต่เอกสารอยู่ order 2
        signers: [{ user_id: 'u1', name: 'A', require_annotation: false }],
        completed_user_ids: [],
      },
    });
    expect(filterPendingMemos([memo], profile)).toHaveLength(0);
  });
});

// =============================================
// Regular User (ครู)
// =============================================

describe('filterPendingMemos — Regular User', () => {
  const profile = makeProfile({ user_id: 'teacher-1', position: 'government_teacher' });

  it('ถึงคิว + ไม่ใช่เจ้าของ → เห็น', () => {
    const memo = makeMemo({
      user_id: 'author-1',
      current_signer_order: 2,
      signer_list_progress: [{ user_id: 'teacher-1', order: 2, role: 'signer' }],
    });
    expect(filterPendingMemos([memo], profile)).toHaveLength(1);
  });

  it('ยังไม่ถึงคิว → ไม่เห็น', () => {
    const memo = makeMemo({
      current_signer_order: 2,
      signer_list_progress: [{ user_id: 'teacher-1', order: 3, role: 'signer' }],
    });
    expect(filterPendingMemos([memo], profile)).toHaveLength(0);
  });

  it('เป็นเจ้าของเอกสาร → ไม่เห็น (ไม่ approve ตัวเอง)', () => {
    const memo = makeMemo({
      user_id: 'teacher-1', // เจ้าของ = ตัวเอง
      current_signer_order: 2,
      signer_list_progress: [{ user_id: 'teacher-1', order: 2, role: 'signer' }],
    });
    expect(filterPendingMemos([memo], profile)).toHaveLength(0);
  });

  it('ไม่อยู่ใน signer list → ไม่เห็น', () => {
    const memo = makeMemo({
      current_signer_order: 2,
      signer_list_progress: [{ user_id: 'other-user', order: 2, role: 'signer' }],
    });
    expect(filterPendingMemos([memo], profile)).toHaveLength(0);
  });

  it('ไม่มี signer_list_progress → ไม่เห็น', () => {
    const memo = makeMemo({ signer_list_progress: null });
    expect(filterPendingMemos([memo], profile)).toHaveLength(0);
  });
});

// =============================================
// Edge Cases
// =============================================

describe('filterPendingMemos — Edge Cases', () => {
  it('null profile → empty array', () => {
    expect(filterPendingMemos([makeMemo()], null)).toEqual([]);
  });

  it('empty memos → empty array', () => {
    expect(filterPendingMemos([], makeProfile())).toEqual([]);
  });

  it('rejected memo (order 0) + executive → ไม่เห็น (ไม่ใช่ pending_sign)', () => {
    const profile = makeProfile({ position: 'assistant_director' });
    const memo = makeMemo({ current_signer_order: 0, status: 'rejected' });
    expect(filterPendingMemos([memo], profile)).toHaveLength(0);
  });
});
