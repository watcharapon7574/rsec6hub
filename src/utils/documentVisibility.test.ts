import { describe, it, expect } from 'vitest';
import { shouldShowMemo, DocumentVisibilityParams, parseSecretaryRole } from './documentVisibility';

// === UT: parseSecretaryRole ===

describe('parseSecretaryRole', () => {
  it('เลขาฝ่ายบริหารทั่วไป → isSecretary + department', () => {
    const result = parseSecretaryRole('เลขาฝ่ายบริหารทั่วไป');
    expect(result.isSecretary).toBe(true);
    expect(result.department).toBe('ฝ่ายบริหารทั่วไป');
  });

  it('เลขาฝ่ายบริหารกิจการพิเศษ', () => {
    const result = parseSecretaryRole('เลขาฝ่ายบริหารกิจการพิเศษ');
    expect(result.isSecretary).toBe(true);
    expect(result.department).toBe('ฝ่ายบริหารกิจการพิเศษ');
  });

  it('เลขาฝ่ายบริหารงบประมาณ', () => {
    expect(parseSecretaryRole('เลขาฝ่ายบริหารงบประมาณ').department).toBe('ฝ่ายบริหารงบประมาณ');
  });

  it('เลขาฝ่ายบริหารงานบุคคล', () => {
    expect(parseSecretaryRole('เลขาฝ่ายบริหารงานบุคคล').department).toBe('ฝ่ายบริหารงานบุคคล');
  });

  it('เลขาฝ่ายบริหารวิชาการ', () => {
    expect(parseSecretaryRole('เลขาฝ่ายบริหารวิชาการ').department).toBe('ฝ่ายบริหารวิชาการ');
  });

  it('หัวหน้าฝ่าย → ไม���ใช่เลขา', () => {
    const result = parseSecretaryRole('หัวหน้าฝ่ายบริหารทั่วไป');
    expect(result.isSecretary).toBe(false);
    expect(result.department).toBe(null);
  });

  it('ครู → ไม่ใช่เลขา', () => {
    expect(parseSecretaryRole('ครู').isSecretary).toBe(false);
  });

  it('empty string → ไม่ใช่เลขา', () => {
    expect(parseSecretaryRole('').isSecretary).toBe(false);
  });

  it('null → ไม่ใช่เลขา', () => {
    expect(parseSecretaryRole(null).isSecretary).toBe(false);
  });

  it('undefined → ไม่ใช่เลขา', () => {
    expect(parseSecretaryRole(undefined).isSecretary).toBe(false);
  });
});

// === Helpers ===

const makeMemo = (overrides: Record<string, any> = {}) => ({
  id: 'memo-1',
  user_id: 'user-author',
  subject: 'ทดสอบ',
  stamp_department: null,
  status: 'pending_sign',
  current_signer_order: 2,
  form_data: {},
  signer_list_progress: null,
  signature_positions: null,
  ...overrides,
});

const makeParams = (overrides: Partial<DocumentVisibilityParams> = {}): DocumentVisibilityParams => ({
  permissions: { isAdmin: false, isClerk: false, position: 'government_teacher' },
  userId: 'user-viewer',
  isSecretary: false,
  secretaryDepartment: null,
  ...overrides,
});

// === Regression Tests: โค้ดเดิมที่ต้องไม่พัง ===

