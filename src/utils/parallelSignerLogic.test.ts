import { describe, it, expect } from 'vitest';
import {
  splitParallelAndAdmins,
  buildAllSigners,
  findFirstAdminIndex,
  type Profile,
  type ParallelSignerConfig,
  type ParallelSigner,
  type Signer,
} from './parallelSignerLogic';

// === Test Data ===
const profiles: Profile[] = [
  { user_id: 'teacher-a', first_name: 'ภิชดา', last_name: 'สีดำ', position: 'government_teacher', prefix: 'นางสาว' },
  { user_id: 'teacher-b', first_name: 'อุบลวรรณ', last_name: 'อะวะโห', position: 'government_employee', prefix: 'นางสาว' },
  { user_id: 'deputy-1', first_name: 'ภาราดา', last_name: 'พัสลัง', position: 'deputy_director', prefix: 'นาง', org_structure_role: 'ปฏิบัติหน้าที่รองผู้อำนวยการ' },
  { user_id: 'assistant-1', first_name: 'ภัชรกุล', last_name: 'ม่วงงาม', position: 'assistant_director', prefix: 'นาย', org_structure_role: 'หัวหน้าฝ่ายบริหารงบประมาณ' },
  { user_id: 'director-1', first_name: 'กาญจนา', last_name: 'จันทอุปรี', position: 'director', prefix: 'นาง', org_structure_role: 'ผู้อำนวยการ' },
  { user_id: 'author-1', first_name: 'วัชรพล', last_name: 'อ่อนพันธ์', position: 'government_teacher', prefix: 'นาย' },
];

// =============================================
// splitParallelAndAdmins
// =============================================
describe('splitParallelAndAdmins', () => {
  it('ผู้เขียนเลือกแค่ครู → ทุกคนเป็น parallel, dropdown ว่าง', () => {
    const config: ParallelSignerConfig = {
      enabled: true,
      signer_user_ids: ['teacher-a', 'teacher-b'],
    };

    const result = splitParallelAndAdmins(config, profiles);

    expect(result.parallelSigners).toHaveLength(2);
    expect(result.selectedAssistant).toBe('');
    expect(result.selectedDeputy).toBe('');
  });

  it('ผู้เขียนเลือก ครู + ภาราดา(deputy) + กาญจนา(director) → แยกถูก', () => {
    const config: ParallelSignerConfig = {
      enabled: true,
      signer_user_ids: ['teacher-a', 'teacher-b', 'deputy-1', 'director-1'],
    };

    const result = splitParallelAndAdmins(config, profiles);

    // ครู 2 คนเป็น parallel
    expect(result.parallelSigners).toHaveLength(2);
    expect(result.parallelSigners.map(p => p.user_id)).toEqual(['teacher-a', 'teacher-b']);

    // ภาราดา → dropdown
    expect(result.selectedDeputy).toBe('deputy-1');

    // กาญจนา (director) → ข้าม (มีอยู่แล้ว)
    expect(result.selectedAssistant).toBe('');
  });

  it('ผู้เขียนเลือก ครู + ภัชรกุล(assistant) → ภัชรกุลไป dropdown', () => {
    const config: ParallelSignerConfig = {
      enabled: true,
      signer_user_ids: ['teacher-a', 'assistant-1'],
    };

    const result = splitParallelAndAdmins(config, profiles);

    expect(result.parallelSigners).toHaveLength(1);
    expect(result.parallelSigners[0].user_id).toBe('teacher-a');
    expect(result.selectedAssistant).toBe('assistant-1');
  });

  it('ผู้เขียนเลือกทุกคน → แยกผู้บริหารออกหมด', () => {
    const config: ParallelSignerConfig = {
      enabled: true,
      signer_user_ids: ['teacher-a', 'teacher-b', 'assistant-1', 'deputy-1', 'director-1'],
      annotation_required_for: ['teacher-a', 'deputy-1'],
    };

    const result = splitParallelAndAdmins(config, profiles);

    expect(result.parallelSigners).toHaveLength(2); // แค่ครู
    expect(result.selectedAssistant).toBe('assistant-1');
    expect(result.selectedDeputy).toBe('deputy-1');
    expect(result.annotationRequiredUserIds).toContain('teacher-a');
    expect(result.annotationRequiredUserIds).toContain('deputy-1');
  });

  it('ไม่ทับ dropdown ที่เลือกไว้แล้ว', () => {
    const config: ParallelSignerConfig = {
      enabled: true,
      signer_user_ids: ['deputy-1', 'teacher-a'],
    };

    // deputy ถูกเลือกไว้แล้วเป็นคนอื่น
    const result = splitParallelAndAdmins(config, profiles, '', 'other-deputy-id');

    // ไม่ทับ — ภาราดาเป็น parallel แทน
    expect(result.selectedDeputy).toBe('other-deputy-id');
    expect(result.parallelSigners).toHaveLength(2); // teacher-a + deputy-1 (ไม่ได้ไป dropdown)
  });

  it('เอกสารเก่าไม่มี config → return ว่าง', () => {
    const config: ParallelSignerConfig = {
      enabled: true,
      signer_user_ids: [],
    };

    const result = splitParallelAndAdmins(config, profiles);

    expect(result.parallelSigners).toHaveLength(0);
    expect(result.selectedAssistant).toBe('');
    expect(result.selectedDeputy).toBe('');
  });

  it('user_id ไม่พบใน profiles → ข้าม', () => {
    const config: ParallelSignerConfig = {
      enabled: true,
      signer_user_ids: ['nonexistent-id', 'teacher-a'],
    };

    const result = splitParallelAndAdmins(config, profiles);

    expect(result.parallelSigners).toHaveLength(1);
    expect(result.parallelSigners[0].user_id).toBe('teacher-a');
  });
});

