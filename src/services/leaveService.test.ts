import { describe, it, expect } from 'vitest';
import {
  addManualRegistryEntry,
  approveLeave,
  canSignNow,
  createLeaveRequest,
  getLeaveRegistry,
  getNextDocNumber,
} from './leaveService';

describe('canSignNow', () => {
  // order 1 = หน.บุคคล's turn (status: pending)
  // order 2 = ผอ.'s turn (status: in_progress)

  describe('ผอ. only', () => {
    it('order=1 (รอ หน.บุคคล) → false : ผอ.ยังไม่ถึงคิว', () => {
      expect(canSignNow({ current_signer_order: 1 }, ['director'])).toBe(false);
    });

    it('order=2 (รอ ผอ.) → true : ผอ.ถึงคิวแล้ว', () => {
      expect(canSignNow({ current_signer_order: 2 }, ['director'])).toBe(true);
    });
  });

  describe('หน.บุคคล only', () => {
    it('order=1 (รอ หน.บุคคล) → true', () => {
      expect(canSignNow({ current_signer_order: 1 }, ['hr_head'])).toBe(true);
    });

    it('order=2 (รอ ผอ.) → false : หน.บุคคล เซ็นไปแล้ว ไม่ใช่คิวตัวเอง', () => {
      expect(canSignNow({ current_signer_order: 2 }, ['hr_head'])).toBe(false);
    });
  });

  describe('admin ที่มีทั้ง 2 role', () => {
    it('order=1 → true : กดแทน หน.บุคคล ได้', () => {
      expect(
        canSignNow({ current_signer_order: 1 }, ['hr_head', 'director']),
      ).toBe(true);
    });

    it('order=2 → true : กดแทน ผอ. ได้', () => {
      expect(
        canSignNow({ current_signer_order: 2 }, ['hr_head', 'director']),
      ).toBe(true);
    });
  });

  it('ไม่มี role → false', () => {
    expect(canSignNow({ current_signer_order: 1 }, [])).toBe(false);
    expect(canSignNow({ current_signer_order: 2 }, [])).toBe(false);
  });
});

// SKIP: เดิมเทสกับ _mockStore (in-memory). หลัง migrate ไป Supabase v2 (มี.ค. 2569)
// service เรียก Supabase RPC โดยตรง — ต้องเซ็ต Supabase test harness ก่อน
// (หรือเขียน integration test แยก). TODO: ฟื้นชุดนี้เป็น DB-backed test.
describe.skip('doc_number registry (needs Supabase test harness)', () => {
  it('getNextDocNumber → 4-digit zero-padded', () => {
    const n = getNextDocNumber();
    expect(n).toMatch(/^\d{4,}$/);
    expect(n.length).toBeGreaterThanOrEqual(4);
  });

  it('addManualRegistryEntry → status=approved + entry_source=manual + doc_number', async () => {
    const before = getNextDocNumber();
    const entry = await addManualRegistryEntry({
      user_name: 'นายทดสอบ ระบบ',
      user_position: 'ครู',
      leave_type: 'personal_leave',
      start_date: '2026-05-01',
      end_date: '2026-05-01',
      reason: 'ลาย้อนหลัง (กระดาษ)',
    });
    expect(entry.doc_number).toBe(before);
    expect(entry.status).toBe('approved');
    expect(entry.entry_source).toBe('manual');
    expect(entry.doc_number_at).toBeTruthy();
  });

  it('เลขเดินต่อเนื่อง — สอง manual ติดกัน +1', async () => {
    const a = await addManualRegistryEntry({
      user_name: 'A', user_position: 'X', leave_type: 'sick_leave',
      start_date: '2026-01-01', end_date: '2026-01-01', reason: 'test',
    });
    const b = await addManualRegistryEntry({
      user_name: 'B', user_position: 'X', leave_type: 'sick_leave',
      start_date: '2026-01-01', end_date: '2026-01-01', reason: 'test',
    });
    expect(Number.parseInt(b.doc_number!, 10)).toBe(
      Number.parseInt(a.doc_number!, 10) + 1,
    );
  });

  it('approveLeave (HR head) → ออกเลขทะเบียน; (ผอ.) → ไม่ออกใหม่', async () => {
    const req = await createLeaveRequest(
      'test-user',
      'นายทดสอบ คิวเลข',
      'ครู',
      {
        leave_type: 'annual_leave',
        start_date: '2026-06-01',
        end_date: '2026-06-01',
        reason: 'ทดสอบรันเลข',
      },
    );
    expect(req.doc_number).toBeFalsy();

    const afterHr = await approveLeave(req.id, {
      user_id: 'hr-1',
      user_name: 'หน.บุคคล',
      role: 'hr_head',
    });
    expect(afterHr.doc_number).toMatch(/^\d{4,}$/);
    const numAfterHr = afterHr.doc_number;

    const afterDir = await approveLeave(req.id, {
      user_id: 'dir-1',
      user_name: 'ผอ.',
      role: 'director',
    });
    // ผอ.ลงนามแล้วเลขเดิม ไม่ใช่ออกใหม่
    expect(afterDir.doc_number).toBe(numAfterHr);
    expect(afterDir.status).toBe('approved');
  });

  it('getLeaveRegistry → เรียงเลขมาก→น้อย', async () => {
    const list = await getLeaveRegistry();
    expect(list.length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i++) {
      const prev = Number.parseInt(list[i - 1].doc_number ?? '0', 10);
      const curr = Number.parseInt(list[i].doc_number ?? '0', 10);
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });
});