describe('shouldShowMemo — Regression (ระบบเดิ��)', () => {
  describe('Admin', () => {
    const params = makeParams({ permissions: { isAdmin: true, isClerk: false, position: 'director' } });

    it('เห็นเอกสารทุกฉบับ', () => {
      expect(shouldShowMemo(makeMemo(), params)).toBe(true);
    });

    it('เห็นเอกสารของคนอื่น', () => {
      expect(shouldShowMemo(makeMemo({ user_id: 'someone-else' }), params)).toBe(true);
    });

    it('เห็นเอกสาร draft', () => {
      expect(shouldShowMemo(makeMemo({ current_signer_order: 1 }), params)).toBe(true);
    });

    it('เห็นเอกสาร completed', () => {
      expect(shouldShowMemo(makeMemo({ current_signer_order: 5 }), params)).toBe(true);
    });

    it('เห็นเอกสาร rejected', () => {
      expect(shouldShowMemo(makeMemo({ current_signer_order: 0 }), params)).toBe(true);
    });
  });

  describe('Clerk (ธุรการ)', () => {
    const params = makeParams({ permissions: { isAdmin: false, isClerk: true, position: 'clerk_teacher' } });

    it('เห็นเอกสารทุกฉบับ', () => {
      expect(shouldShowMemo(makeMemo(), params)).toBe(true);
    });

    it('เห็นเอกสารของตัวเอง', () => {
      expect(shouldShowMemo(makeMemo({ user_id: params.userId }), params)).toBe(true);
    });

    it('เห็นเอกสารของคนอื่น', () => {
      expect(shouldShowMemo(makeMemo({ user_id: 'someone-else' }), params)).toBe(true);
    });
  });

  describe('Director (ผอ)', () => {
    const params = makeParams({ permissions: { isAdmin: false, isClerk: false, position: 'director' } });

    it('เห็นเอกสารทุกฉบับ', () => {
      expect(shouldShowMemo(makeMemo(), params)).toBe(true);
    });

    it('เห็นเอกสารของคนอื่น', () => {
      expect(shouldShowMemo(makeMemo({ user_id: 'someone-else' }), params)).toBe(true);
    });
  });

  describe('Assistant Director (ผช.ผอ / หัวหน้าฝ่าย)', () => {
    const userId = 'user-asst-director';
    const params = makeParams({
      permissions: { isAdmin: false, isClerk: false, position: 'assistant_director' },
      userId,
    });

    it('เห็นเอกสารที่ตัวเองอยู่ใน signer_list_progress', () => {
      const memo = makeMemo({
        signer_list_progress: [
          { user_id: 'user-clerk', order: 1, role: 'clerk' },
          { user_id: userId, order: 2, role: 'assistant_director' },
        ],
      });
      expect(shouldShowMemo(memo, params)).toBe(true);
    });

    it('ไม่เห็นเอกสารที่ตัวเองไม่อยู่ใน signer_list_progress', () => {
      const memo = makeMemo({
        signer_list_progress: [
          { user_id: 'user-clerk', order: 1, role: 'clerk' },
          { user_id: 'other-director', order: 2, role: 'assistant_director' },
        ],
      });
      expect(shouldShowMemo(memo, params)).toBe(false);
    });

    it('เห็น PDF Upload เสมอ', () => {
      const memo = makeMemo({
        form_data: { type: 'pdf_upload' },
        signer_list_progress: [],
      });
      expect(shouldShowMemo(memo, params)).toBe(true);
    });

    it('fallback ไป signature_positions ถ้าไม่มี signer_list_progress', () => {
      const memo = makeMemo({
        signer_list_progress: null,
        signature_positions: [{ signer: { user_id: userId, order: 2 } }],
      });
      expect(shouldShowMemo(memo, params)).toBe(true);
    });

    it('ไม่เห็นถ้าไม่มีทั้ง signer_list และ signature_positions', () => {
      const memo = makeMemo({
        signer_list_progress: null,
        signature_positions: null,
      });
      expect(shouldShowMemo(memo, params)).toBe(false);
    });
  });

  describe('Deputy Director (รองผอ)', () => {
    const userId = 'user-deputy';
    const params = makeParams({
      permissions: { isAdmin: false, isClerk: false, position: 'deputy_director' },
      userId,
    });

    it('เห็นเอกสารที่ตัวเองอยู่ใน signer_list_progress', () => {
      const memo = makeMemo({
        signer_list_progress: [{ user_id: userId, order: 3, role: 'deputy_director' }],
      });
      expect(shouldShowMemo(memo, params)).toBe(true);
    });

    it('ไม่เห็นเอกสารที่ตัวเองไม่อยู่ใน signer list', () => {
      const memo = makeMemo({
        signer_list_progress: [{ user_id: 'other-user', order: 3, role: 'deputy_director' }],
      });
      expect(shouldShowMemo(memo, params)).toBe(false);
    });
  });

  describe('Regular User (ครู / พนักงาน)', () => {
    const userId = 'user-teacher';
    const params = makeParams({
      permissions: { isAdmin: false, isClerk: false, position: 'government_teacher' },
      userId,
    });

    it('เห็นเอกสารของตัวเอง', () => {
      expect(shouldShowMemo(makeMemo({ user_id: userId }), params)).toBe(true);
    });

    it('ไม่เห็นเอกสารของคนอื่น', () => {
      expect(shouldShowMemo(makeMemo({ user_id: 'someone-else' }), params)).toBe(false);
    });
  });
});

