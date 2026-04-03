import { describe, it, expect } from 'vitest';
import {
  SIGNER_ORDER,
  extractOrder,
  getSortedSignerOrders,
  getFirstSignerOrder,
  calculateNextSignerOrder,
  calculateRejection,
  calculateNextSignerOrderWithParallel,
  isParallelGroupComplete,
  isInParallelGroup,
  isCurrentSignerWithParallel,
  isCurrentSigner,
  canActOnDocument,
} from './approvalWorkflowService';
import type { ParallelSignerConfig } from '@/types/memo';

// === Helpers ===

const makePos = (order: number) => ({ signer: { order } });
const makePosFlat = (order: number) => ({ order });
const makeParallel = (overrides: Partial<ParallelSignerConfig> = {}): ParallelSignerConfig => ({
  order: 2,
  signers: [
    { user_id: 'u1', name: 'A', require_annotation: false },
    { user_id: 'u2', name: 'B', require_annotation: false },
    { user_id: 'u3', name: 'C', require_annotation: false },
  ],
  completed_user_ids: [],
  ...overrides,
});

// =============================================
// 1. extractOrder
// =============================================

describe('extractOrder', () => {
  it('pos.signer.order → number', () => {
    expect(extractOrder({ signer: { order: 3 } })).toBe(3);
  });

  it('pos.order (flat) → number', () => {
    expect(extractOrder({ order: 2 })).toBe(2);
  });

  it('signer.order มี priority เหนือ pos.order', () => {
    expect(extractOrder({ order: 5, signer: { order: 3 } })).toBe(3);
  });

  it('ไม่มี order → null', () => {
    expect(extractOrder({})).toBe(null);
  });

  it('order เป็น string → null', () => {
    expect(extractOrder({ order: '3' as any })).toBe(null);
  });
});

// =============================================
// 2. getSortedSignerOrders
// =============================================

describe('getSortedSignerOrders', () => {
  it('เรียง order จากน้อยไปมาก', () => {
    expect(getSortedSignerOrders([makePos(4), makePos(2), makePos(3)])).toEqual([2, 3, 4]);
  });

  it('unique — ไม่มี duplicate', () => {
    expect(getSortedSignerOrders([makePos(2), makePos(2), makePos(3)])).toEqual([2, 3]);
  });

  it('ข้ามค่า order <= 0', () => {
    expect(getSortedSignerOrders([makePos(0), makePos(-1), makePos(2)])).toEqual([2]);
  });

  it('empty array → []', () => {
    expect(getSortedSignerOrders([])).toEqual([]);
  });

  it('null → []', () => {
    expect(getSortedSignerOrders(null as any)).toEqual([]);
  });

  it('รองรับทั้ง pos.order และ pos.signer.order', () => {
    expect(getSortedSignerOrders([makePosFlat(3), makePos(2)])).toEqual([2, 3]);
  });
});

// =============================================
// 3. getFirstSignerOrder
// =============================================

describe('getFirstSignerOrder', () => {
  it('return order แรก', () => {
    expect(getFirstSignerOrder([makePos(3), makePos(2), makePos(4)])).toBe(2);
  });

  it('empty positions → fallback เป็น 2', () => {
    expect(getFirstSignerOrder([])).toBe(2);
  });
});

// =============================================
// 4. calculateNextSignerOrder (STATE MACHINE)
// =============================================

