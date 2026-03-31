import { describe, it, expect } from 'vitest';
import { checkApprovalAccess, ApprovalProfile, ApprovalMemo } from './approvalPermission';

// === Helpers ===

const makeProfile = (overrides: Partial<ApprovalProfile> = {}): ApprovalProfile => ({
  user_id: 'viewer-1',
  is_admin: false,
  position: 'government_teacher',
  ...overrides,
});

const makeMemo = (overrides: Partial<ApprovalMemo> = {}): ApprovalMemo => ({
  status: 'pending_sign',
  current_signer_order: 2,
  signer_list_progress: null,
  signature_positions: null,
  parallel_signers: null,
  ...overrides,
});

// =============================================
// Admin
// =============================================

describe('checkApprovalAccess — Admin', () => {
  const admin = makeProfile({ is_admin: true });

  it('Admin เข้าได้ทุกเอกสาร', () => {
    const result = checkApprovalAccess(admin, makeMemo());
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('admin_bypass');
  });

  it('Admin เข้าได้แม้ไม่อยู่ใน signer list', () => {
    const result = checkApprovalAccess(admin, makeMemo({ signer_list_progress: [] }));
    expect(result.allowed).toBe(true);
  });

  it('Admin เข้าได้แม้เอกสาร draft', () => {
    const result = checkApprovalAccess(admin, makeMemo({ status: 'draft', current_signer_order: 1 }));
    expect(result.allowed).toBe(true);
  });
});

// =============================================
// Parallel Group
// =============================================

describe('checkApprovalAccess — Parallel Group', () => {
  const user = makeProfile({ user_id: 'u1' });

  it('อยู่ใน group + ถึงคิว + ยังไม่เซ็น → allowed', () => {
    const memo = makeMemo({
      current_signer_order: 2,
      parallel_signers: {
        order: 2,
        signers: [{ user_id: 'u1' }],
        completed_user_ids: [],
      },
    });
    const result = checkApprovalAccess(user, memo);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('parallel_turn');
  });

  it('อยู่ใน group + เซ็นแล้ว → ไม่ได้เข้า parallel_turn', () => {
    const memo = makeMemo({
      current_signer_order: 2,
      parallel_signers: {
        order: 2,
        signers: [{ user_id: 'u1' }],
        completed_user_ids: ['u1'],
      },
    });
    const result = checkApprovalAccess(user, memo);
    // ไม่เข้า parallel_turn แต่ยังเป็น parallel member → ไม่ redirect
    expect(result.reason).not.toBe('not_in_signer_list');
  });

  it('ไม่อยู่ใน group + ไม่อยู่ใน signer list → denied + redirect', () => {
    const memo = makeMemo({
      current_signer_order: 2,
      parallel_signers: {
        order: 2,
        signers: [{ user_id: 'u99' }],
        completed_user_ids: [],
      },
    });
    const result = checkApprovalAccess(user, memo);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not_in_signer_list');
  });
});

// =============================================
// Management Role (ผช.ผอ / รองผอ / ผอ)
// =============================================

describe('checkApprovalAccess — Management', () => {
  const asstDir = makeProfile({ user_id: 'asst-1', position: 'assistant_director' });

  it('มี signature ในเอกสาร → allowed', () => {
    const memo = makeMemo({
      current_signer_order: 3,
      signer_list_progress: [{ user_id: 'asst-1', order: 2, role: 'assistant_director' }],
    });
    const result = checkApprovalAccess(asstDir, memo);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('management_with_signature');
  });

  it('ไม่มี signature ในเอกสาร → denied', () => {
    const memo = makeMemo({
      signer_list_progress: [{ user_id: 'other-user', order: 2 }],
    });
    const result = checkApprovalAccess(asstDir, memo);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not_in_signer_list');
  });

  it('Deputy Director มี signature → allowed', () => {
    const deputy = makeProfile({ user_id: 'dep-1', position: 'deputy_director' });
    const memo = makeMemo({
      signature_positions: [{ signer: { user_id: 'dep-1', order: 3 } }],
    });
    const result = checkApprovalAccess(deputy, memo);
    expect(result.allowed).toBe(true);
  });

  it('Director (ไม่ใช่ admin) มี signature → allowed', () => {
    const director = makeProfile({ user_id: 'dir-1', position: 'director', is_admin: false });
    const memo = makeMemo({
      signer_list_progress: [{ user_id: 'dir-1', order: 4, role: 'director' }],
    });
    const result = checkApprovalAccess(director, memo);
    expect(result.allowed).toBe(true);
  });
});

// =============================================
// Regular User (ครู)
// =============================================

describe('checkApprovalAccess — Regular User', () => {
  const teacher = makeProfile({ user_id: 'teacher-1', position: 'government_teacher' });

  it('ถึงคิว (order ตรง) → allowed', () => {
    const memo = makeMemo({
      current_signer_order: 2,
      signer_list_progress: [{ user_id: 'teacher-1', order: 2 }],
    });
    const result = checkApprovalAccess(teacher, memo);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('current_signer');
  });

  it('ยังไม่ถึงคิว แต่อยู่ใน signer list → allowed (guarded)', () => {
    const memo = makeMemo({
      current_signer_order: 3,
      signer_list_progress: [{ user_id: 'teacher-1', order: 2 }],
    });
    const result = checkApprovalAccess(teacher, memo);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('signer_order_mismatch_but_allowed');
  });

  it('ไม่อยู่ใน signer list เลย → denied + redirect', () => {
    const memo = makeMemo({
      signer_list_progress: [{ user_id: 'other', order: 2 }],
    });
    const result = checkApprovalAccess(teacher, memo);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not_in_signer_list');
  });

  it('อยู่ใน signature_positions (fallback) + ถึงคิว → allowed', () => {
    const memo = makeMemo({
      current_signer_order: 2,
      signature_positions: [{ signer: { user_id: 'teacher-1', order: 2 } }],
    });
    const result = checkApprovalAccess(teacher, memo);
    expect(result.allowed).toBe(true);
  });
});

// =============================================
// Edge Cases
// =============================================

describe('checkApprovalAccess — Edge Cases', () => {
  it('null signer lists → denied', () => {
    const result = checkApprovalAccess(
      makeProfile(),
      makeMemo({ signer_list_progress: null, signature_positions: null })
    );
    expect(result.allowed).toBe(false);
  });

  it('empty signer lists → denied', () => {
    const result = checkApprovalAccess(
      makeProfile(),
      makeMemo({ signer_list_progress: [], signature_positions: [] })
    );
    expect(result.allowed).toBe(false);
  });
});