// === New Feature Tests: เลขาฝ่าย ===

describe('shouldShowMemo — เลขาฝ่า�� (ฟีเจอร์ใหม่)', () => {
  const userId = 'user-secretary';
  const dept = 'ฝ่ายบริหารทั่วไป';
  const params = makeParams({
    permissions: { isAdmin: false, isClerk: false, position: 'government_employee' },
    userId,
    isSecretary: true,
    secretaryDepartment: dept,
  });

  it('เห็นเอกสารที่ stamp_department ตรงกับฝ่ายตัวเอง', () => {
    const memo = makeMemo({ stamp_department: dept, user_id: 'other-user' });
    expect(shouldShowMemo(memo, params)).toBe(true);
  });

  it('ไม่เห็นเอกสารของฝ่ายอื่น', () => {
    const memo = makeMemo({ stamp_department: 'ฝ่ายบริหารงบประมาณ', user_id: 'other-user' });
    expect(shouldShowMemo(memo, params)).toBe(false);
  });

  it('ไม่เห็นเอกสารที่ไม่มี stamp_department', () => {
    const memo = makeMemo({ stamp_department: null, user_id: 'other-user' });
    expect(shouldShowMemo(memo, params)).toBe(false);
  });

  it('เห็นเอกสารของตัวเองที่ตรงฝ่ายด้วย (แสดงได้ทั้ง 2 ที่)', () => {
    const memo = makeMemo({ stamp_department: dept, user_id: userId });
    expect(shouldShowMemo(memo, params)).toBe(true);
  });

  it('เห็นเอกสาร draft ของฝ่ายตัวเอง', () => {
    const memo = makeMemo({ stamp_department: dept, user_id: 'other', current_signer_order: 1 });
    expect(shouldShowMemo(memo, params)).toBe(true);
  });

  it('เห็นเอกสาร completed ของฝ่ายตัวเอง', () => {
    const memo = makeMemo({ stamp_department: dept, user_id: 'other', current_signer_order: 5 });
    expect(shouldShowMemo(memo, params)).toBe(true);
  });

  it('เห็นเอกสาร rejected ของฝ่ายตัวเอง', () => {
    const memo = makeMemo({ stamp_department: dept, user_id: 'other', current_signer_order: 0 });
    expect(shouldShowMemo(memo, params)).toBe(true);
  });
});

// === Edge Cases ===

describe('shouldShowMemo — Edge Cases', () => {
  it('isSecretary=true แต่ secretaryDepartment=null → fallback เป���น regular user', () => {
    const params = makeParams({
      permissions: { isAdmin: false, isClerk: false, position: 'government_employee' },
      userId: 'user-x',
      isSecretary: true,
      secretaryDepartment: null,
    });
    // ไม่เข้า secretary path → ใช้ regular user logic → เ��็นเฉพาะเอกสารตัวเอง
    expect(shouldShowMemo(makeMemo({ user_id: 'user-x' }), params)).toBe(true);
    expect(shouldShowMemo(makeMemo({ user_id: 'someone-else' }), params)).toBe(false);
  });

  it('คนท����เป็นทั้ง clerk และ secretary → clerk มา priority สูงกว่า เห็นทุกฉบับ', () => {
    const params = makeParams({
      permissions: { isAdmin: false, isClerk: true, position: 'clerk_teacher' },
      userId: 'user-clerk-sec',
      isSecretary: true,
      secretaryDepartment: 'ฝ่ายบริหารทั่วไป',
    });
    // clerk check มาก่อน secretary → เห็นทุกฉบับ
    expect(shouldShowMemo(makeMemo({ stamp_department: null, user_id: 'anyone' }), params)).toBe(true);
  });
});