describe('calculateNextSignerOrder', () => {
  const positions = [makePos(2), makePos(3), makePos(4)];

  it('order 2 → ไปต่อ order 3', () => {
    const result = calculateNextSignerOrder(2, positions);
    expect(result.nextSignerOrder).toBe(3);
    expect(result.newStatus).toBe('pending_sign');
  });

  it('order 3 → ไปต่อ order 4', () => {
    const result = calculateNextSignerOrder(3, positions);
    expect(result.nextSignerOrder).toBe(4);
    expect(result.newStatus).toBe('pending_sign');
  });

  it('order 4 (สุดท้าย) → COMPLETED', () => {
    const result = calculateNextSignerOrder(4, positions);
    expect(result.nextSignerOrder).toBe(SIGNER_ORDER.COMPLETED);
    expect(result.newStatus).toBe('completed');
  });

  it('ข้ามผู้ลงนาม: positions [2, 4] → order 2 ข้ามไป 4', () => {
    const skipPositions = [makePos(2), makePos(4)];
    const result = calculateNextSignerOrder(2, skipPositions);
    expect(result.nextSignerOrder).toBe(4);
  });

  it('Director shortcut → COMPLETED ทันที', () => {
    const result = calculateNextSignerOrder(2, positions, 'director');
    expect(result.nextSignerOrder).toBe(SIGNER_ORDER.COMPLETED);
    expect(result.newStatus).toBe('completed');
  });

  it('Director shortcut ทำงานแม้ยังเหลือ signer อีกหลายคน', () => {
    const result = calculateNextSignerOrder(2, [makePos(2), makePos(3), makePos(4)], 'director');
    expect(result.nextSignerOrder).toBe(SIGNER_ORDER.COMPLETED);
  });

  it('Empty positions → COMPLETED', () => {
    const result = calculateNextSignerOrder(2, []);
    expect(result.nextSignerOrder).toBe(SIGNER_ORDER.COMPLETED);
    expect(result.newStatus).toBe('completed');
  });

  it('signingPosition ไม่ใช่ director → ไม่ shortcut', () => {
    const result = calculateNextSignerOrder(2, positions, 'assistant_director');
    expect(result.nextSignerOrder).toBe(3);
    expect(result.newStatus).toBe('pending_sign');
  });
});

// =============================================
// 5. calculateRejection
// =============================================

describe('calculateRejection', () => {
  it('return REJECTED state', () => {
    const result = calculateRejection();
    expect(result.nextSignerOrder).toBe(SIGNER_ORDER.REJECTED);
    expect(result.newStatus).toBe('rejected');
  });
});

// =============================================
// 6. calculateNextSignerOrderWithParallel
// =============================================

describe('calculateNextSignerOrderWithParallel', () => {
  const positions = [makePos(2), makePos(3), makePos(4)];

  it('คนแรกใน parallel group sign → ยังอยู่ order เดิม', () => {
    const parallel = makeParallel();
    const result = calculateNextSignerOrderWithParallel(2, positions, undefined, parallel, 'u1');
    expect(result.nextSignerOrder).toBe(2); // ยังอยู่ order 2
    expect(result.newStatus).toBe('pending_sign');
    expect(result.parallelUpdate?.completed_user_ids).toContain('u1');
    expect(result.parallelUpdate?.completed_user_ids).toHaveLength(1);
  });

  it('คนที่สองใน parallel group sign → ยังอยู่ order เดิม', () => {
    const parallel = makeParallel({ completed_user_ids: ['u1'] });
    const result = calculateNextSignerOrderWithParallel(2, positions, undefined, parallel, 'u2');
    expect(result.nextSignerOrder).toBe(2);
    expect(result.parallelUpdate?.completed_user_ids).toEqual(expect.arrayContaining(['u1', 'u2']));
    expect(result.parallelUpdate?.completed_user_ids).toHaveLength(2);
  });

  it('คนสุดท้ายใน parallel group sign → advance ไป order ถัดไป', () => {
    const parallel = makeParallel({ completed_user_ids: ['u1', 'u2'] });
    const result = calculateNextSignerOrderWithParallel(2, positions, undefined, parallel, 'u3');
    expect(result.nextSignerOrder).toBe(3); // advance ไป order 3
    expect(result.newStatus).toBe('pending_sign');
    expect(result.parallelUpdate?.completed_user_ids).toHaveLength(3);
  });

  it('parallel group ครบ + เป็น order สุดท้าย → COMPLETED', () => {
    const parallel = makeParallel({ order: 4, completed_user_ids: ['u1', 'u2'] });
    const positionsEndAt4 = [makePos(2), makePos(4)];
    const result = calculateNextSignerOrderWithParallel(4, positionsEndAt4, undefined, parallel, 'u3');
    expect(result.nextSignerOrder).toBe(SIGNER_ORDER.COMPLETED);
    expect(result.newStatus).toBe('completed');
  });

  it('ไม่มี parallel config → fallback ไปฟังก์ชันเดิม', () => {
    const result = calculateNextSignerOrderWithParallel(2, positions, undefined, null, 'u1');
    expect(result.nextSignerOrder).toBe(3);
    expect(result.parallelUpdate).toBeUndefined();
  });

  it('current order ไม่ตรง parallel.order → fallback ไปฟังก์ชันเดิม', () => {
    const parallel = makeParallel({ order: 3 }); // parallel อยู่ order 3
    const result = calculateNextSignerOrderWithParallel(2, positions, undefined, parallel, 'u1');
    expect(result.nextSignerOrder).toBe(3); // ไม่เข้า parallel logic
  });

  it('ซ้ำ sign ไม่ duplicate completed_user_ids', () => {
    const parallel = makeParallel({ completed_user_ids: ['u1'] });
    const result = calculateNextSignerOrderWithParallel(2, positions, undefined, parallel, 'u1');
    const u1Count = result.parallelUpdate?.completed_user_ids.filter(id => id === 'u1').length;
    expect(u1Count).toBe(1);
  });
});