// =============================================
// buildAllSigners
// =============================================
describe('buildAllSigners', () => {
  const baseSigner = (role: string, uid: string, name: string): Signer => ({
    order: 0, user_id: uid, name, position: role, role,
  });

  it('ไม่มี parallel → return signers เดิม', () => {
    const signers: Signer[] = [
      baseSigner('author', 'author-1', 'วัชรพล'),
      baseSigner('director', 'director-1', 'กาญจนา'),
    ];

    const result = buildAllSigners(signers, [], profiles);
    expect(result).toHaveLength(2);
  });

  it('มี parallel → แทรกหลัง author, ก่อน admin', () => {
    const signers: Signer[] = [
      baseSigner('author', 'author-1', 'วัชรพล'),
      baseSigner('deputy_director', 'deputy-1', 'ภาราดา'),
      baseSigner('director', 'director-1', 'กาญจนา'),
    ];

    const parallel: ParallelSigner[] = [
      { user_id: 'teacher-a', name: 'ภิชดา', require_annotation: false },
    ];

    const result = buildAllSigners(signers, parallel, profiles);

    expect(result).toHaveLength(4); // author + parallel + deputy + director
    expect(result[0].role).toBe('author');
    expect(result[1].role).toBe('parallel_signer');
    expect(result[2].role).toBe('deputy_director');
    expect(result[3].role).toBe('director');
  });

  it('parallel ที่ซ้ำกับ admin ถูกกรองออก', () => {
    const signers: Signer[] = [
      baseSigner('author', 'author-1', 'วัชรพล'),
      baseSigner('deputy_director', 'deputy-1', 'ภาราดา'), // อยู่ใน dropdown แล้ว
      baseSigner('director', 'director-1', 'กาญจนา'),
    ];

    // ภาราดา ซ้ำทั้ง parallel และ dropdown
    const parallel: ParallelSigner[] = [
      { user_id: 'teacher-a', name: 'ภิชดา', require_annotation: false },
      { user_id: 'deputy-1', name: 'ภาราดา', require_annotation: false }, // ซ้ำ!
    ];

    const result = buildAllSigners(signers, parallel, profiles);

    // ภาราดาต้องไม่ซ้ำ
    const userIds = result.map(s => s.user_id);
    expect(userIds.filter(id => id === 'deputy-1')).toHaveLength(1); // แค่ 1 ครั้ง

    expect(result).toHaveLength(4); // author + teacher-a + deputy + director (ไม่มี ภาราดา ซ้ำ)
  });

  it('parallel ทุกคนซ้ำกับ admin → return signers เดิม', () => {
    const signers: Signer[] = [
      baseSigner('author', 'author-1', 'วัชรพล'),
      baseSigner('deputy_director', 'deputy-1', 'ภาราดา'),
      baseSigner('director', 'director-1', 'กาญจนา'),
    ];

    const parallel: ParallelSigner[] = [
      { user_id: 'deputy-1', name: 'ภาราดา', require_annotation: false },
      { user_id: 'director-1', name: 'กาญจนา', require_annotation: false },
    ];

    const result = buildAllSigners(signers, parallel, profiles);

    expect(result).toHaveLength(3); // เหมือน signers เดิม ไม่มี parallel เพิ่ม
  });
});

// =============================================
// findFirstAdminIndex
// =============================================
describe('findFirstAdminIndex', () => {
  const baseSigner = (role: string): Signer => ({
    order: 0, user_id: '', name: '', position: '', role,
  });

  it('หา assistant_director คนแรก', () => {
    const signers = [baseSigner('author'), baseSigner('parallel_signer'), baseSigner('assistant_director'), baseSigner('director')];
    expect(findFirstAdminIndex(signers)).toBe(2);
  });

  it('ไม่มี admin → return -1', () => {
    const signers = [baseSigner('author'), baseSigner('parallel_signer')];
    expect(findFirstAdminIndex(signers)).toBe(-1);
  });

  it('admin คนแรกเป็น director', () => {
    const signers = [baseSigner('author'), baseSigner('director')];
    expect(findFirstAdminIndex(signers)).toBe(1);
  });

  it('ข้าม author และ parallel_signer', () => {
    const signers = [baseSigner('author'), baseSigner('parallel_signer'), baseSigner('parallel_signer'), baseSigner('deputy_director')];
    expect(findFirstAdminIndex(signers)).toBe(3);
  });
});