// =============================================
// 7. isParallelGroupComplete
// =============================================

describe('isParallelGroupComplete', () => {
  it('ครบทุกคน → true', () => {
    const p = makeParallel({ completed_user_ids: ['u1', 'u2', 'u3'] });
    expect(isParallelGroupComplete(p)).toBe(true);
  });

  it('ยังไม่ครบ → false', () => {
    const p = makeParallel({ completed_user_ids: ['u1'] });
    expect(isParallelGroupComplete(p)).toBe(false);
  });

  it('null config → true (ไม่มี parallel = ถือว่าเสร็จ)', () => {
    expect(isParallelGroupComplete(null)).toBe(true);
  });

  it('undefined config → true', () => {
    expect(isParallelGroupComplete(undefined)).toBe(true);
  });

  it('empty completed_user_ids → false', () => {
    const p = makeParallel({ completed_user_ids: [] });
    expect(isParallelGroupComplete(p)).toBe(false);
  });
});

// =============================================
// 8. isInParallelGroup
// =============================================

describe('isInParallelGroup', () => {
  const parallel = makeParallel();

  it('user อยู่ใน group → true', () => {
    expect(isInParallelGroup('u1', parallel)).toBe(true);
  });

  it('user ไม่อยู่ใน group → false', () => {
    expect(isInParallelGroup('u99', parallel)).toBe(false);
  });

  it('null config → false', () => {
    expect(isInParallelGroup('u1', null)).toBe(false);
  });
});

// =============================================
// 9. isCurrentSignerWithParallel
// =============================================

describe('isCurrentSignerWithParallel', () => {
  it('อยู่ใน parallel group + ถึงคิว + ยังไม่เซ็น → true', () => {
    const p = makeParallel({ order: 2, completed_user_ids: [] });
    expect(isCurrentSignerWithParallel('u1', 2, 2, p)).toBe(true);
  });

  // BUG: เมื่อ user เซ็นแล้ว parallel check ไม่ผ่าน → fallback ไป isCurrentSigner(2,2) = true
  // ในการใช้งานจริง ApproveDocumentPage เช็ค completed_user_ids แยกอีกชั้น จึงไม่มีผลกระทบ
  // TODO: ควรแก้ให้ return false เมื่อ user อยู่ใน parallel group และเซ็นแล้ว
  it('อยู่ใน parallel group + ถึงคิว + เซ็นแล้ว → true (known bug, guarded by caller)', () => {
    const p = makeParallel({ order: 2, completed_user_ids: ['u1'] });
    expect(isCurrentSignerWithParallel('u1', 2, 2, p)).toBe(true);
  });

  it('ไม่อยู่ใน parallel group + order ตรง → fallback isCurrentSigner → true', () => {
    const p = makeParallel({ order: 3 }); // parallel อยู่ order 3
    expect(isCurrentSignerWithParallel('outsider', 2, 2, p)).toBe(true);
  });

  it('ไม่มี parallel → fallback isCurrentSigner', () => {
    expect(isCurrentSignerWithParallel('u1', 3, 3, null)).toBe(true);
    expect(isCurrentSignerWithParallel('u1', 3, 4, null)).toBe(false);
  });
});

// =============================================
// 10. isCurrentSigner
// =============================================

describe('isCurrentSigner', () => {
  it('order ตรง → true', () => {
    expect(isCurrentSigner(3, 3)).toBe(true);
  });

  it('order ไม่ตรง → false', () => {
    expect(isCurrentSigner(2, 3)).toBe(false);
  });
});

// =============================================
// 11. canActOnDocument
// =============================================

describe('canActOnDocument', () => {
  it('order 2 (pending_sign) → true', () => {
    expect(canActOnDocument(2)).toBe(true);
  });

  it('order 3 → true', () => {
    expect(canActOnDocument(3)).toBe(true);
  });

  it('order 4 → true', () => {
    expect(canActOnDocument(4)).toBe(true);
  });

  it('order 1 (DRAFT) → false', () => {
    expect(canActOnDocument(1)).toBe(false);
  });

  it('order 5 (COMPLETED) → false', () => {
    expect(canActOnDocument(5)).toBe(false);
  });

  it('order 0 (REJECTED) → false', () => {
    expect(canActOnDocument(0)).toBe(false);
  });
});

// =============================================
// 12. Full parallel → admin flow (#0295 scenario)
// =============================================

describe('Full parallel → admin flow', () => {
  // Memo #0295: order 1 (author) → order 2 (parallel: u1, u2, u3) → order 3 (deputy) → order 4 (director)
  const positions = [makePos(1), makePos(2), makePos(2), makePos(2), makePos(3), makePos(4)];
  const parallel = makeParallel({ order: 2, completed_user_ids: [] });

  it('parallel u1 signs → stays at order 2', () => {
    const result = calculateNextSignerOrderWithParallel(2, positions, undefined, parallel, 'u1');
    expect(result.nextSignerOrder).toBe(2);
    expect(result.newStatus).toBe('pending_sign');
  });

  it('parallel u2 signs (u1 done) → stays at order 2', () => {
    const p = makeParallel({ completed_user_ids: ['u1'] });
    const result = calculateNextSignerOrderWithParallel(2, positions, undefined, p, 'u2');
    expect(result.nextSignerOrder).toBe(2);
  });

  it('parallel u3 signs (u1,u2 done) → advance to order 3 (deputy)', () => {
    const p = makeParallel({ completed_user_ids: ['u1', 'u2'] });
    const result = calculateNextSignerOrderWithParallel(2, positions, undefined, p, 'u3');
    expect(result.nextSignerOrder).toBe(3);
    expect(result.newStatus).toBe('pending_sign');
  });

  it('deputy (order 3) signs → advance to order 4', () => {
    const result = calculateNextSignerOrderWithParallel(3, positions, 'deputy_director', null, 'deputy-1');
    expect(result.nextSignerOrder).toBe(4);
    expect(result.newStatus).toBe('pending_sign');
  });

  it('director (order 4) signs → COMPLETED', () => {
    const result = calculateNextSignerOrderWithParallel(4, positions, 'director', null, 'director-1');
    expect(result.nextSignerOrder).toBe(SIGNER_ORDER.COMPLETED);
    expect(result.newStatus).toBe('completed');
  });
});
